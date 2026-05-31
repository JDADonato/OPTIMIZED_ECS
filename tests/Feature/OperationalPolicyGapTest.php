<?php

namespace Tests\Feature;

use App\Mail\AnnouncementEmail;
use App\Models\Announcement;
use App\Models\Booking;
use App\Models\ContactInquiry;
use App\Models\FoodTasting;
use App\Models\Payment;
use App\Models\User;
use App\Notifications\StaffOperationalNotification;
use App\Services\NotificationRecipientService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class OperationalPolicyGapTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_hides_history_without_deleting_booking_or_payments(): void
    {
        $client = $this->user('Client');
        $booking = $this->booking($client, ['status' => 'Completed']);
        $payment = Payment::create([
            'booking_id' => $booking->id,
            'amount' => 5000,
            'payment_method' => 'PayMongo',
            'status' => 'Paid',
            'payment_type' => 'Reservation',
            'due_date' => now()->toDateString(),
        ]);

        $this->actingAs($client)
            ->patchJson("/api/bookings/{$booking->id}/hide-from-history")
            ->assertOk()
            ->assertJsonPath('message', 'Booking hidden from your history.');

        $this->assertDatabaseHas('bookings', ['id' => $booking->id]);
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'booking_id' => $booking->id]);
        $this->assertNotNull($booking->fresh()->hidden_from_customer_history_at);

        $this->actingAs($client)
            ->getJson('/api/dashboard/client')
            ->assertOk()
            ->assertJsonPath('historyBookings', []);
    }

    public function test_active_booking_cannot_be_hidden_from_customer_history(): void
    {
        $client = $this->user('Client');
        $booking = $this->booking($client, ['status' => 'Confirmed']);

        $this->actingAs($client)
            ->deleteJson("/api/bookings/{$booking->id}/remove-history")
            ->assertStatus(422);

        $this->assertNull($booking->fresh()->hidden_from_customer_history_at);
    }

    public function test_legacy_remove_history_alias_is_non_destructive(): void
    {
        $client = $this->user('Client');
        $booking = $this->booking($client, ['status' => 'Cancelled']);

        $this->actingAs($client)
            ->deleteJson("/api/bookings/{$booking->id}/remove-history")
            ->assertOk()
            ->assertJsonPath('message', 'Booking hidden from your history.');

        $this->assertDatabaseHas('bookings', ['id' => $booking->id]);
        $this->assertNotNull($booking->fresh()->hidden_from_customer_history_at);
    }

    public function test_legacy_message_endpoints_are_retired(): void
    {
        $client = $this->user('Client');

        foreach ([
            ['getJson', '/api/messages/conversations', []],
            ['getJson', '/api/messages/staff/available', []],
            ['getJson', '/api/messages/unread-count', []],
            ['getJson', '/api/messages/my-bookings', []],
            ['getJson', "/api/messages/{$client->id}", []],
            ['postJson', '/api/messages', ['receiver_id' => $client->id, 'message' => 'legacy path']],
        ] as [$method, $uri, $payload]) {
            $this->actingAs($client)
                ->{$method}($uri, $payload)
                ->assertStatus(410)
                ->assertJsonPath('error', 'Legacy messaging endpoints are retired. Use /api/chat instead.');
        }
    }

    public function test_due_announcements_publish_from_command_and_email_once(): void
    {
        Mail::fake();
        $admin = $this->user('Admin');
        $client = $this->user('Client');
        $this->user('Client', ['account_status' => 'deactivated', 'email' => 'deactivated+1+20260529@eloquente.invalid']);
        $this->user('Marketing', ['account_status' => 'deactivated']);

        $announcement = Announcement::create([
            'title' => 'Scheduled note',
            'slug' => 'scheduled-note',
            'summary' => 'A due scheduled announcement.',
            'body' => 'This announcement should publish from the scheduler.',
            'type' => 'info',
            'visibility' => 'all_customers',
            'status' => 'scheduled',
            'starts_at' => now()->subMinute(),
            'send_email' => true,
            'created_by' => $admin->id,
            'updated_by' => $admin->id,
        ]);

        $this->artisan('announcements:publish-due')->assertSuccessful();
        $this->assertSame('published', $announcement->fresh()->status);
        Mail::assertQueued(AnnouncementEmail::class, 1);

        $this->artisan('announcements:publish-due')->assertSuccessful();
        Mail::assertQueued(AnnouncementEmail::class, 1);
    }

    public function test_operational_notification_recipients_skip_inactive_and_placeholder_accounts(): void
    {
        Notification::fake();

        $activeAdmin = $this->user('Admin');
        $inactiveAdmin = $this->user('Admin', ['account_status' => 'deactivated']);
        $placeholderAdmin = $this->user('Admin', ['email' => 'deactivated+8+20260529@eloquente.invalid']);

        app(NotificationRecipientService::class)->sendToRoles(
            ['Admin'],
            new StaffOperationalNotification('Ops check', 'Ops check', 'A staff operation needs review.', '/dashboard/admin'),
            'test_operational_reachability'
        );

        Notification::assertSentTo($activeAdmin, StaffOperationalNotification::class);
        Notification::assertNotSentTo($inactiveAdmin, StaffOperationalNotification::class);
        Notification::assertNotSentTo($placeholderAdmin, StaffOperationalNotification::class);
    }

    public function test_guest_food_tasting_lifecycle_archives_from_default_staff_queue(): void
    {
        $marketing = $this->user('Marketing');
        $client = $this->user('Client', ['email' => 'guest@example.test', 'phone' => '09170000000']);

        $response = $this->postJson('/api/food-tasting', [
            'guest_name' => 'Guest Lead',
            'guest_email' => $client->email,
            'guest_phone' => $client->phone,
            'preferred_date' => now()->addWeek()->toDateString(),
            'preferred_time' => '10:00 AM',
        ])->assertCreated();

        $tasting = FoodTasting::findOrFail($response->json('tastingId'));
        $this->assertSame($client->id, $tasting->duplicate_user_id);

        $this->actingAs($marketing)
            ->patchJson("/api/marketing/food-tastings/{$tasting->id}", [
                'status' => 'Archived',
                'preferred_date' => $tasting->preferred_date->toDateString(),
                'preferred_time' => $tasting->preferred_time,
            ])
            ->assertOk();

        $this->actingAs($marketing)
            ->getJson('/api/marketing/food-tastings')
            ->assertOk()
            ->assertJsonMissing(['id' => $tasting->id]);

        $this->actingAs($marketing)
            ->getJson('/api/marketing/food-tastings?status=Archived')
            ->assertOk()
            ->assertJsonFragment(['id' => $tasting->id]);
    }

    public function test_guest_duplicate_indicators_label_deactivated_customers_safely(): void
    {
        $marketing = $this->user('Marketing');
        $client = $this->user('Client', [
            'full_name' => 'Dormant Client',
            'email' => 'deactivated+7+20260529@eloquente.invalid',
            'phone' => '09179999999',
            'account_status' => 'deactivated',
        ]);

        $response = $this->postJson('/api/food-tasting', [
            'guest_name' => 'Dormant Lead',
            'guest_email' => 'fresh-lead@example.test',
            'guest_phone' => $client->phone,
            'preferred_date' => now()->addWeek()->toDateString(),
            'preferred_time' => '10:00 AM',
        ])->assertCreated();

        $tasting = FoodTasting::findOrFail($response->json('tastingId'));
        $this->assertSame($client->id, $tasting->duplicate_user_id);

        $this->actingAs($marketing)
            ->getJson('/api/marketing/food-tastings')
            ->assertOk()
            ->assertJsonFragment([
                'id' => $client->id,
                'email' => null,
                'is_deactivated' => true,
            ]);

        $inquiryResponse = $this->postJson('/api/contact-inquiries', [
            'full_name' => 'Dormant Inquiry',
            'email' => 'new-inquiry@example.test',
            'phone' => $client->phone,
            'subject' => 'Planning',
            'message' => 'Please help.',
        ])->assertCreated();

        $inquiry = ContactInquiry::findOrFail($inquiryResponse->json('inquiry_id'));
        $this->assertSame($client->id, $inquiry->duplicate_user_id);

        $this->actingAs($marketing)
            ->getJson('/api/marketing/contact-inquiries')
            ->assertOk()
            ->assertJsonFragment([
                'id' => $client->id,
                'email' => null,
                'is_deactivated' => true,
            ]);
    }

    public function test_customer_food_tasting_cancel_routes_are_non_destructive(): void
    {
        $client = $this->user('Client');

        $patchTasting = FoodTasting::create([
            'user_id' => $client->id,
            'guest_name' => $client->full_name,
            'guest_email' => $client->email,
            'guest_phone' => $client->phone,
            'preferred_date' => now()->addWeek()->toDateString(),
            'preferred_time' => '10:00 AM',
            'status' => 'Pending',
        ]);
        $legacyTasting = FoodTasting::create([
            'user_id' => $client->id,
            'guest_name' => $client->full_name,
            'guest_email' => $client->email,
            'guest_phone' => $client->phone,
            'preferred_date' => now()->addWeeks(2)->toDateString(),
            'preferred_time' => '11:00 AM',
            'status' => 'Pending',
        ]);

        $this->actingAs($client)
            ->patchJson("/api/food-tasting/{$patchTasting->id}/cancel")
            ->assertOk()
            ->assertJsonPath('message', 'Food tasting cancelled.');

        $this->actingAs($client)
            ->deleteJson("/api/food-tasting/{$legacyTasting->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Food tasting cancelled.');

        $this->assertDatabaseHas('food_tastings', ['id' => $patchTasting->id, 'status' => 'Cancelled']);
        $this->assertDatabaseHas('food_tastings', ['id' => $legacyTasting->id, 'status' => 'Cancelled']);
    }

    public function test_contact_inquiry_archived_and_spam_statuses_leave_active_queue(): void
    {
        $marketing = $this->user('Marketing');
        $client = $this->user('Client', ['email' => 'lead@example.test']);

        $response = $this->postJson('/api/contact-inquiries', [
            'full_name' => 'Lead Person',
            'email' => $client->email,
            'subject' => 'Planning help',
            'message' => 'Please help with planning.',
        ])->assertCreated();

        $inquiry = ContactInquiry::findOrFail($response->json('inquiry_id'));
        $this->assertSame($client->id, $inquiry->duplicate_user_id);

        $this->actingAs($marketing)
            ->patchJson("/api/marketing/contact-inquiries/{$inquiry->id}", ['status' => 'Spam'])
            ->assertOk();

        $this->actingAs($marketing)
            ->getJson('/api/marketing/contact-inquiries')
            ->assertOk()
            ->assertJsonMissing(['id' => $inquiry->id]);

        $this->actingAs($marketing)
            ->getJson('/api/marketing/contact-inquiries?status=Spam')
            ->assertOk()
            ->assertJsonFragment(['id' => $inquiry->id]);
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
            'email_verified_at' => now(),
        ], $overrides));
    }

    private function booking(User $client, array $overrides = []): Booking
    {
        return Booking::create(array_merge([
            'user_id' => $client->id,
            'event_date' => now()->subDays(2)->toDateString(),
            'event_time' => '10:00 AM - 2:00 PM',
            'event_name' => 'Policy Gap Event',
            'event_type' => 'Wedding',
            'pax' => 100,
            'budget' => 50000,
            'package_id' => 'custom',
            'client_full_name' => $client->full_name,
            'client_email' => $client->email,
            'client_phone' => $client->phone,
            'venue_city' => 'Quezon City',
            'venue_address_line' => 'Policy venue',
            'total_cost' => 50000,
            'selected_menu' => ['starter' => [['id' => 1, 'name' => 'Soup']]],
            'status' => 'Completed',
            'review_status' => 'Completed',
        ], $overrides));
    }
}
