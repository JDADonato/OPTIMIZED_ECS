<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Exception;

class BookingManagementService
{
    /**
     * Check if supplementary details (Motif, Timeline, Allergies, Contacts) can be edited.
     * Rule: Must be > 14 days away from event_date.
     */
    public function canEditSupplementary(Booking $booking): bool
    {
        // Grace period: Allow editing within 48 hours of booking creation, regardless of event date proximity.
        // This ensures Rush 2 clients can still input their supplementary details immediately upon booking.
        if ($booking->created_at && $booking->created_at->diffInHours(now()) <= 48) {
            return true;
        }

        $eventDate = Carbon::parse($booking->event_date)->startOfDay();
        $daysUntilEvent = now()->startOfDay()->diffInDays($eventDate, false);
        
        return $daysUntilEvent > 14;
    }

    /**
     * Check if menu (Dish swapping) can be edited.
     * Rule: Must be > 30 days away from event_date.
     */
    public function canEditMenu(Booking $booking): bool
    {
        $eventDate = Carbon::parse($booking->event_date)->startOfDay();
        $daysUntilEvent = now()->startOfDay()->diffInDays($eventDate, false);
        
        return $daysUntilEvent > 30;
    }

    /**
     * Renegotiate Core Details (Date, Pax, Venue).
     * Rule: Reset milestone_step to 1, requires re-validation against capacity limits.
     * 
     * @throws Exception if validation fails
     */
    public function renegotiateCoreDetails(Booking $booking, array $newDetails): Booking
    {
        DB::beginTransaction();
        try {
            // Validate capacity if date or pax changed
            if (isset($newDetails['event_date']) || isset($newDetails['pax'])) {
                $checkDate = $newDetails['event_date'] ?? $booking->event_date;
                $checkPax = $newDetails['pax'] ?? $booking->pax;

                // Subtract current booking from totals to simulate moving it
                $currentPaxOnDate = Booking::whereDate('event_date', $checkDate)
                    ->where('id', '!=', $booking->id)
                    ->whereNotIn('status', ['Cancelled', 'cancelled'])
                    ->sum('pax');

                $currentEventsOnDate = Booking::whereDate('event_date', $checkDate)
                    ->where('id', '!=', $booking->id)
                    ->whereNotIn('status', ['Cancelled', 'cancelled'])
                    ->count();

                if ($currentEventsOnDate >= BusinessRulesService::MAX_EVENTS_PER_DAY) {
                    throw new Exception("Maximum events reached for this date.");
                }

                if (($currentPaxOnDate + $checkPax) > BusinessRulesService::MAX_PAX_PER_DAY) {
                    throw new Exception("Maximum pax capacity reached for this date.");
                }
            }

            // Apply updates
            $booking->update(array_merge($newDetails, [
                'milestone_step' => 1,
                'status' => 'Pending Review',
            ]));

            // Recalculate payment schedule if date moved?
            // Optionally we can regenerate the schedule here or leave it to admin/marketing to review first.

            DB::commit();
            return $booking;
        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Calculate Cancellation Impact without modifying the database.
     * 
     * @return array
     */
    public function calculateCancellationImpact(Booking $booking): array
    {
        $eventDate = Carbon::parse($booking->event_date)->startOfDay();
        $daysUntilEvent = now()->startOfDay()->diffInDays($eventDate, false);
        
        $totalPaid = $booking->payments()->active()->whereIn('status', ['Verified', 'Paid'])->sum('amount');
        $totalCost = (float) $booking->total_cost;
        $reservationFee = $totalCost * 0.10;

        $nonRefundableAmount = 0;
        $refundableAmount = 0;

        if ($daysUntilEvent <= 7) {
            $nonRefundableAmount = $totalPaid;
            $refundableAmount = 0;
        } else {
            if ($totalPaid > $reservationFee) {
                $nonRefundableAmount = $reservationFee;
                $refundableAmount = $totalPaid - $reservationFee;
            } else {
                $nonRefundableAmount = $totalPaid;
                $refundableAmount = 0;
            }
        }

        return [
            'total_paid' => $totalPaid,
            'non_refundable_amount' => $nonRefundableAmount,
            'refundable_amount' => $refundableAmount,
            'message' => $refundableAmount > 0 
                ? "Warning: Because your event is > 7 days away, the 10% Reservation Fee (₱" . number_format($reservationFee, 2) . ") is forfeited. The remaining ₱" . number_format($refundableAmount, 2) . " will be flagged for refund."
                : ($daysUntilEvent <= 7 
                    ? "Warning: Because your event is within 7 days, ALL payments (₱" . number_format($nonRefundableAmount, 2) . ") are strictly non-refundable." 
                    : "Warning: Your 10% Reservation Fee is non-refundable. Your paid amount does not exceed this fee."),
        ];
    }

    /**
     * Handle Cancellation and Refund Logic.
     * 
     * @return array Contains summary of cancellation financial impact
     */
    public function cancelBooking(Booking $booking): array
    {
        $impact = $this->calculateCancellationImpact($booking);

        DB::transaction(function () use ($booking, $impact) {
            $booking->update(['status' => 'Cancelled']);

            if ($impact['refundable_amount'] > 0) {
                $booking->update(['live_status' => 'Refund Processing']);
            }
        });

        $impact['message'] = str_replace('Warning: ', 'Booking cancelled. ', $impact['message']);
        return $impact;
    }
}
