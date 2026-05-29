<?php

namespace App\Models;

use App\Models\Concerns\StoresPostgresBooleans;
use Illuminate\Database\Eloquent\Model;

class MenuItem extends Model
{
    use StoresPostgresBooleans;

    protected $fillable = [
        'dish_id',
        'name',
        'category',
        'cost_per_head',
        'price_adj',
        'image',
        'description',
        'is_best_seller',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'cost_per_head'      => 'integer',
            'price_adj'          => 'integer',
            'is_best_seller'     => 'boolean',
            'is_active'          => 'boolean',
        ];
    }

    // ─── Relationships ───

    public function ingredients()
    {
        return $this->hasMany(DishIngredient::class, 'menu_item_id');
    }

    public function bookingItems()
    {
        return $this->hasMany(BookingItem::class, 'menu_item_id');
    }

    // ─── Accessors ───

    public function setIsBestSellerAttribute($value): void
    {
        $this->storeBooleanAttribute('is_best_seller', $value);
    }

    public function setIsActiveAttribute($value): void
    {
        $this->storeBooleanAttribute('is_active', $value);
    }

    public function getTotalPricePerHeadAttribute(): int
    {
        return $this->cost_per_head + $this->price_adj;
    }
}
