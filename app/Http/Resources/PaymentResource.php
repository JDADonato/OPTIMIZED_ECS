<?php

namespace App\Http\Resources;

use App\Support\PaymentLabels;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $method = PaymentLabels::method($this->payment_method);

        return [
            'id' => $this->id,
            'booking_id' => $this->booking_id,
            'amount' => (float) $this->amount,
            'payment_method' => $this->payment_method,
            'payment_method_label' => $method['label'],
            'payment_method_meta' => $method,
            'status' => $this->status,
            'payment_type' => $this->payment_type,
            'due_date' => $this->due_date,
            'verified_by' => $this->verified_by,
            'verified_at' => $this->verified_at,
            'voided_at' => $this->voided_at,
            'void_reason' => $this->void_reason,
            'superseded_by_payment_id' => $this->superseded_by_payment_id,
            'schedule_state_label' => $this->voided_at ? 'Voided schedule term' : 'Active schedule term',
            'paymongo_checkout_session_id' => $this->paymongo_checkout_session_id ?? null,
            'paymongo_payment_id' => $this->paymongo_payment_id ?? null,
            'paymongo_reference_number' => $this->paymongo_reference_number ?? null,
        ];
    }
}
