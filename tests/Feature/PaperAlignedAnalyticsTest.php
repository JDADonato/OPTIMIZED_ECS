<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Package;
use App\Models\Payment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class PaperAlignedAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-05-31 12:00:00'));
        Cache::flush();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_sales_frequency_distribution_includes_frequency_percentages_and_revenue_contribution(): void
    {
        $admin = $this->user('Admin');
        $client = $this->user('Client');
        $premium = $this->package('premium', 'Wedding Classic');
        $birthday = $this->package('birthday', 'Birthday Classic');

        $this->paidBooking($client, $premium, 'Wedding', '2026-02-10', 100000);
        $this->paidBooking($client, $premium, 'Wedding', '2026-02-18', 50000);
        $this->paidBooking($client, $birthday, 'Birthday', '2026-03-12', 25000);

        $payload = $this->actingAs($admin)
            ->getJson('/api/admin/analytics?date_from=2026-01-01&date_to=2026-12-31')
            ->assertOk()
            ->json('salesFrequencyDistribution');

        $this->assertSame('Frequency Distribution', $payload['method']);
        $this->assertSame(3, $payload['summary']['totalFrequency']);
        $this->assertEquals(175000.0, $payload['summary']['totalRevenue']);

        $premiumRow = collect($payload['rows'])->firstWhere('key', 'premium');
        $this->assertSame(2, $premiumRow['frequency']);
        $this->assertSame(66.7, $premiumRow['percentage']);
        $this->assertEquals(150000.0, $premiumRow['revenue']);
        $this->assertSame(85.7, $premiumRow['revenueContribution']);
    }

    public function test_slr_and_sma_forecasts_use_real_history_and_expose_method_metadata(): void
    {
        $admin = $this->user('Admin');
        $client = $this->user('Client');
        $package = $this->package('standard', 'Standard Feast');

        $this->paidBooking($client, $package, 'Corporate', '2026-04-10', 50000, 80, '2026-04-15 10:00:00');
        $this->paidBooking($client, $package, 'Corporate', '2026-05-10', 80000, 120, '2026-05-15 10:00:00');

        $payload = $this->actingAs($admin)
            ->getJson('/api/admin/analytics/forecasts?trend_months=6&revenue_forecast_horizon=2&pax_sma_window=2&pax_projection_horizon=2')
            ->assertOk()
            ->json();

        $revenue = $payload['revenueRegression'];
        $this->assertSame('Simple Linear Regression (OLS)', $revenue['method']);
        $this->assertSame('Y = a + bX', $revenue['formula']);
        $this->assertFalse($revenue['is_insufficient_data']);
        $this->assertSame(2, $revenue['sampleSize']);
        $this->assertNotNull($revenue['alpha']);
        $this->assertNotNull($revenue['beta']);
        $this->assertCount(2, $revenue['projection']);

        $demand = $payload['demandMovingAverage'];
        $this->assertSame('Simple Moving Average (SMA)', $demand['method']);
        $this->assertSame('SMA = (P1 + P2 + ... + Pn) / n', $demand['formula']);
        $this->assertFalse($demand['is_insufficient_data']);
        $this->assertSame(2, $demand['sampleSize']);
        $this->assertSame(100, $demand['summary']['nextForecast']);
    }

    public function test_forecasts_return_insufficient_historical_data_instead_of_synthetic_values(): void
    {
        $admin = $this->user('Admin');

        $payload = $this->actingAs($admin)
            ->getJson('/api/admin/analytics/forecasts?trend_months=6&pax_sma_window=2')
            ->assertOk()
            ->json();

        $this->assertTrue($payload['revenueRegression']['is_insufficient_data']);
        $this->assertFalse($payload['revenueRegression']['is_fallback']);
        $this->assertNull($payload['revenueRegression']['alpha']);
        $this->assertSame([], $payload['revenueRegression']['projection']);
        $this->assertStringContainsString('Insufficient historical data', $payload['revenueRegression']['insight']);

        $this->assertTrue($payload['demandMovingAverage']['is_insufficient_data']);
        $this->assertFalse($payload['demandMovingAverage']['is_fallback']);
        $this->assertSame([], $payload['demandMovingAverage']['rows']);
        $this->assertStringContainsString('Insufficient historical data', $payload['demandMovingAverage']['insight']);
    }

    public function test_peak_season_cross_tab_groups_event_type_by_calendar_month(): void
    {
        $admin = $this->user('Admin');
        $client = $this->user('Client');
        $package = $this->package('premium', 'Wedding Classic');

        $this->booking($client, $package, 'Wedding', '2026-01-12', 90);
        $this->booking($client, $package, 'Wedding', '2026-01-28', 60);
        $this->booking($client, $package, 'Birthday', '2026-02-14', 45);

        $payload = $this->actingAs($admin)
            ->getJson('/api/admin/analytics/operations?date_from=2026-01-01&date_to=2026-12-31')
            ->assertOk()
            ->json();

        $this->assertSame('Frequency Distribution', $payload['salesFrequencyDistribution']['method']);
        $this->assertSame('Simple Linear Regression (OLS)', $payload['revenueRegression']['method']);
        $this->assertSame('Simple Moving Average (SMA)', $payload['demandMovingAverage']['method']);

        $heatmap = $payload['peakSeasonCrossTab'];

        $this->assertSame('Cross-tabulation frequency heatmap', $heatmap['method']);
        $this->assertCount(12, $heatmap['months']);
        $this->assertSame(3, $heatmap['summary']['totalEvents']);
        $this->assertSame(195, $heatmap['summary']['totalPax']);
        $this->assertSame('Jan', $heatmap['summary']['busiestMonth']);
        $this->assertSame('Wedding', $heatmap['summary']['busiestEventType']);

        $wedding = collect($heatmap['rows'])->firstWhere('label', 'Wedding');
        $january = collect($wedding['months'])->firstWhere('label', 'Jan');

        $this->assertSame(2, $january['events']);
        $this->assertSame(150, $january['pax']);
        $this->assertSame('peak', $january['intensity']);
    }

    private function paidBooking(
        User $client,
        Package $package,
        string $eventType,
        string $eventDate,
        float $amount,
        int $pax = 100,
        ?string $verifiedAt = null
    ): Booking {
        $booking = $this->booking($client, $package, $eventType, $eventDate, $pax, $amount);

        Payment::create([
            'booking_id' => $booking->id,
            'amount' => $amount,
            'payment_method' => 'PayMongo Checkout',
            'status' => 'Verified',
            'payment_type' => 'Reservation',
            'due_date' => Carbon::parse($eventDate)->subDays(10)->toDateString(),
            'verified_at' => $verifiedAt ? Carbon::parse($verifiedAt) : Carbon::parse($eventDate)->addDays(5),
        ]);

        return $booking;
    }

    private function booking(
        User $client,
        Package $package,
        string $eventType,
        string $eventDate,
        int $pax,
        ?float $totalCost = null
    ): Booking {
        return Booking::create([
            'user_id' => $client->id,
            'event_date' => $eventDate,
            'event_time' => '10:00',
            'pax' => $pax,
            'budget' => $totalCost ?: 50000,
            'package_id' => (string) $package->id,
            'event_type' => $eventType,
            'event_name' => $eventType.' Analytics Event',
            'status' => 'Completed',
            'review_status' => 'Approved',
            'total_cost' => $totalCost ?: ($pax * 1000),
        ]);
    }

    private function package(string $category, string $name): Package
    {
        return Package::create([
            'name' => $name,
            'type' => 'Event Package',
            'package_category' => $category,
            'base_price_per_head' => 1000,
            'minimum_pax' => 30,
            'description' => $name,
            'is_active' => true,
        ]);
    }

    private function user(string $role, array $overrides = []): User
    {
        return User::create(array_merge([
            'full_name' => "{$role} User",
            'username' => strtolower($role).'_'.uniqid(),
            'email' => strtolower($role).uniqid().'@example.test',
            'password' => 'password',
            'role' => $role,
            'account_status' => 'active',
            'email_verified_at' => now(),
        ], $overrides));
    }
}
