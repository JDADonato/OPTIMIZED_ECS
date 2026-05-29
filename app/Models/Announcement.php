<?php

namespace App\Models;

use App\Models\Concerns\StoresPostgresBooleans;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class Announcement extends Model
{
    use StoresPostgresBooleans;

    protected $fillable = [
        'title',
        'slug',
        'summary',
        'body',
        'type',
        'status',
        'visibility',
        'visibility_roles',
        'specific_user_ids',
        'starts_at',
        'ends_at',
        'published_at',
        'created_by',
        'updated_by',
        'approved_by',
        'send_email',
        'email_subject',
        'email_body',
        'cta_label',
        'cta_url',
        'image_path',
    ];

    protected $casts = [
        'visibility_roles' => 'array',
        'specific_user_ids' => 'array',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'published_at' => 'datetime',
        'send_email' => 'boolean',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(AnnouncementRecipient::class);
    }

    public function reads(): HasMany
    {
        return $this->hasMany(AnnouncementRead::class);
    }

    public function setSendEmailAttribute($value): void
    {
        $this->storeBooleanAttribute('send_email', $value);
    }

    public function scopeVisibleNow(Builder $query): Builder
    {
        $now = Carbon::now();

        return $query
            ->where('status', 'published')
            ->where(function ($q) use ($now) {
                $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now);
            })
            ->where(function ($q) use ($now) {
                $q->whereNull('ends_at')->orWhere('ends_at', '>=', $now);
            });
    }
}
