<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\RefundCase;
use App\Models\User;
use App\Services\PayMongoService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class RefundFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_cancelled_booking_with_paid_payment_appears_in_refund_queue(): void
    {
        $accounting = $this->user('Accounting');
        $client = $this->user('Client');
        $booking = $this->booking($client, ['status' => 'Cancelled']);
        $payment = $this->payment($booking, [
            'status' => 'Paid',
            'payment_method' => 'PayMongo',
            'paymongo_payment_id' => 'pay_queue_123',
        ]);

        $this->actingAs($accounting)
            ->getJson('/api/accounting/refunds/queue')
            ->assertOk()
            ->assertJsonFragment([
                'booking_id' => $booking->id,
                'client_email' => $client->email,
                'refund_status' => 'Needs Review',
            ]);

        $this->assertSame('Paid', $payment->fresh()->status);
    }

    public function test_paymongo_refund_success_updates_payment_and_refund_case(): void
    {
        $accounting = $this->user('Accounting');
        $client = $this->user('Client');
        $booking = $this->booking($client, ['status' => 'Cancelled', 'total_cost' => 50000]);
        $payment = $this->payment($booking, [
            'amount' => 20000,
            'status' => 'Paid',
            'payment_method' => 'PayMongo',
            'paymongo_payment_id' => 'pay_refund_success',
        ]);

        $this->mock(PayMongoService::class, function (MockInterface $mock): void {
            $mock->shouldReceive('createRefund')
                ->once()
                ->with('pay_refund_success', 15000.0, 'requested_by_customer', \Mockery::type('string'))
                ->andReturn([
                    'id' => 'ref_success_123',
                    'amount' => 15000,
                    'status' => 'succeeded',
                    'raw' => ['data' => ['id' => 'ref_success_123']],
                ]);
        });

        $this->actingAs($accounting)
            ->postJson("/api/accounting/refund/{$booking->id}")
            ->assertOk()
            ->assertJsonPath('success', true);

        $payment->refresh();

        $this->assertSame('Refunded', $payment->status);
        $this->assertDatabaseHas('refund_cases', [
            'booking_id' => $booking->id,
            'payment_id' => $payment->id,
            'amount' => 15000,
            'non_refundable_amount' => 5000,
            'status' => 'Refunded',
            'provider_refund_id' => 'ref_success_123',
        ]);
        $this->assertDatabaseHas('payment_events', [
            'payment_id' => $payment->id,
            'event_type' => 'refund_completed',
            'source' => 'paymongo',
        ]);
    }

    public function test_paymongo_refund_failure_keeps_payment_paid_and_marks_case_failed(): void
    {
        $accounting = $this->user('Accounting');
        $client = $this->user('Client');
        $booking = $this->booking($client, ['status' => 'Cancelled', 'total_cost' => 50000]);
        $payment = $this->payment($booking, [
            'amount' => 20000,
            'status' => 'Paid',
            'payment_method' => 'PayMongo',
            'paymongo_payment_id' => 'pay_refund_failure',
        ]);

        $this->mock(PayMongoService::class, function (MockInterface $mock): void {
            $mock->shouldReceive('createRefund')
                ->once()
                ->andThrow(new RuntimeException('Provider temporarily unavailable.'));
        });

        $this->actingAs($accounting)
            ->postJson("/api/accounting/refund/{$booking->id}")
            ->assertStatus(500)
            ->assertJsonPath('error', 'Failed to process refunds.');

        $this->assertSame('Paid', $payment->fresh()->status);

        $case = RefundCase::where('payment_id', $payment->id)->firstOrFail();

        $this->assertSame('Failed', $case->status);
        $this->assertSame('Automatic provider refund failed. Review PayMongo logs before retrying.', $case->notes);
        $this->assertDatabaseHas('payment_events', [
            'payment_id' => $payment->id,
            'event_type' => 'refund_failed',
            'source' => 'paymongo',
        ]);
    }

    public function test_failed_refund_retry_reuses_case_without_duplicate(): void
    {
        $accounting = $this->user('Accounting');
        $client = $this->user('Client');
        $booking = $this->booking($client, ['status' => 'Cancelled', 'total_cost' => 50000]);
        $payment = $this->payment($booking, [
            'amount' => 20000,
            'status' => 'Paid',
            'payment_method' => 'PayMongo',
            'paymongo_payment_id' => 'pay_refund_retry',
        ]);

        RefundCase::create([
            'booking_id' => $booking->id,
            'payment_id' => $payment->id,
            'amount' => 15000,
            'non_refundable_amount' => 5000,
            'reason' => 'cancelled_booking',
            'status' => 'Failed',
            'notes' => 'Previous provider failure.',
        ]);

        $this->mock(PayMongoService::class, function (MockInterface $mock): void {
            $mock->shouldReceive('createRefund')
                ->once()
                ->andReturn(['id' => 'ref_retry_123', 'status' => 'succeeded']);
        });

        $this->actingAs($accounting)
            ->postJson("/api/accounting/refund/{$booking->id}")
            ->assertOk();

        $this->assertSame(1, RefundCase::where('payment_id', $payment->id)->count());
        $this->assertDatabaseHas('refund_cases', [
            'payment_id' => $payment->id,
            'status' => 'Refunded',
            'provider_refund_id' => 'ref_retry_123',
        ]);
    }

    public function test_explicit_provider_refund_retry_updates_case_payment_and_events(): void
    {
        $accounting = $this->user('Accounting');
        $client = $this->user('Client');
        $booking = $this->booking($client, ['status' => 'Cancelled', 'total_cost' => 50000]);
        $payment = $this->payment($booking, [
            'amount' => 20000,
            'status' => 'Paid',
            'payment_method' => 'PayMongo',
            'paymongo_payment_id' => 'pay_explicit_retry',
        ]);
        $case = RefundCase::create([
            'booking_id' => $booking->id,
            'payment_id' => $payment->id,
            'amount' => 15000,
            'non_refundable_amount' => 5000,
            'reason' => 'cancelled_booking',
            'status' => 'Failed',
            'last_action' => 'provider_refund_failed',
        ]);

        $this->mock(PayMongoService::class, function (MockInterface $mock): void {
            $mock->shouldReceive('createRefund')
                ->once()
                ->with('pay_explicit_retry', 15000.0, 'requested_by_customer', \Mockery::type('string'))
                ->andReturn(['id' => 'ref_explicit_retry', 'status' => 'succeeded']);
        });

        $this->actingAs($accounting)
            ->postJson("/api/accounting/refund/{$booking->id}/retry_provider_refund", [
                'refund_case_id' => $case->id,
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Provider refund retried successfully.');

        $this->assertSame('Refunded', $payment->fresh()->status);
        $this->assertDatabaseHas('refund_cases', [
            'id' => $case->id,
            'status' => 'Refunded',
            'provider_refund_id' => 'ref_explicit_retry',
        ]);
        $this->assertDatabaseHas('payment_events', [
            'payment_id' => $payment->id,
            'event_type' => 'refund_retry_requested',
            'source' => 'accounting',
        ]);
        $this->assertDatabaseHas('payment_events', [
            'payment_id' => $payment->id,
            'event_type' => 'refund_completed',
            'source' => 'paymongo',
        ]);
    }

    public function test_explicit_provider_refund_retry_requires_provider_payment_id(): void
    {
        $accounting = $this->user('Accounting');
        $client = $this->user('Client');
        $booking = $this->booking($client, ['status' => 'Cancelled', 'total_cost' => 50000]);
        $payment = $this->payment($booking, [
            'amount' => 20000,
            'status' => 'Paid',
            'payment_method' => 'PayMongo',
            'paymongo_payment_id' => null,
            'paymongo_checkout_session_id' => 'checkout_missing_reference',
        ]);
        $case = RefundCase::create([
            'booking_id' => $booking->id,
            'payment_id' => $payment->id,
            'amount' => 15000,
            'non_refundable_amount' => 5000,
            'reason' => 'cancelled_booking',
            'status' => 'Failed',
        ]);

        $this->mock(PayMongoService::class, function (MockInterface $mock): void {
            $mock->shouldNotReceive('createRefund');
        });

        $this->actingAs($accounting)
            ->postJson("/api/accounting/refund/{$booking->id}/retry_provider_refund", [
                'refund_case_id' => $case->id,
            ])
            ->assertStatus(422);

        $this->assertSame('Paid', $payment->fresh()->status);
        $this->assertDatabaseHas('refund_cases', [
            'id' => $case->id,
            'status' => 'Failed',
            'last_action' => 'missing_provider_payment_id',
        ]);
    }

    public function test_manual_refund_action_requires_notes_and_closes_case(): void
    {
        $accounting = $this->user('Accounting');
        $client = $this->user('Client');
        $booking = $this->booking($client, ['status' => 'Cancelled', 'total_cost' => 50000]);
        $payment = $this->payment($booking, [
            'amount' => 20000,
            'status' => 'Paid',
            'payment_method' => 'Manual',
        ]);
        $case = RefundCase::create([
            'booking_id' => $booking->id,
            'payment_id' => $payment->id,
            'amount' => 15000,
            'non_refundable_amount' => 5000,
            'reason' => 'cancelled_booking',
            'status' => 'Manual Review',
        ]);

        $this->actingAs($accounting)
            ->postJson("/api/accounting/refund/{$booking->id}/mark_manually_refunded", [
                'refund_case_id' => $case->id,
            ])
            ->assertStatus(422);

        $this->actingAs($accounting)
            ->postJson("/api/accounting/refund/{$booking->id}/mark_manually_refunded", [
                'refund_case_id' => $case->id,
                'notes' => 'Refunded via bank transfer reference ABC123.',
            ])
            ->assertOk();

        $this->assertSame('Refunded', $payment->fresh()->status);
        $this->assertDatabaseHas('refund_cases', [
            'id' => $case->id,
            'status' => 'Manual Refunded',
            'last_action' => 'mark_manually_refunded',
        ]);
    }

    public function test_non_refundable_reservation_fee_is_forfeited_without_provider_refund(): void
    {
        $accounting = $this->user('Accounting');
        $client = $this->user('Client');
        $booking = $this->booking($client, [
            'status' => 'Cancelled',
            'event_date' => now()->addDays(45)->toDateString(),
            'total_cost' => 50000,
        ]);
        $payment = $this->payment($booking, [
            'amount' => 5000,
            'status' => 'Paid',
            'payment_method' => 'PayMongo',
            'paymongo_payment_id' => 'pay_non_refundable',
        ]);

        $this->mock(PayMongoService::class, function (MockInterface $mock): void {
            $mock->shouldNotReceive('createRefund');
        });

        $this->actingAs($accounting)
            ->postJson("/api/accounting/refund/{$booking->id}")
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertSame('Refunded', $payment->fresh()->status);
        $this->assertDatabaseHas('refund_cases', [
            'booking_id' => $booking->id,
            'payment_id' => $payment->id,
            'amount' => 0,
            'non_refundable_amount' => 5000,
            'status' => 'Refunded',
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
            'email_verified_at' => now(),
        ]);
    }

    private function booking(User $client, array $overrides = []): Booking
    {
        return Booking::create(array_merge([
            'user_id' => $client->id,
            'event_date' => now()->addDays(45)->toDateString(),
            'event_time' => '10:00 AM - 2:00 PM',
            'event_name' => 'Refund Test Event',
            'event_type' => 'Wedding',
            'pax' => 100,
            'budget' => 50000,
            'package_id' => 'custom',
            'client_full_name' => 'Refund Client',
            'client_email' => $client->email,
            'client_phone' => '09170000000',
            'venue_city' => 'Quezon City',
            'venue_address_line' => 'Refund venue',
            'total_cost' => 50000,
            'selected_menu' => ['starter' => [['id' => 1, 'name' => 'Soup']]],
            'status' => 'Cancelled',
            'review_status' => 'Approved For Reservation',
        ], $overrides));
    }

    private function payment(Booking $booking, array $overrides = []): Payment
    {
        return Payment::create(array_merge([
            'booking_id' => $booking->id,
            'amount' => 5000,
            'payment_method' => 'PayMongo',
            'status' => 'Paid',
            'payment_type' => 'Reservation',
            'due_date' => now()->toDateString(),
        ], $overrides));
    }
}
