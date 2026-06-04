<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\User;
use App\Notifications\BookingStatusNotification;
use App\Notifications\PaymentApprovedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class CustomerNotificationDeliveryTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_booking_approval_notifies_customer_by_mail_and_database(): void
    {
        Notification::fake();

        $admin = $this->user('Admin');
        $client = $this->user('Client');
        $booking = $this->booking($client, ['status' => 'Pending']);

        $this->actingAs($admin)
            ->putJson("/api/admin/bookings/{$booking->id}/status", ['status' => 'Confirmed'])
            ->assertOk();

        Notification::assertSentTo($client, BookingStatusNotification::class, function (BookingStatusNotification $notification, array $channels) use ($booking) {
            return $notification->booking->id === $booking->id
                && $notification->newStatus === 'Confirmed'
                && in_array('mail', $channels, true)
                && in_array('database', $channels, true);
        });
    }

    public function test_accounting_payment_verification_notifies_customer_by_mail_and_database(): void
    {
        Notification::fake();

        $accounting = $this->user('Accounting');
        $client = $this->user('Client');
        $booking = $this->booking($client, ['status' => 'Confirmed']);
        $payment = Payment::create([
            'booking_id' => $booking->id,
            'amount' => 5000,
            'payment_method' => 'PayMongo Checkout',
            'status' => 'Pending',
            'payment_type' => 'Reservation',
            'due_date' => now()->toDateString(),
        ]);

        $this->actingAs($accounting)
            ->putJson("/api/accounting/payments/{$payment->id}/verify", ['action' => 'Verify'])
            ->assertOk();

        Notification::assertSentTo($client, PaymentApprovedNotification::class, function (PaymentApprovedNotification $notification, array $channels) use ($booking) {
            return $notification->booking->id === $booking->id
                && $notification->paymentType === 'Reservation'
                && in_array('mail', $channels, true)
                && in_array('database', $channels, true);
        });
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
            'email_verified_at' => now(),
        ]);
    }

    private function booking(User $client, array $overrides = []): Booking
    {
        return Booking::create(array_merge([
            'user_id' => $client->id,
            'event_date' => now()->addDays(45)->toDateString(),
            'event_time' => '10:00 AM - 2:00 PM',
            'event_name' => 'Notification Test Event',
            'event_type' => 'Wedding',
            'pax' => 100,
            'budget' => 50000,
            'package_id' => 'custom',
            'client_full_name' => 'Notification Client',
            'client_email' => $client->email,
            'client_phone' => '09170000000',
            'venue_city' => 'Quezon City',
            'venue_address_line' => 'Notification venue',
            'total_cost' => 50000,
            'selected_menu' => ['starter' => [['id' => 1, 'name' => 'Soup']]],
            'review_status' => 'Submitted',
        ], $overrides));
    }
}
