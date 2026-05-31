<?php

namespace App\Http\Controllers;

use App\Http\Resources\BookingSummaryResource;
use App\Http\Resources\PaymentResource;
use App\Mail\BookingContinuationReminder;
use App\Models\AuditLog;
use App\Models\Booking;
use App\Models\BookingHistoryNote;
use App\Models\BusinessRule;
use App\Models\CalendarAvailabilityOverride;
use App\Models\Conversation;
use App\Models\MenuItem;
use App\Models\Message;
use App\Models\Payment;
use App\Notifications\ClientMenuUpdatedNotification;
use App\Notifications\NewBookingNotification;
use App\Notifications\StaffMenuUpdatedNotification;
use App\Services\BookingManagementService;
use App\Services\BookingValidationService;
use App\Services\BusinessRulesService;
use App\Services\CalendarAvailabilityService;
use App\Services\ConversionEventService;
use App\Services\NotificationRecipientService;
use App\Services\OperationalBroadcastService;
use App\Services\PaymentCalculationService;
use App\Services\PaymentEventService;
use App\Services\UploadRegistryService;
use App\Support\AuditContext;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Ported from: server/controllers/bookingController.js
 * Handles booking CRUD, availability checks, and payment recording.
 */
class BookingController extends Controller
{
    /**
     * Create a new booking.
     * Ported from: bookingController.createBooking()
     *
     * Business rules enforced:
     * - MAX_EVENTS_PER_DAY = 10
     * - MAX_PAX_PER_DAY = 3500
     * - Auto-generates 3-tier payment schedule (10% / 70% / 20%)
     */
    public function store(Request $request)
    {
        $request->validate([
            'user_id' => 'nullable|exists:users,id',
            'event_date' => 'required|date',
            'event_time' => 'required|string',
            'pax' => 'required|integer|min:1',
            'budget' => 'nullable|numeric',
            'package_id' => 'nullable|string',
            'event_type' => 'nullable|string',
            'event_name' => 'required|string|max:255',
            'menu_items' => 'nullable|array',
            'total_cost' => 'nullable|numeric',
        ]);

        // ─── Apply Business Rule Validation ───
        // Validates: lead time, capacity per day, pax limits
        try {
            BookingValidationService::validateBookingConstraints([
                'event_date' => $request->event_date,
                'pax' => $request->pax,
            ]);
        } catch (ValidationException $e) {
            return response()->json(['errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error("Booking validation error: {$e->getMessage()}");

            return response()->json(['error' => $e->getMessage()], 500);
        }

        // ─── Verify Price Accuracy ───
        // Prevents client-side price manipulation
        if ($request->has('menu_items') && $request->has('total_cost')) {
            try {
                $isAccurate = BookingValidationService::verifyCostAccuracy(
                    (float) $request->total_cost,
                    $request->menu_items,
                    (int) $request->pax
                );

                if (! $isAccurate) {
                    Log::warning('Potential price manipulation detected for user '.Auth::id());

                    return response()->json([
                        'error' => 'Price calculation mismatch. Please refresh and try again.',
                        'recalculated_total' => BookingValidationService::calculateTotalCost(
                            $request->menu_items,
                            (int) $request->pax
                        ),
                    ], 422);
                }
            } catch (\Exception $e) {
                Log::error("Price verification failed: {$e->getMessage()}");

                return response()->json(['error' => 'Unable to verify pricing'], 500);
            }
        }

        $eventDate = $request->event_date;
        $pax = (int) $request->pax;

        $outsourcedServices = $this->normalizeJsonPayload($request->outsourced_services);
        $selectedMenu = $this->normalizeJsonPayload($request->selected_menu);

        // 4. Insert Booking
        $booking = Booking::create([
            'user_id' => Auth::id(),
            'event_date' => $eventDate,
            'event_time' => $request->event_time,
            'pax' => $pax,
            'budget' => $request->budget,
            'package_id' => $request->package_id,
            'event_type' => $request->event_type,
            'event_name' => $request->event_name,
            'client_full_name' => $request->client_full_name,
            'venue_address_line' => $request->venue_address_line,
            'venue_street' => $request->venue_street,
            'venue_city' => $request->venue_city,
            'venue_province' => $request->venue_province,
            'venue_zip_code' => $request->venue_zip_code,
            'client_email' => $request->client_email,
            'client_phone' => $request->client_phone,
            'total_cost' => $request->total_cost ?? $request->budget,
            'outsourced_services' => $outsourcedServices,
            'selected_menu' => $selectedMenu,
            'venue_building_details' => $request->venue_building_details,
            'transport_fee' => $request->transport_fee ?? 0,
            'labor_surcharge' => $request->labor_surcharge ?? 0,
            'review_status' => 'Submitted',
            'expires_at' => now()->addHours(24), // Phase 1: Slot Expiration
        ]);

        ConversionEventService::record('booking_submitted', [
            'booking' => $booking,
            'source' => 'customer_wizard',
            'step' => 'review',
            'metadata' => [
                'event_type' => $booking->event_type,
                'pax' => $booking->pax,
                'total_cost' => (float) ($booking->total_cost ?? 0),
                'has_menu' => ! empty($selectedMenu),
            ],
        ]);

        foreach ([
            'Confirm date and capacity',
            'Review package and menu fit',
            'Check venue location and access',
            'Confirm payment schedule',
            'Check tasting preference',
        ] as $label) {
            $booking->reviewTasks()->create([
                'task_type' => 'review',
                'label' => $label,
                'status' => 'Pending',
                'customer_visible' => false,
            ]);
        }

        // 5. Auto-generate dynamic payment schedule using PaymentCalculationService
        $cost = (float) ($request->total_cost ?? $request->budget ?? 0);

        if ($cost > 0) {
            try {
                $paymentService = new PaymentCalculationService;
                $tranches = $paymentService->calculateTranches($booking);

                foreach ($tranches as $tranche) {
                    Payment::create([
                        'booking_id' => $booking->id,
                        'amount' => $tranche['amount'],
                        'payment_method' => 'Pending',
                        'status' => 'Pending',
                        'payment_type' => $tranche['name'],
                        'due_date' => Carbon::parse($tranche['due_date'])->toDateString(),
                    ]);
                }

                Log::info("Created dynamic payment schedule for booking #{$booking->id}");
            } catch (\Exception $e) {
                Log::error("Payment schedule creation failed (booking still created): {$e->getMessage()}");
            }
        }

        // ─── Send Notifications ───
        try {
            // Notify admins/marketing of new booking
            app(NotificationRecipientService::class)
                ->sendToRoles(['Admin', 'Marketing'], new NewBookingNotification($booking), 'new_booking');
        } catch (\Exception $e) {
            Log::error("Notification sending failed: {$e->getMessage()}");
            // Don't fail the booking if notifications fail
        }
        app(OperationalBroadcastService::class)
            ->bookingChanged($booking->fresh(), 'created', 'New booking submitted.');

        return response()->json([
            'message' => 'Booking created successfully!',
            'bookingId' => $booking->id,
        ], 201);
    }

    public function respondToClarification(Request $request, int $id)
    {
        $data = $request->validate([
            'response' => ['required', 'string', 'min:3', 'max:3000'],
        ]);

        $booking = Booking::where('id', $id)
            ->where('user_id', Auth::id())
            ->first();

        if (! $booking) {
            return response()->json(['message' => 'Booking not found.'], 404);
        }

        if (! $booking->clarification_request) {
            return response()->json(['message' => 'No details are being requested for this booking right now.'], 422);
        }

        $booking->update([
            'clarification_response' => $data['response'],
            'clarification_responded_at' => now(),
            'review_status' => 'Clarification Received',
        ]);

        ConversionEventService::record('clarification_responded', [
            'booking' => $booking,
            'source' => 'customer_dashboard',
            'metadata' => [
                'response_length' => mb_strlen($data['response']),
                'review_status' => 'Clarification Received',
            ],
        ]);

        $booking->reviewTasks()
            ->where('task_type', 'clarification')
            ->whereRaw('customer_visible is true')
            ->whereIn('status', ['Pending', 'Needs Customer'])
            ->latest()
            ->first()
            ?->update([
                'status' => 'Customer Responded',
                'customer_response' => $data['response'],
            ]);

        try {
            app(NotificationRecipientService::class)
                ->sendToRoles(['Admin', 'Marketing'], new NewBookingNotification($booking), 'clarification_received');
        } catch (\Throwable $e) {
            Log::warning('Clarification response notification failed.', [
                'booking_id' => $booking->id,
                'error' => $e->getMessage(),
            ]);
        }
        app(OperationalBroadcastService::class)
            ->bookingChanged($booking->fresh(), 'clarification_received', 'Customer sent requested booking details.');

        return response()->json([
            'message' => 'Your response was sent to the team.',
            'booking' => $booking->fresh(['reviewTasks']),
        ]);
    }

    /**
     * Send a gentle continuation email when a logged-in client leaves a meaningful booking draft.
     */
    public function sendAbandonedReminder(Request $request)
    {
        $user = Auth::user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $data = $request->validate([
            'step' => 'required|integer|min:2|max:6',
            'event_date' => 'nullable|date',
            'event_time' => 'nullable|string|max:20',
            'event_type' => 'nullable|string|max:120',
            'pax' => 'nullable|integer|min:1|max:5000',
            'client_email' => 'nullable|email|max:255',
            'client_full_name' => 'nullable|string|max:255',
            'total_cost' => 'nullable|numeric|min:0',
        ]);

        $email = $data['client_email'] ?? $user->email;
        if (! $email) {
            return response()->json(['message' => 'No customer email available.'], 202);
        }

        $draftSignature = sha1(implode('|', [
            $user->id,
            $data['step'],
            $data['event_date'] ?? '',
            $data['event_type'] ?? '',
            $data['pax'] ?? '',
        ]));
        $cacheKey = "booking.abandoned_reminder.{$draftSignature}";

        if (Cache::has($cacheKey)) {
            return response()->json(['message' => 'Reminder already sent for this draft.']);
        }

        try {
            Mail::to($email)->send(new BookingContinuationReminder($user, $data));
            Cache::put($cacheKey, true, now()->addHours(6));
            ConversionEventService::record('abandoned_booking_reminder_sent', [
                'user' => $user,
                'source' => 'booking_draft',
                'step' => (string) $data['step'],
                'metadata' => [
                    'event_type' => $data['event_type'] ?? null,
                    'has_event_date' => filled($data['event_date'] ?? null),
                    'has_total' => isset($data['total_cost']),
                ],
            ]);
        } catch (\Throwable $e) {
            Log::warning('Booking continuation reminder failed.', [
                'user_id' => $user->id,
                'email' => $email,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Reminder could not be sent right now.'], 202);
        }

        return response()->json(['message' => 'Continuation reminder sent.']);
    }

    /**
     * GET /api/bookings/disabled-dates
     *
     * Returns an array of all fully-booked dates (YYYY-MM-DD) within the next
     * 12 months so the React calendar can disable them on initial render.
     * Also includes dates within the 7-day lead-time window.
     */
    public function getDisabledDates(CalendarAvailabilityService $availabilityService)
    {
        // Lead-time window: today through today + 6 days are always blocked
        $today = Carbon::today();
        $rangeEnd = Carbon::today()->addMonths(12);

        $disabledDates = [];

        // Add lead-time blocked dates (0-6 days from today)
        for ($i = 0; $i < 7; $i++) {
            $disabledDates[] = $today->copy()->addDays($i)->toDateString();
        }

        $rules = BusinessRule::getActive();
        $baseMaxEvents = $rules ? (int) $rules->maximum_capacity_per_day : BusinessRulesService::MAX_EVENTS_PER_DAY;
        $baseMaxPax = BusinessRulesService::MAX_PAX_PER_DAY;

        // Query aggregate booking stats once for the full future bookable window.
        $bookingStats = DB::table('bookings')
            ->select(
                DB::raw('DATE(event_date) as booking_date'),
                DB::raw('COUNT(*) as event_count'),
                DB::raw('COALESCE(SUM(pax), 0) as total_pax')
            )
            ->where('event_date', '>', $today->toDateString())
            ->where('event_date', '<=', $rangeEnd->toDateString())
            ->whereNotIn('status', ['Cancelled', 'cancelled'])
            ->groupBy('booking_date')
            ->get()
            ->keyBy(fn ($stat) => Carbon::parse($stat->booking_date)->toDateString());

        $overrides = CalendarAvailabilityOverride::query()
            ->where('date', '>', $today->toDateString())
            ->where('date', '<=', $rangeEnd->toDateString())
            ->get()
            ->keyBy(fn (CalendarAvailabilityOverride $override) => $override->date->toDateString());

        $candidateDates = $bookingStats->keys()
            ->merge($overrides->keys())
            ->unique();

        foreach ($candidateDates as $dateString) {
            $stat = $bookingStats->get($dateString);
            $override = $overrides->get($dateString);
            $currentEvents = (int) ($stat->event_count ?? 0);
            $currentPax = (int) ($stat->total_pax ?? 0);
            $maxEvents = $override?->max_events_override ?? $baseMaxEvents;
            $maxPax = $override?->max_pax_override ?? $baseMaxPax;
            $isLocked = (bool) ($override?->is_locked ?? false);

            if ($isLocked || $currentEvents >= $maxEvents || $currentPax >= $maxPax) {
                $disabledDates[] = $dateString;
            }
        }

        return response()->json([
            'disabled_dates' => array_values(array_unique($disabledDates)),
        ]);
    }

    /**
     * Check availability for a specific date.
     * Ported from: bookingController.checkAvailability()
     */
    public function checkAvailability(string $date, CalendarAvailabilityService $availabilityService)
    {
        $availability = $availabilityService->availabilityForDate($date);
        unset($availability['override']);

        return response()->json($availability);
    }

    /**
     * Update event details from dashboard.
     * Ported from: bookingController.updateEventDetails()
     */
    public function updateEventDetails(Request $request, int $id)
    {
        $userId = Auth::id();

        $booking = Booking::where('id', $id)->where('user_id', $userId)->first();

        if (! $booking) {
            return response()->json(['error' => 'Booking not found.'], 404);
        }

        if (in_array($booking->status, ['Cancelled', 'cancelled', 'Completed', 'completed'], true)) {
            return response()->json(['error' => 'This booking can no longer be edited.'], 400);
        }

        $themeUploads = $request->theme_uploads;
        if (is_array($themeUploads)) {
            $themeUploads = json_encode($themeUploads);
        }

        app(UploadRegistryService::class)
            ->attachBookingThemeUploads($booking, $themeUploads, $request->user());

        $booking->update([
            'reservation_time' => $request->reservation_time,
            'serving_time' => $request->serving_time,
            'event_timeline' => $request->event_timeline,
            'color_motif' => $request->color_motif,
            'theme_uploads' => $themeUploads,
            'special_instructions' => $request->special_instructions,
            'venue_building_details' => $request->venue_building_details,
            'selected_menu' => $request->has('selected_menu')
                ? $this->normalizeJsonPayload($request->selected_menu)
                : $booking->selected_menu,
        ]);

        $conversation = Conversation::where('booking_id', $booking->id)
            ->where('client_id', $userId)
            ->where('status', 'active')
            ->first();

        if ($conversation) {
            Message::create([
                'conversation_id' => $conversation->id,
                'sender_id' => $userId,
                'receiver_id' => $conversation->staff_id ?: $userId,
                'message' => 'Booking details were updated.',
                'message_type' => 'system',
                'metadata' => ['booking_id' => $booking->id, 'event' => 'booking_details_updated'],
            ]);
        }

        app(OperationalBroadcastService::class)
            ->bookingChanged($booking->fresh(), 'event_details_updated', 'Booking details updated.');

        return response()->json(['message' => 'Event details updated successfully!']);
    }

    /**
     * Update selected dishes while preserving payment integrity.
     * Server recalculates with current menu prices, updates total_cost, and redistributes
     * unpaid tranches only. Verified payments are never modified.
     */
    public function updateMenu(Request $request, int $id)
    {
        $userId = Auth::id();

        $booking = Booking::where('id', $id)->where('user_id', $userId)->first();

        if (! $booking) {
            return response()->json(['error' => 'Booking not found.'], 404);
        }

        if (in_array($booking->status, ['Cancelled', 'cancelled', 'Completed', 'completed'], true)) {
            return response()->json(['error' => 'This booking can no longer be edited.'], 400);
        }

        $bookingService = new BookingManagementService;
        if (! $bookingService->canEditMenu($booking)) {
            return response()->json(['error' => 'Menu changes are locked within 30 days of the event.'], 400);
        }

        $validated = $request->validate([
            'selected_menu' => 'required|array',
        ]);

        $selectedMenu = $validated['selected_menu'];
        $menuItemIds = collect($selectedMenu)
            ->flatMap(fn ($items) => is_array($items) ? $items : [])
            ->map(function ($item) {
                if (is_array($item)) {
                    return $item['id'] ?? null;
                }

                return $item;
            })
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->values();

        if ($menuItemIds->isEmpty()) {
            return response()->json(['error' => 'Please select at least one dish.'], 422);
        }

        $menuItems = MenuItem::whereIn('id', $menuItemIds)->whereRaw('is_active is true')->get()->keyBy('id');
        if ($menuItems->count() !== $menuItemIds->unique()->count()) {
            return response()->json(['error' => 'One or more selected dishes are unavailable. Please refresh your menu.'], 422);
        }

        $oldTotal = (float) ($booking->total_cost ?? $booking->budget ?? 0);
        $newTotal = $menuItemIds->reduce(function ($sum, $itemId) use ($menuItems, $booking) {
            $item = $menuItems[$itemId];

            return $sum + (($item->cost_per_head + ($item->price_adj ?? 0)) * (int) $booking->pax);
        }, 0);

        DB::transaction(function () use ($booking, $selectedMenu, $newTotal) {
            $paidTotal = $booking->payments()
                ->active()
                ->whereIn('status', ['Paid', 'Verified'])
                ->sum('amount');

            $pendingPayments = $booking->payments()
                ->active()
                ->whereIn('status', ['Pending', 'Failed', 'Rejected'])
                ->orderByRaw("CASE payment_type WHEN 'Reservation' THEN 1 WHEN 'DownPayment' THEN 2 WHEN 'Final' THEN 3 ELSE 4 END")
                ->get();

            $remaining = max($newTotal - (float) $paidTotal, 0);
            $pendingTotal = (float) $pendingPayments->sum('amount');

            foreach ($pendingPayments as $index => $payment) {
                if ($remaining <= 0) {
                    $payment->update(['amount' => 0]);

                    continue;
                }

                if ($index === $pendingPayments->count() - 1) {
                    $amount = $remaining;
                } elseif ($pendingTotal > 0) {
                    $amount = round($remaining * ((float) $payment->amount / $pendingTotal), 2);
                } else {
                    $amount = round($remaining / max($pendingPayments->count(), 1), 2);
                }

                $payment->update(['amount' => $amount]);
                $remaining -= $amount;
            }

            $booking->update([
                'selected_menu' => $selectedMenu,
                'total_cost' => $newTotal,
                'live_status' => $paidTotal > $newTotal ? 'Credit Review' : $booking->live_status,
            ]);
        });

        $booking->refresh()->load('user');
        app(NotificationRecipientService::class)
            ->sendToUser($booking->user, new ClientMenuUpdatedNotification($booking, $newTotal), 'client_menu_updated');

        app(NotificationRecipientService::class)
            ->sendToRoles(['Marketing', 'Accounting', 'Admin'], new StaffMenuUpdatedNotification($booking, $newTotal, $oldTotal), 'staff_menu_updated');

        $this->recordCustomerMenuUpdate($request, $booking, $oldTotal, (float) $newTotal);
        app(OperationalBroadcastService::class)
            ->bookingChanged($booking->fresh(), 'menu_updated', 'Menu and pricing updated.');

        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'Menu updated and pricing recalculated.',
                'total_cost' => $newTotal,
                'booking' => new BookingSummaryResource($booking->fresh(['user', 'assignee', 'reviewTasks', 'preparationTasks', 'payments'])),
            ]);
        }

        return back();
    }

    private function recalculateMenuPricingForBooking(Booking $booking, int $oldPax, float $oldTotal): ?array
    {
        $selectedMenu = $booking->selected_menu_array ?: [];
        $menuItemIds = $this->selectedMenuItemIds($selectedMenu);

        if ($menuItemIds->isEmpty()) {
            return null;
        }

        $menuItems = MenuItem::whereIn('id', $menuItemIds)
            ->whereRaw('is_active is true')
            ->get()
            ->keyBy('id');

        if ($menuItems->isEmpty()) {
            return null;
        }

        $newTotal = $menuItemIds->reduce(function ($sum, $itemId) use ($menuItems, $booking) {
            if (! isset($menuItems[$itemId])) {
                return $sum;
            }

            $item = $menuItems[$itemId];

            return $sum + (((float) $item->cost_per_head + (float) ($item->price_adj ?? 0)) * (int) $booking->pax);
        }, 0.0);

        $affectedPayments = [];
        $paidTotal = 0.0;

        DB::transaction(function () use ($booking, $newTotal, &$affectedPayments, &$paidTotal) {
            $paidTotal = (float) $booking->payments()
                ->active()
                ->whereIn('status', ['Paid', 'Verified'])
                ->sum('amount');

            $pendingPayments = $booking->payments()
                ->active()
                ->whereIn('status', ['Pending', 'Failed', 'Rejected'])
                ->orderByRaw("CASE payment_type WHEN 'Reservation' THEN 1 WHEN 'DownPayment' THEN 2 WHEN 'Final' THEN 3 ELSE 4 END")
                ->get();

            $remaining = max($newTotal - $paidTotal, 0);
            $pendingTotal = (float) $pendingPayments->sum('amount');

            foreach ($pendingPayments as $index => $payment) {
                $oldAmount = (float) $payment->amount;

                if ($remaining <= 0) {
                    $amount = 0;
                } elseif ($index === $pendingPayments->count() - 1) {
                    $amount = round($remaining, 2);
                } elseif ($pendingTotal > 0) {
                    $amount = round($remaining * ($oldAmount / $pendingTotal), 2);
                } else {
                    $amount = round($remaining / max($pendingPayments->count(), 1), 2);
                }

                $payment->update(['amount' => $amount]);
                $remaining -= $amount;

                if (round($oldAmount, 2) !== round($amount, 2)) {
                    $affectedPayments[] = [
                        'id' => $payment->id,
                        'payment_type' => $payment->payment_type,
                        'old_amount' => round($oldAmount, 2),
                        'new_amount' => round($amount, 2),
                    ];
                }
            }

            $booking->update([
                'total_cost' => $newTotal,
                'live_status' => $paidTotal > $newTotal ? 'Credit Review' : $booking->live_status,
            ]);
        });

        $booking->refresh();

        return [
            'old_pax' => $oldPax,
            'new_pax' => (int) $booking->pax,
            'old_total' => round($oldTotal, 2),
            'new_total' => round((float) $newTotal, 2),
            'paid_total' => round($paidTotal, 2),
            'remaining_balance' => round(max((float) $newTotal - $paidTotal, 0), 2),
            'affected_payments' => $affectedPayments,
        ];
    }

    private function selectedMenuItemIds(array $selectedMenu): Collection
    {
        return collect($selectedMenu)
            ->flatMap(fn ($items) => is_array($items) ? $items : [])
            ->map(function ($item) {
                if (is_array($item)) {
                    return $item['id'] ?? null;
                }

                return $item;
            })
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->values();
    }

    private function recordCustomerMenuUpdate(Request $request, Booking $booking, float $oldTotal, float $newTotal): void
    {
        $note = 'Menu updated by customer. Event total changed from PHP '.number_format($oldTotal, 2).' to PHP '.number_format($newTotal, 2).'.';

        try {
            if (Schema::hasTable('booking_history_notes')) {
                BookingHistoryNote::create([
                    'booking_id' => $booking->id,
                    'user_id' => Auth::id(),
                    'body' => $note,
                ]);
            }

            Conversation::where('booking_id', $booking->id)
                ->where('status', 'active')
                ->each(function (Conversation $conversation) use ($booking, $oldTotal, $newTotal) {
                    Message::create([
                        'conversation_id' => $conversation->id,
                        'sender_id' => Auth::id() ?: $conversation->client_id,
                        'receiver_id' => $conversation->staff_id ?: $conversation->client_id,
                        'message' => 'Booking menu was updated by the customer.',
                        'message_type' => 'system',
                        'metadata' => [
                            'type' => 'customer_menu_updated',
                            'booking_id' => $booking->id,
                            'old_total' => $oldTotal,
                            'new_total' => $newTotal,
                        ],
                    ]);
                });

            if (Schema::hasTable('audit_logs')) {
                AuditLog::create([
                    'user_id' => Auth::id(),
                    'username' => $request->user()?->username,
                    'role' => $request->user()?->role,
                    'action' => 'Menu updated by customer',
                    'method' => $request->method(),
                    'path' => '/'.ltrim($request->path(), '/'),
                    'status_code' => 200,
                    'ip_address' => $request->ip(),
                    'user_agent' => substr((string) $request->userAgent(), 0, 500),
                    'metadata' => AuditContext::forRequest($request, null, [
                        'target_type' => 'booking',
                        'target_id' => $booking->id,
                        'booking_id' => $booking->id,
                        'changed_fields' => ['selected_menu', 'total_cost'],
                    ]),
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('Unable to record customer menu update activity.', [
                'booking_id' => $booking->id,
                'message' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Hide an inactive booking from the customer's own history without deleting business records.
     */
    public function hideFromHistory(int $id)
    {
        $userId = Auth::id();
        $booking = Booking::with(['payments' => fn ($query) => $query->active(), 'refundCases', 'preparationTasks'])
            ->where('id', $id)
            ->where('user_id', $userId)
            ->first();

        if (! $booking) {
            return response()->json(['error' => 'Booking not found.'], 404);
        }

        $status = strtolower((string) $booking->status);
        $eventDate = $booking->event_date ? Carbon::parse($booking->event_date)->startOfDay() : null;
        $isInactive = in_array($status, ['cancelled', 'canceled', 'completed', 'expired'], true)
            || ($eventDate && $eventDate->isPast() && ! in_array($status, ['pending', 'confirmed'], true));
        $hasOpenPayments = $booking->payments->contains(fn ($payment) => ! in_array($payment->status, ['Paid', 'Verified', 'Refunded'], true));
        $hasOpenRefunds = $booking->refundCases->contains(fn ($case) => ! in_array($case->status, ['Refunded', 'Completed', 'Closed', 'Manual Refunded', 'Forfeited', 'No Refund Due', 'Rejected', 'Cancelled'], true));
        $hasOpenPreparation = $booking->preparationTasks->contains(fn ($task) => ! in_array($task->status, ['Done', 'Completed', 'done', 'completed'], true));

        if (! $isInactive || $hasOpenPayments || $hasOpenRefunds || $hasOpenPreparation) {
            return response()->json([
                'error' => 'Only inactive bookings with no open payment, refund, or preparation work can be hidden from history.',
            ], 422);
        }

        $booking->forceFill(['hidden_from_customer_history_at' => now()])->save();

        return response()->json(['message' => 'Booking hidden from your history.']);
    }

    public function removeHistory(int $id)
    {
        return $this->hideFromHistory($id);
    }

    /**
     * Cancel a booking (only if 7+ days before event).
     * Ported from: bookingController.cancelBooking()
     */
    public function cancel(Request $request, int $id)
    {
        $reasonOptions = $this->cancellationReasonOptions();
        $validated = $request->validate([
            'cancellation_reason' => ['required', 'string', Rule::in(array_keys($reasonOptions))],
            'cancellation_reason_details' => ['nullable', 'string', 'max:1000', 'required_if:cancellation_reason,other'],
        ]);

        $userId = Auth::id();

        $booking = Booking::where('id', $id)->where('user_id', $userId)->first();

        if (! $booking) {
            return response()->json(['error' => 'Booking not found.'], 404);
        }

        if ($booking->status === 'Cancelled') {
            return response()->json(['error' => 'Booking is already cancelled.'], 400);
        }

        // Check 7-day rule and 48-hour grace period
        $eventDate = Carbon::parse($booking->event_date);
        $daysUntilEvent = (int) ceil(now()->diffInDays($eventDate, false));
        $hoursSinceCreation = (int) ceil($booking->created_at->diffInHours(now()));

        if ($daysUntilEvent < 7 && $hoursSinceCreation > 48) {
            return response()->json(['error' => 'Cannot cancel within 7 days of the event date unless within 48 hours of booking.'], 400);
        }

        $details = trim((string) ($validated['cancellation_reason_details'] ?? ''));
        $reasonKey = $validated['cancellation_reason'];
        $reasonLabel = $reasonOptions[$reasonKey];
        $impact = app(BookingManagementService::class)->calculateCancellationImpact($booking);

        DB::transaction(function () use ($booking, $impact, $reasonKey, $reasonLabel, $details) {
            $updates = [
                'status' => 'Cancelled',
                'cancellation_reason' => $reasonKey,
                'cancellation_reason_details' => $details !== '' ? $details : null,
                'cancelled_at' => now(),
            ];

            if (($impact['refundable_amount'] ?? 0) > 0) {
                $updates['live_status'] = 'Refund Processing';
            }

            $booking->update($updates);

            PaymentEventService::record(
                'booking_cancelled_by_customer',
                'customer',
                null,
                [
                    'booking_id' => $booking->id,
                    'cancellation_reason' => $reasonKey,
                    'cancellation_reason_label' => $reasonLabel,
                    'cancellation_reason_details' => $details !== '' ? $details : null,
                    'refund_preview' => $impact,
                ],
                bookingId: $booking->id
            );
        });

        app(OperationalBroadcastService::class)
            ->bookingChanged($booking->fresh(), 'cancelled', 'Booking cancelled.');

        return response()->json([
            'message' => 'Booking cancelled successfully. Accounting will review any eligible refund.',
            'refund_preview' => $impact,
            'cancellation_reason' => [
                'value' => $reasonKey,
                'label' => $reasonLabel,
                'details' => $details !== '' ? $details : null,
            ],
        ]);
    }

    private function cancellationReasonOptions(): array
    {
        return [
            'schedule_conflict' => 'Schedule conflict',
            'event_postponed' => 'Event postponed',
            'budget_or_payment_concern' => 'Budget or payment concern',
            'venue_unavailable' => 'Venue unavailable',
            'guest_count_changed' => 'Guest count changed',
            'changed_provider' => 'Chose another provider',
            'duplicate_or_mistake' => 'Duplicate or mistaken booking',
            'emergency_or_personal_reason' => 'Emergency or personal reason',
            'other' => 'Other',
        ];
    }

    /**
     * Update booking details via modal (only if 7+ days before event).
     * Ported from: bookingController.updateBooking()
     */
    public function update(Request $request, int $id)
    {
        $userId = Auth::id();

        $booking = Booking::where('id', $id)->where('user_id', $userId)->first();

        if (! $booking) {
            return response()->json(['error' => 'Booking not found.'], 404);
        }

        if (in_array($booking->status, ['Cancelled', 'cancelled', 'Completed', 'completed'], true)) {
            return response()->json(['error' => 'This booking can no longer be edited.'], 400);
        }

        // Check 7-day rule and 48-hour grace period
        $eventDate = Carbon::parse($booking->event_date);
        $daysUntilEvent = (int) ceil(now()->diffInDays($eventDate, false));
        $hoursSinceCreation = (int) ceil($booking->created_at->diffInHours(now()));

        if ($daysUntilEvent < 7 && $hoursSinceCreation > 48) {
            return response()->json(['error' => 'Cannot edit within 7 days of the event date unless within 48 hours of booking.'], 400);
        }

        // Only update provided fields (COALESCE equivalent)
        $fields = [
            'event_date', 'event_time', 'pax', 'event_name',
            'client_full_name', 'venue_address_line', 'venue_street',
            'venue_city', 'venue_province', 'venue_zip_code',
            'client_email', 'client_phone',
        ];

        $updates = [];
        foreach ($fields as $field) {
            if ($request->has($field) && $request->$field !== null) {
                $updates[$field] = $request->$field;
            }
        }

        $pricingChange = null;
        if (! empty($updates)) {
            try {
                if (array_key_exists('event_date', $updates) || array_key_exists('pax', $updates)) {
                    BookingValidationService::validateBookingConstraints([
                        'event_date' => $updates['event_date'] ?? $booking->event_date,
                        'pax' => $updates['pax'] ?? $booking->pax,
                    ], $booking);
                }
            } catch (ValidationException $e) {
                return response()->json(['errors' => $e->errors()], 422);
            } catch (\Exception $e) {
                Log::error("Booking update validation error: {$e->getMessage()}");

                return response()->json(['error' => $e->getMessage()], 500);
            }

            $oldPax = (int) $booking->pax;
            $oldTotal = (float) ($booking->total_cost ?? $booking->budget ?? 0);

            $booking->update($updates);

            $pricingChange = null;
            if (array_key_exists('pax', $updates)) {
                $booking->refresh();
                $pricingChange = $this->recalculateMenuPricingForBooking($booking, $oldPax, $oldTotal);
            }
        }

        $booking->load(['user', 'assignee', 'reviewTasks', 'preparationTasks', 'payments' => fn ($query) => $query->active()]);
        app(OperationalBroadcastService::class)
            ->bookingChanged($booking->fresh(), 'updated', 'Booking details updated.');

        return response()->json([
            'message' => 'Booking updated successfully.',
            'pricing_change' => $pricingChange ?? null,
            'booking' => new BookingSummaryResource($booking),
            'payments' => PaymentResource::collection($booking->payments),
        ]);
    }

    /**
     * Record a payment (client submits payment).
     * Ported from: bookingController.recordPayment()
     */
    public function recordPayment(Request $request)
    {
        $userId = Auth::id();

        $request->validate([
            'booking_id' => 'required|integer',
            'payment_id' => 'nullable|integer',
            'payment_method' => 'nullable|string',
        ]);

        $booking = Booking::where('id', $request->booking_id)
            ->where('user_id', $userId)
            ->first();

        if (! $booking) {
            return response()->json(['error' => 'Booking not found.'], 404);
        }

        $payment = null;
        if ($request->filled('payment_id')) {
            $payment = Payment::where('id', $request->integer('payment_id'))
                ->active()
                ->where('booking_id', $booking->id)
                ->first();
        }

        PaymentEventService::record(
            'manual_payment_blocked',
            'customer',
            $payment,
            [
                'booking_id' => $booking->id,
                'payment_id' => $request->input('payment_id'),
                'payment_method' => $request->input('payment_method'),
                'amount' => $request->input('amount'),
                'reference_number_provided' => $request->filled('reference_number'),
                'reason' => 'legacy_manual_payment_disabled',
            ],
            null,
            null,
            $booking->id
        );

        return response()->json([
            'error' => 'Manual payment confirmation is retired. Please use Secure Checkout from your dashboard or contact Accounting so a staff member can review any manual payment proof.',
        ], 410);
    }

    public function preview(Booking $booking)
    {
        $booking->load(['user', 'assignee', 'payments' => fn ($query) => $query->active(), 'reviewTasks', 'preparationTasks']);

        return response()->json([
            'preview' => true,
            'booking' => (new BookingSummaryResource($booking))->resolve(),
        ]);
    }

    private function normalizeJsonPayload(mixed $value): mixed
    {
        if (is_string($value)) {
            $decoded = json_decode($value, true);

            return json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
        }

        return $value;
    }
}
