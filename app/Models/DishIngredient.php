<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DishIngredient extends Model
{
    protected $fillable = [
        'menu_item_id',
        'inventory_item_id',
        'quantity_needed',
    ];

    protected function casts(): array
    {
        return [
            'quantity_needed' => 'decimal:2',
        ];
    }

    // ─── Relationships ───

    public function dish()
    {
        return $this->belongsTo(MenuItem::class, 'menu_item_id');
    }

    public function ingredient()
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }
}
