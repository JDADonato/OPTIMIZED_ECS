<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private array $localImages = [
        'formal-wedding' => '/images/event-types/formal-wedding.webp',
        'debut' => '/images/event-types/debut.webp',
        'casual-birthday' => '/images/event-types/casual-birthday.webp',
        'corporate-seminar' => '/images/event-types/corporate-seminar.webp',
        'family-reunion' => '/images/event-types/family-reunion.webp',
        'anniversary' => '/images/event-types/anniversary.webp',
        'graduation' => '/images/event-types/graduation.webp',
        'other' => '/images/event-types/other.webp',
    ];

    private array $previousImages = [
        'formal-wedding' => 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=800&auto=format&fit=crop',
        'debut' => 'https://images.unsplash.com/photo-1541086095944-f4b5412d3666?q=80&w=800&auto=format&fit=crop',
        'casual-birthday' => 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?q=80&w=800&auto=format&fit=crop',
        'corporate-seminar' => 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?q=80&w=800&auto=format&fit=crop',
        'family-reunion' => 'https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=800&auto=format&fit=crop',
        'anniversary' => 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=800&auto=format&fit=crop',
        'graduation' => 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=800&auto=format&fit=crop',
        'other' => 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?q=80&w=800&auto=format&fit=crop',
    ];

    public function up(): void
    {
        foreach ($this->localImages as $slug => $image) {
            DB::table('event_types')
                ->where('slug', $slug)
                ->update(['image' => $image]);
        }
    }

    public function down(): void
    {
        foreach ($this->previousImages as $slug => $image) {
            DB::table('event_types')
                ->where('slug', $slug)
                ->update(['image' => $image]);
        }
    }
};
