<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Payment;
use App\Services\BrandedPdfService;
use App\Services\PaymentEventService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class DocumentController extends Controller
{
    private const MAX_CALENDAR_EXPORT_DAYS = 366;

    private const MAX_CALENDAR_EXPORT_EVENTS = 500;

    public function receipt(Payment $payment, BrandedPdfService $pdf)
    {
        $payment->loadMissing('booking.user');
        $booking = $payment->booking;
        $user = request()->user();

        if (! $booking || (! $user->isAdmin() && ! $user->isMarketing() && ! $user->isAccounting() && (int) $booking->user_id !== (int) $user->id)) {
            abort(403);
        }

        PaymentEventService::record(
            'receipt_downloaded',
            $user->role === 'Client' ? 'client' : strtolower((string) $user->role),
            $payment,
            ['booking_id' => $booking->id],
            $payment->paymongo_payment_id ?: $payment->paymongo_checkout_session_id
        );

        return response($pdf->receipt($payment, $booking), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="eloquente-receipt-'.$payment->id.'.pdf"',
        ]);
    }

    public function preparationList(Booking $booking, BrandedPdfService $pdf)
    {
        $user = request()->user();
        if (! $user->isAdmin() && ! $user->isMarketing()) {
            abort(403);
        }

        return response($pdf->preparationList($booking), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="event-preparation-'.$booking->id.'.pdf"',
        ]);
    }

    public function calendar(Request $request, BrandedPdfService $pdf)
    {
        $user = $request->user();
        if (! $user->isAdmin() && ! $user->isMarketing()) {
            abort(403);
        }

        $data = $request->validate([
            'month' => ['nullable', 'date_format:Y-m'],
            'start' => ['nullable', 'date'],
            'end' => ['nullable', 'date', 'after_or_equal:start'],
            'status' => ['nullable', 'string', 'max:80'],
            'event_type' => ['nullable', 'string', 'max:120'],
            'search' => ['nullable', 'string', 'max:120'],
        ]);

        [$start, $end] = $this->dateWindow($data);
        if ($start->diffInDays($end) > self::MAX_CALENDAR_EXPORT_DAYS) {
            return response()->json([
                'error' => 'Calendar PDF exports are limited to one year. Narrow the date range or use reports for larger exports.',
            ], 422);
        }

        $query = Booking::query()
            ->with('user:id,full_name,username')
            ->whereBetween('event_date', [$start->toDateString(), $end->toDateString()])
            ->whereNotIn('status', ['Cancelled', 'cancelled'])
            ->when($data['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($data['event_type'] ?? null, fn ($q, $type) => $q->where('event_type', $type))
            ->when($data['search'] ?? null, function ($q, $search) {
                $term = '%'.mb_strtolower(trim((string) $search)).'%';
                $q->where(fn ($inner) => $inner
                    ->whereRaw('LOWER(event_name) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(event_type) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(client_full_name) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(venue_city) LIKE ?', [$term]));
            })
            ->orderBy('event_date')
            ->orderBy('event_time');

        $events = $query->limit(self::MAX_CALENDAR_EXPORT_EVENTS + 1)->get();
        $truncated = $events->count() > self::MAX_CALENDAR_EXPORT_EVENTS;
        $events = $events->take(self::MAX_CALENDAR_EXPORT_EVENTS);

        return response($pdf->calendar(
            'Event Calendar - '.$start->format('M j, Y').' to '.$end->format('M j, Y'),
            $events,
            ['start' => $start, 'end' => $end],
            $truncated
        ), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="event-calendar.pdf"',
        ]);
    }

    private function dateWindow(array $data): array
    {
        if (! empty($data['start']) && ! empty($data['end'])) {
            return [Carbon::parse($data['start']), Carbon::parse($data['end'])];
        }

        $start = Carbon::createFromFormat('Y-m', $data['month'] ?? now()->format('Y-m'))->startOfMonth();

        return [$start, $start->copy()->endOfMonth()];
    }
}
