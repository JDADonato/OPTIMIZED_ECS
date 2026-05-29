<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BookingItem extends Model
{
    protected $fillable = [
        'booking_id',
        'menu_item_id',
        'quantity',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
        ];
    }

    // ─── Relationships ───

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }

    public function menuItem()
    {
        return $this->belongsTo(MenuItem::class);
    }
}
