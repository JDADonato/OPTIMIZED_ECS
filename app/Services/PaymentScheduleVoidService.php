<?php

namespace App\Services;

use App\Models\Payment;

class PaymentScheduleVoidService
{
    public function void(
        Payment $payment,
        string $reason,
        string $source = 'system',
        ?int $actorId = null,
        ?int $replacementPaymentId = null
    ): bool {
        $payment->loadMissing(['events', 'refundCases']);

        if (! $payment->isVoidableScheduleTerm()) {
            return false;
        }

        $metadata = [
            'reason' => $reason,
            'old_amount' => (float) $payment->amount,
            'old_due_date' => $payment->due_date?->toDateString(),
            'old_payment_type' => $payment->payment_type,
            'replacement_payment_id' => $replacementPaymentId,
        ];

        $payment->forceFill([
            'voided_at' => now(),
            'voided_by' => $actorId,
            'void_reason' => $reason,
            'superseded_by_payment_id' => $replacementPaymentId,
        ])->save();

        PaymentEventService::record(
            'payment_term_voided',
            $source,
            $payment,
            $metadata,
            $payment->paymongo_payment_id ?: $payment->paymongo_checkout_session_id
        );

        return true;
    }
}
