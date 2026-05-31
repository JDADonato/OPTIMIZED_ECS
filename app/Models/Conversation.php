<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Conversation extends Model
{
    use HasFactory;

    protected $fillable = [
        'client_id',
        'staff_id',
        'booking_id',
        'status',
        'joined_by_admin_at',
        'internal_notes',
        'reopened_at',
    ];

    // ─── Relationships ───

    /**
     * The client who started this conversation.
     */
    public function client()
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    /**
     * The staff member who claimed this conversation (nullable).
     */
    public function staff()
    {
        return $this->belongsTo(User::class, 'staff_id');
    }

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }

    public function participants()
    {
        return $this->hasMany(ConversationParticipant::class)->active();
    }

    public function participantHistory()
    {
        return $this->hasMany(ConversationParticipant::class);
    }

    public function collaborators()
    {
        return $this->participants()->where('role', 'collaborator');
    }

    public function adminObservers()
    {
        return $this->participants()->where('role', 'admin_observer');
    }

    /**
     * All messages in this conversation.
     */
    public function messages()
    {
        return $this->hasMany(Message::class)->orderBy('created_at', 'asc');
    }

    /**
     * The latest message in this conversation (for sidebar previews).
     */
    public function latestMessage()
    {
        return $this->hasOne(Message::class)->latestOfMany();
    }

    // ─── Scopes ───

    /**
     * Conversations waiting in the unassigned queue.
     */
    public function scopeUnassigned($query)
    {
        return $query->whereNull('staff_id')
            ->where('status', 'active')
            ->withActiveClient();
    }

    /**
     * Active conversations claimed by a specific staff member.
     */
    public function scopeClaimedBy($query, int $staffId)
    {
        return $query->where('status', 'active')
            ->withActiveClient()
            ->where(function ($inner) use ($staffId) {
                $inner->where('staff_id', $staffId)
                    ->orWhereHas('participants', function ($participant) use ($staffId) {
                        $participant->where('user_id', $staffId)
                            ->whereIn('role', ['owner', 'collaborator', 'admin_observer']);
                    });
            });
    }

    /**
     * All resolved conversations.
     */
    public function scopeResolved($query)
    {
        return $query->where('status', 'resolved');
    }

    public function scopeWithActiveClient($query)
    {
        return $query->whereHas('client', fn ($client) => $client->activeAccounts());
    }

    // ─── Helpers ───

    /**
     * Check if the conversation has been claimed by any staff.
     */
    public function isClaimed(): bool
    {
        return ! is_null($this->staff_id);
    }

    /**
     * Check if the conversation is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
