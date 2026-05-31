<?php

namespace App\Models;

use App\Models\Concerns\StoresPostgresBooleans;
use App\Support\PasswordPolicy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable, StoresPostgresBooleans;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'full_name',
        'username',
        'password',
        'email',
        'phone',
        'avatar_path',
        'preferred_contact_method',
        'notification_preferences',
        'profile_preferences',
        'role',
        'email_verified_at',
        'otp_code',
        'otp_expires_at',
        'otp_resend_available_at',
        'otp_resend_attempts',
        'account_status',
        'deactivated_at',
        'deactivated_by',
        'deactivation_reason',
        'must_change_password',
        'password_changed_at',
        'password_policy_version',
        'temporary_password_expires_at',
        'temporary_password_secret',
        'last_login_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     */
    protected $hidden = [
        'password',
        'remember_token',
        'otp_code',
        'temporary_password_secret',
    ];

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'email_verified_at' => 'datetime',
            'otp_expires_at' => 'datetime',
            'otp_resend_available_at' => 'datetime',
            'otp_resend_attempts' => 'integer',
            'deactivated_at' => 'datetime',
            'must_change_password' => 'boolean',
            'password_changed_at' => 'datetime',
            'password_policy_version' => 'integer',
            'temporary_password_expires_at' => 'datetime',
            'temporary_password_secret' => 'encrypted',
            'last_login_at' => 'datetime',
            'notification_preferences' => 'array',
            'profile_preferences' => 'array',
        ];
    }

    // ─── Relationships ───

    public function setMustChangePasswordAttribute($value): void
    {
        $this->storeBooleanAttribute('must_change_password', $value);
    }

    public function getMustChangePasswordAttribute($value): bool
    {
        return $this->readBooleanAttribute($value);
    }

    public function requiresPasswordChange(): bool
    {
        return $this->readBooleanAttribute(
            $this->getAttributes()['must_change_password'] ?? $this->getRawOriginal('must_change_password')
        );
    }

    public function usesCurrentPasswordPolicy(): bool
    {
        return PasswordPolicy::isCurrent($this->password_policy_version);
    }

    public function bookings()
    {
        return $this->hasMany(Booking::class);
    }

    public function foodTastings()
    {
        return $this->hasMany(FoodTasting::class);
    }

    public function sentMessages()
    {
        return $this->hasMany(Message::class, 'sender_id');
    }

    public function receivedMessages()
    {
        return $this->hasMany(Message::class, 'receiver_id');
    }

    /**
     * Conversations started by this user (as a client).
     */
    public function clientConversations()
    {
        return $this->hasMany(Conversation::class, 'client_id');
    }

    /**
     * Conversations claimed by this user (as staff).
     */
    public function staffConversations()
    {
        return $this->hasMany(Conversation::class, 'staff_id');
    }

    public function conversationParticipations()
    {
        return $this->hasMany(ConversationParticipant::class);
    }

    // ─── Role Helpers ───

    public function isAdmin(): bool
    {
        return $this->role === 'Admin';
    }

    public function isMarketing(): bool
    {
        return $this->role === 'Marketing';
    }

    public function isAccounting(): bool
    {
        return $this->role === 'Accounting';
    }

    public function isClient(): bool
    {
        return $this->role === 'Client';
    }

    public function isActive(): bool
    {
        return ($this->account_status ?? 'active') === 'active';
    }

    public function scopeActiveAccounts($query)
    {
        return $query->where(fn ($inner) => $inner
            ->whereNull('account_status')
            ->orWhere('account_status', 'active'));
    }

    public function scopeReachableForNotifications($query)
    {
        return $query->activeAccounts()
            ->whereNotNull('email')
            ->where('email', '!=', '')
            ->where('email', 'not like', '%@eloquente.invalid');
    }

    public function hasPlaceholderEmail(): bool
    {
        return is_string($this->email) && str_ends_with($this->email, '@eloquente.invalid');
    }

    public function isReachableForNotifications(): bool
    {
        return $this->isActive()
            && filled($this->email)
            && ! $this->hasPlaceholderEmail();
    }
}
