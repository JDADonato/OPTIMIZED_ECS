<?php

namespace Tests\Feature;

use App\Mail\BookingLiveStatusUpdate;
use App\Models\Booking;
use App\Models\User;
use App\Notifications\BookingLiveStatusNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class MarketingLiveStatusTrackerTest extends TestCase
{
    use RefreshDatabase;

    public function test_marketing_can_update_approved_booking_live_status_and_email_customer(): void
    {
        Mail::fake();

        $marketing = $this->user('Marketing');
        $client = $this->user('Client', ['email' => 'customer@example.test']);
        $booking = $this->booking([
            'user_id' => $client->id,
            'assigned_to' => $marketing->id,
            'client_email' => 'customer@example.test',
            'status' => 'Confirmed',
            'review_status' => 'Approved For Reservation',
            'live_status' => 'Not Started',
        ]);

        $this->actingAs($marketing)
            ->putJson("/api/marketing/bookings/{$booking->id}/livestatus", [
                'live_status' => 'On the Way',
            ])
            ->assertOk()
            ->assertJsonPath('booking.live_status', 'On the Way');

        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'live_status' => 'On the Way',
        ]);

        Mail::assertQueued(BookingLiveStatusUpdate::class, function (BookingLiveStatusUpdate $mail) {
            return $mail->liveStatus === 'On the Way'
                && $mail->hasTo('customer@example.test');
        });

        $notification = $client->notifications()->first();
        $this->assertNotNull($notification);
        $this->assertSame(BookingLiveStatusNotification::class, $notification->type);
        $this->assertSame('booking_live_status', $notification->data['type']);
        $this->assertSame('booking', $notification->data['category']);
        $this->assertSame($booking->id, $notification->data['booking_id']);
        $this->assertStringContainsString('on the way', strtolower($notification->data['message']));
    }

    public function test_live_status_is_locked_until_booking_is_approved(): void
    {
        Mail::fake();

        $marketing = $this->user('Marketing');
        $booking = $this->booking([
            'assigned_to' => $marketing->id,
            'status' => 'Pending',
            'review_status' => 'Submitted',
            'live_status' => 'Not Started',
        ]);

        $this->actingAs($marketing)
            ->putJson("/api/marketing/bookings/{$booking->id}/livestatus", [
                'live_status' => 'On the Way',
            ])
            ->assertStatus(422)
            ->assertJsonPath('error', 'Live tracking unlocks after the booking is approved.');

        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'live_status' => 'Not Started',
        ]);

        Mail::assertNothingQueued();
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
        $clientId = $overrides['user_id'] ?? $this->user('Client')->id;

        return Booking::create(array_merge([
            'user_id' => $clientId,
            'event_date' => now()->addDays(14)->toDateString(),
            'event_time' => '10:00',
            'event_name' => 'Live Tracker Test Event',
            'event_type' => 'Wedding',
            'pax' => 100,
            'budget' => 100000,
            'package_id' => 'custom',
            'client_full_name' => 'Live Tracker Client',
            'client_email' => 'client@example.test',
            'client_phone' => '09170000000',
            'venue_city' => 'Quezon City',
            'venue_address_line' => 'Live tracker venue',
            'total_cost' => 100000,
            'selected_menu' => ['starter' => [['id' => 1, 'name' => 'Soup']]],
            'status' => 'Confirmed',
            'review_status' => 'Approved For Reservation',
            'live_status' => 'Not Started',
        ], $overrides));
    }
}
