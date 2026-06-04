<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BookingReviewTask;
use App\Models\ContactInquiry;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\EventPreparationTask;
use App\Models\FeedbackRequest;
use App\Models\FeedbackResponse;
use App\Models\Message;
use App\Models\User;
use App\Notifications\StaffAccountAccessNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AdminCustomerAccountTest extends TestCase
{
    use RefreshDatabase;

    public function test_deactivated_customers_are_hidden_from_default_customer_list(): void
    {
        $admin = $this->user('Admin');
        $active = $this->user('Client', ['username' => 'active_customer']);
        $deactivated = $this->user('Client', [
            'username' => 'deactivated_customer',
            'account_status' => 'deactivated',
            'deactivated_at' => now(),
        ]);

        $this->actingAs($admin)
            ->getJson('/api/admin/customers?paginated=1')
            ->assertOk()
            ->assertJsonFragment(['id' => $active->id])
            ->assertJsonMissing(['id' => $deactivated->id]);

        $this->actingAs($admin)
            ->getJson('/api/admin/customers?paginated=1&status=deactivated')
            ->assertOk()
            ->assertJsonFragment(['id' => $deactivated->id])
            ->assertJsonMissing(['id' => $active->id]);
    }

    public function test_customer_with_bookings_is_deactivated_and_can_be_reactivated(): void
    {
        $admin = $this->user('Admin');
        $customer = $this->user('Client');

        Booking::create([
            'user_id' => $customer->id,
            'event_date' => now()->addMonth()->toDateString(),
            'event_time' => '18:00',
            'pax' => 80,
            'event_type' => 'Wedding',
            'status' => 'Pending',
        ]);

        $this->actingAs($admin)
            ->deleteJson("/api/admin/customers/{$customer->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Customer account deactivated. Booking and payment records were preserved.');

        $this->assertDatabaseHas('users', [
            'id' => $customer->id,
            'account_status' => 'deactivated',
        ]);
        $this->assertStringStartsWith('deactivated+'.$customer->id, $customer->fresh()->email);

        $this->actingAs($admin)
            ->getJson('/api/admin/customers?paginated=1')
            ->assertOk()
            ->assertJsonMissing(['id' => $customer->id]);

        $this->actingAs($admin)
            ->postJson("/api/admin/customers/{$customer->id}/reactivate")
            ->assertOk();

        $this->assertDatabaseHas('users', [
            'id' => $customer->id,
            'account_status' => 'active',
        ]);
    }

    public function test_deactivating_customer_archives_active_chats_and_hides_placeholder_email_from_active_queues(): void
    {
        $admin = $this->user('Admin');
        $marketing = $this->user('Marketing');
        $customer = $this->user('Client', [
            'username' => 'mav',
            'email' => 'mav@example.test',
        ]);

        $conversation = Conversation::create([
            'client_id' => $customer->id,
            'staff_id' => $marketing->id,
            'status' => 'active',
        ]);
        Message::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $customer->id,
            'receiver_id' => $marketing->id,
            'message' => 'Please help.',
        ]);

        $this->actingAs($admin)
            ->deleteJson("/api/admin/customers/{$customer->id}")
            ->assertOk();

        $this->assertDatabaseHas('conversations', [
            'id' => $conversation->id,
            'status' => 'resolved',
        ]);
        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'message_type' => 'system',
            'message' => 'Conversation archived because customer account was deactivated.',
        ]);

        $payload = $this->actingAs($admin)
            ->getJson('/api/chat/conversations')
            ->assertOk()
            ->json();

        $this->assertNotContains($conversation->id, collect($payload['all_active'])->pluck('id')->all());
        $this->assertNotContains($conversation->id, collect($payload['needs_attention'])->pluck('id')->all());

        $archived = collect($payload['resolved'])->firstWhere('id', $conversation->id);
        $this->assertNotNull($archived);
        $this->assertTrue($archived['client_is_deactivated']);
        $this->assertSame('Deactivated customer', $archived['client_status_label']);
        $this->assertNull($archived['client_email']);
        $this->assertFalse($archived['can_reply']);
        $this->assertFalse($archived['can_transfer']);

        $this->actingAs($marketing)
            ->postJson("/api/chat/conversations/{$conversation->id}/messages", ['message' => 'Are you still there?'])
            ->assertForbidden()
            ->assertJsonPath('error', 'This conversation is archived because the customer account is deactivated.');
    }

    public function test_deactivated_customers_are_hidden_from_marketing_search_unless_requested(): void
    {
        $marketing = $this->user('Marketing');
        $active = $this->user('Client', [
            'full_name' => 'Mav Active',
            'username' => 'mav_active',
            'email' => 'mav-active@example.test',
        ]);
        $deactivated = $this->user('Client', [
            'full_name' => 'Mav Archived',
            'username' => 'mav_archived',
            'email' => 'mav-archived@example.test',
            'account_status' => 'deactivated',
            'deactivated_at' => now(),
        ]);

        $this->actingAs($marketing)
            ->getJson('/api/marketing/customers?search=mav')
            ->assertOk()
            ->assertJsonFragment(['id' => $active->id])
            ->assertJsonMissing(['id' => $deactivated->id]);

        $this->actingAs($marketing)
            ->getJson('/api/marketing/customers?search=mav&include_deactivated=1')
            ->assertOk()
            ->assertJsonFragment(['id' => $active->id])
            ->assertJsonFragment(['id' => $deactivated->id]);
    }

    public function test_deactivating_staff_releases_active_operational_ownership_without_erasing_history(): void
    {
        $admin = $this->user('Admin');
        $staff = $this->user('Marketing', ['username' => 'former_marketing', 'email' => 'former.marketing@example.test']);
        $customer = $this->user('Client');

        $booking = Booking::create([
            'user_id' => $customer->id,
            'event_date' => now()->addMonth()->toDateString(),
            'event_time' => '18:00',
            'pax' => 80,
            'event_type' => 'Wedding',
            'status' => 'Pending',
            'assigned_to' => $staff->id,
        ]);

        $conversation = Conversation::create([
            'client_id' => $customer->id,
            'staff_id' => $staff->id,
            'status' => 'active',
        ]);
        ConversationParticipant::create([
            'conversation_id' => $conversation->id,
            'user_id' => $staff->id,
            'role' => 'owner',
            'joined_at' => now(),
        ]);
        Message::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $staff->id,
            'receiver_id' => $customer->id,
            'message' => 'Historical staff reply.',
        ]);

        $inquiry = ContactInquiry::create([
            'full_name' => 'Walk In',
            'email' => 'walkin@example.test',
            'subject' => 'Question',
            'message' => 'Question',
            'status' => 'open',
            'assigned_to' => $staff->id,
        ]);
        $reviewTask = BookingReviewTask::create([
            'booking_id' => $booking->id,
            'label' => 'Review customer request',
            'assigned_to' => $staff->id,
        ]);
        $prepTask = EventPreparationTask::create([
            'booking_id' => $booking->id,
            'label' => 'Prepare service kit',
            'assigned_to' => $staff->id,
        ]);
        $feedbackRequest = FeedbackRequest::create([
            'booking_id' => $booking->id,
            'user_id' => $customer->id,
            'token' => 'feedback-token',
        ]);
        $feedback = FeedbackResponse::create([
            'feedback_request_id' => $feedbackRequest->id,
            'booking_id' => $booking->id,
            'user_id' => $customer->id,
            'rating' => 2,
            'follow_up_required' => true,
            'assigned_to' => $staff->id,
            'review_status' => 'Open',
        ]);

        $this->actingAs($admin)
            ->deleteJson("/api/admin/employees/{$staff->id}")
            ->assertOk();

        $this->assertNull($conversation->fresh()->staff_id);
        $participant = ConversationParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', $staff->id)
            ->firstOrFail();
        $this->assertNotNull($participant->removed_at);
        $this->assertSame($admin->id, $participant->removed_by);
        $this->assertSame('staff_deactivated', $participant->removal_reason);
        $this->assertNull($booking->fresh()->assigned_to);
        $this->assertNull($inquiry->fresh()->assigned_to);
        $this->assertNull($reviewTask->fresh()->assigned_to);
        $this->assertNull($prepTask->fresh()->assigned_to);
        $this->assertNull($feedback->fresh()->assigned_to);
        $this->assertDatabaseHas('messages', [
            'sender_id' => $staff->id,
            'message' => 'Historical staff reply.',
        ]);
        $this->assertDatabaseHas('users', [
            'id' => $staff->id,
            'account_status' => 'deactivated',
        ]);
        $this->assertStringStartsWith('deactivated+'.$staff->id, $staff->fresh()->email);

        $this->actingAs($admin)
            ->postJson('/api/admin/employees', [
                'full_name' => 'Replacement Marketing',
                'username' => 'replacement_marketing',
                'email' => 'former.marketing@example.test',
                'phone' => '09170000009',
                'role' => 'Marketing',
            ])
            ->assertCreated();

        $this->assertDatabaseHas('users', [
            'username' => 'replacement_marketing',
            'email' => 'former.marketing@example.test',
            'role' => 'Marketing',
        ]);
    }

    public function test_deactivating_customer_frees_original_email_for_new_registration(): void
    {
        $admin = $this->user('Admin');
        $customer = $this->user('Client', ['email' => 'reuse@example.test']);

        Booking::create([
            'user_id' => $customer->id,
            'event_date' => now()->addMonth()->toDateString(),
            'event_time' => '18:00',
            'pax' => 80,
            'event_type' => 'Wedding',
            'status' => 'Pending',
        ]);

        $this->actingAs($admin)
            ->deleteJson("/api/admin/customers/{$customer->id}")
            ->assertOk();

        Auth::logout();

        $this->post('/register', [
            'username' => 'reuse_user',
            'email' => 'reuse@example.test',
            'password' => 'StrongPass123!',
            'phone' => '09170000000',
        ])->assertRedirect();

        $this->assertDatabaseHas('users', [
            'username' => 'reuse_user',
            'email' => 'reuse@example.test',
            'role' => 'Client',
        ]);
    }

    public function test_admin_can_create_admin_account_and_reset_temporary_password_but_deactivation_stays_protected(): void
    {
        Notification::fake();

        $admin = $this->user('Admin');

        $response = $this->actingAs($admin)
            ->postJson('/api/admin/employees', [
                'full_name' => 'Second Admin',
                'username' => 'second_admin',
                'email' => 'second.admin@example.test',
                'phone' => '09170000001',
                'role' => 'Admin',
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Account created. Share the temporary password through a private channel.')
            ->assertJsonPath('email_delivery_status.status', 'sent');

        $created = User::where('username', 'second_admin')->firstOrFail();

        $this->assertSame('Admin', $created->role);
        $this->assertTrue((bool) $created->must_change_password);
        $this->assertNotEmpty($response->json('temporary_password'));
        $this->assertNotSame($response->json('temporary_password'), $created->getRawOriginal('temporary_password_secret'));
        $this->assertTrue($created->temporary_password_expires_at->between(now()->addHours(23), now()->addHours(25)));
        Notification::assertSentTo($created, StaffAccountAccessNotification::class);

        $this->actingAs($admin)
            ->getJson('/api/admin/employees?paginated=1&role=Admin&search=second_admin')
            ->assertOk()
            ->assertJsonFragment(['id' => $created->id]);

        $this->actingAs($admin)
            ->deleteJson("/api/admin/employees/{$created->id}")
            ->assertForbidden();

        $this->actingAs($admin)
            ->postJson("/api/admin/employees/{$created->id}/reset-password")
            ->assertOk()
            ->assertJsonStructure(['temporary_password', 'temporary_password_expires_at', 'email_delivery_status']);
    }

    public function test_reset_temporary_password_is_emailed_and_expires_within_one_day(): void
    {
        Notification::fake();

        $admin = $this->user('Admin');
        $staff = $this->user('Marketing');

        $response = $this->actingAs($admin)
            ->postJson("/api/admin/employees/{$staff->id}/reset-password")
            ->assertOk()
            ->assertJsonStructure(['temporary_password', 'temporary_password_expires_at', 'email_delivery', 'email_delivery_status' => ['status', 'message']])
            ->assertJsonPath('email_delivery_status.status', 'sent');

        $staff->refresh();

        $this->assertNotEmpty($response->json('temporary_password'));
        $this->assertNotSame($response->json('temporary_password'), $staff->getRawOriginal('temporary_password_secret'));
        $this->assertTrue($staff->temporary_password_expires_at->between(now()->addHours(23), now()->addHours(25)));
        Notification::assertSentTo($staff, StaffAccountAccessNotification::class);
    }

    public function test_admin_can_reveal_temporary_password_until_it_is_used_or_expired(): void
    {
        $admin = $this->user('Admin');
        $staff = $this->user('Marketing');

        $reset = $this->actingAs($admin)
            ->postJson("/api/admin/employees/{$staff->id}/reset-password")
            ->assertOk();

        $temporaryPassword = $reset->json('temporary_password');

        $this->actingAs($admin)
            ->postJson("/api/admin/employees/{$staff->id}/temporary-password/reveal")
            ->assertOk()
            ->assertJsonPath('temporary_password', $temporaryPassword);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'Temporary password viewed',
        ]);

        $this->actingAs($staff)
            ->postJson('/password/change-required', [
                'password' => 'NewSecurePassword123!',
                'password_confirmation' => 'NewSecurePassword123!',
            ])
            ->assertOk();

        $this->actingAs($admin)
            ->postJson("/api/admin/employees/{$staff->id}/temporary-password/reveal")
            ->assertStatus(410)
            ->assertJsonPath('message', 'Temporary password is no longer available. Reset temporary password to generate a new one.');
    }

    public function test_expired_temporary_password_cannot_be_revealed(): void
    {
        $admin = $this->user('Admin');
        $staff = $this->user('Marketing', [
            'must_change_password' => true,
            'temporary_password_expires_at' => now()->subMinute(),
            'temporary_password_secret' => 'ExpiredSecret123!',
        ]);

        $this->actingAs($admin)
            ->postJson("/api/admin/employees/{$staff->id}/temporary-password/reveal")
            ->assertStatus(410);

        $this->assertNull($staff->fresh()->temporary_password_secret);
    }

    public function test_temporary_password_secret_is_not_exposed_in_employee_list(): void
    {
        $admin = $this->user('Admin');
        $staff = $this->user('Marketing', [
            'must_change_password' => true,
            'temporary_password_expires_at' => now()->addDay(),
            'temporary_password_secret' => 'SecretToHide123!',
        ]);

        $response = $this->actingAs($admin)
            ->getJson('/api/admin/employees?paginated=1')
            ->assertOk();

        $row = collect($response->json('data'))->firstWhere('id', $staff->id);
        $this->assertIsArray($row);
        $this->assertArrayNotHasKey('temporary_password_secret', $row);
    }

    public function test_authenticated_users_can_refresh_csrf_token(): void
    {
        $admin = $this->user('Admin');

        $this->actingAs($admin)
            ->getJson('/api/session/csrf-token')
            ->assertOk()
            ->assertJsonStructure(['token']);
    }

    public function test_password_change_required_users_can_refresh_csrf_token(): void
    {
        $admin = $this->user('Admin', [
            'must_change_password' => true,
        ]);

        $this->actingAs($admin)
            ->getJson('/api/session/csrf-token')
            ->assertOk()
            ->assertJsonStructure(['token']);
    }

    public function test_account_email_delivery_reports_missing_email(): void
    {
        $admin = $this->user('Admin');

        $response = $this->actingAs($admin)
            ->postJson('/api/admin/employees', [
                'full_name' => 'No Email Staff',
                'username' => 'no_email_staff',
                'role' => 'Marketing',
            ])
            ->assertCreated()
            ->assertJsonPath('email_delivery_status.status', 'skipped_no_email');

        $this->assertStringContainsString('No email address', $response->json('email_delivery'));
    }

    public function test_admin_can_view_delivery_diagnostics(): void
    {
        $admin = $this->user('Admin');

        $this->actingAs($admin)
            ->getJson('/api/admin/system-delivery')
            ->assertOk()
            ->assertJsonStructure([
                'session' => ['current_host', 'app_url', 'same_site', 'authenticated'],
                'mail' => ['mailer', 'from_address', 'configured'],
                'queue' => ['connection', 'worker_required'],
                'guidance',
            ]);
    }

    public function test_admin_required_password_change_redirects_to_admin_dashboard_and_hashes_password(): void
    {
        $admin = $this->user('Admin', [
            'must_change_password' => true,
            'temporary_password_expires_at' => now()->addDay(),
            'temporary_password_secret' => 'OldTemporaryPassword123!',
        ]);

        $this->actingAs($admin)
            ->post('/password/change-required', [
                'password' => 'NewSecurePassword123!',
                'password_confirmation' => 'NewSecurePassword123!',
            ])
            ->assertRedirect('/dashboard/admin');

        $admin->refresh();

        $this->assertFalse((bool) $admin->must_change_password);
        $this->assertNull($admin->temporary_password_expires_at);
        $this->assertNull($admin->temporary_password_secret);
        $this->assertNotSame('NewSecurePassword123!', $admin->password);
        $this->assertTrue(Hash::check('NewSecurePassword123!', $admin->password));
    }

    public function test_json_required_password_change_returns_final_account_state(): void
    {
        $admin = $this->user('Admin', [
            'must_change_password' => true,
            'temporary_password_expires_at' => now()->addDay(),
        ]);

        $this->actingAs($admin)
            ->postJson('/password/change-required', [
                'password' => 'NewSecurePassword123!',
                'password_confirmation' => 'NewSecurePassword123!',
            ])
            ->assertOk()
            ->assertJsonPath('redirect', '/dashboard/admin')
            ->assertJsonPath('role', 'Admin')
            ->assertJsonPath('must_change_password', false);

        $this->get('/dashboard/admin')->assertOk();
    }

    public function test_staff_roles_can_access_dashboard_after_required_password_change(): void
    {
        foreach ([
            'Marketing' => '/dashboard/marketing',
            'Accounting' => '/dashboard/accounting',
        ] as $role => $dashboard) {
            $user = $this->user($role, [
                'must_change_password' => true,
                'temporary_password_expires_at' => now()->addDay(),
            ]);

            $this->actingAs($user)
                ->postJson('/password/change-required', [
                    'password' => 'NewSecurePassword123!',
                    'password_confirmation' => 'NewSecurePassword123!',
                ])
                ->assertOk()
                ->assertJsonPath('redirect', $dashboard)
                ->assertJsonPath('role', $role)
                ->assertJsonPath('must_change_password', false);

            $this->get($dashboard)->assertOk();
            $this->post('/logout');
        }
    }

    public function test_inertia_admin_required_password_change_forces_dashboard_location(): void
    {
        $admin = $this->user('Admin', [
            'must_change_password' => true,
            'temporary_password_expires_at' => now()->addDay(),
        ]);

        $this->actingAs($admin)
            ->withHeader('X-Inertia', 'true')
            ->withHeader('X-Inertia-Version', 'test')
            ->withHeader('Accept', 'application/json')
            ->withHeader('X-Requested-With', 'XMLHttpRequest')
            ->post('/password/change-required', [
                'password' => 'NewSecurePassword123!',
                'password_confirmation' => 'NewSecurePassword123!',
            ])
            ->assertStatus(409)
            ->assertHeader('X-Inertia-Location', '/dashboard/admin');
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
            'account_status' => 'active',
        ], $overrides));
    }
}
