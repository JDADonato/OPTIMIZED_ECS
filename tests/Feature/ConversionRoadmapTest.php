<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BusinessRule;
use App\Models\ConversionEvent;
use App\Models\User;
use App\Services\ConversionEventService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class ConversionRoadmapTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        BusinessRule::create([
            'minimum_lead_days' => 7,
            'maximum_capacity_per_day' => 10,
            'maximum_pax_per_event' => 1000,
            'minimum_pax_per_event' => 30,
            'is_active' => true,
            'reservation_fee_percentage' => 10,
            'downpayment_percentage' => 70,
            'final_payment_percentage' => 20,
            'reservation_validity_hours' => 24,
            'downpayment_due_days' => 30,
            'final_payment_due_days' => 10,
        ]);
    }

    public function test_frontend_conversion_endpoint_records_safe_event_without_secrets(): void
    {
        $client = $this->user('Client');

        $this->actingAs($client)
            ->postJson('/api/conversion-events', [
                'event_name' => 'booking_started',
                'source' => 'customer_booking_wizard',
                'step' => 'Vision',
                'metadata' => [
                    'event_type' => 'Wedding',
                    'temporary_password' => 'never-store-this',
                    'nested' => ['otp_code' => '123456', 'safe' => 'kept'],
                ],
            ])
            ->assertAccepted();

        $event = ConversionEvent::firstOrFail();

        $this->assertSame('booking_started', $event->event_name);
        $this->assertSame($client->id, $event->user_id);
        $this->assertSame('Client', $event->role);
        $this->assertSame('Vision', $event->step);
        $this->assertSame('Wedding', $event->metadata['event_type']);
        $this->assertArrayNotHasKey('temporary_password', $event->metadata);
        $this->assertArrayNotHasKey('otp_code', $event->metadata['nested']);
        $this->assertSame('kept', $event->metadata['nested']['safe']);
    }

    public function test_customer_booking_submission_records_conversion_event(): void
    {
        $client = $this->user('Client');

        $response = $this->actingAs($client)
            ->postJson('/api/bookings', [
                'event_date' => now()->addDays(21)->toDateString(),
                'event_time' => '10:00',
                'pax' => 80,
                'budget' => 50000,
                'event_type' => 'Birthday',
                'event_name' => 'Conversion Birthday',
                'total_cost' => 50000,
            ])
            ->assertCreated();

        $this->assertDatabaseHas('conversion_events', [
            'event_name' => 'booking_submitted',
            'user_id' => $client->id,
            'booking_id' => $response->json('bookingId'),
            'source' => 'customer_wizard',
            'step' => 'review',
        ]);
    }

    public function test_admin_analytics_summary_includes_conversion_funnel(): void
    {
        Cache::flush();

        $admin = $this->user('Admin');
        $client = $this->user('Client');
        $booking = Booking::create([
            'user_id' => $client->id,
            'event_date' => now()->addDays(30)->toDateString(),
            'event_time' => '11:00',
            'pax' => 100,
            'event_type' => 'Wedding',
            'event_name' => 'Analytics Wedding',
            'status' => 'Pending',
            'review_status' => 'Submitted',
            'total_cost' => 100000,
        ]);

        ConversionEventService::record('booking_started', ['user' => $client, 'booking' => $booking, 'source' => 'customer_booking_wizard']);
        ConversionEventService::record('booking_submitted', ['user' => $client, 'booking' => $booking, 'source' => 'customer_wizard']);
        ConversionEventService::record('payment_checkout_started', ['user' => $client, 'booking' => $booking, 'source' => 'customer_dashboard']);
        ConversionEventService::record('payment_confirmed', ['user' => $client, 'booking' => $booking, 'source' => 'paymongo_checkout']);
        ConversionEventService::record('feedback_submitted', ['user' => $client, 'booking' => $booking, 'source' => 'customer_dashboard']);

        $this->actingAs($admin)
            ->getJson('/api/admin/analytics/summary')
            ->assertOk()
            ->assertJsonPath('conversionFunnel.booking_starts', 1)
            ->assertJsonPath('conversionFunnel.booking_submissions', 1)
            ->assertJsonPath('conversionFunnel.booking_completion_rate', 100)
            ->assertJsonPath('conversionFunnel.payment_completion_rate', 100)
            ->assertJsonPath('summary.feedbackSubmissions', 1);
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
