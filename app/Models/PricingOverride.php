<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PricingOverride extends Model
{
    /**
     * The primary key type is string (e.g., "dish_chicken_adobo").
     */
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'item_type',
        'item_id',
        'new_price',
    ];

    protected function casts(): array
    {
        return [
            'new_price' => 'decimal:2',
        ];
    }
}
