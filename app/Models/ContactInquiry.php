<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ContactInquiry extends Model
{
    use HasFactory;

    protected $fillable = [
        'full_name',
        'email',
        'phone',
        'event_date',
        'pax',
        'event_type',
        'concern_type',
        'subject',
        'message',
        'status',
        'source',
        'assigned_to',
        'duplicate_user_id',
        'resolved_at',
        'archived_at',
        'staff_notes',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'event_date' => 'date',
            'pax' => 'integer',
            'resolved_at' => 'datetime',
            'archived_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function duplicateUser()
    {
        return $this->belongsTo(User::class, 'duplicate_user_id');
    }
}
