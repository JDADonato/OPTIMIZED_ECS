<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RefundCase extends Model
{
    protected $fillable = [
        'booking_id',
        'payment_id',
        'amount',
        'non_refundable_amount',
        'reason',
        'status',
        'last_action',
        'requested_by',
        'approved_by',
        'resolved_by',
        'resolved_at',
        'provider_refund_id',
        'provider_refund_status',
        'provider_synced_at',
        'provider_response',
        'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'non_refundable_amount' => 'decimal:2',
        'provider_response' => 'array',
        'provider_synced_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }
}
