<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ConversationParticipant extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'conversation_id',
        'user_id',
        'role',
        'joined_by',
        'joined_at',
        'removed_at',
        'removed_by',
        'removal_reason',
    ];

    protected function casts(): array
    {
        return [
            'joined_at' => 'datetime',
            'removed_at' => 'datetime',
        ];
    }

    public function scopeActive($query)
    {
        return $query->whereNull('removed_at');
    }

    public function scopeRemoved($query)
    {
        return $query->whereNotNull('removed_at');
    }

    public function conversation()
    {
        return $this->belongsTo(Conversation::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function joinedBy()
    {
        return $this->belongsTo(User::class, 'joined_by');
    }

    public function removedBy()
    {
        return $this->belongsTo(User::class, 'removed_by');
    }
}
