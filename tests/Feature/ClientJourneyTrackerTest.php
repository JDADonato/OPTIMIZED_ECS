<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClientJourneyTrackerTest extends TestCase
{
    use RefreshDatabase;

    public function test_client_journey_tracker_returns_lightweight_active_booking_payload(): void
    {
        $client = $this->user('Client');
        $otherClient = $this->user('Client');
        $booking = $this->booking(['user_id' => $client->id, 'status' => 'Confirmed']);
        $this->booking(['user_id' => $client->id, 'status' => 'Completed']);
        $this->booking(['user_id' => $otherClient->id, 'status' => 'Confirmed']);

        Payment::create([
            'booking_id' => $booking->id,
            'amount' => 10000,
            'payment_method' => 'PayMongo',
            'status' => 'Paid',
            'payment_type' => 'Reservation',
            'due_date' => now()->toDateString(),
        ]);

        $response = $this->actingAs($client)
            ->getJson('/api/customer/journey-tracker')
            ->assertOk()
            ->assertJsonCount(1, 'bookings')
            ->assertJsonPath('bookings.0.id', $booking->id)
            ->assertJsonPath('bookings.0.event_name', 'Journey Test Event')
            ->assertJsonPath('bookings.0.live_status', 'Not Started')
            ->assertJsonMissingPath('historyBookings')
            ->assertJsonMissingPath('tastings');

        $this->assertNotEmpty($response->json('payments'));
        $this->assertArrayHasKey('cached_at', $response->json());
    }

    private function user(string $role): User
    {
        return User::create([
            'full_name' => "{$role} Tester",
            'username' => strtolower($role).'_'.uniqid(),
            'email' => uniqid(strtolower($role).'_').'@example.test',
            'password' => 'password',
            'phone' => '09170000000',
            'role' => $role,
        ]);
    }

    private function booking(array $overrides = []): Booking
    {
        return Booking::create(array_merge([
            'user_id' => $this->user('Client')->id,
            'event_date' => now()->addDays(45)->toDateString(),
            'event_time' => '10:00 AM - 2:00 PM',
            'event_name' => 'Journey Test Event',
            'event_type' => 'Wedding',
            'pax' => 100,
            'budget' => 100000,
            'package_id' => 'custom',
            'client_full_name' => 'Journey Client',
            'client_email' => 'client@example.test',
            'client_phone' => '09170000000',
            'venue_city' => 'Quezon City',
            'venue_address_line' => 'Journey venue',
            'total_cost' => 100000,
            'selected_menu' => ['starter' => [['id' => 1, 'name' => 'Soup']]],
            'status' => 'Confirmed',
            'review_status' => 'Approved For Reservation',
        ], $overrides));
    }
}
