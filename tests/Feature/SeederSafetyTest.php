<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BusinessRule;
use App\Models\EventType;
use App\Models\MenuItem;
use App\Models\Package;
use App\Models\User;
use Database\Seeders\AnalyticsDemoSeeder;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class SeederSafetyTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_seeder_keeps_demo_data_outside_non_local_environments(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertGreaterThan(0, User::whereIn('role', ['Admin', 'Marketing', 'Accounting', 'Client'])->count());
        $this->assertGreaterThan(0, EventType::count());
        $this->assertGreaterThan(0, MenuItem::count());
        $this->assertGreaterThan(0, Package::count());
        $this->assertGreaterThan(0, BusinessRule::count());

        $this->assertSame(0, User::where('email', 'like', '%@demo.eloquente.test')->count());
        $this->assertSame(0, Booking::where('client_email', 'like', '%@demo.eloquente.test')->count());
        $this->assertSame(0, MenuItem::where('dish_id', 'like', 'demo_%')->count());
    }

    public function test_analytics_demo_seeder_is_disabled_outside_local_environment(): void
    {
        $this->seed(AnalyticsDemoSeeder::class);

        $this->assertSame(0, User::where('email', 'like', '%@demo.eloquente.test')->count());
        $this->assertSame(0, Booking::where('client_email', 'like', '%@demo.eloquente.test')->count());
        $this->assertSame(0, MenuItem::where('dish_id', 'like', 'demo_%')->count());
    }

    public function test_analytics_demo_seeder_refuses_production_environment(): void
    {
        $originalEnvironment = app()->environment();
        app()->detectEnvironment(fn () => 'production');

        try {
            $this->expectException(RuntimeException::class);
            app(AnalyticsDemoSeeder::class)->run();
        } finally {
            app()->detectEnvironment(fn () => $originalEnvironment);
        }
    }
}
