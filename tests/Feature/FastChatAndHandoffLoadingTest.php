<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Conversation;
use App\Models\EventPreparationTask;
use App\Models\Message;
use App\Models\User;
use App\Services\EventPreparationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FastChatAndHandoffLoadingTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_chat_send_echoes_client_temp_id(): void
    {
        $client = $this->user('Client');
        $marketing = $this->user('Marketing');
        $conversation = Conversation::create([
            'client_id' => $client->id,
            'staff_id' => $marketing->id,
            'status' => 'active',
        ]);

        $this->actingAs($marketing)
            ->postJson("/api/chat/conversations/{$conversation->id}/messages", [
                'message' => 'We can help with this.',
                'client_temp_id' => 'tmp-staff-123',
            ])
            ->assertCreated()
            ->assertJsonPath('client_temp_id', 'tmp-staff-123')
            ->assertJsonPath('message', 'We can help with this.');
    }

    public function test_client_start_conversation_echoes_client_temp_id(): void
    {
        $client = $this->user('Client');

        $this->actingAs($client)
            ->postJson('/api/chat/conversations', [
                'message' => 'I need planning help.',
                'client_temp_id' => 'tmp-client-456',
            ])
            ->assertCreated()
            ->assertJsonPath('message.client_temp_id', 'tmp-client-456')
            ->assertJsonPath('message.message', 'I need planning help.');
    }

    public function test_chat_send_reuses_duplicate_client_temp_id(): void
    {
        $client = $this->user('Client');
        $marketing = $this->user('Marketing');
        $conversation = Conversation::create([
            'client_id' => $client->id,
            'staff_id' => $marketing->id,
            'status' => 'active',
        ]);

        $first = $this->actingAs($marketing)
            ->postJson("/api/chat/conversations/{$conversation->id}/messages", [
                'message' => 'The original reply.',
                'client_temp_id' => 'tmp-dedupe-1',
            ])
            ->assertCreated()
            ->json();

        $second = $this->actingAs($marketing)
            ->postJson("/api/chat/conversations/{$conversation->id}/messages", [
                'message' => 'A duplicate retry with changed text.',
                'client_temp_id' => 'tmp-dedupe-1',
            ])
            ->assertOk()
            ->assertJsonPath('id', $first['id'])
            ->assertJsonPath('message', 'The original reply.')
            ->json();

        $this->assertSame($first['client_temp_id'], $second['client_temp_id']);
        $this->assertSame(1, Message::where('conversation_id', $conversation->id)->count());
    }

    public function test_chat_messages_support_newest_page_before_and_after_cursors(): void
    {
        $client = $this->user('Client');
        $marketing = $this->user('Marketing');
        $conversation = Conversation::create([
            'client_id' => $client->id,
            'staff_id' => $marketing->id,
            'status' => 'active',
        ]);

        $messages = collect(range(1, 25))->map(fn ($number) => Message::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $client->id,
            'receiver_id' => $marketing->id,
            'message' => "Message {$number}",
        ]));

        $latestPage = $this->actingAs($marketing)
            ->getJson("/api/chat/conversations/{$conversation->id}/messages")
            ->assertOk()
            ->assertJsonCount(20, 'data')
            ->json();

        $this->assertSame($messages[5]->id, $latestPage['data'][0]['id']);
        $this->assertSame($messages[24]->id, $latestPage['data'][19]['id']);
        $this->assertTrue($latestPage['pagination']['has_more']);

        $olderPage = $this->actingAs($marketing)
            ->getJson("/api/chat/conversations/{$conversation->id}/messages?limit=20&before_id={$latestPage['pagination']['before_id']}")
            ->assertOk()
            ->assertJsonCount(5, 'data')
            ->json();

        $this->assertSame($messages[0]->id, $olderPage['data'][0]['id']);
        $this->assertSame($messages[4]->id, $olderPage['data'][4]['id']);

        $deltaPage = $this->actingAs($marketing)
            ->getJson("/api/chat/conversations/{$conversation->id}/messages?after_id={$messages[20]->id}")
            ->assertOk()
            ->assertJsonCount(4, 'data')
            ->json();

        $this->assertSame($messages[21]->id, $deltaPage['data'][0]['id']);
        $this->assertSame($messages[24]->id, $deltaPage['data'][3]['id']);
    }

    public function test_preparation_board_supports_lightweight_pages_and_detail_loading(): void
    {
        $admin = $this->user('Admin');
        $first = $this->booking(['event_date' => now()->addDays(3)->toDateString()]);
        $this->booking(['event_date' => now()->addDays(4)->toDateString()]);
        EventPreparationService::ensureDefaultTasks($first);

        $list = $this->actingAs($admin)
            ->getJson('/api/operations/preparation-board?paginated=1&lightweight=1&per_page=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.total', 2);

        $this->assertArrayNotHasKey('tasks', $list->json('data.0'));
        $this->assertContains('Marketing', $list->json('meta.departments'));

        $this->actingAs($admin)
            ->getJson("/api/operations/preparation-board/{$first->id}")
            ->assertOk()
            ->assertJsonPath('booking.id', $first->id)
            ->assertJsonPath('task_progress.total', EventPreparationTask::where('booking_id', $first->id)->count())
            ->assertJsonStructure([
                'tasks',
                'task_groups',
                'readiness_details',
                'event_sheet',
            ]);
    }

    public function test_admin_booking_payload_distinguishes_account_and_booking_contact(): void
    {
        $admin = $this->user('Admin');
        $customer = $this->user('Client', [
            'full_name' => 'Account Name',
            'username' => 'account_name',
            'email' => 'account@example.test',
            'phone' => '09171111111',
        ]);
        $booking = $this->booking([
            'user_id' => $customer->id,
            'client_full_name' => 'Booking Contact',
            'client_email' => 'booking@example.test',
            'client_phone' => '09272222222',
        ]);

        $this->actingAs($admin)
            ->getJson('/api/admin/bookings?paginated=1&include_history=1')
            ->assertOk()
            ->assertJsonPath('data.0.id', $booking->id)
            ->assertJsonPath('data.0.customer_account.name', 'Account Name')
            ->assertJsonPath('data.0.customer_account.username', 'account_name')
            ->assertJsonPath('data.0.booking_contact.name', 'Booking Contact')
            ->assertJsonPath('data.0.booking_contact.email', 'booking@example.test')
            ->assertJsonPath('data.0.has_different_booking_contact', true);
    }

    public function test_chat_conversation_payload_leads_with_account_and_keeps_booking_contact(): void
    {
        $admin = $this->user('Admin');
        $marketing = $this->user('Marketing');
        $customer = $this->user('Client', [
            'full_name' => 'Account Chat Name',
            'username' => 'account_chat',
            'email' => 'chat-account@example.test',
            'phone' => '09173333333',
        ]);
        $booking = $this->booking([
            'user_id' => $customer->id,
            'client_full_name' => 'Event Contact Name',
            'client_email' => 'event-contact@example.test',
            'client_phone' => '09274444444',
        ]);
        $conversation = Conversation::create([
            'client_id' => $customer->id,
            'staff_id' => $marketing->id,
            'booking_id' => $booking->id,
            'status' => 'active',
        ]);

        $payload = $this->actingAs($admin)
            ->getJson('/api/chat/conversations')
            ->assertOk()
            ->json();

        $thread = collect($payload['all_active'])->firstWhere('id', $conversation->id);
        $this->assertNotNull($thread);
        $this->assertSame('Account Chat Name', $thread['client_name']);
        $this->assertSame('Account Chat Name', $thread['customer_account']['name']);
        $this->assertSame('Event Contact Name', $thread['booking_contact']['name']);
        $this->assertTrue($thread['has_different_booking_contact']);
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
            'event_time' => '10:00 AM - 2:00 PM',
            'event_name' => 'Fast Loading Event',
            'event_type' => 'Wedding',
            'pax' => 100,
            'budget' => 100000,
            'package_id' => 'custom',
            'client_full_name' => 'Fast Client',
            'client_email' => 'fast@example.test',
            'client_phone' => '09170000000',
            'venue_city' => 'Quezon City',
            'venue_address_line' => 'Fast venue',
            'total_cost' => 100000,
            'selected_menu' => ['starter' => [['id' => 1, 'name' => 'Soup']]],
            'status' => 'Confirmed',
            'review_status' => 'Approved For Reservation',
        ], $overrides));
    }
}
