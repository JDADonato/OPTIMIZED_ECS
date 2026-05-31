<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BookingReviewTask;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OwnershipEnforcementTest extends TestCase
{
    use RefreshDatabase;

    public function test_marketing_must_claim_unassigned_booking_before_mutating(): void
    {
        $client = $this->user('Client');
        $staff = $this->user('Marketing');
        $booking = $this->booking($client);

        $this->actingAs($staff)
            ->putJson("/api/marketing/bookings/{$booking->id}/status", ['status' => 'Confirmed'])
            ->assertForbidden()
            ->assertJsonPath('error', 'Claim this booking before making changes.')
            ->assertJsonPath('booking.can_claim', true)
            ->assertJsonPath('booking.can_edit', false);

        $this->assertNull($booking->fresh()->assigned_to);

        $this->actingAs($staff)
            ->postJson("/api/marketing/bookings/{$booking->id}/claim")
            ->assertOk()
            ->assertJsonPath('booking.owner_id', $staff->id)
            ->assertJsonPath('booking.can_edit', true);

        $this->actingAs($staff)
            ->putJson("/api/marketing/bookings/{$booking->id}/status", ['status' => 'Confirmed'])
            ->assertOk();

        $this->assertSame('Confirmed', $booking->fresh()->status);
    }

    public function test_marketing_booking_claim_is_atomic_and_blocks_other_staff_mutations(): void
    {
        $client = $this->user('Client');
        $owner = $this->user('Marketing');
        $other = $this->user('Marketing');
        $booking = $this->booking($client);

        $this->actingAs($owner)
            ->postJson("/api/marketing/bookings/{$booking->id}/claim")
            ->assertOk()
            ->assertJsonPath('booking.owner_id', $owner->id)
            ->assertJsonPath('booking.can_edit', true);

        $this->actingAs($other)
            ->postJson("/api/marketing/bookings/{$booking->id}/claim")
            ->assertStatus(409);

        $this->actingAs($other)
            ->putJson("/api/marketing/bookings/{$booking->id}/status", ['status' => 'Confirmed'])
            ->assertForbidden()
            ->assertJsonPath('booking.can_edit', false);

        $this->actingAs($owner)
            ->putJson("/api/marketing/bookings/{$booking->id}/status", ['status' => 'Confirmed'])
            ->assertOk();

        $this->assertSame('Confirmed', $booking->fresh()->status);
    }

    public function test_admin_can_transfer_and_owner_can_release_uncompleted_booking(): void
    {
        $client = $this->user('Client');
        $owner = $this->user('Marketing');
        $newOwner = $this->user('Marketing');
        $admin = $this->user('Admin');
        $booking = $this->booking($client, ['assigned_to' => $owner->id, 'review_status' => 'Under Review']);

        $this->actingAs($admin)
            ->postJson("/api/marketing/bookings/{$booking->id}/transfer", ['new_staff_id' => $newOwner->id])
            ->assertOk()
            ->assertJsonPath('booking.owner_id', $owner->id)
            ->assertJsonPath('booking.transfer_requested_to', $newOwner->id);

        $this->actingAs($newOwner)
            ->postJson("/api/marketing/bookings/{$booking->id}/transfer/accept")
            ->assertOk()
            ->assertJsonPath('booking.owner_id', $newOwner->id)
            ->assertJsonPath('booking.transfer_requested_to', null);

        $this->actingAs($newOwner)
            ->postJson("/api/marketing/bookings/{$booking->id}/release")
            ->assertOk()
            ->assertJsonPath('booking.owner_id', null);

        $this->actingAs($owner)
            ->postJson("/api/marketing/bookings/{$booking->id}/claim")
            ->assertOk()
            ->assertJsonPath('booking.owner_id', $owner->id);
    }

    public function test_requested_staff_can_decline_booking_transfer(): void
    {
        $client = $this->user('Client');
        $owner = $this->user('Marketing');
        $newOwner = $this->user('Marketing');
        $booking = $this->booking($client, ['assigned_to' => $owner->id, 'review_status' => 'Under Review']);

        $this->actingAs($owner)
            ->postJson("/api/marketing/bookings/{$booking->id}/transfer", ['new_staff_id' => $newOwner->id])
            ->assertOk()
            ->assertJsonPath('booking.transfer_requested_to', $newOwner->id);

        $this->actingAs($newOwner)
            ->postJson("/api/marketing/bookings/{$booking->id}/transfer/decline")
            ->assertOk()
            ->assertJsonPath('booking.owner_id', $owner->id)
            ->assertJsonPath('booking.transfer_requested_to', null);

        $this->assertSame($owner->id, $booking->fresh()->assigned_to);
    }

    public function test_admin_booking_list_includes_pending_transfer_without_lazy_loading_failure(): void
    {
        $client = $this->user('Client');
        $owner = $this->user('Marketing');
        $newOwner = $this->user('Marketing');
        $admin = $this->user('Admin');
        $booking = $this->booking($client, ['assigned_to' => $owner->id, 'review_status' => 'Under Review']);

        $this->actingAs($owner)
            ->postJson("/api/marketing/bookings/{$booking->id}/transfer", ['new_staff_id' => $newOwner->id])
            ->assertOk();

        $this->actingAs($admin)
            ->getJson('/api/admin/bookings?paginated=1&per_page=25')
            ->assertOk()
            ->assertJsonPath('data.0.id', $booking->id)
            ->assertJsonPath('data.0.transfer_requested_to', $newOwner->id)
            ->assertJsonPath('data.0.transfer_requested_to_name', $newOwner->full_name);
    }

    public function test_booking_review_tasks_are_owner_locked(): void
    {
        $client = $this->user('Client');
        $owner = $this->user('Marketing');
        $other = $this->user('Marketing');
        $booking = $this->booking($client, ['assigned_to' => $owner->id]);
        $task = BookingReviewTask::create([
            'booking_id' => $booking->id,
            'task_type' => 'review',
            'label' => 'Confirm venue',
            'status' => 'Pending',
        ]);

        $this->actingAs($other)
            ->patchJson("/api/marketing/bookings/{$booking->id}/review-tasks/{$task->id}", ['status' => 'Done'])
            ->assertForbidden();

        $this->actingAs($owner)
            ->patchJson("/api/marketing/bookings/{$booking->id}/review-tasks/{$task->id}", ['status' => 'Done'])
            ->assertOk();
    }

    public function test_chat_collaborator_can_reply_but_not_transfer_or_resolve(): void
    {
        $client = $this->user('Client');
        $owner = $this->user('Marketing');
        $collaborator = $this->user('Marketing');
        $conversation = Conversation::create(['client_id' => $client->id, 'staff_id' => $owner->id, 'status' => 'active']);

        $this->actingAs($owner)
            ->postJson("/api/chat/conversations/{$conversation->id}/collaborators", ['user_id' => $collaborator->id])
            ->assertOk()
            ->assertJsonCount(1, 'conversation.collaborators');

        $this->actingAs($collaborator)
            ->postJson("/api/chat/conversations/{$conversation->id}/messages", ['message' => 'I can help with this.'])
            ->assertCreated();

        $this->actingAs($collaborator)
            ->postJson("/api/chat/conversations/{$conversation->id}/resolve")
            ->assertForbidden();

        $this->actingAs($owner)
            ->postJson("/api/chat/conversations/{$conversation->id}/transfer-owner", ['new_staff_id' => $collaborator->id])
            ->assertOk()
            ->assertJsonPath('conversation.staff_id', $collaborator->id);
    }

    public function test_removed_chat_collaborator_is_soft_removed_and_loses_reply_access(): void
    {
        $client = $this->user('Client');
        $owner = $this->user('Marketing');
        $collaborator = $this->user('Marketing');
        $conversation = Conversation::create(['client_id' => $client->id, 'staff_id' => $owner->id, 'status' => 'active']);

        $this->actingAs($owner)
            ->postJson("/api/chat/conversations/{$conversation->id}/collaborators", ['user_id' => $collaborator->id])
            ->assertOk();

        $this->actingAs($owner)
            ->deleteJson("/api/chat/conversations/{$conversation->id}/collaborators/{$collaborator->id}")
            ->assertOk()
            ->assertJsonCount(0, 'conversation.collaborators');

        $participant = ConversationParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', $collaborator->id)
            ->firstOrFail();

        $this->assertNotNull($participant->removed_at);
        $this->assertSame($owner->id, $participant->removed_by);
        $this->assertSame('removed_by_staff', $participant->removal_reason);

        $this->actingAs($collaborator)
            ->postJson("/api/chat/conversations/{$conversation->id}/messages", ['message' => 'Still here?'])
            ->assertForbidden();
    }

    public function test_rejoining_chat_reactivates_existing_removed_participant_row(): void
    {
        $client = $this->user('Client');
        $owner = $this->user('Marketing');
        $collaborator = $this->user('Marketing');
        $conversation = Conversation::create(['client_id' => $client->id, 'staff_id' => $owner->id, 'status' => 'active']);

        $this->actingAs($owner)
            ->postJson("/api/chat/conversations/{$conversation->id}/collaborators", ['user_id' => $collaborator->id])
            ->assertOk();

        $this->actingAs($owner)
            ->deleteJson("/api/chat/conversations/{$conversation->id}/collaborators/{$collaborator->id}")
            ->assertOk();

        $this->actingAs($owner)
            ->postJson("/api/chat/conversations/{$conversation->id}/collaborators", ['user_id' => $collaborator->id])
            ->assertOk()
            ->assertJsonCount(1, 'conversation.collaborators');

        $participants = ConversationParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', $collaborator->id)
            ->get();

        $this->assertCount(1, $participants);
        $this->assertNull($participants->first()->removed_at);
        $this->assertNull($participants->first()->removed_by);
        $this->assertNull($participants->first()->removal_reason);
        $this->assertSame('collaborator', $participants->first()->role);
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
            'event_date' => now()->addMonth()->toDateString(),
            'event_time' => '10:00',
            'pax' => 50,
            'budget' => 50000,
            'event_type' => 'Wedding',
            'client_full_name' => $client->full_name,
            'client_email' => $client->email,
            'client_phone' => $client->phone,
            'status' => 'Pending',
            'review_status' => 'Submitted',
        ], $overrides));
    }
}
