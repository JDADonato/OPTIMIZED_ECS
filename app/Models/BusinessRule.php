<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class BusinessRule extends Model
{
    protected $fillable = [
        'minimum_lead_days',
        'maximum_capacity_per_day',
        'maximum_pax_per_event',
        'minimum_pax_per_event',
        'is_active',
        'reservation_fee_percentage',
        'downpayment_percentage',
        'final_payment_percentage',
        'reservation_validity_hours',
        'downpayment_due_days',
        'final_payment_due_days',
    ];

    protected function casts(): array
    {
        return [
            'minimum_lead_days' => 'integer',
            'maximum_capacity_per_day' => 'integer',
            'maximum_pax_per_event' => 'integer',
            'minimum_pax_per_event' => 'integer',
            'is_active' => 'boolean',
            'reservation_fee_percentage' => 'decimal:2',
            'downpayment_percentage' => 'decimal:2',
            'final_payment_percentage' => 'decimal:2',
            'reservation_validity_hours' => 'integer',
            'downpayment_due_days' => 'integer',
            'final_payment_due_days' => 'integer',
        ];
    }

    public static function getActive(): ?self
    {
        return Cache::remember('business_rules.active', now()->addMinutes(5), fn () => (
            self::whereRaw('is_active is true')->first() ?? self::first()
        ));
    }
}
