<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\FeedbackRequest;
use App\Models\FeedbackResponse;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StaffEventHistoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_completed_bookings_are_visible_to_staff_history_only(): void
    {
        $marketing = $this->user('Marketing');
        $accounting = $this->user('Accounting');
        $admin = $this->user('Admin');
        $completed = $this->booking(['status' => 'Completed', 'review_status' => 'Completed', 'post_event_status' => 'Feedback Pending']);
        $pending = $this->booking(['status' => 'Pending', 'review_status' => 'Submitted']);
        $cancelled = $this->booking(['status' => 'Cancelled', 'review_status' => 'Not Available']);

        Payment::create([
            'booking_id' => $completed->id,
            'amount' => 25000,
            'payment_method' => 'Manual',
            'status' => 'Verified',
            'payment_type' => 'Reservation',
        ]);

        foreach ([$marketing, $accounting, $admin] as $staff) {
            $this->actingAs($staff)
                ->getJson('/api/staff/event-history')
                ->assertOk()
                ->assertJsonPath('meta.total', 1)
                ->assertJsonPath('data.0.id', $completed->id)
                ->assertJsonPath('data.0.payments_summary.paid_amount', 25000);
        }

        $this->actingAs($marketing)
            ->getJson('/api/staff/event-history?search='.$pending->id)
            ->assertOk()
            ->assertJsonPath('meta.total', 0);

        $this->actingAs($accounting)
            ->getJson('/api/staff/event-history?search='.$cancelled->id)
            ->assertOk()
            ->assertJsonPath('meta.total', 0);
    }

    public function test_clients_cannot_view_staff_event_history(): void
    {
        $this->actingAs($this->user('Client'))
            ->getJson('/api/staff/event-history')
            ->assertForbidden();
    }

    public function test_staff_can_add_notes_only_to_completed_events(): void
    {
        $staff = $this->user('Marketing');
        $completed = $this->booking(['status' => 'Completed', 'review_status' => 'Completed']);
        $pending = $this->booking(['status' => 'Pending', 'review_status' => 'Submitted']);

        $this->actingAs($staff)
            ->postJson("/api/staff/event-history/{$completed->id}/notes", ['body' => 'Client praised the service team.'])
            ->assertCreated()
            ->assertJsonPath('note.body', 'Client praised the service team.')
            ->assertJsonPath('note.user_role', 'Marketing');

        $this->actingAs($staff)
            ->postJson("/api/staff/event-history/{$pending->id}/notes", ['body' => 'This should stay active.'])
            ->assertStatus(422)
            ->assertJsonPath('error', 'History notes can only be added to completed events.');

        $this->actingAs($staff)
            ->getJson('/api/staff/event-history')
            ->assertOk()
            ->assertJsonPath('data.0.notes.0.body', 'Client praised the service team.');
    }

    public function test_marketing_can_filter_history_by_feedback_status(): void
    {
        $staff = $this->user('Marketing');
        $client = $this->user('Client');
        $needsFollowUp = $this->booking([
            'user_id' => $client->id,
            'status' => 'Completed',
            'review_status' => 'Completed',
            'client_full_name' => $client->full_name,
        ]);
        $closed = $this->booking(['status' => 'Completed', 'review_status' => 'Completed']);

        $request = FeedbackRequest::create([
            'booking_id' => $needsFollowUp->id,
            'user_id' => $client->id,
            'token' => 'history-token',
            'status' => 'Completed',
            'sent_at' => now(),
            'completed_at' => now(),
        ]);

        FeedbackResponse::create([
            'feedback_request_id' => $request->id,
            'booking_id' => $needsFollowUp->id,
            'user_id' => $client->id,
            'rating' => 3,
            'follow_up_required' => true,
            'review_status' => 'Needs Follow Up',
            'testimonial_status' => 'Not Requested',
        ]);

        $this->actingAs($staff)
            ->getJson('/api/staff/event-history?feedback_status=Needs%20Follow%20Up')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $needsFollowUp->id);

        $this->actingAs($staff)
            ->getJson('/api/staff/event-history?search='.$closed->id.'&feedback_status=Needs%20Follow%20Up')
            ->assertOk()
            ->assertJsonPath('meta.total', 0);
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

    private function booking(array $overrides = []): Booking
    {
        $client = $overrides['user_id'] ?? $this->user('Client')->id;

        return Booking::create(array_merge([
            'user_id' => $client,
            'event_date' => now()->subDays(10)->toDateString(),
            'event_time' => '10:00',
            'pax' => 80,
            'budget' => 75000,
            'event_type' => 'Wedding',
            'event_name' => 'History Event',
            'client_full_name' => 'History Client',
            'client_email' => 'history@example.test',
            'client_phone' => '09170000000',
            'status' => 'Completed',
            'review_status' => 'Completed',
        ], $overrides));
    }
}
