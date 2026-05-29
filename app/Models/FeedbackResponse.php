<?php

namespace App\Models;

use App\Models\Concerns\StoresPostgresBooleans;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeedbackResponse extends Model
{
    use StoresPostgresBooleans;

    protected $fillable = [
        'feedback_request_id',
        'booking_id',
        'user_id',
        'rating',
        'food_rating',
        'service_rating',
        'communication_rating',
        'value_rating',
        'comments',
        'testimonial_permission',
        'follow_up_required',
        'assigned_to',
        'follow_up_due_at',
        'review_status',
        'testimonial_status',
        'retention_notes',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $casts = [
        'testimonial_permission' => 'boolean',
        'follow_up_required' => 'boolean',
        'follow_up_due_at' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    public function request(): BelongsTo
    {
        return $this->belongsTo(FeedbackRequest::class, 'feedback_request_id');
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function setTestimonialPermissionAttribute($value): void
    {
        $this->storeBooleanAttribute('testimonial_permission', $value);
    }

    public function setFollowUpRequiredAttribute($value): void
    {
        $this->storeBooleanAttribute('follow_up_required', $value);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }
}
