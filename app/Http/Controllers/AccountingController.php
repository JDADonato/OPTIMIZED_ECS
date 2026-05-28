<?php

namespace App\Http\Controllers;

use App\Http\Resources\PaymentResource;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\RefundCase;
use App\Models\User;
use App\Notifications\PaymentReminderNotification;
use App\Services\BookingManagementService;
use App\Services\PaymentEventService;
use App\Support\ApiResponse;
use App\Support\ResourceVersion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;

/**
 * Accounting dashboard controller
 * 8 methods for the Accounting dashboard.
 */
class AccountingController extends Controller
{
    /**
     * Show the Accounting dashboard page.
     */
    public function index()
    {
        return Inertia::render('DashboardAccounting');
    }

    /**
     * Get all bookings with their payment schedules.
     * Ported from: accountingController.getBookingsWithPayments()
     */
    public function getBookingsWithPayments(Request $request)
    {
        $query = Booking::query()
            ->select([
                'id',
                'user_id',
                'event_date',
                'pax',
                'budget',
                'total_cost',
                'status',
                'client_full_name',
                'client_email',
                'client_phone',
                'event_name',
                'event_type',
                'created_at',
            ])
            ->with(['user:id,username', 'payments' => function ($q) {
                $q->select([
                    'id',
                    'booking_id',
                    'amount',
                    'payment_method',
                    'status',
                    'payment_type',
                    'due_date',
                    'verified_by',
                    'verified_at',
                    'paymongo_checkout_session_id',
                    'paymongo_payment_id',
                    'paymongo_reference_number',
                ])
                  ->whereNotNull('payment_type')
                  ->orderByRaw("CASE payment_type WHEN 'Reservation' THEN 1 WHEN 'DownPayment' THEN 2 WHEN 'Final' THEN 3 ELSE 4 END")
                  ->orderBy('due_date')
                  ->orderBy('id');
            }])
            ->where('status', '!=', 'Cancelled')
            ->where('status', '!=', 'Pending'); // Do not show pending (unapproved) bookings

        if (!$request->boolean('include_completed') && $request->query('payment_status') !== 'complete') {
            $query->whereNotIn('status', ['Completed', 'completed']);
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->query('search'));
            $term = '%' . mb_strtolower($search) . '%';
            $query->where(function ($inner) use ($search, $term) {
                $inner->whereRaw('LOWER(client_full_name) LIKE ?', [$term])
                    ->orWhereHas('user', fn ($userQuery) => $userQuery->whereRaw('LOWER(username) LIKE ?', [$term]));
                if (ctype_digit($search)) {
                    $inner->orWhere('id', (int) $search);
                }
            });
        }

        if ($request->query('payment_status') === 'pending') {
            $query->whereHas('payments', fn ($paymentQuery) => $paymentQuery->whereNotIn('status', ['Paid', 'Verified']));
        } elseif ($request->query('payment_status') === 'complete') {
            $query->whereHas('payments')
                ->whereDoesntHave('payments', fn ($paymentQuery) => $paymentQuery->whereNotIn('status', ['Paid', 'Verified']));
        }

        match ($request->query('finance_segment')) {
            'needs_verification' => $query->whereHas('payments', fn ($paymentQuery) => $paymentQuery->where('status', 'Pending')),
            'overdue' => $query->whereHas('payments', fn ($paymentQuery) => $paymentQuery
                ->where('status', 'Pending')
                ->whereNotNull('due_date')
                ->whereDate('due_date', '<', now()->toDateString())),
            'upcoming' => $query->whereHas('payments', fn ($paymentQuery) => $paymentQuery
                ->where('status', 'Pending')
                ->whereNotNull('due_date')
                ->whereBetween('due_date', [now()->toDateString(), now()->addDays(7)->toDateString()])),
            default => null,
        };

        match ($request->query('sort', 'eventDateSoonest')) {
            'eventDateLatest' => $query->orderBy('event_date', 'desc'),
            'bookingNewest' => $query->orderBy('created_at', 'desc'),
            'bookingOldest' => $query->orderBy('created_at', 'asc'),
            'clientAZ' => $query->orderBy('client_full_name', 'asc'),
            'clientZA' => $query->orderBy('client_full_name', 'desc'),
            default => $query->orderBy('event_date', 'asc'),
        };

        $versionMeta = ResourceVersion::fromQuery($query);
        if (ResourceVersion::matches($request, $versionMeta)) {
            return ResourceVersion::unchanged($versionMeta);
        }

        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
        $bookings = $query->paginate($perPage)->through(function ($b) {
                $paidAmount = (float) $b->payments
                    ->whereIn('status', ['Paid', 'Verified'])
                    ->sum(fn (Payment $payment) => (float) $payment->amount);
                $totalCost = (float) ($b->total_cost ?? $b->budget ?? 0);

                return array_merge($b->toArray(), [
                'totalCost' => $totalCost,
                'event_display_name' => $b->event_display_name,
                'username'  => $b->user->username ?? null,
                'paid_amount' => $paidAmount,
                'remaining_balance' => max($totalCost - $paidAmount, 0),
                'finance_state' => $b->payments->contains(fn (Payment $payment) => $payment->status === 'Pending' && $payment->due_date && $payment->due_date->isPast())
                    ? 'overdue'
                    : ($b->payments->contains(fn (Payment $payment) => $payment->status === 'Pending') ? 'needs_verification' : 'settled'),
                ]);
            });

        $payload = $bookings->toArray();
        $payload['meta'] = [
            ...($payload['meta'] ?? []),
            ...$versionMeta,
            'changed' => true,
        ];

        return response()->json($payload);
    }

    public function summary()
    {
        $approvedBookings = fn ($query) => $query->whereNotIn('status', ['Pending', 'Cancelled', 'Completed', 'completed']);

        $paymentQuery = Payment::query()
            ->whereHas('booking', $approvedBookings);

        $pending = (clone $paymentQuery)->where('status', 'Pending')->count();
        $overdue = (clone $paymentQuery)
            ->where('status', 'Pending')
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', now()->toDateString())
            ->count();
        $collected = (float) (clone $paymentQuery)
            ->whereIn('status', ['Paid', 'Verified'])
            ->sum('amount');
        $refunds = Booking::query()
            ->where('status', 'Cancelled')
            ->whereHas('payments', fn ($query) => $query->whereIn('status', ['Verified', 'Paid']))
            ->count();
        $exceptions = (clone $paymentQuery)
            ->where(function ($query) {
                $query->where(fn ($inner) => $inner->whereNotNull('paymongo_checkout_session_id')->whereNotIn('status', ['Paid', 'Verified', 'Refunded']))
                    ->orWhere(fn ($inner) => $inner->whereNotNull('paymongo_payment_id')->whereNotIn('status', ['Paid', 'Verified', 'Refunded']))
                    ->orWhere(fn ($inner) => $inner->where('status', 'Pending')->whereNotNull('due_date')->whereDate('due_date', '<', now()->toDateString()));
            })
            ->count();

        return response()->json([
            'bookings' => Booking::query()->whereNotIn('status', ['Pending', 'Cancelled', 'Completed', 'completed'])->count(),
            'pending' => $pending,
            'needs_verification' => $pending,
            'overdue' => $overdue,
            'refunds' => $refunds,
            'exceptions' => $exceptions,
            'due_soon' => (clone $paymentQuery)
                ->where('status', 'Pending')
                ->whereNotNull('due_date')
                ->whereBetween('due_date', [now()->toDateString(), now()->addDays(7)->toDateString()])
                ->count(),
            'refund_manual_review' => RefundCase::query()->whereIn('status', ['Failed', 'Manual Review'])->count(),
            'collected' => $collected,
        ]);
    }

    /**
     * Get pending payments for verification queue.
     * Ported from: accountingController.getPendingPayments()
     */
    public function getPendingPayments(Request $request)
    {
        $query = Payment::with(['booking:id,event_date,client_full_name,user_id', 'booking.user:id,username'])
            ->where('status', 'Pending')
            ->whereHas('booking', function ($q) {
                $q->where('status', '!=', 'Pending'); // Only payments for approved/confirmed bookings
            })
            ->orderBy('due_date', 'asc');

        if ($request->boolean('paginated')) {
            $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
            $payments = $query->paginate($perPage);
            $data = $payments->getCollection()
                ->map(fn ($p) => $this->paymentWithBookingContext($p))
                ->values();

            return ApiResponse::paginated($payments, $data);
        }

        $payments = $query->get()
            ->map(function ($p) {
                return $this->paymentWithBookingContext($p);
            });

        return response()->json($payments);
    }

    /**
     * Verify or reject a payment.
     * Ported from: accountingController.verifyPayment()
     */
    public function verifyPayment(Request $request, int $id)
    {
        $request->validate([
            'action' => 'required|in:Verify,Reject',
        ]);

        $newStatus = $request->action === 'Verify' ? 'Verified' : 'Rejected';
        $verifiedBy = Auth::user()->username ?? 'accounting';

        $payment = Payment::find($id);

        if (!$payment) {
            return response()->json(['error' => 'Payment not found'], 404);
        }

        $payment->update([
            'status'      => $newStatus,
            'verified_by' => $verifiedBy,
            'verified_at' => now(),
        ]);

        PaymentEventService::record(
            $newStatus === 'Verified' ? 'verified_by_accounting' : 'rejected_by_accounting',
            'accounting',
            $payment,
            [
                'action' => $request->action,
                'status' => $newStatus,
            ],
            $payment->paymongo_payment_id ?: $payment->paymongo_checkout_session_id
        );

        // ─── Send notification to the client ───
        try {
            $booking = Booking::find($payment->booking_id);
            if ($booking && $newStatus === 'Verified') {
                $client = \App\Models\User::find($booking->user_id);
                if ($client) {
                    $client->notify(new \App\Notifications\PaymentApprovedNotification(
                        $booking,
                        $payment->payment_type,
                        (float) $payment->amount
                    ));
                }
            }
        } catch (\Exception $e) {
            Log::error("Notification failed on payment verify: {$e->getMessage()}");
        }

        return response()->json(['success' => true, 'message' => "Payment {$newStatus}"]);
    }

    /**
     * Update payment term (amount, due_date).
     * Ported from: accountingController.updatePayment()
     */
    public function updatePayment(Request $request, int $id)
    {
        $request->validate([
            'amount'   => 'required|numeric',
            'due_date' => 'required|date',
        ]);

        $payment = Payment::find($id);

        if (!$payment) {
            return response()->json(['error' => 'Payment not found'], 404);
        }

        if (in_array($payment->status, ['Verified', 'Paid', 'Refunded'], true)) {
            return response()->json(['error' => 'Verified, paid, or refunded payment terms cannot be modified.'], 422);
        }

        $payment->update([
            'amount'   => $request->amount,
            'due_date' => $request->due_date,
        ]);

        return response()->json(['success' => true, 'message' => 'Payment updated successfully']);
    }

    public function updateBookingPaymentTerms(Request $request, int $id)
    {
        $data = $request->validate([
            'terms' => 'required|array|min:1',
            'terms.*.id' => 'nullable|integer|exists:payments,id',
            'terms.*.payment_type' => 'required|string|max:255',
            'terms.*.percentage' => 'required|numeric|min:0.01|max:100',
            'terms.*.due_date' => 'required|date',
        ]);

        $booking = Booking::with('payments')->find($id);
        if (!$booking) {
            return response()->json(['error' => 'Booking not found'], 404);
        }

        $totalPercentage = collect($data['terms'])->sum(fn ($term) => (float) $term['percentage']);
        if (round($totalPercentage, 2) !== 100.00) {
            return response()->json(['error' => 'Payment term percentages must total 100%.'], 422);
        }

        $totalCost = (float) ($booking->total_cost ?? $booking->budget ?? 0);
        if ($totalCost <= 0) {
            return response()->json(['error' => 'Booking total must be greater than zero before payment terms can be edited.'], 422);
        }

        $existingIds = $booking->payments->pluck('id')->all();
        $incomingIds = collect($data['terms'])->pluck('id')->filter()->map(fn ($id) => (int) $id)->all();

        foreach ($incomingIds as $paymentId) {
            if (!in_array($paymentId, $existingIds, true)) {
                return response()->json(['error' => 'One or more payment terms do not belong to this booking.'], 422);
            }
        }

        $lockedPaymentIds = $booking->payments
            ->whereIn('status', ['Verified', 'Paid', 'Refunded'])
            ->pluck('id')
            ->all();

        foreach ($lockedPaymentIds as $lockedPaymentId) {
            if (!in_array($lockedPaymentId, $incomingIds, true)) {
                return response()->json(['error' => 'Verified, paid, or refunded payment terms must remain in the schedule.'], 422);
            }
        }

        DB::transaction(function () use ($booking, $data, $totalCost, $incomingIds) {
            $stalePayments = $booking->payments();
            if (!empty($incomingIds)) {
                $stalePayments->whereNotIn('id', $incomingIds);
            }
            $stalePayments->whereNotIn('status', ['Verified', 'Paid', 'Refunded'])->delete();

            $remaining = round($totalCost, 2);
            $lastIndex = count($data['terms']) - 1;

            foreach ($data['terms'] as $index => $term) {
                $existingPayment = !empty($term['id'])
                    ? $booking->payments->firstWhere('id', (int) $term['id'])
                    : null;

                if ($existingPayment && in_array($existingPayment->status, ['Verified', 'Paid', 'Refunded'], true)) {
                    $remaining = round($remaining - (float) $existingPayment->amount, 2);
                    continue;
                }

                $amount = $index === $lastIndex
                    ? $remaining
                    : round($totalCost * ((float) $term['percentage'] / 100), 2);

                $payload = [
                    'amount' => $amount,
                    'payment_method' => 'Pending',
                    'status' => 'Pending',
                    'payment_type' => $term['payment_type'],
                    'due_date' => $term['due_date'],
                ];

                if (!empty($term['id'])) {
                    Payment::where('id', $term['id'])
                        ->where('booking_id', $booking->id)
                        ->update($payload);
                } else {
                    $booking->payments()->create($payload);
                }

                $remaining = round($remaining - $amount, 2);
            }
        });

        $booking->load(['payments' => function ($q) {
            $q->orderByRaw("CASE payment_type WHEN 'Reservation' THEN 1 WHEN 'DownPayment' THEN 2 WHEN 'Final' THEN 3 ELSE 4 END")
                ->orderBy('due_date')
                ->orderBy('id');
        }]);

        foreach ($booking->payments as $payment) {
            PaymentEventService::record(
                'payment_terms_updated',
                'accounting',
                $payment,
                ['booking_id' => $booking->id],
                $payment->paymongo_payment_id ?: $payment->paymongo_checkout_session_id
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Payment terms updated successfully.',
            'booking' => $booking,
        ]);
    }

    /**
     * Get transaction ledger (all payments with filters).
     * Ported from: accountingController.getLedger()
     */
    public function getLedger(Request $request)
    {
        $query = Payment::query()
            ->select([
                'id',
                'booking_id',
                'amount',
                'payment_method',
                'status',
                'payment_type',
                'due_date',
                'verified_by',
                'verified_at',
                'created_at',
                'paymongo_checkout_session_id',
                'paymongo_payment_id',
                'paymongo_reference_number',
                'paymongo_event_id',
            ])
            ->with(['booking:id,event_date,client_full_name,package_id,user_id', 'booking.user:id,username'])
            ->whereHas('booking', function ($q) {
                $q->whereNotIn('status', ['Pending', 'Cancelled']); // Hide ledger entries for unapproved/cancelled bookings
            });

        if ($request->status && $request->status !== 'All') {
            $query->where('status', $request->status);
        }

        if ($request->startDate) {
            $query->where('created_at', '>=', $request->startDate);
        }

        if ($request->endDate) {
            $query->where('created_at', '<=', $request->endDate);
        }

        if ($request->filled('clientSearch')) {
            $search = trim((string) $request->query('clientSearch'));
            $term = '%' . mb_strtolower($search) . '%';
            $query->whereHas('booking', function ($bookingQuery) use ($search, $term) {
                $bookingQuery->whereRaw('LOWER(client_full_name) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(event_name) LIKE ?', [$term])
                    ->orWhereHas('user', fn ($userQuery) => $userQuery->whereRaw('LOWER(username) LIKE ?', [$term]));
                if (ctype_digit($search)) {
                    $bookingQuery->orWhere('id', (int) $search);
                }
            });
        }

        if ($request->filled('method') && $request->query('method') !== 'All') {
            $method = '%' . mb_strtolower(trim((string) $request->query('method'))) . '%';
            $query->whereRaw('LOWER(payment_method) LIKE ?', [$method]);
        }

        if ($request->filled('payment_type') && $request->query('payment_type') !== 'All') {
            $query->where('payment_type', $request->query('payment_type'));
        }

        $query->orderBy('created_at', 'desc');

        if ($request->boolean('paginated')) {
            $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
            $payments = $query->paginate($perPage);
            $data = $payments->getCollection()
                ->map(fn ($p) => $this->paymentWithBookingContext($p))
                ->values();

            return ApiResponse::paginated($payments, $data);
        }

        $payments = $query->get()
            ->map(fn ($p) => $this->paymentWithBookingContext($p));

        return response()->json($payments);
    }

    public function getReconciliation(Request $request)
    {
        $payments = Payment::query()
            ->with(['booking:id,event_date,client_full_name,client_email,status,total_cost', 'events'])
            ->whereHas('booking', fn ($query) => $query->whereNotIn('status', ['Pending']))
            ->latest()
            ->limit(300)
            ->get()
            ->map(function (Payment $payment) {
                $hasCheckout = filled($payment->paymongo_checkout_session_id);
                $hasProviderPayment = filled($payment->paymongo_payment_id);
                $hasPaidWebhook = $payment->events->contains('event_type', 'webhook_paid');
                $hasMismatch = $payment->events->contains(fn ($event) => in_array($event->event_type, ['webhook_mismatch', 'webhook_unmatched'], true));
                $isPaidLocally = in_array($payment->status, ['Paid', 'Verified', 'Refunded'], true);
                $isOverdue = $payment->due_date && $payment->due_date->isPast() && $payment->status === 'Pending';

                $exceptions = [];
                if ($hasCheckout && !$isPaidLocally) {
                    $exceptions[] = 'checkout_started_unpaid';
                }
                if ($hasProviderPayment && !$isPaidLocally) {
                    $exceptions[] = 'provider_paid_not_local';
                }
                if ($isOverdue) {
                    $exceptions[] = 'pending_past_due';
                }
                if (str_contains(strtolower((string) $payment->payment_method), 'paymongo') && $isPaidLocally && !$hasProviderPayment) {
                    $exceptions[] = 'missing_paymongo_payment_id_for_refund';
                }
                if ($hasMismatch) {
                    $exceptions[] = 'webhook_mismatch';
                }

                return [
                    'id' => $payment->id,
                    'booking_id' => $payment->booking_id,
                    'client_full_name' => $payment->booking?->client_full_name,
                    'event_date' => $payment->booking?->event_date,
                    'amount' => $payment->amount,
                    'payment_type' => $payment->payment_type,
                    'status' => $payment->status,
                    'due_date' => $payment->due_date,
                    'paymongo_checkout_session_id' => $payment->paymongo_checkout_session_id,
                    'paymongo_payment_id' => $payment->paymongo_payment_id,
                    'paymongo_reference_number' => $payment->paymongo_reference_number,
                    'webhook_received' => $hasPaidWebhook,
                    'mismatch' => $hasMismatch,
                    'exceptions' => $exceptions,
                ];
            })
            ->filter(fn ($payment) => $request->query('exceptions_only') ? count($payment['exceptions']) > 0 : true)
            ->values();

        return response()->json($payments);
    }

    /**
     * Send a real payment reminder email + in-app notification to the client.
     * Ported from: accountingController.remindClient()
     */
    public function remindClient(int $paymentId)
    {
        $payment = Payment::with([
            'booking:id,user_id,client_email,client_full_name,client_phone',
        ])->find($paymentId);

        if (!$payment) {
            return response()->json(['error' => 'Payment not found'], 404);
        }

        $booking = $payment->booking;

        if (!$booking) {
            return response()->json(['error' => 'Booking not found for this payment'], 404);
        }

        // Ensure the payment has its booking eager-loaded for the notification
        $payment->setRelation('booking', $booking);

        $notified = false;

        // ── Path A: Booking has a registered user account ──
        if ($booking->user_id) {
            $client = User::find($booking->user_id);

            if ($client) {
                try {
                    $client->notify(new PaymentReminderNotification($payment));
                    $notified = true;

                    PaymentEventService::record(
                        'payment_reminder_sent',
                        'accounting',
                        $payment,
                        ['channel' => 'notification'],
                        $payment->paymongo_payment_id ?: $payment->paymongo_checkout_session_id
                    );

                    Log::info('Payment reminder notification sent.', [
                        'payment_id' => $paymentId,
                        'user_id'    => $client->id,
                        'email'      => $client->email,
                    ]);
                } catch (\Throwable $e) {
                    Log::error('PaymentReminderNotification failed.', [
                        'payment_id' => $paymentId,
                        'error'      => $e->getMessage(),
                    ]);

                    return response()->json([
                        'error' => 'Could not send reminder: ' . $e->getMessage(),
                    ], 500);
                }
            }
        }

        // ── Path B: No linked user — fall back to raw mail using client_email ──
        if (!$notified) {
            $email = $booking->client_email;

            if (!$email) {
                return response()->json([
                    'error' => 'No email address found for this client. Please update the booking with a valid email first.',
                ], 422);
            }

            try {
                $dueDate  = \Carbon\Carbon::parse($payment->due_date)->format('F j, Y');
                $amount   = number_format((float) $payment->amount, 2);
                $type     = $payment->payment_type ?? 'Payment';
                $bookingRef = str_pad($booking->id, 5, '0', STR_PAD_LEFT);
                $clientName = $booking->client_full_name ?: 'Valued Client';

                Mail::send('emails.generic', [
                    'emailTitle' => 'Payment reminder',
                    'headline' => 'Your payment is coming up',
                    'preheader' => 'A friendly reminder for your Eloquente booking payment.',
                    'greeting' => "Hello {$clientName},",
                    'lines' => ['This is a friendly reminder about an upcoming payment for your booking.'],
                    'details' => [
                        'Payment type' => $type,
                        'Amount due' => 'PHP ' . $amount,
                        'Due date' => $dueDate,
                        'Booking reference' => "#{$bookingRef}",
                    ],
                    'ctaLabel' => 'View payment',
                    'ctaUrl' => route('payment.page'),
                    'note' => 'Please settle your payment on or before the due date to keep your booking active.',
                ], function ($message) use ($email, $clientName, $bookingRef) {
                    $message->to($email, $clientName)
                            ->subject("Payment Reminder - Booking #{$bookingRef} | Eloquente Catering");
                });

                PaymentEventService::record(
                    'payment_reminder_sent',
                    'accounting',
                    $payment,
                    ['channel' => 'mail', 'recipient' => $email],
                    $payment->paymongo_payment_id ?: $payment->paymongo_checkout_session_id
                );

                /*
                Mail::raw(
                    implode("\n\n", [
                        "Hello {$clientName},",
                        "This is a friendly payment reminder from Eloquente Catering.",
                        "Payment Type : {$type}",
                        "Amount Due   : ₱{$amount}",
                        "Due Date     : {$dueDate}",
                        "Booking Ref  : #{$bookingRef}",
                        "Please settle your payment on or before the due date to keep your booking active.",
                        "Thank you,\nEloquente Catering Team",
                    ]),
                    function ($message) use ($email, $clientName, $bookingRef) {
                        $message->to($email, $clientName)
                                ->subject("Payment Reminder – Booking #{$bookingRef} | Eloquente Catering");
                    }
                );
                */

                Log::info('Payment reminder raw mail sent (no user account).', [
                    'payment_id' => $paymentId,
                    'email'      => $email,
                ]);

                $notified = true;
            } catch (\Throwable $e) {
                Log::error('Payment reminder raw mail failed.', [
                    'payment_id' => $paymentId,
                    'email'      => $booking->client_email,
                    'error'      => $e->getMessage(),
                ]);

                return response()->json([
                    'error' => 'Could not send reminder email: ' . $e->getMessage(),
                ], 500);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Payment reminder sent to the client successfully.',
        ]);
    }

    /**
     * Get refund queue (cancelled bookings with verified payments).
     * Ported from: accountingController.getRefundQueue()
     */
    public function getRefundQueue()
    {
        $items = Booking::query()
            ->with([
                'payments' => fn ($query) => $query->whereIn('status', ['Verified', 'Paid']),
                'refundCases:id,booking_id,status',
            ])
            ->where('status', 'Cancelled')
            ->whereHas('payments', fn ($query) => $query->whereIn('status', ['Verified', 'Paid']))
            ->get()
            ->map(function (Booking $booking) {
                $refundCases = $booking->refundCases;

                return [
                    'booking_id' => $booking->id,
                    'client_full_name' => $booking->client_full_name,
                    'client_email' => $booking->client_email,
                    'event_date' => $booking->event_date,
                    'total_cost' => $booking->total_cost,
                    'total_paid' => $booking->payments->sum(fn (Payment $payment) => (float) $payment->amount),
                    'refund_case_count' => $refundCases->count(),
                    'refund_status' => match (true) {
                        $refundCases->contains(fn (RefundCase $case) => in_array($case->status, ['Failed', 'Manual Review'], true)) => 'Manual Review',
                        $refundCases->contains(fn (RefundCase $case) => in_array($case->status, ['Processing', 'Approved', 'Requested'], true)) => 'In Progress',
                        $refundCases->isNotEmpty() => 'Reviewed',
                        default => 'Needs Review',
                    },
                ];
            })
            ->values();

        return response()->json($items);
    }

    /**
     * Process refund for a booking.
     * Integrates with PayMongo API to refund actual payments.
     */
    public function processRefund(int $bookingId, \App\Services\PayMongoService $payMongo)
    {
        $verifiedBy = Auth::user()->username ?? 'accounting';
        $booking = Booking::with('payments')->find($bookingId);

        if (!$booking) {
            return response()->json(['error' => 'Booking not found.'], 404);
        }

        $payments = Payment::where('booking_id', $bookingId)
            ->whereIn('status', ['Verified', 'Paid'])
            ->orderByRaw("CASE payment_type WHEN 'Reservation' THEN 1 WHEN 'DownPayment' THEN 2 WHEN 'Final' THEN 3 ELSE 4 END")
            ->orderBy('id')
            ->get();

        if ($payments->isEmpty()) {
            return response()->json(['error' => 'No verified or paid payments found for this booking to refund.'], 404);
        }

        $impact = (new BookingManagementService())->calculateCancellationImpact($booking);
        $remainingRefundable = round((float) ($impact['refundable_amount'] ?? 0), 2);
        $nonRefundableRemaining = round((float) ($impact['non_refundable_amount'] ?? 0), 2);
        $refundCount = 0;
        $forfeitedCount = 0;
        $errors = [];
        $safeMissingReferenceMessage = 'This payment cannot be refunded automatically because the original online payment reference is missing.';

        foreach ($payments as $payment) {
            $refundCase = null;
            try {
                $paidAmount = round((float) $payment->amount, 2);
                $forfeitedForPayment = min($paidAmount, $nonRefundableRemaining);
                $nonRefundableRemaining = round($nonRefundableRemaining - $forfeitedForPayment, 2);
                $refundAmount = min(round($paidAmount - $forfeitedForPayment, 2), $remainingRefundable);

                $refundCase = RefundCase::create([
                    'booking_id' => $booking->id,
                    'payment_id' => $payment->id,
                    'amount' => max($refundAmount, 0),
                    'non_refundable_amount' => $forfeitedForPayment,
                    'reason' => 'cancelled_booking',
                    'status' => $refundAmount > 0 ? 'Approved' : 'Refunded',
                    'requested_by' => Auth::id(),
                    'approved_by' => Auth::id(),
                    'notes' => $refundAmount > 0 ? null : 'Paid amount was fully non-refundable under cancellation policy.',
                ]);

                PaymentEventService::record(
                    'refund_requested',
                    'accounting',
                    $payment,
                    [
                        'refund_case_id' => $refundCase->id,
                        'amount' => max($refundAmount, 0),
                        'non_refundable_amount' => $forfeitedForPayment,
                    ],
                    $payment->paymongo_payment_id ?: $payment->paymongo_checkout_session_id
                );

                if ($refundAmount <= 0) {
                    $payment->update([
                        'status'      => 'Refunded',
                        'verified_by' => $verifiedBy,
                        'verified_at' => now(),
                        'payment_method' => trim(($payment->payment_method ?: 'Payment') . ' (Forfeited)')
                    ]);
                    $forfeitedCount++;
                    PaymentEventService::record(
                        'refund_completed',
                        'accounting',
                        $payment,
                        [
                            'refund_case_id' => $refundCase->id,
                            'amount' => 0,
                            'non_refundable_amount' => $forfeitedForPayment,
                        ],
                        $payment->paymongo_payment_id ?: $payment->paymongo_checkout_session_id
                    );
                    continue;
                }

                // If it was paid via PayMongo and has a payment ID, issue a real refund
                if ($payment->paymongo_payment_id) {
                    try {
                        $refundCase->update(['status' => 'Processing']);
                        $providerResponse = $payMongo->createRefund(
                            paymentId: $payment->paymongo_payment_id,
                            amount: $refundAmount,
                            reason: 'requested_by_customer',
                            notes: "Refunded via Accounting Dashboard for Booking #{$bookingId}, Payment #{$payment->id}"
                        );
                        $refundCase->update([
                            'status' => 'Refunded',
                            'provider_refund_id' => data_get($providerResponse, 'id'),
                            'provider_response' => $providerResponse,
                        ]);
                    } catch (\Exception $apiException) {
                        Log::error("PayMongo API failed for payment #{$payment->id}: " . $apiException->getMessage(), [
                            'payment_id' => $payment->id,
                            'booking_id' => $bookingId,
                        ]);
                        $refundCase->update([
                            'status' => 'Failed',
                            'provider_response' => ['error' => $apiException->getMessage()],
                            'notes' => 'Automatic provider refund failed. Review PayMongo logs before retrying.',
                        ]);
                        PaymentEventService::record(
                            'refund_failed',
                            'paymongo',
                            $payment,
                            [
                                'refund_case_id' => $refundCase->id,
                                'reason' => 'provider_error',
                            ],
                            $payment->paymongo_payment_id
                        );
                        $errors[] = 'Automatic refund failed for one payment. Please review the refund case before retrying.';
                        continue; // Skip local update if the real refund failed
                    }
                } elseif (str_contains(strtolower((string) $payment->payment_method), 'paymongo')) {
                    Log::warning('PayMongo refund skipped because provider payment ID is missing.', [
                        'payment_id' => $payment->id,
                        'booking_id' => $bookingId,
                    ]);
                    $refundCase->update([
                        'status' => 'Failed',
                        'notes' => $safeMissingReferenceMessage,
                    ]);
                    PaymentEventService::record(
                        'refund_failed',
                        'accounting',
                        $payment,
                        [
                            'refund_case_id' => $refundCase->id,
                            'reason' => 'missing_provider_payment_id',
                        ],
                        $payment->paymongo_checkout_session_id
                    );
                    $errors[] = $safeMissingReferenceMessage;
                    continue;
                }

                // Update the payment record
                $payment->update([
                    'status'      => 'Refunded',
                    'verified_by' => $verifiedBy,
                    'verified_at' => now(),
                    'payment_method' => $forfeitedForPayment > 0
                        ? trim(($payment->payment_method ?: 'Payment') . " (Partial refund: PHP " . number_format($refundAmount, 2) . "; forfeited: PHP " . number_format($forfeitedForPayment, 2) . ")")
                        : $payment->payment_method,
                ]);

                $remainingRefundable = round($remainingRefundable - $refundAmount, 2);
                $refundCount++;
                PaymentEventService::record(
                    'refund_completed',
                    $payment->paymongo_payment_id ? 'paymongo' : 'accounting',
                    $payment,
                    [
                        'refund_case_id' => $refundCase->id,
                        'amount' => $refundAmount,
                        'non_refundable_amount' => $forfeitedForPayment,
                    ],
                    $payment->paymongo_payment_id ?: $payment->paymongo_checkout_session_id
                );
            } catch (\Exception $e) {
                Log::error("Failed to process refund for payment #{$payment->id}: " . $e->getMessage());
                $refundCase?->update([
                    'status' => 'Failed',
                    'notes' => 'Refund case could not be completed. Please review server logs.',
                    'provider_response' => ['error' => $e->getMessage()],
                ]);
                $errors[] = 'A refund case could not be completed. Please review it before retrying.';
            }
        }

        if (count($errors) > 0 && $refundCount === 0) {
            return response()->json([
                'error' => 'Failed to process refunds.',
                'details' => array_values(array_unique($errors))
            ], 500);
        }

        $message = $refundCount > 0
            ? "Refund processed successfully through PayMongo where provider payment IDs were available. Non-refundable reservation fees were forfeited."
            : "No refundable amount was available. Paid amounts were marked as forfeited.";
        if (count($errors) > 0) {
            $message .= " However, some payments failed to refund.";
        }

        Log::info("[REFUND] Processed refund for booking #{$bookingId}. Updated records.", [
            'refunded_payments' => $refundCount,
            'forfeited_payments' => $forfeitedCount,
            'errors' => $errors,
        ]);

        return response()->json(['success' => true, 'message' => $message]);
    }

    private function paymentWithBookingContext(Payment $payment): array
    {
        $data = (new PaymentResource($payment))->resolve();
        $data['event_date'] = $payment->booking->event_date ?? null;
        $data['client_full_name'] = $payment->booking->client_full_name ?? null;
        $data['package_id'] = $payment->booking->package_id ?? null;
        $data['username'] = $payment->booking?->user?->username;
        $data['receipt_url'] = route('documents.receipt', $payment);
        $data['finance_state'] = $payment->status === 'Pending' && $payment->due_date && $payment->due_date->isPast()
            ? 'overdue'
            : (in_array($payment->status, ['Paid', 'Verified'], true) ? 'settled' : strtolower((string) $payment->status));

        return $data;
    }
}
