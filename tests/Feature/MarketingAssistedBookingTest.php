<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BusinessRule;
use App\Models\User;
use App\Notifications\CustomerAssistedBookingInviteNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class MarketingAssistedBookingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('mail.default', 'array');
        Config::set('queue.default', 'sync');

        BusinessRule::create([
            'minimum_lead_days' => 7,
            'maximum_capacity_per_day' => 7,
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

    public function test_marketing_can_create_assisted_booking_for_existing_customer(): void
    {
        Notification::fake();

        $marketing = $this->user('Marketing');
        $customer = $this->user('Client', ['full_name' => 'Existing Client']);

        $response = $this->actingAs($marketing)
            ->postJson('/api/marketing/bookings/assisted', $this->payload([
                'customer_mode' => 'existing',
                'customer_id' => $customer->id,
            ]))
            ->assertCreated()
            ->assertJsonPath('booking.booking_source', 'marketing_assisted')
            ->assertJsonPath('booking.created_by_staff_id', $marketing->id)
            ->assertJsonPath('customer.created', false);

        $bookingId = $response->json('booking.id');
        $booking = Booking::with('payments')->findOrFail($bookingId);

        $this->assertSame($customer->id, $booking->user_id);
        $this->assertSame($marketing->id, $booking->assigned_to);
        $this->assertGreaterThan(0, $booking->payments->count());
    }

    public function test_marketing_customer_search_is_limited_ranked_and_reports_more_matches(): void
    {
        $marketing = $this->user('Marketing');

        for ($i = 1; $i <= 10; $i++) {
            $this->user('Client', [
                'full_name' => "Tyron Match {$i}",
                'username' => "tyron_match_{$i}",
                'email' => "tyron{$i}@example.test",
            ]);
        }

        $exact = $this->user('Client', [
            'full_name' => 'Another Person',
            'username' => 'tyron',
            'email' => 'exact.tyron@example.test',
        ]);

        $response = $this->actingAs($marketing)
            ->getJson('/api/marketing/customers?search=TYRON&limit=8')
            ->assertOk()
            ->assertJsonCount(8, 'data')
            ->assertJsonPath('meta.total', 11)
            ->assertJsonPath('meta.limit', 8)
            ->assertJsonPath('meta.page', 1)
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonPath('meta.from', 1)
            ->assertJsonPath('meta.to', 8)
            ->assertJsonPath('meta.has_more', true);

        $this->assertSame($exact->id, $response->json('data.0.id'));

        $this->actingAs($marketing)
            ->getJson('/api/marketing/customers?search=TYRON&limit=8&page=2')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('meta.page', 2)
            ->assertJsonPath('meta.from', 9)
            ->assertJsonPath('meta.to', 11)
            ->assertJsonPath('meta.has_more', false);
    }

    public function test_marketing_can_create_walk_in_customer_with_temporary_invite(): void
    {
        Notification::fake();

        $marketing = $this->user('Marketing');

        $response = $this->actingAs($marketing)
            ->postJson('/api/marketing/bookings/assisted', $this->payload([
                'customer_mode' => 'new',
                'send_invite' => true,
                'customer' => [
                    'full_name' => 'Walk In Guest',
                    'email' => 'walkin@example.test',
                    'phone' => '09181234567',
                ],
            ]))
            ->assertCreated()
            ->assertJsonPath('customer.created', true)
            ->assertJsonPath('invite_delivery.status', 'sent');

        $customer = User::where('email', 'walkin@example.test')->firstOrFail();

        $this->assertSame('Client', $customer->role);
        $this->assertTrue($customer->must_change_password);
        $this->assertNotNull($customer->temporary_password_secret);
        $this->assertNotEmpty($response->json('temporary_password'));

        Notification::assertSentTo($customer, CustomerAssistedBookingInviteNotification::class);
    }

    public function test_walk_in_without_email_still_creates_booking_and_warns_staff(): void
    {
        Notification::fake();

        $marketing = $this->user('Marketing');

        $response = $this->actingAs($marketing)
            ->postJson('/api/marketing/bookings/assisted', $this->payload([
                'customer_mode' => 'new',
                'send_invite' => true,
                'customer' => [
                    'full_name' => 'Phone Only Guest',
                    'phone' => '09185554444',
                ],
            ]))
            ->assertCreated()
            ->assertJsonPath('customer.created', true)
            ->assertJsonPath('invite_delivery.status', 'skipped_no_email');

        $this->assertNotEmpty($response->json('temporary_password'));
        $this->assertDatabaseHas('users', [
            'full_name' => 'Phone Only Guest',
            'phone' => '09185554444',
            'role' => 'Client',
        ]);
    }

    public function test_duplicate_walk_in_email_must_link_existing_customer(): void
    {
        $marketing = $this->user('Marketing');
        $this->user('Client', ['email' => 'duplicate@example.test']);

        $this->actingAs($marketing)
            ->postJson('/api/marketing/bookings/assisted', $this->payload([
                'customer_mode' => 'new',
                'customer' => [
                    'full_name' => 'Duplicate Person',
                    'email' => 'duplicate@example.test',
                    'phone' => '09189990000',
                ],
            ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('customer');
    }

    public function test_admin_booking_list_can_filter_assisted_sources(): void
    {
        Notification::fake();

        $admin = $this->user('Admin');
        $marketing = $this->user('Marketing');
        $customer = $this->user('Client');

        Booking::create([
            'user_id' => $customer->id,
            'event_date' => now()->addDays(45)->toDateString(),
            'event_time' => '10:00',
            'pax' => 50,
            'budget' => 50000,
            'event_type' => 'Wedding',
            'client_full_name' => $customer->full_name,
            'client_email' => $customer->email,
            'client_phone' => $customer->phone,
            'status' => 'Pending',
            'review_status' => 'Submitted',
            'booking_source' => 'customer',
        ]);

        $this->actingAs($marketing)
            ->postJson('/api/marketing/bookings/assisted', $this->payload([
                'customer_mode' => 'existing',
                'customer_id' => $customer->id,
            ]))
            ->assertCreated();

        $this->actingAs($admin)
            ->getJson('/api/admin/bookings?paginated=1&source=marketing_assisted')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.booking_source', 'marketing_assisted')
            ->assertJsonPath('data.0.created_by_staff_id', $marketing->id);
    }

    private function payload(array $overrides = []): array
    {
        return array_replace_recursive([
            'customer_mode' => 'existing',
            'customer_id' => null,
            'send_invite' => false,
            'event_date' => now()->addDays(45)->toDateString(),
            'event_time' => '10:00 AM - 2:00 PM',
            'event_type' => 'Wedding',
            'event_name' => 'Assisted Booking Test',
            'pax' => 80,
            'package_id' => 'custom',
            'budget' => 50000,
            'total_cost' => 50000,
            'client_full_name' => 'Assisted Client',
            'client_email' => 'assisted@example.test',
            'client_phone' => '09170000000',
            'venue_address_line' => '123 Demo Street',
            'venue_city' => 'Quezon City',
            'venue_province' => 'Metro Manila',
            'venue_zip_code' => '1100',
            'venue_building_details' => 'Main hall',
            'selected_menu' => [],
            'menu_items' => [],
        ], $overrides);
    }

    private function user(string $role, array $overrides = []): User
    {
        return User::create(array_merge([
            'full_name' => "{$role} Tester",
            'username' => strtolower($role) . '_' . uniqid(),
            'email' => uniqid(strtolower($role) . '_') . '@example.test',
            'password' => 'password',
            'phone' => '09170000000',
            'role' => $role,
            'account_status' => 'active',
            'email_verified_at' => now(),
        ], $overrides));
    }
}
