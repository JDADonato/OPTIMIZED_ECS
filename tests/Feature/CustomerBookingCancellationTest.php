<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\PaymentEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerBookingCancellationTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_must_provide_a_valid_cancellation_reason(): void
    {
        $client = $this->user('Client');
        $booking = $this->booking(['user_id' => $client->id]);

        $this->actingAs($client)
            ->putJson("/api/bookings/{$booking->id}/cancel", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['cancellation_reason']);

        $this->actingAs($client)
            ->putJson("/api/bookings/{$booking->id}/cancel", [
                'cancellation_reason' => 'other',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['cancellation_reason_details']);

        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'status' => 'Confirmed',
        ]);
    }

    public function test_customer_cancellation_stores_reason_and_returns_refund_preview(): void
    {
        $client = $this->user('Client');
        $booking = $this->booking([
            'user_id' => $client->id,
            'total_cost' => 100000,
        ]);

        Payment::create([
            'booking_id' => $booking->id,
            'amount' => 30000,
            'payment_method' => 'Bank Transfer',
            'status' => 'Verified',
            'payment_type' => 'Reservation',
            'due_date' => now()->toDateString(),
        ]);

        $response = $this->actingAs($client)
            ->putJson("/api/bookings/{$booking->id}/cancel", [
                'cancellation_reason' => 'event_postponed',
                'cancellation_reason_details' => 'The family moved the celebration to next quarter.',
            ])
            ->assertOk()
            ->assertJsonPath('cancellation_reason.value', 'event_postponed')
            ->assertJsonPath('refund_preview.total_paid', 30000)
            ->assertJsonPath('refund_preview.non_refundable_amount', 10000)
            ->assertJsonPath('refund_preview.refundable_amount', 20000);

        $this->assertSame('Booking cancelled successfully. Accounting will review any eligible refund.', $response->json('message'));

        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'status' => 'Cancelled',
            'live_status' => 'Refund Processing',
            'cancellation_reason' => 'event_postponed',
            'cancellation_reason_details' => 'The family moved the celebration to next quarter.',
        ]);

        $this->assertNotNull($booking->fresh()->cancelled_at);

        $event = PaymentEvent::where('booking_id', $booking->id)
            ->where('event_type', 'booking_cancelled_by_customer')
            ->first();

        $this->assertNotNull($event);
        $this->assertSame('Event postponed', $event->metadata['cancellation_reason_label']);
        $this->assertSame(20000.0, (float) $event->metadata['refund_preview']['refundable_amount']);
    }

    private function user(string $role, array $overrides = []): User
    {
        return User::create(array_merge([
            'full_name' => "{$role} Tester",
            'username' => strtolower($role).'_'.uniqid(),
            'email' => uniqid(strtolower($role).'_').'@example.test',
            'password' => 'password',
            'phone' => '09170000000',
            'role' => $role,
        ], $overrides));
    }

    private function booking(array $overrides = []): Booking
    {
        return Booking::create(array_merge([
            'user_id' => $this->user('Client')->id,
            'event_date' => now()->addDays(30)->toDateString(),
            'event_time' => '10:00 AM - 2:00 PM',
            'event_name' => 'Cancellation Test Event',
            'event_type' => 'Birthday',
            'pax' => 100,
            'budget' => 100000,
            'package_id' => 'custom',
            'client_full_name' => 'Cancellation Client',
            'client_email' => 'client@example.test',
            'client_phone' => '09170000000',
            'venue_city' => 'Quezon City',
            'venue_address_line' => 'Cancellation venue',
            'total_cost' => 100000,
            'selected_menu' => ['starter' => [['id' => 1, 'name' => 'Soup']]],
            'status' => 'Confirmed',
            'review_status' => 'Approved For Reservation',
            'live_status' => 'Not Started',
        ], $overrides));
    }
}
