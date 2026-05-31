<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\EventType;
use App\Models\MenuItem;
use App\Models\Package;
use App\Models\Payment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class AnalyticsDemoSeeder extends Seeder
{
    private const DEMO_DOMAIN = 'demo.eloquente.test';

    public function run(): void
    {
        if (! app()->environment('local')) {
            $message = 'Analytics demo seeding is disabled outside APP_ENV=local. Use php artisan db:seed --class=AnalyticsDemoSeeder only in a local demo database.';

            if (app()->environment('production')) {
                throw new RuntimeException($message);
            }

            $this->command?->warn($message);

            return;
        }

        mt_srand(20260520);

        if ($this->generatedAnalyticsBookingsExist()) {
            $this->command?->info('Analytics demo data already exists; keeping existing demo accounts and bookings.');

            return;
        }

        DB::transaction(function () {
            $this->cleanGeneratedAnalyticsData();
            $this->ensureMenuVolume();
            $clients = $this->seedClients();
            $this->seedBookings($clients);
        });

        Cache::forget('admin.analytics.v3');
        Cache::forget('admin.analytics.v4');
        Cache::put('admin.analytics.version', (int) Cache::get('admin.analytics.version', 1) + 1);

        $this->command?->info('Seeded analytics demo data: 125 clients, 216 bookings from 2024-2026, payments, and booking menu items.');
    }

    private function generatedAnalyticsBookingsExist(): bool
    {
        return Booking::where('client_email', 'like', '%@'.self::DEMO_DOMAIN)->exists();
    }

    private function cleanGeneratedAnalyticsData(): void
    {
        $bookingIds = Booking::where('client_email', 'like', '%@'.self::DEMO_DOMAIN)->pluck('id');

        if ($bookingIds->isNotEmpty()) {
            $this->deleteGeneratedBookingChildren($bookingIds->all());

            Payment::whereIn('booking_id', $bookingIds)->delete();
            BookingItem::whereIn('booking_id', $bookingIds)->delete();
            Booking::whereIn('id', $bookingIds)->delete();
        }

        $this->deleteGeneratedAnalyticsUsers();
        MenuItem::where('dish_id', 'like', 'demo_%')->delete();
    }

    private function deleteGeneratedBookingChildren(array $bookingIds): void
    {
        $children = [
            'feedback_responses',
            'feedback_requests',
            'payment_events',
            'refund_cases',
            'event_preparation_tasks',
            'booking_review_tasks',
            'booking_history_notes',
            'conversion_events',
        ];

        foreach ($children as $table) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, 'booking_id')) {
                DB::table($table)->whereIn('booking_id', $bookingIds)->delete();
            }
        }
    }

    private function deleteGeneratedAnalyticsUsers(): void
    {
        $userIds = User::where('username', 'like', 'ecs_demo_client_%')->pluck('id')->all();

        if (empty($userIds)) {
            return;
        }

        $conversationIds = [];

        if (Schema::hasTable('conversations')) {
            $conversationIds = DB::table('conversations')
                ->whereIn('client_id', $userIds)
                ->orWhereIn('staff_id', $userIds)
                ->pluck('id')
                ->all();
        }

        if (Schema::hasTable('messages')) {
            DB::table('messages')
                ->when(! empty($conversationIds), fn ($query) => $query->whereIn('conversation_id', $conversationIds))
                ->orWhereIn('sender_id', $userIds)
                ->orWhereIn('receiver_id', $userIds)
                ->delete();
        }

        if (Schema::hasTable('conversation_participants')) {
            DB::table('conversation_participants')
                ->when(! empty($conversationIds), fn ($query) => $query->whereIn('conversation_id', $conversationIds))
                ->orWhereIn('user_id', $userIds)
                ->delete();
        }

        if (! empty($conversationIds)) {
            DB::table('conversations')->whereIn('id', $conversationIds)->delete();
        }

        User::whereIn('id', $userIds)->delete();
    }

    private function ensureMenuVolume(): void
    {
        $targets = [
            'starter' => 22,
            'main' => 36,
            'side' => 20,
            'dessert' => 18,
            'drink' => 14,
        ];

        $names = [
            'starter' => ['Roasted Squash Soup', 'Citrus Garden Salad', 'Spinach Artichoke Dip', 'Tomato Basil Bisque', 'Mini Beef Empanadas', 'Cucumber Canapes', 'Smoked Chicken Tartlets', 'Shrimp Cocktail Cups', 'Mushroom Vol-au-Vent', 'Crispy Tofu Bites', 'Herbed Potato Croquettes', 'Asian Slaw Cups'],
            'main' => ['Chicken Roulade', 'Beef Caldereta', 'Pork Medallions', 'Baked Salmon', 'Herb Roasted Chicken', 'Kare-Kare Beef', 'Fish Florentine', 'Pork Asado', 'Chicken Cordon Bleu', 'Beef Stroganoff', 'Garlic Prawn Pasta', 'Lengua Estofado', 'Soy Ginger Fish', 'Pork BBQ Skewers', 'Truffle Cream Chicken', 'Vegetable Lasagna'],
            'side' => ['Garlic Butter Rice', 'Herbed Mashed Potato', 'Vegetable Pilaf', 'Buttered Corn', 'Roasted Mixed Vegetables', 'Creamy Macaroni', 'Pancit Canton', 'Potato Gratin', 'Spanish Rice', 'Sauteed Green Beans'],
            'dessert' => ['Mango Panna Cotta', 'Mini Cheesecake', 'Leche Flan Cups', 'Chocolate Mousse', 'Fruit Tartlets', 'Ube Panna Cotta', 'Brazo de Mercedes', 'Tiramisu Cups', 'Pandan Jelly', 'Banoffee Cups'],
            'drink' => ['Calamansi Cooler', 'Cucumber Lemonade', 'Four Seasons Juice', 'House Iced Tea', 'Blue Lemonade', 'Mango Citrus Punch', 'Brewed Coffee Station', 'Hot Chocolate'],
        ];

        $images = [
            'starter' => 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&q=80&w=400',
            'main' => 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=400',
            'side' => 'https://images.unsplash.com/photo-1543352634-a1c51d9f1fa7?auto=format&fit=crop&q=80&w=400',
            'dessert' => 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&q=80&w=400',
            'drink' => 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&q=80&w=400',
        ];

        foreach ($targets as $category => $target) {
            $current = MenuItem::where('category', $category)->count();
            $needed = max(0, $target - $current);

            for ($i = 0; $i < $needed; $i++) {
                $baseName = $names[$category][$i % count($names[$category])];
                $variant = intdiv($i, count($names[$category])) + 1;
                $name = $variant > 1 ? "{$baseName} {$variant}" : $baseName;

                DB::table('menu_items')->insert([
                    'dish_id' => 'demo_'.$category.'_'.str_pad((string) ($i + 1), 3, '0', STR_PAD_LEFT),
                    'name' => $name,
                    'category' => $category,
                    'cost_per_head' => $this->menuPrice($category, $i),
                    'price_adj' => in_array($category, ['main', 'dessert'], true) && $i % 5 === 0 ? 20 : 0,
                    'image' => $images[$category],
                    'description' => $this->menuDescription($category),
                    'is_best_seller' => $i % 7 === 0 ? DB::raw('true') : DB::raw('false'),
                    'is_active' => DB::raw('true'),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    private function seedClients(): array
    {
        $firstNames = ['Maria', 'James', 'Angela', 'Nina', 'Rafael', 'Bea', 'Carlo', 'Trisha', 'Miguel', 'Sofia', 'Paolo', 'Isabel', 'Marco', 'Camille', 'Luis', 'Andrea', 'Enzo', 'Patricia', 'Daniel', 'Mika'];
        $lastNames = ['Santos', 'Reyes', 'Cruz', 'Lim', 'Tan', 'Mendoza', 'Garcia', 'Dela Cruz', 'Villanueva', 'Sy', 'Ramos', 'Torres', 'Navarro', 'Chua', 'Aquino', 'Bautista', 'Castillo', 'Gonzales', 'Rivera', 'Yu'];
        $clients = [];

        for ($i = 1; $i <= 125; $i++) {
            $first = $firstNames[($i - 1) % count($firstNames)];
            $last = $lastNames[(int) floor(($i - 1) / count($firstNames)) % count($lastNames)];
            $name = "{$first} {$last}";
            $clients[] = [
                'name' => $name,
                'user' => User::create([
                    'full_name' => $name,
                    'username' => 'ecs_demo_client_'.str_pad((string) $i, 3, '0', STR_PAD_LEFT),
                    'password' => 'password123',
                    'role' => 'Client',
                    'email' => 'client'.str_pad((string) $i, 3, '0', STR_PAD_LEFT).'@'.self::DEMO_DOMAIN,
                    'phone' => '09'.str_pad((string) (170000000 + $i * 713), 9, '0', STR_PAD_LEFT),
                    'email_verified_at' => now(),
                    'account_status' => 'active',
                    'preferred_contact_method' => 'email',
                    'notification_preferences' => [
                        'email_enabled' => true,
                        'sound_enabled' => false,
                        'quiet_mode' => false,
                        'chat_email_enabled' => true,
                        'payment_email_enabled' => true,
                    ],
                    'profile_preferences' => [],
                    'created_at' => now()->subDays(260 - ($i % 180)),
                    'updated_at' => now(),
                ]),
            ];
        }

        return $clients;
    }

    private function seedBookings(array $clients): void
    {
        $packages = Package::whereRaw('is_active is true')->get()->values();
        $eventTypes = EventType::all()->keyBy('slug');
        $menuItems = MenuItem::where('is_active', DB::raw('true'))->get()->groupBy('category');
        $cities = ['Makati City', 'Quezon City', 'Pasig City', 'Taguig City', 'San Juan', 'Paranaque City', 'Mandaluyong', 'Alabang', 'Antipolo City', 'Tagaytay City', 'Santa Rosa'];
        $venues = ['Grand Pavilion', 'Glass Garden', 'Corporate Hall', 'Lakeside Events Place', 'Heritage Ballroom', 'Skyline Function Room', 'Vista Tent', 'Garden Courtyard', 'Ayala Executive Hall', 'The Blue Leaf Pavilion'];
        $eventPattern = [
            'formal-wedding',
            'corporate-seminar',
            'casual-birthday',
            'debut',
            'family-reunion',
            'graduation',
            'anniversary',
            'corporate-seminar',
            'formal-wedding',
            'other',
        ];
        $months = collect();
        $cursor = Carbon::create(2024, 1, 1)->startOfMonth();
        $last = Carbon::create(2026, 12, 1)->startOfMonth();
        while ($cursor->lte($last)) {
            $weight = in_array($cursor->month, [5, 6, 11, 12], true) ? 9 : (in_array($cursor->month, [2, 3, 10], true) ? 6 : 4);
            for ($j = 0; $j < $weight; $j++) {
                $months->push($cursor->copy());
            }
            $cursor->addMonth();
        }

        for ($i = 0; $i < 216; $i++) {
            $client = $clients[$i % count($clients)];
            $eventSlug = $eventPattern[$i % count($eventPattern)];
            $eventType = $eventTypes[$eventSlug] ?? $eventTypes->first();
            $package = $this->packageForEvent($packages, $eventType?->slug ?? 'other', $i);
            $month = $months[$i % $months->count()];
            $eventDate = $month->copy()->addDays(2 + (($i * 5) % 24));
            $city = $cities[$i % count($cities)];
            $pax = $this->paxForEvent($eventType?->slug ?? '', $i);
            $base = (int) ($package?->base_price_per_head ?? 650);
            $transport = in_array($city, ['Antipolo City', 'Tagaytay City', 'Santa Rosa'], true) ? 8500 + (($i % 3) * 1500) : 2500 + (($i % 4) * 700);
            $labor = $pax >= 280 ? 16000 : ($pax >= 160 ? 9500 : 4500);
            $baseEventCost = $base * $pax;
            $serviceCharge = in_array($package?->package_category, ['premium', 'birthday'], true) ? (int) round($baseEventCost * 0.10) : 0;
            $vat = $package?->package_category === 'standard' ? (int) round($baseEventCost * 0.12) : 0;
            $security = $package?->security_type === 'contingency' ? (int) round(($baseEventCost + $serviceCharge + $transport + $labor) * 0.10) : 1500;
            $stylePremium = $package?->package_category === 'premium' ? 18000 : 0;
            $total = $baseEventCost + $serviceCharge + $vat + $security + $transport + $labor + $stylePremium;
            $status = $this->statusForDate($eventDate, $i);

            $booking = Booking::create([
                'user_id' => $client['user']->id,
                'event_date' => $eventDate->toDateString(),
                'event_time' => ['10:00', '12:00', '15:00', '18:00'][$i % 4],
                'pax' => $pax,
                'budget' => $total,
                'package_id' => $package ? (string) $package->id : null,
                'event_type_id' => $eventType?->id,
                'event_type' => $eventType?->label ?? 'Social Event',
                'client_full_name' => $client['name'],
                'venue_address_line' => ($i + 18).' '.$venues[$i % count($venues)],
                'venue_street' => 'Events Avenue',
                'venue_city' => $city,
                'venue_province' => in_array($city, ['Tagaytay City', 'Santa Rosa'], true) ? 'Cavite/Laguna Area' : 'Metro Manila',
                'venue_zip_code' => (string) (1000 + ($i % 80)),
                'client_email' => $client['user']->email,
                'client_phone' => $client['user']->phone,
                'reservation_time' => '16:00',
                'serving_time' => ['12:30', '18:30', '19:00'][$i % 3],
                'event_timeline' => "Ingress 4 hours before service\nGuest arrival 1 hour before service\nBuffet opens after program cue",
                'color_motif' => ['burgundy and gold', 'sage and ivory', 'navy and champagne', 'dusty blue and white'][$i % 4],
                'total_cost' => $total,
                'status' => $status,
                'selected_menu' => json_encode([]),
                'live_status' => $status === 'Completed' ? 'Completed' : ($status === 'Confirmed' ? 'Payment Verified' : 'Not Started'),
                'transport_fee' => $transport,
                'labor_surcharge' => $labor,
                'created_at' => $this->notInFuture($eventDate->copy()->subDays(28 + ($i % 42))),
                'updated_at' => $eventDate->isPast() ? $eventDate->copy()->addDays(2) : now()->subDays($i % 9),
            ]);

            $selected = $this->attachMenuItems($booking, $menuItems, $i, $package);
            $booking->update(['selected_menu' => $selected]);
            $this->seedPaymentPlan($booking, $status);
        }
    }

    private function packageForEvent($packages, string $eventSlug, int $index): ?Package
    {
        $candidates = $packages->filter(function ($package) use ($eventSlug) {
            $slugs = $package->event_type_slugs ?: [];

            return $package->type === $eventSlug || in_array($eventSlug, $slugs, true);
        })->values();

        if ($candidates->isEmpty()) {
            $candidates = $packages->where('package_category', 'standard')->values();
        }

        return $candidates->isNotEmpty() ? $candidates[$index % $candidates->count()] : null;
    }

    private function attachMenuItems(Booking $booking, $menuItems, int $index, ?Package $package): array
    {
        $structure = $this->normalizePackageStructure($package?->menu_structure ?: []);
        $selected = [];

        foreach ($structure as $category => $count) {
            $items = ($menuItems[$category] ?? collect())->values();
            $selected[$category] = [];

            for ($i = 0; $i < $count && $items->isNotEmpty(); $i++) {
                $item = $items[($index + ($i * 7)) % $items->count()];
                $selected[$category][] = [
                    'id' => $item->id,
                    'name' => $item->name,
                    'costPerHead' => (float) $item->cost_per_head,
                    'priceAdj' => (float) $item->price_adj,
                ];

                BookingItem::create([
                    'booking_id' => $booking->id,
                    'menu_item_id' => $item->id,
                    'quantity' => $booking->pax,
                ]);
            }
        }

        return $selected;
    }

    private function normalizePackageStructure(array $structure): array
    {
        return [
            'starter' => (int) ($structure['starter'] ?? $structure['starters'] ?? 1),
            'main' => (int) ($structure['main'] ?? $structure['mains'] ?? 2),
            'side' => (int) ($structure['side'] ?? $structure['sides'] ?? 1),
            'dessert' => (int) ($structure['dessert'] ?? $structure['desserts'] ?? 1),
            'drink' => (int) ($structure['drink'] ?? $structure['drinks'] ?? $structure['refreshments'] ?? 1),
        ];
    }

    private function seedPaymentPlan(Booking $booking, string $status): void
    {
        $eventDate = Carbon::parse($booking->event_date);
        $plan = [
            ['Reservation', 0.10, $eventDate->copy()->subDays(45)],
            ['DownPayment', 0.70, $eventDate->copy()->subDays(30)],
            ['Final', 0.20, $eventDate->copy()->subDays(10)],
        ];

        foreach ($plan as [$type, $ratio, $dueDate]) {
            $isPayableNow = $dueDate->lte(now());
            $settled = $isPayableNow && (
                $status === 'Completed'
                || ($status === 'Confirmed' && $type !== 'Final')
                || ($status === 'Confirmed' && $type === 'Final' && $booking->id % 4 !== 0)
            );

            Payment::create([
                'booking_id' => $booking->id,
                'amount' => round((float) $booking->total_cost * $ratio, 2),
                'payment_method' => $settled ? ['Bank Transfer', 'PayMongo Checkout', 'GCash'][$booking->id % 3] : 'Pending',
                'status' => $settled ? 'Verified' : 'Pending',
                'payment_type' => $type,
                'due_date' => $dueDate->toDateString(),
                'verified_by' => $settled ? 'accounting' : null,
                'verified_at' => $settled ? $dueDate->copy()->addDay() : null,
                'created_at' => $this->notInFuture($dueDate->copy()->subDays(2)),
                'updated_at' => $settled ? $dueDate->copy()->addDay() : now(),
            ]);
        }
    }

    private function notInFuture(Carbon $date): Carbon
    {
        return $date->gt(now()) ? now()->copy()->subDay() : $date;
    }

    private function statusForDate(Carbon $eventDate, int $index): string
    {
        if ($eventDate->isPast()) {
            return $index % 12 === 0 ? 'Cancelled' : 'Completed';
        }

        return $index % 4 === 0 ? 'Pending' : 'Confirmed';
    }

    private function paxForEvent(string $slug, int $index): int
    {
        $ranges = [
            'formal-wedding' => [120, 380],
            'debut' => [90, 240],
            'corporate-seminar' => [60, 320],
            'family-reunion' => [55, 180],
            'casual-birthday' => [45, 150],
        ];
        [$min, $max] = $ranges[$slug] ?? [50, 220];

        return $min + (($index * 23) % max($max - $min, 1));
    }

    private function menuPrice(string $category, int $index): int
    {
        $ranges = [
            'starter' => [38, 78],
            'main' => [72, 165],
            'side' => [28, 58],
            'dessert' => [32, 72],
            'drink' => [24, 46],
        ];
        [$min, $max] = $ranges[$category];

        return $min + (($index * 7) % ($max - $min + 1));
    }

    private function menuDescription(string $category): string
    {
        return [
            'starter' => 'A light opening dish prepared for plated or buffet service.',
            'main' => 'A hearty event entree designed for reliable buffet holding and service flow.',
            'side' => 'A balanced side dish that pairs cleanly with classic Filipino and continental mains.',
            'dessert' => 'A portion-friendly dessert prepared for smooth event service.',
            'drink' => 'A refreshing beverage option suitable for lunch, dinner, and reception service.',
        ][$category];
    }
}
