<?php

namespace App\Models;

use App\Models\Concerns\StoresPostgresBooleans;
use Illuminate\Database\Eloquent\Model;

class EventType extends Model
{
    use StoresPostgresBooleans;

    protected $fillable = [
        'slug',
        'label',
        'icon',
        'description',
        'image',
        'package_category',
        'applicable_setups',
        'security_type',
        'security_label',
        'security_description',
        'is_active',
        'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'applicable_setups' => 'array',
            'is_active' => 'boolean',
            'archived_at' => 'datetime',
        ];
    }

    public function bookings()
    {
        return $this->hasMany(Booking::class);
    }

    public function setIsActiveAttribute($value): void
    {
        $this->storeBooleanAttribute('is_active', $value);
    }
}
