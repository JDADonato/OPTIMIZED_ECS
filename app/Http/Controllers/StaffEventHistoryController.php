<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\BookingHistoryNote;
use App\Support\ApiResponse;
use App\Support\CustomerIdentity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class StaffEventHistoryController extends Controller
{
    public function index(Request $request)
    {
        $this->authorizeStaff();

        $query = Booking::query()
            ->with([
                'user:id,full_name,username,email,phone,role,account_status',
                'assignee:id,full_name,username',
                'payments' => fn ($paymentQuery) => $paymentQuery
                    ->when(! $request->boolean('include_voided'), fn ($inner) => $inner->active())
                    ->select('id', 'booking_id', 'amount', 'status', 'payment_type', 'due_date', 'voided_at', 'void_reason'),
                'refundCases:id,booking_id,payment_id,amount,non_refundable_amount,status,reason,notes',
                'feedbackResponses:id,booking_id,rating,follow_up_required,review_status,testimonial_status,retention_notes,assigned_to,follow_up_due_at,reviewed_at,created_at',
                'feedbackResponses.assignee:id,full_name,username',
                'historyNotes' => fn ($notes) => $notes->with('user:id,full_name,username,role')->latest()->limit(10),
            ])
            ->where('status', 'Completed')
            ->when($request->filled('date_from'), fn ($q) => $q->whereDate('event_date', '>=', $request->query('date_from')))
            ->when($request->filled('date_to'), fn ($q) => $q->whereDate('event_date', '<=', $request->query('date_to')))
            ->when($request->filled('event_type') && $request->query('event_type') !== 'all', fn ($q) => $q->where('event_type', $request->query('event_type')))
            ->when($request->filled('owner_id') && $request->query('owner_id') !== 'all', fn ($q) => $q->where('assigned_to', $request->query('owner_id')))
            ->when($request->filled('post_event_status') && $request->query('post_event_status') !== 'all', fn ($q) => $q->where('post_event_status', $request->query('post_event_status')))
            ->when($request->filled('feedback_status') && $request->query('feedback_status') !== 'all', function ($q) use ($request) {
                $status = $request->query('feedback_status');
                if ($status === 'none') {
                    $q->whereDoesntHave('feedbackResponses');

                    return;
                }

                $q->whereHas('feedbackResponses', fn ($feedback) => $feedback->where('review_status', $status));
            })
            ->when($request->filled('payment_status') && $request->query('payment_status') !== 'all', fn ($q) => $q->whereHas('payments', fn ($payment) => $payment->active()->where('status', $request->query('payment_status'))))
            ->when($request->filled('refund_status') && $request->query('refund_status') !== 'all', function ($q) use ($request) {
                $status = $request->query('refund_status');
                if ($status === 'none') {
                    $q->whereDoesntHave('refundCases');

                    return;
                }

                $q->whereHas('refundCases', fn ($refund) => $refund->where('status', $status));
            })
            ->when($request->filled('search'), function ($q) use ($request) {
                $raw = trim((string) $request->query('search'));
                $term = '%'.mb_strtolower($raw).'%';
                $q->where(function ($inner) use ($term, $raw) {
                    if (ctype_digit($raw) && strlen($raw) < 4) {
                        $inner->where('id', (int) $raw);

                        return;
                    }

                    $inner
                        ->whereRaw('LOWER(client_full_name) LIKE ?', [$term])
                        ->orWhereRaw('LOWER(client_email) LIKE ?', [$term])
                        ->orWhereRaw('LOWER(client_phone) LIKE ?', [$term])
                        ->orWhereRaw('LOWER(event_name) LIKE ?', [$term])
                        ->orWhereRaw('LOWER(event_type) LIKE ?', [$term])
                        ->orWhereRaw('LOWER(venue_city) LIKE ?', [$term])
                        ->orWhereHas('user', fn ($userQuery) => $userQuery
                            ->whereRaw('LOWER(full_name) LIKE ?', [$term])
                            ->orWhereRaw('LOWER(username) LIKE ?', [$term])
                            ->orWhereRaw('LOWER(email) LIKE ?', [$term])
                            ->orWhereRaw('LOWER(phone) LIKE ?', [$term]));

                    if (ctype_digit($raw)) {
                        $inner->orWhere('id', (int) $raw);
                    }
                });
            })
            ->orderByDesc('event_date')
            ->orderByDesc('id');

        $perPage = min(max((int) $request->query('per_page', 15), 1), 50);
        $bookings = $query->paginate($perPage);

        return ApiResponse::paginated(
            $bookings,
            $bookings->getCollection()->map(fn (Booking $booking) => $this->eventPayload($booking))->values()->all()
        );
    }

    public function storeNote(Request $request, Booking $booking)
    {
        $this->authorizeStaff();

        if ($booking->status !== 'Completed') {
            return response()->json(['error' => 'History notes can only be added to completed events.'], 422);
        }

        $data = $request->validate([
            'body' => ['required', 'string', 'min:2', 'max:3000'],
        ]);

        $note = BookingHistoryNote::create([
            'booking_id' => $booking->id,
            'user_id' => Auth::id(),
            'body' => $data['body'],
        ]);

        return response()->json([
            'message' => 'History note added.',
            'note' => $this->notePayload($note->load('user:id,full_name,username,role')),
        ], 201);
    }

    private function authorizeStaff(): void
    {
        if (! in_array(Auth::user()?->role, ['Admin', 'Marketing', 'Accounting'], true)) {
            abort(403);
        }
    }

    private function eventPayload(Booking $booking): array
    {
        $feedback = $booking->feedbackResponses->sortByDesc('created_at')->first();

        return [
            'id' => $booking->id,
            'event_date' => $booking->event_date,
            'event_time' => $booking->event_time,
            'event_type' => $booking->event_type,
            'event_name' => $booking->event_name,
            'event_display_name' => $booking->event_display_name,
            'client_full_name' => $booking->client_full_name ?: $booking->user?->full_name ?: $booking->user?->username,
            'client_email' => $booking->client_email ?: $booking->user?->email,
            'client_phone' => $booking->client_phone ?: $booking->user?->phone,
            ...CustomerIdentity::forBooking($booking),
            'pax' => $booking->pax,
            'venue' => collect([$booking->venue_address_line, $booking->venue_city, $booking->venue_province])->filter()->join(', '),
            'total_cost' => (float) ($booking->total_cost ?: $booking->budget ?: 0),
            'status' => $booking->status,
            'review_status' => $booking->review_status,
            'live_status' => $booking->live_status,
            'post_event_status' => $booking->post_event_status,
            'owner_id' => $booking->assigned_to,
            'owner_name' => $booking->assignee?->full_name ?: $booking->assignee?->username,
            'selected_menu' => $booking->selected_menu,
            'payments_summary' => [
                'total' => $booking->payments->count(),
                'paid_amount' => $booking->payments->whereIn('status', ['Paid', 'Verified', 'Refunded'])->sum(fn ($payment) => (float) $payment->amount),
                'pending' => $booking->payments->where('status', 'Pending')->count(),
                'statuses' => $booking->payments->pluck('status')->unique()->values()->all(),
            ],
            'refund_summary' => [
                'total' => $booking->refundCases->count(),
                'open' => $booking->refundCases->filter(fn ($refund) => ! in_array($refund->status, ['completed', 'rejected', 'cancelled'], true))->count(),
                'statuses' => $booking->refundCases->pluck('status')->unique()->values()->all(),
            ],
            'feedback_summary' => [
                'has_response' => (bool) $feedback,
                'rating' => $feedback?->rating,
                'follow_up_required' => (bool) ($feedback?->follow_up_required),
                'review_status' => $feedback?->review_status,
                'testimonial_status' => $feedback?->testimonial_status,
                'retention_notes' => $feedback?->retention_notes,
                'assigned_name' => $feedback?->assignee?->full_name ?: $feedback?->assignee?->username,
                'follow_up_due_at' => $feedback?->follow_up_due_at,
            ],
            'notes' => $booking->historyNotes->map(fn (BookingHistoryNote $note) => $this->notePayload($note))->values()->all(),
            'locked_message' => 'Completed event details are archived. Add a note or use the available post-event follow-up actions.',
        ];
    }

    private function notePayload(BookingHistoryNote $note): array
    {
        return [
            'id' => $note->id,
            'body' => $note->body,
            'created_at' => $note->created_at,
            'user_name' => $note->user?->full_name ?: $note->user?->username,
            'user_role' => $note->user?->role,
        ];
    }
}
