<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BusinessRule;
use App\Models\Payment;
use App\Models\PaymentEvent;
use App\Models\RefundCase;
use App\Models\User;
use App\Services\PaymentCalculationService;
use App\Services\PayMongoService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Mockery\MockInterface;
use Tests\TestCase;

class PaymentSafetyTest extends TestCase
{
    use RefreshDatabase;

    public function test_legacy_manual_payment_endpoint_cannot_verify_customer_payment(): void
    {
        $client = $this->user('Client');
        $booking = $this->booking($client);
        $payment = $this->payment($booking);

        $response = $this->actingAs($client)->postJson('/api/bookings/pay', [
            'booking_id' => $booking->id,
            'payment_id' => $payment->id,
            'amount' => 5000,
            'payment_method' => 'GCash',
            'reference_number' => 'CLIENT-CAN-NOT-VERIFY',
        ]);

        $response
            ->assertStatus(410)
            ->assertJsonPath('error', 'Manual payment confirmation is retired. Please use Secure Checkout from your dashboard or contact Accounting so a staff member can review any manual payment proof.');

        $payment->refresh();

        $this->assertSame('Pending', $payment->status);
        $this->assertSame('Pending', $payment->payment_method);
        $this->assertNull($payment->verified_by);
        $this->assertNull($payment->verified_at);
        $this->assertNull($payment->paymongo_payment_id);

        $event = PaymentEvent::where('event_type', 'manual_payment_blocked')->first();

        $this->assertNotNull($event);
        $this->assertSame($payment->id, $event->payment_id);
        $this->assertSame($booking->id, $event->booking_id);
        $this->assertSame('customer', $event->source);
        $this->assertSame($client->id, $event->created_by);
        $this->assertTrue($event->metadata['reference_number_provided']);
        $this->assertArrayNotHasKey('reference_number', $event->metadata);
    }

    public function test_customer_cannot_use_legacy_payment_endpoint_for_another_customer_booking(): void
    {
        $client = $this->user('Client');
        $otherClient = $this->user('Client');
        $otherBooking = $this->booking($otherClient);
        $otherPayment = $this->payment($otherBooking);

        $this->actingAs($client)->postJson('/api/bookings/pay', [
            'booking_id' => $otherBooking->id,
            'payment_id' => $otherPayment->id,
            'amount' => 5000,
            'payment_method' => 'GCash',
            'reference_number' => 'OTHER-CUSTOMER-PAYMENT',
        ])->assertNotFound();

        $otherPayment->refresh();

        $this->assertSame('Pending', $otherPayment->status);
        $this->assertNull($otherPayment->verified_by);
        $this->assertDatabaseMissing('payment_events', [
            'booking_id' => $otherBooking->id,
            'event_type' => 'manual_payment_blocked',
        ]);
    }

    public function test_retired_manual_payment_page_redirects_customer_to_dashboard(): void
    {
        $client = $this->user('Client');

        $this->actingAs($client)
            ->get('/pay')
            ->assertRedirect(route('dashboard.client'))
            ->assertSessionHas('error', 'The manual payment page has been retired. Please use Secure Checkout from your dashboard so PayMongo or Accounting can confirm the payment safely.');
    }

    public function test_accounting_can_still_verify_a_payment_after_review(): void
    {
        Notification::fake();

        $client = $this->user('Client');
        $accounting = $this->user('Accounting');
        $booking = $this->booking($client);
        $payment = $this->payment($booking);

        $this->actingAs($accounting)
            ->putJson("/api/accounting/payments/{$payment->id}/verify", ['action' => 'Verify'])
            ->assertOk()
            ->assertJsonPath('message', 'Payment Verified');

        $payment->refresh();

        $this->assertSame('Verified', $payment->status);
        $this->assertSame($accounting->username, $payment->verified_by);
        $this->assertNotNull($payment->verified_at);
        $this->assertDatabaseHas('payment_events', [
            'payment_id' => $payment->id,
            'event_type' => 'verified_by_accounting',
            'source' => 'accounting',
        ]);
    }

    public function test_client_cannot_access_accounting_payment_verification_route(): void
    {
        $client = $this->user('Client');
        $booking = $this->booking($client);
        $payment = $this->payment($booking);

        $this->actingAs($client)
            ->putJson("/api/accounting/payments/{$payment->id}/verify", ['action' => 'Verify'])
            ->assertForbidden();

        $payment->refresh();

        $this->assertSame('Pending', $payment->status);
        $this->assertNull($payment->verified_by);
        $this->assertNull($payment->verified_at);
    }

    public function test_paymongo_checkout_remains_the_primary_customer_payment_path(): void
    {
        $this->businessRules();

        $client = $this->user('Client');
        $booking = $this->booking($client, ['total_cost' => 50000, 'budget' => 50000]);
        $payment = $this->payment($booking, ['amount' => 5000, 'payment_type' => 'Reservation']);

        $this->mock(PayMongoService::class, function (MockInterface $mock): void {
            $mock->shouldReceive('createCheckoutSession')
                ->once()
                ->andReturn([
                    'id' => 'checkout_session_test_123',
                    'checkout_url' => 'https://checkout.paymongo.test/session/123',
                ]);
        });

        $this->actingAs($client)
            ->withHeader('X-Inertia', 'true')
            ->post('/checkout/initialize', [
                'booking_id' => $booking->id,
                'payment_id' => $payment->id,
            ])
            ->assertStatus(409)
            ->assertHeader('X-Inertia-Location', 'https://checkout.paymongo.test/session/123');

        $payment->refresh();

        $this->assertSame('Pending', $payment->status);
        $this->assertSame('PayMongo Checkout', $payment->payment_method);
        $this->assertSame('checkout_session_test_123', $payment->paymongo_checkout_session_id);
        $this->assertSame("ECS-{$booking->id}-P{$payment->id}", $payment->paymongo_reference_number);
        $this->assertNull($payment->verified_by);
        $this->assertNull($payment->verified_at);
        $this->assertDatabaseHas('payment_events', [
            'payment_id' => $payment->id,
            'event_type' => 'checkout_created',
            'source' => 'customer',
        ]);
    }

    public function test_payment_milestones_do_not_overwrite_operational_booking_status(): void
    {
        $client = $this->user('Client');
        $booking = $this->booking($client, [
            'status' => 'Confirmed',
            'total_cost' => 50000,
            'milestone_step' => 1,
            'live_status' => 'Not Started',
        ]);
        $this->payment($booking, [
            'amount' => 5000,
            'status' => 'Paid',
            'payment_type' => 'Reservation',
        ]);

        app(PaymentCalculationService::class)->updateBookingMilestone($booking);

        $booking->refresh();

        $this->assertSame('Confirmed', $booking->status);
        $this->assertSame(3, $booking->milestone_step);
        $this->assertSame('Reserved', $booking->live_status);
    }

    public function test_schedule_recalculation_voids_obsolete_pending_terms_instead_of_deleting_them(): void
    {
        $this->businessRules();
        $client = $this->user('Client');
        $booking = $this->booking($client, [
            'event_date' => now()->addDays(5)->toDateString(),
            'total_cost' => 50000,
            'budget' => 50000,
        ]);

        $reservation = $this->payment($booking, ['amount' => 5000, 'payment_type' => 'Reservation']);
        $downPayment = $this->payment($booking, ['amount' => 35000, 'payment_type' => 'DownPayment']);

        app(PaymentCalculationService::class)->syncPendingTranches($booking);

        $this->assertNotNull($reservation->fresh()->voided_at);
        $this->assertSame('obsolete_rush_tranche', $reservation->fresh()->void_reason);
        $this->assertNotNull($downPayment->fresh()->voided_at);
        $this->assertDatabaseHas('payments', ['id' => $reservation->id]);
        $this->assertDatabaseHas('payment_events', [
            'payment_id' => $reservation->id,
            'event_type' => 'payment_term_voided',
            'source' => 'system',
        ]);
        $this->assertDatabaseHas('payments', [
            'booking_id' => $booking->id,
            'payment_type' => 'Final',
            'status' => 'Pending',
            'voided_at' => null,
        ]);
    }

    public function test_schedule_cleanup_does_not_void_locked_or_touched_payments(): void
    {
        $this->businessRules();
        $client = $this->user('Client');
        $booking = $this->booking($client, [
            'event_date' => now()->addDays(5)->toDateString(),
            'total_cost' => 50000,
            'budget' => 50000,
        ]);
        $withProof = $this->payment($booking, [
            'amount' => 5000,
            'payment_type' => 'Reservation',
            'proof_image' => 'proofs/payment.jpg',
        ]);
        $withEvent = $this->payment($booking, [
            'amount' => 35000,
            'payment_type' => 'DownPayment',
        ]);
        PaymentEvent::create([
            'payment_id' => $withEvent->id,
            'booking_id' => $booking->id,
            'event_type' => 'checkout_created',
            'source' => 'customer',
            'metadata' => [],
        ]);

        app(PaymentCalculationService::class)->syncPendingTranches($booking);

        $this->assertNull($withProof->fresh()->voided_at);
        $this->assertNull($withEvent->fresh()->voided_at);
    }

    public function test_accounting_term_removal_voids_unlocked_terms_and_active_queues_ignore_them(): void
    {
        $accounting = $this->user('Accounting');
        $client = $this->user('Client');
        $booking = $this->booking($client, ['total_cost' => 50000, 'budget' => 50000]);
        $kept = $this->payment($booking, ['amount' => 10000, 'payment_type' => 'Reservation']);
        $removed = $this->payment($booking, ['amount' => 40000, 'payment_type' => 'Final']);

        $this->actingAs($accounting)
            ->putJson("/api/accounting/bookings/{$booking->id}/payment-terms", [
                'terms' => [[
                    'id' => $kept->id,
                    'payment_type' => 'Reservation',
                    'percentage' => 100,
                    'due_date' => now()->addDay()->toDateString(),
                ]],
            ])
            ->assertOk();

        $removed->refresh();
        $this->assertNotNull($removed->voided_at);
        $this->assertSame('accounting_terms_removed', $removed->void_reason);
        $this->assertSame($accounting->id, $removed->voided_by);
        $this->assertDatabaseHas('payment_events', [
            'payment_id' => $removed->id,
            'event_type' => 'payment_term_voided',
            'source' => 'accounting',
        ]);

        $pending = $this->actingAs($accounting)
            ->getJson('/api/accounting/payments/pending')
            ->assertOk()
            ->json();

        $this->assertContains($kept->id, collect($pending)->pluck('id')->all());
        $this->assertNotContains($removed->id, collect($pending)->pluck('id')->all());

        $ledger = $this->actingAs($accounting)
            ->getJson('/api/accounting/ledger')
            ->assertOk()
            ->json();
        $this->assertNotContains($removed->id, collect($ledger)->pluck('id')->all());

        $ledgerWithVoided = $this->actingAs($accounting)
            ->getJson('/api/accounting/ledger?include_voided=1')
            ->assertOk()
            ->json();
        $this->assertContains($removed->id, collect($ledgerWithVoided)->pluck('id')->all());
    }

    public function test_customer_dashboard_checkout_and_next_due_ignore_voided_terms(): void
    {
        $this->businessRules();
        $client = $this->user('Client');
        $booking = $this->booking($client, ['total_cost' => 50000, 'budget' => 50000]);
        $voided = $this->payment($booking, [
            'amount' => 5000,
            'payment_type' => 'Reservation',
            'due_date' => now()->subDay()->toDateString(),
            'voided_at' => now(),
            'void_reason' => 'schedule_recalculated',
        ]);
        $active = $this->payment($booking, [
            'amount' => 45000,
            'payment_type' => 'Final',
            'due_date' => now()->addDay()->toDateString(),
        ]);

        $payload = $this->actingAs($client)
            ->getJson('/api/dashboard/client')
            ->assertOk()
            ->json();

        $this->assertNotContains($voided->id, collect($payload['payments'])->pluck('id')->all());
        $this->assertContains($active->id, collect($payload['payments'])->pluck('id')->all());
        $this->assertSame($active->id, $payload['bookings'][0]['nextPaymentDue']['id']);

        $this->actingAs($client)
            ->withHeader('X-Inertia', 'true')
            ->post('/checkout/initialize', [
                'booking_id' => $booking->id,
                'payment_id' => $voided->id,
            ])
            ->assertRedirect()
            ->assertSessionHas('error', 'Payment milestone not found for this booking.');
    }

    public function test_voiding_guard_blocks_refund_case_connected_terms(): void
    {
        $this->businessRules();
        $client = $this->user('Client');
        $booking = $this->booking($client, [
            'event_date' => now()->addDays(5)->toDateString(),
            'total_cost' => 50000,
            'budget' => 50000,
        ]);
        $payment = $this->payment($booking, ['payment_type' => 'Reservation']);
        RefundCase::create([
            'booking_id' => $booking->id,
            'payment_id' => $payment->id,
            'amount' => 100,
            'non_refundable_amount' => 0,
            'reason' => 'manual_review',
            'status' => 'Manual Review',
        ]);

        app(PaymentCalculationService::class)->syncPendingTranches($booking);

        $this->assertNull($payment->fresh()->voided_at);
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
            'event_name' => 'Payment Safety Event',
            'event_type' => 'Wedding',
            'pax' => 100,
            'budget' => 50000,
            'package_id' => 'custom',
            'client_full_name' => 'Payment Safety Client',
            'client_email' => $client->email,
            'client_phone' => '09170000000',
            'venue_city' => 'Quezon City',
            'venue_address_line' => 'Payment safety venue',
            'total_cost' => 50000,
            'selected_menu' => ['starter' => [['id' => 1, 'name' => 'Soup']]],
            'status' => 'Confirmed',
            'review_status' => 'Approved For Reservation',
        ], $overrides));
    }

    private function payment(Booking $booking, array $overrides = []): Payment
    {
        return Payment::create(array_merge([
            'booking_id' => $booking->id,
            'amount' => 5000,
            'payment_method' => 'Pending',
            'status' => 'Pending',
            'payment_type' => 'Reservation',
            'due_date' => now()->toDateString(),
        ], $overrides));
    }

    private function businessRules(): BusinessRule
    {
        return BusinessRule::create([
            'minimum_lead_days' => 7,
            'maximum_capacity_per_day' => 7,
            'maximum_pax_per_event' => 1000,
            'minimum_pax_per_event' => 30,
            'is_active' => true,
            'reservation_fee_percentage' => 10,
            'downpayment_percentage' => 70,
            'final_payment_percentage' => 20,
            'reservation_validity_hours' => 24,
            'downpayment_due_days' => 30,
            'final_payment_due_days' => 10,
        ]);
    }
}
