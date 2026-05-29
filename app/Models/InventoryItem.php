<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryItem extends Model
{
    protected $fillable = [
        'name',
        'unit',
        'quantity_in_stock',
        'minimum_threshold',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'quantity_in_stock'  => 'integer',
            'minimum_threshold'  => 'integer',
        ];
    }

    // ─── Relationships ───

    public function dishes()
    {
        return $this->belongsToMany(MenuItem::class, 'dish_ingredients', 'inventory_item_id', 'menu_item_id');
    }

    // ─── Query Scopes ───

    public function scopeLowStock($query)
    {
        return $query->whereColumn('quantity_in_stock', '<=', 'minimum_threshold');
    }

    public function scopeOutOfStock($query)
    {
        return $query->where('quantity_in_stock', 0);
    }

    // ─── Accessors ───

    public function getIsLowStockAttribute(): bool
    {
        return $this->quantity_in_stock <= $this->minimum_threshold;
    }
}
