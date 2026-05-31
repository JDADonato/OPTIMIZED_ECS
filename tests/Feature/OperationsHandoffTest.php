<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\EventPreparationTask;
use App\Models\FeedbackRequest;
use App\Models\FeedbackResponse;
use App\Models\FoodTasting;
use App\Models\Payment;
use App\Models\User;
use App\Services\EventPreparationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OperationsHandoffTest extends TestCase
{
    use RefreshDatabase;

    public function test_approving_booking_creates_default_preparation_tasks_once(): void
    {
        $admin = $this->user('Admin');
        $booking = $this->booking(['status' => 'Pending']);

        $this->actingAs($admin)
            ->putJson("/api/admin/bookings/{$booking->id}/status", ['status' => 'Confirmed'])
            ->assertOk();

        $this->assertSame(10, EventPreparationTask::where('booking_id', $booking->id)->count());

        EventPreparationService::ensureDefaultTasks($booking->fresh());

        $this->assertSame(10, EventPreparationTask::where('booking_id', $booking->id)->count());
    }

    public function test_preparation_board_returns_upcoming_approved_bookings(): void
    {
        $marketing = $this->user('Marketing');
        $included = $this->booking([
            'status' => 'Confirmed',
            'event_date' => now()->addDays(10)->toDateString(),
        ]);
        $this->booking([
            'status' => 'Pending',
            'event_date' => now()->addDays(10)->toDateString(),
        ]);
        $this->booking([
            'status' => 'Confirmed',
            'event_date' => now()->addDays(45)->toDateString(),
        ]);

        $response = $this->actingAs($marketing)
            ->getJson('/api/operations/preparation-board')
            ->assertOk();

        $response->assertJsonCount(1)
            ->assertJsonPath('0.booking.id', $included->id)
            ->assertJsonPath('0.task_progress.total', 10)
            ->assertJsonPath('0.event_sheet.booking_ref', str_pad((string) $included->id, 5, '0', STR_PAD_LEFT));
    }

    public function test_preparation_board_returns_action_first_handoff_helpers(): void
    {
        $admin = $this->user('Admin');
        $booking = $this->booking([
            'status' => 'Confirmed',
            'event_date' => now()->addDays(10)->toDateString(),
        ]);

        $response = $this->actingAs($admin)
            ->getJson('/api/operations/preparation-board')
            ->assertOk();

        $response->assertJsonPath('0.booking.id', $booking->id)
            ->assertJsonPath('0.next_action.kind', 'payment')
            ->assertJsonPath('0.next_action.label', 'Accounting must clear payment')
            ->assertJsonPath('0.blocking_items.0.key', 'payment')
            ->assertJsonPath('0.readiness_progress.total', 6)
            ->assertJsonPath('0.task_groups.0.owner', 'Marketing')
            ->assertJsonPath('0.task_groups.1.owner', 'Accounting')
            ->assertJsonPath('0.task_groups.2.owner', 'Service prep');
    }

    public function test_preparation_board_prioritizes_customer_menu_before_headcount_after_payment_clearance(): void
    {
        $marketing = $this->user('Marketing');
        $booking = $this->booking([
            'status' => 'Confirmed',
            'event_date' => now()->addDays(10)->toDateString(),
            'selected_menu' => null,
            'pax' => 0,
        ]);
        Payment::create([
            'booking_id' => $booking->id,
            'amount' => 1000,
            'payment_method' => 'cash',
            'payment_type' => 'Reservation',
            'status' => 'Paid',
        ]);

        $this->actingAs($marketing)
            ->getJson('/api/operations/preparation-board')
            ->assertOk()
            ->assertJsonPath('0.blocking_items.0.key', 'menu')
            ->assertJsonPath('0.next_action.kind', 'menu')
            ->assertJsonPath('0.next_action.primary_action_label', 'Open messages');
    }

    public function test_staff_can_complete_and_reopen_preparation_task(): void
    {
        $marketing = $this->user('Marketing');
        $booking = $this->booking(['status' => 'Confirmed']);
        EventPreparationService::ensureDefaultTasks($booking);
        $task = EventPreparationTask::where('booking_id', $booking->id)
            ->where('department', 'Marketing')
            ->firstOrFail();

        $this->actingAs($marketing)
            ->patchJson("/api/operations/preparation-tasks/{$task->id}", ['status' => 'Done'])
            ->assertOk()
            ->assertJsonPath('task.status', 'Done');

        $this->assertDatabaseHas('event_preparation_tasks', [
            'id' => $task->id,
            'status' => 'Done',
            'completed_by' => $marketing->id,
        ]);

        $this->actingAs($marketing)
            ->patchJson("/api/operations/preparation-tasks/{$task->id}", ['status' => 'Pending'])
            ->assertOk()
            ->assertJsonPath('task.status', 'Pending');

        $this->assertDatabaseHas('event_preparation_tasks', [
            'id' => $task->id,
            'status' => 'Pending',
            'completed_by' => null,
        ]);
    }

    public function test_marketing_cannot_update_non_marketing_preparation_task(): void
    {
        $marketing = $this->user('Marketing');
        $booking = $this->booking(['status' => 'Confirmed']);
        EventPreparationService::ensureDefaultTasks($booking);
        $task = EventPreparationTask::where('booking_id', $booking->id)
            ->where('department', 'Accounting')
            ->firstOrFail();

        $this->actingAs($marketing)
            ->patchJson("/api/operations/preparation-tasks/{$task->id}", ['status' => 'Done'])
            ->assertForbidden();

        $this->assertDatabaseHas('event_preparation_tasks', [
            'id' => $task->id,
            'status' => 'Pending',
            'completed_by' => null,
        ]);
    }

    public function test_completing_booking_creates_one_feedback_request(): void
    {
        $marketing = $this->user('Marketing');
        $booking = $this->booking(['status' => 'Confirmed', 'assigned_to' => $marketing->id]);

        $this->actingAs($marketing)
            ->putJson("/api/marketing/bookings/{$booking->id}/status", ['status' => 'Completed'])
            ->assertOk();

        $this->assertSame(1, FeedbackRequest::where('booking_id', $booking->id)->count());

        $this->actingAs($marketing)
            ->putJson("/api/marketing/bookings/{$booking->id}/status", ['status' => 'Completed'])
            ->assertOk();

        $this->assertSame(1, FeedbackRequest::where('booking_id', $booking->id)->count());
    }

    public function test_command_completes_past_submitted_booking_once(): void
    {
        $marketing = $this->user('Marketing');
        $pastSubmitted = $this->booking([
            'status' => 'Pending',
            'review_status' => 'Submitted',
            'event_date' => now()->subDay()->toDateString(),
            'assigned_to' => $marketing->id,
        ]);

        $this->artisan('bookings:complete-past-submitted')
            ->expectsOutput('Completed 1 past submitted booking(s).')
            ->assertSuccessful();

        $pastSubmitted->refresh();
        $this->assertSame('Completed', $pastSubmitted->status);
        $this->assertSame('Completed', $pastSubmitted->review_status);
        $this->assertSame('Completed', $pastSubmitted->live_status);
        $this->assertNotNull($pastSubmitted->reviewed_at);
        $this->assertSame(1, FeedbackRequest::where('booking_id', $pastSubmitted->id)->count());

        $this->artisan('bookings:complete-past-submitted')
            ->expectsOutput('Completed 0 past submitted booking(s).')
            ->assertSuccessful();

        $this->assertSame(1, FeedbackRequest::where('booking_id', $pastSubmitted->id)->count());
    }

    public function test_past_submitted_cleanup_skips_future_and_confirmed_bookings(): void
    {
        $futureSubmitted = $this->booking([
            'status' => 'Pending',
            'review_status' => 'Submitted',
            'event_date' => now()->addDay()->toDateString(),
        ]);
        $pastConfirmed = $this->booking([
            'status' => 'Confirmed',
            'review_status' => 'Approved For Reservation',
            'event_date' => now()->subDay()->toDateString(),
        ]);

        $this->artisan('bookings:complete-past-submitted')
            ->expectsOutput('Completed 0 past submitted booking(s).')
            ->assertSuccessful();

        $this->assertSame('Pending', $futureSubmitted->fresh()->status);
        $this->assertSame('Submitted', $futureSubmitted->fresh()->review_status);
        $this->assertSame('Confirmed', $pastConfirmed->fresh()->status);
        $this->assertSame('Approved For Reservation', $pastConfirmed->fresh()->review_status);
        $this->assertSame(0, FeedbackRequest::whereIn('booking_id', [$futureSubmitted->id, $pastConfirmed->id])->count());
    }

    public function test_cleanup_normalizes_completed_bookings_stuck_with_submitted_review_status(): void
    {
        $booking = $this->booking([
            'status' => 'Completed',
            'review_status' => 'Submitted',
            'event_date' => now()->subDay()->toDateString(),
        ]);

        $this->artisan('bookings:complete-past-submitted')
            ->expectsOutput('Completed 1 past submitted booking(s).')
            ->assertSuccessful();

        $booking->refresh();
        $this->assertSame('Completed', $booking->status);
        $this->assertSame('Completed', $booking->review_status);
        $this->assertSame('Completed', $booking->live_status);
        $this->assertSame(1, FeedbackRequest::where('booking_id', $booking->id)->count());
    }

    public function test_completed_past_submitted_booking_leaves_marketing_review_counts(): void
    {
        $marketing = $this->user('Marketing');
        $booking = $this->booking([
            'status' => 'Pending',
            'review_status' => 'Submitted',
            'event_date' => now()->subDay()->toDateString(),
        ]);

        $this->actingAs($marketing)
            ->getJson('/api/marketing/summary')
            ->assertOk()
            ->assertJsonPath('pending', 1);

        $this->artisan('bookings:complete-past-submitted')->assertSuccessful();

        $this->actingAs($marketing)
            ->getJson('/api/marketing/summary')
            ->assertOk()
            ->assertJsonPath('pending', 0);

        $this->assertSame('Completed', $booking->fresh()->status);
    }

    public function test_customer_submits_feedback_and_low_rating_requires_follow_up(): void
    {
        $client = $this->user('Client');
        $booking = $this->booking(['user_id' => $client->id, 'status' => 'Completed']);
        $request = EventPreparationService::ensureFeedbackRequest($booking);

        $this->actingAs($client)
            ->getJson('/api/customer/feedback-requests')
            ->assertOk()
            ->assertJsonPath('0.token', $request->token);

        $this->actingAs($client)
            ->postJson("/api/customer/feedback-requests/{$request->token}/responses", [
                'rating' => 3,
                'food_rating' => 4,
                'service_rating' => 3,
                'communication_rating' => 3,
                'value_rating' => 3,
                'comments' => 'Please follow up with us.',
                'testimonial_permission' => false,
            ])
            ->assertCreated()
            ->assertJsonPath('response.follow_up_required', true);

        $this->assertDatabaseHas('feedback_requests', [
            'id' => $request->id,
            'status' => 'Completed',
        ]);
        $this->assertDatabaseHas('feedback_responses', [
            'feedback_request_id' => $request->id,
            'follow_up_required' => true,
        ]);

        $this->actingAs($client)
            ->postJson("/api/customer/feedback-requests/{$request->token}/responses", ['rating' => 5])
            ->assertUnprocessable();
    }

    public function test_marketing_can_manage_food_tasting_queue_and_outcome(): void
    {
        $marketing = $this->user('Marketing');
        $client = $this->user('Client');
        $tasting = FoodTasting::create([
            'user_id' => $client->id,
            'guest_name' => 'Tasting Client',
            'guest_email' => 'tasting@example.test',
            'guest_phone' => '09170000000',
            'preferred_date' => now()->addDays(8)->toDateString(),
            'preferred_time' => '2:00 PM',
            'notes' => 'Interested in wedding menu.',
            'status' => 'Pending',
        ]);

        $this->actingAs($marketing)
            ->getJson('/api/marketing/food-tastings')
            ->assertOk()
            ->assertJsonFragment([
                'id' => $tasting->id,
                'client_email' => 'tasting@example.test',
                'status' => 'Pending',
            ]);

        $this->actingAs($marketing)
            ->patchJson("/api/marketing/food-tastings/{$tasting->id}", [
                'status' => 'Completed',
                'outcome_notes' => 'Client approved the beef and pasta tasting menu.',
            ])
            ->assertOk()
            ->assertJsonPath('tasting.status', 'Completed');

        $tasting->refresh();

        $this->assertSame('Completed', $tasting->status);
        $this->assertSame('Client approved the beef and pasta tasting menu.', $tasting->outcome_notes);
        $this->assertSame($marketing->id, $tasting->handled_by);
        $this->assertNotNull($tasting->completed_at);
    }

    public function test_marketing_can_review_feedback_follow_up_and_approve_testimonial(): void
    {
        $marketing = $this->user('Marketing');
        $client = $this->user('Client');
        $booking = $this->booking(['user_id' => $client->id, 'status' => 'Completed']);
        $request = EventPreparationService::ensureFeedbackRequest($booking);

        $lowRating = FeedbackResponse::create([
            'feedback_request_id' => $request->id,
            'booking_id' => $booking->id,
            'user_id' => $client->id,
            'rating' => 2,
            'comments' => 'Please call us.',
            'testimonial_permission' => false,
            'follow_up_required' => true,
            'review_status' => 'Needs Follow Up',
            'testimonial_status' => 'Not Requested',
        ]);

        $this->actingAs($marketing)
            ->getJson('/api/marketing/feedback-responses?follow_up_only=1')
            ->assertOk()
            ->assertJsonFragment([
                'id' => $lowRating->id,
                'follow_up_required' => true,
                'review_status' => 'Needs Follow Up',
            ]);

        $this->actingAs($marketing)
            ->patchJson("/api/marketing/feedback-responses/{$lowRating->id}", [
                'review_status' => 'Resolved',
                'retention_notes' => 'Called client and offered a recovery tasting.',
            ])
            ->assertOk()
            ->assertJsonPath('response.review_status', 'Resolved')
            ->assertJsonPath('response.follow_up_required', false);

        $highRating = FeedbackResponse::create([
            'feedback_request_id' => $request->id,
            'booking_id' => $booking->id,
            'user_id' => $client->id,
            'rating' => 5,
            'comments' => 'Wonderful service.',
            'testimonial_permission' => true,
            'follow_up_required' => false,
            'review_status' => 'Open',
            'testimonial_status' => 'Candidate',
        ]);

        $this->actingAs($marketing)
            ->patchJson("/api/marketing/feedback-responses/{$highRating->id}", [
                'testimonial_status' => 'Approved',
                'review_status' => 'Closed',
            ])
            ->assertOk()
            ->assertJsonPath('response.testimonial_status', 'Approved');

        $this->assertDatabaseHas('feedback_responses', [
            'id' => $highRating->id,
            'testimonial_status' => 'Approved',
            'reviewed_by' => $marketing->id,
        ]);
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
        $clientId = $overrides['user_id'] ?? $this->user('Client')->id;

        return Booking::create(array_merge([
            'user_id' => $clientId,
            'event_date' => now()->addDays(14)->toDateString(),
            'event_time' => '10:00 AM - 2:00 PM',
            'event_name' => 'Operations Test Event',
            'event_type' => 'Wedding',
            'pax' => 100,
            'budget' => 100000,
            'package_id' => 'custom',
            'client_full_name' => 'Operations Client',
            'client_email' => 'client@example.test',
            'client_phone' => '09170000000',
            'venue_city' => 'Quezon City',
            'venue_address_line' => 'Operations venue',
            'total_cost' => 100000,
            'selected_menu' => ['starter' => [['id' => 1, 'name' => 'Soup']]],
            'status' => 'Confirmed',
            'review_status' => 'Approved For Reservation',
        ], $overrides));
    }
}
