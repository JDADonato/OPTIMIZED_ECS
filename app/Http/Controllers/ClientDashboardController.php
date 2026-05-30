<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\FoodTasting;
use App\Models\Payment;
use App\Services\BookingManagementService;
use App\Services\PaymentCalculationService;
use App\Support\ResourceVersion;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Ported from: server/controllers/clientDashboardController.js
 * Client dashboard — aggregates bookings, tastings, and payments for the logged-in user.
 */
class ClientDashboardController extends Controller
{
    /**
     * JSON API endpoint — returns dashboard data for the original ClientDashboard.jsx
     * which fetches via fetch('/api/dashboard/client').
     */
    public function apiData(Request $request, PaymentCalculationService $paymentService, BookingManagementService $bookingService)
    {
        $userId = Auth::id();

        $allBookings = Booking::where('user_id', $userId)
            ->with(['payments' => fn ($query) => $query->active()])
            ->orderBy('event_date', 'desc')
            ->get();

        $allBookings->each(fn ($booking) => $paymentService->syncPendingTranches($booking));
        $allBookings->load(['payments' => fn ($query) => $query->active()]);

        $bookingIdsForVersion = $allBookings->pluck('id');
        $latestUpdatedAt = collect([
            $allBookings->max('updated_at'),
            Payment::active()->whereIn('booking_id', $bookingIdsForVersion)->max('updated_at'),
            FoodTasting::where('user_id', $userId)->max('updated_at'),
        ])->filter()->max();
        $versionMeta = ResourceVersion::make(
            $allBookings->count()
                + Payment::active()->whereIn('booking_id', $bookingIdsForVersion)->count()
                + FoodTasting::where('user_id', $userId)->count(),
            $latestUpdatedAt,
            $bookingIdsForVersion->max()
        );
        if (ResourceVersion::matches($request, $versionMeta)) {
            return ResourceVersion::unchanged($versionMeta);
        }

        $allBookings = $allBookings
            ->map(function ($booking) use ($paymentService, $bookingService) {
                $nextPayment = $booking->payments
                    ->whereIn('status', ['Pending', 'Failed', 'Rejected'])
                    ->sortBy('due_date')
                    ->first();
                $tranches = collect($paymentService->calculateTranches($booking))->keyBy('name');

                $bookingArray = $booking->attributesToArray();
                $bookingArray['nextPaymentDue'] = $nextPayment ? [
                    'id' => $nextPayment->id,
                    'payment_type' => $nextPayment->payment_type,
                    'amount' => $nextPayment->amount,
                    'due_date' => $nextPayment->due_date,
                    'status' => $nextPayment->status,
                    'description' => $tranches->get($nextPayment->payment_type)['description'] ?? 'Payment due.',
                ] : null;
                $bookingArray['canEditSupplementary'] = $bookingService->canEditSupplementary($booking);
                $bookingArray['canEditMenu'] = $bookingService->canEditMenu($booking);
                $bookingArray['cancellationImpact'] = $this->calculateCancellationImpactFromLoadedPayments($booking);
                return $bookingArray;
            });

        $historyStatuses = ['Cancelled', 'cancelled', 'Completed', 'completed'];
        $bookings = $allBookings
            ->reject(fn ($booking) => in_array($booking['status'] ?? null, $historyStatuses, true))
            ->values();
        $historyBookings = $allBookings
            ->filter(fn ($booking) => in_array($booking['status'] ?? null, $historyStatuses, true))
            ->reject(fn ($booking) => !empty($booking['hidden_from_customer_history_at']))
            ->values();

        $tastings = FoodTasting::where('user_id', $userId)
            ->orderBy('preferred_date', 'desc')
            ->get();

        $bookingIds = $allBookings->pluck('id');
        $payments = Payment::whereIn('booking_id', $bookingIds)
            ->active()
            ->with('booking:id,event_date,event_name,event_type,client_full_name,total_cost')
            ->orderBy('booking_id')
            ->orderByRaw("CASE payment_type WHEN 'Reservation' THEN 1 WHEN 'DownPayment' THEN 2 WHEN 'Final' THEN 3 END")
            ->get()
            ->map(function ($p) {
                $data = $p->toArray();
                $data['event_date'] = $p->booking->event_date ?? null;
                $data['event_name'] = $p->booking->event_name ?? null;
                $data['event_type'] = $p->booking->event_type ?? null;
                $data['client_full_name'] = $p->booking->client_full_name ?? null;
                $data['total_cost'] = $p->booking->total_cost ?? null;
                return $data;
            });

        return response()->json([
            'bookings' => $bookings,
            'historyBookings' => $historyBookings,
            'tastings' => $tastings,
            'payments' => $payments,
            'meta' => [
                ...$versionMeta,
                'changed' => true,
            ],
        ]);
    }

    private function calculateCancellationImpactFromLoadedPayments(Booking $booking): array
    {
        $eventDate = Carbon::parse($booking->event_date)->startOfDay();
        $daysUntilEvent = now()->startOfDay()->diffInDays($eventDate, false);

        $totalPaid = (float) $booking->payments
            ->whereIn('status', ['Verified', 'Paid'])
            ->sum(fn (Payment $payment) => (float) $payment->amount);
        $totalCost = (float) $booking->total_cost;
        $reservationFee = $totalCost * 0.10;

        if ($daysUntilEvent <= 7) {
            $nonRefundableAmount = $totalPaid;
            $refundableAmount = 0;
        } elseif ($totalPaid > $reservationFee) {
            $nonRefundableAmount = $reservationFee;
            $refundableAmount = $totalPaid - $reservationFee;
        } else {
            $nonRefundableAmount = $totalPaid;
            $refundableAmount = 0;
        }

        return [
            'total_paid' => $totalPaid,
            'non_refundable_amount' => $nonRefundableAmount,
            'refundable_amount' => $refundableAmount,
            'message' => $refundableAmount > 0
                ? "Warning: Because your event is more than 7 days away, the 10% Reservation Fee (PHP " . number_format($reservationFee, 2) . ") is forfeited. The remaining PHP " . number_format($refundableAmount, 2) . " will be flagged for refund."
                : ($daysUntilEvent <= 7
                    ? "Warning: Because your event is within 7 days, all payments (PHP " . number_format($nonRefundableAmount, 2) . ") are strictly non-refundable."
                    : "Warning: Your 10% Reservation Fee is non-refundable. Your paid amount does not exceed this fee."),
        ];
    }

    public function journeyTracker()
    {
        $userId = Auth::id();
        $historyStatuses = ['Cancelled', 'cancelled', 'Completed', 'completed'];

        $bookings = Booking::where('user_id', $userId)
            ->whereNotIn('status', $historyStatuses)
            ->orderBy('event_date')
            ->get([
                'id',
                'user_id',
                'event_date',
                'event_time',
                'event_name',
                'event_type',
                'client_full_name',
                'pax',
                'total_cost',
                'status',
                'live_status',
                'selected_menu',
                'venue_address_line',
                'event_timeline',
                'special_instructions',
                'color_motif',
                'clarification_request',
                'clarification_response',
                'created_at',
                'updated_at',
            ]);

        $bookingIds = $bookings->pluck('id');
        $payments = Payment::whereIn('booking_id', $bookingIds)
            ->active()
            ->orderBy('booking_id')
            ->orderByRaw("CASE payment_type WHEN 'Reservation' THEN 1 WHEN 'DownPayment' THEN 2 WHEN 'Final' THEN 3 END")
            ->orderBy('due_date')
            ->get([
                'id',
                'booking_id',
                'amount',
                'status',
                'payment_type',
                'due_date',
            ]);

        $paymentsByBooking = $payments->groupBy('booking_id');
        $bookings = $bookings->map(function ($booking) use ($paymentsByBooking) {
            $nextPaymentDue = $paymentsByBooking
                ->get($booking->id, collect())
                ->first(fn ($payment) => in_array($payment->status, ['Pending', 'Failed', 'Rejected'], true));

            $bookingArray = $booking->toArray();
            $bookingArray['nextPaymentDue'] = $nextPaymentDue ? [
                'id' => $nextPaymentDue->id,
                'payment_type' => $nextPaymentDue->payment_type,
                'amount' => $nextPaymentDue->amount,
                'due_date' => $nextPaymentDue->due_date,
                'status' => $nextPaymentDue->status,
            ] : null;

            return $bookingArray;
        })->values();

        return response()->json([
            'bookings' => $bookings,
            'payments' => $payments,
            'cached_at' => now()->toIso8601String(),
        ]);
    }
}
