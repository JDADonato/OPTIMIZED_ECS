<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'booking_id',
        'amount',
        'payment_method',
        'proof_image',
        'status',
        'payment_type',
        'due_date',
        'verified_by',
        'verified_at',
        'paymongo_checkout_session_id',
        'paymongo_payment_id',
        'paymongo_payment_intent_id',
        'paymongo_reference_number',
        'paymongo_event_id',
        'voided_at',
        'voided_by',
        'void_reason',
        'superseded_by_payment_id',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'due_date' => 'date',
            'verified_at' => 'datetime',
            'voided_at' => 'datetime',
        ];
    }

    // ─── Relationships ───

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }

    public function events()
    {
        return $this->hasMany(PaymentEvent::class);
    }

    public function refundCases()
    {
        return $this->hasMany(RefundCase::class);
    }

    public function voidedBy()
    {
        return $this->belongsTo(User::class, 'voided_by');
    }

    public function supersededBy()
    {
        return $this->belongsTo(Payment::class, 'superseded_by_payment_id');
    }

    public function scopeActive($query)
    {
        return $query->whereNull('voided_at');
    }

    public function isVoidableScheduleTerm(): bool
    {
        if ($this->voided_at) {
            return false;
        }

        if (in_array($this->status, ['Paid', 'Verified', 'Refunded'], true)) {
            return false;
        }

        if (filled($this->proof_image)
            || filled($this->paymongo_checkout_session_id)
            || filled($this->paymongo_payment_id)
            || filled($this->paymongo_payment_intent_id)
            || filled($this->paymongo_reference_number)
            || filled($this->paymongo_event_id)) {
            return false;
        }

        if ($this->relationLoaded('events') ? $this->events->isNotEmpty() : $this->events()->exists()) {
            return false;
        }

        if ($this->relationLoaded('refundCases') ? $this->refundCases->isNotEmpty() : $this->refundCases()->exists()) {
            return false;
        }

        return in_array($this->status, ['Pending', 'Failed', 'Rejected'], true);
    }

    protected static function booted(): void
    {
        static::saved(fn (Payment $payment) => self::bumpCustomerDashboardVersion($payment));
        static::deleted(fn (Payment $payment) => self::bumpCustomerDashboardVersion($payment));
    }

    private static function bumpCustomerDashboardVersion(Payment $payment): void
    {
        if (! $payment->booking_id) {
            return;
        }

        Cache::increment("customer.dashboard.payment_version.booking.{$payment->booking_id}");
    }
}
