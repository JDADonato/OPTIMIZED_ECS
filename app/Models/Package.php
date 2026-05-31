<?php

namespace App\Models;

use App\Models\Concerns\StoresPostgresBooleans;
use Illuminate\Database\Eloquent\Model;

class Package extends Model
{
    use StoresPostgresBooleans;

    protected $fillable = [
        'name',
        'type',
        'package_category',
        'event_type_slugs',
        'base_price_per_head',
        'minimum_pax',
        'description',
        'inclusions',
        'amenities',
        'applicable_setups',
        'menu_structure',
        'security_type',
        'security_label',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'base_price_per_head' => 'integer',
            'minimum_pax' => 'integer',
            'event_type_slugs' => 'array',
            'inclusions' => 'array',
            'amenities' => 'array',
            'applicable_setups' => 'array',
            'menu_structure' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function setIsActiveAttribute($value): void
    {
        $this->storeBooleanAttribute('is_active', $value);
    }
}
