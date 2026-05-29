<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class FeedbackRequest extends Model
{
    protected $fillable = [
        'booking_id',
        'user_id',
        'token',
        'status',
        'sent_at',
        'completed_at',
        'expires_at',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
        'completed_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function response(): HasOne
    {
        return $this->hasOne(FeedbackResponse::class);
    }
}
