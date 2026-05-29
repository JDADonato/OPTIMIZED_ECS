<?php

namespace App\Models;

use App\Models\Concerns\StoresPostgresBooleans;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CalendarAvailabilityOverride extends Model
{
    use HasFactory, StoresPostgresBooleans;

    protected $fillable = [
        'date',
        'is_locked',
        'max_events_override',
        'max_pax_override',
        'note',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'is_locked' => 'boolean',
            'max_events_override' => 'integer',
            'max_pax_override' => 'integer',
        ];
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function setIsLockedAttribute($value): void
    {
        $this->storeBooleanAttribute('is_locked', $value);
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
