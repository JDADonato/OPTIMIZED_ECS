<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BusinessRule;
use App\Models\Payment;
use Carbon\Carbon;

class PaymentCalculationService
{
    /**
     * Calculate required payment tranches for a booking based on the event date proximity.
     */
    public function calculateTranches(Booking $booking): array
    {
        $eventDate = Carbon::parse($booking->event_date)->startOfDay();
        $createdAt = $booking->created_at ? $booking->created_at->startOfDay() : now()->startOfDay();

        $daysUntilEvent = $createdAt->diffInDays($eventDate, false);
        $totalCost = (float) $booking->total_cost;
        $rules = BusinessRule::getActive();
        $reservationPct = (float) ($rules->reservation_fee_percentage ?? 10);
        $downPaymentPct = (float) ($rules->downpayment_percentage ?? 70);
        $finalPct = (float) ($rules->final_payment_percentage ?? 20);
        $reservationHours = (int) ($rules->reservation_validity_hours ?? 24);
        $downPaymentDueDays = (int) ($rules->downpayment_due_days ?? 30);
        $finalDueDays = (int) ($rules->final_payment_due_days ?? 10);

        // Rush 2: Event is less than 10 days away
        if ($daysUntilEvent <= 10) {
            return [
                [
                    'name' => 'Final',
                    'percentage' => 100,
                    'amount' => $totalCost,
                    'due_date' => now()->addHours($reservationHours)->toIso8601String(),
                    'description' => '100% Full Payment required immediately for rush events.',
                ],
            ];
        }

        // Rush 1: Event is less than 1 month, but > 10 days away
        if ($daysUntilEvent <= $downPaymentDueDays) {
            $rushPct = $reservationPct + $downPaymentPct;

            return [
                [
                    'name' => 'DownPayment',
                    'percentage' => $rushPct,
                    'amount' => $totalCost * ($rushPct / 100),
                    'due_date' => now()->addHours($reservationHours)->toIso8601String(),
                    'description' => "Because your event is within {$downPaymentDueDays} days, the reservation fee and down payment are combined into a single {$rushPct}% payment required immediately to secure the date.",
                ],
                [
                    'name' => 'Final',
                    'percentage' => $finalPct,
                    'amount' => $totalCost * ($finalPct / 100),
                    'due_date' => $eventDate->copy()->subDays($finalDueDays)->toIso8601String(),
                    'description' => "{$finalPct}% Final Balance due {$finalDueDays} days before the event.",
                ],
            ];
        }

        // Standard: Event is > 1 month away
        return [
            [
                'name' => 'Reservation',
                'percentage' => $reservationPct,
                'amount' => $totalCost * ($reservationPct / 100),
                'due_date' => now()->addHours($reservationHours)->toIso8601String(),
                'description' => "{$reservationPct}% Reservation Fee to lock in your date.",
            ],
            [
                'name' => 'DownPayment',
                'percentage' => $downPaymentPct,
                'amount' => $totalCost * ($downPaymentPct / 100),
                'due_date' => $eventDate->copy()->subDays($downPaymentDueDays)->toIso8601String(),
                'description' => "{$downPaymentPct}% Down Payment due {$downPaymentDueDays} days before the event.",
            ],
            [
                'name' => 'Final',
                'percentage' => $finalPct,
                'amount' => $totalCost * ($finalPct / 100),
                'due_date' => $eventDate->copy()->subDays($finalDueDays)->toIso8601String(),
                'description' => "{$finalPct}% Final Balance due {$finalDueDays} days before the event.",
            ],
        ];
    }

    /**
     * Bring unpaid payment rows back in line with the current rush/standard schedule.
     * This fixes older rush bookings that were saved as 70/20 or 20 instead of 80/20 or 100.
     */
    public function syncPendingTranches(Booking $booking): void
    {
        $tranches = collect($this->calculateTranches($booking));

        if ($tranches->isEmpty() || (float) $booking->total_cost <= 0) {
            return;
        }

        $payments = $booking->payments()->active()->get();
        $lockedStatuses = ['Paid', 'Verified', 'Refunded'];
        $pendingStatuses = ['Pending', 'Failed', 'Rejected'];
        $hasLockedPayments = $payments->contains(fn (Payment $payment) => in_array($payment->status, $lockedStatuses, true));
        $voider = app(PaymentScheduleVoidService::class);

        // Only retire obsolete rows when nothing has been paid yet. Once money moved, preserve the active schedule.
        if (! $hasLockedPayments) {
            $expectedTypes = $tranches->pluck('name')->all();
            $booking->payments()
                ->active()
                ->whereNotIn('payment_type', $expectedTypes)
                ->whereIn('status', $pendingStatuses)
                ->get()
                ->each(fn (Payment $payment) => $voider->void(
                    $payment,
                    count($expectedTypes) === 1 && $expectedTypes[0] === 'Final' ? 'obsolete_rush_tranche' : 'schedule_recalculated',
                    'system'
                ));
        }

        foreach ($tranches as $tranche) {
            $payment = $booking->payments()
                ->active()
                ->where('payment_type', $tranche['name'])
                ->whereIn('status', $pendingStatuses)
                ->orderBy('id')
                ->first();

            if (! $payment) {
                if ($hasLockedPayments) {
                    continue;
                }

                $payment = $booking->payments()->create([
                    'amount' => round((float) $tranche['amount'], 2),
                    'payment_method' => 'Pending',
                    'status' => 'Pending',
                    'payment_type' => $tranche['name'],
                    'due_date' => Carbon::parse($tranche['due_date'])->toDateString(),
                ]);

                continue;
            }

            $booking->payments()
                ->active()
                ->where('payment_type', $tranche['name'])
                ->whereIn('status', $pendingStatuses)
                ->where('id', '!=', $payment->id)
                ->orderBy('id')
                ->get()
                ->each(fn (Payment $duplicate) => $voider->void(
                    $duplicate,
                    'duplicate_pending_term',
                    'system',
                    null,
                    $payment->id
                ));

            $expectedAmount = round((float) $tranche['amount'], 2);
            $currentAmount = round((float) $payment->amount, 2);
            if ($currentAmount !== $expectedAmount) {
                $payment->forceFill([
                    'amount' => $expectedAmount,
                ])->save();
            }
        }

        $booking->unsetRelation('payments');
    }

    /**
     * Check if the booking is within the non-refundable window (7 days before event).
     */
    public function isNonRefundable(Booking $booking): bool
    {
        $eventDate = Carbon::parse($booking->event_date)->startOfDay();
        $daysUntilEvent = now()->startOfDay()->diffInDays($eventDate, false);

        // If the event is in the past, or less than or equal to 7 days away
        return $daysUntilEvent <= 7;
    }

    /**
     * Get the next sequential payment due, ignoring future tranches.
     * Evaluates the event proximity and outstanding payments.
     */
    public function getNextPaymentDue(Booking $booking): ?array
    {
        $this->syncPendingTranches($booking);

        // Since tranches are generated dynamically at reservation time (Standard, Rush 1, Rush 2)
        // we can simply find the earliest pending payment from the database.
        $nextPayment = $booking->payments()
            ->active()
            ->whereIn('status', ['Pending', 'Failed', 'Rejected'])
            ->orderBy('due_date', 'asc')
            ->first();

        if (! $nextPayment) {
            return null; // Fully paid or no pending payments
        }

        $tranches = $this->calculateTranches($booking);
        $description = 'Payment due.';
        foreach ($tranches as $tranche) {
            if ($tranche['name'] === $nextPayment->payment_type) {
                $description = $tranche['description'];
                break;
            }
        }

        return [
            'id' => $nextPayment->id,
            'payment_type' => $nextPayment->payment_type,
            'amount' => $nextPayment->amount,
            'due_date' => $nextPayment->due_date,
            'status' => $nextPayment->status,
            'description' => $description,
        ];
    }

    public function updateBookingMilestone(Booking $booking): void
    {
        $booking->load(['payments' => fn ($query) => $query->active()]);

        $totalPaid = (float) $booking->payments
            ->whereIn('status', ['Paid', 'Verified'])
            ->sum(fn (Payment $payment) => (float) $payment->amount);

        $totalCost = (float) $booking->total_cost;
        $paidRatio = $totalCost > 0 ? $totalPaid / $totalCost : 0;

        $updates = [
            'milestone_step' => $this->milestoneStep($paidRatio),
            'live_status' => $this->bookingLiveStatus($paidRatio),
        ];

        // Payment progress is tracked separately from the booking's operational status.
        // Marketing owns statuses like Confirmed, Completed, and Cancelled.
        $booking->update($updates);
    }

    private function milestoneStep(float $paidRatio): int
    {
        if ($paidRatio >= 1) {
            return 5;
        }

        if ($paidRatio >= 0.80) {
            return 4;
        }

        if ($paidRatio >= 0.10) {
            return 3;
        }

        return 1;
    }

    private function bookingLiveStatus(float $paidRatio): string
    {
        if ($paidRatio >= 1) {
            return 'Payment Complete';
        }

        if ($paidRatio >= 0.80) {
            return 'Progress Payment Paid';
        }

        if ($paidRatio >= 0.10) {
            return 'Reserved';
        }

        return 'Payment Pending';
    }
}
