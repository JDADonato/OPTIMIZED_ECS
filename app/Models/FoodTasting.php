<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FoodTasting extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'guest_name',
        'guest_email',
        'guest_phone',
        'preferred_date',
        'preferred_time',
        'notes',
        'status',
        'confirmed_at',
        'completed_at',
        'archived_at',
        'outcome_notes',
        'handled_by',
        'duplicate_user_id',
    ];

    protected function casts(): array
    {
        return [
            'preferred_date' => 'date',
            'confirmed_at' => 'datetime',
            'completed_at' => 'datetime',
            'archived_at' => 'datetime',
        ];
    }

    // ─── Relationships ───

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function duplicateUser()
    {
        return $this->belongsTo(User::class, 'duplicate_user_id');
    }
}
