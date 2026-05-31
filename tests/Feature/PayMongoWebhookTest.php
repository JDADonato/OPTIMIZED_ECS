<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\PaymentEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PayMongoWebhookTest extends TestCase
{
    use RefreshDatabase;

    public function test_valid_paymongo_webhook_marks_matching_payment_paid(): void
    {
        $booking = $this->booking($this->user('Client'), ['total_cost' => 50000]);
        $payment = $this->payment($booking, [
            'amount' => 5000,
            'paymongo_checkout_session_id' => 'cs_valid_123',
            'paymongo_reference_number' => "ECS-{$booking->id}-P",
        ]);
        $payment->update(['paymongo_reference_number' => "ECS-{$booking->id}-P{$payment->id}"]);

        $this->postWebhook($this->paidPayload($payment, [
            'event_id' => 'evt_valid_paid',
            'checkout_id' => 'cs_valid_123',
            'payment_id' => 'pay_valid_123',
            'amount' => 500000,
        ]))->assertOk()->assertJsonPath('result.status', 'processed');

        $payment->refresh();

        $this->assertSame('Paid', $payment->status);
        $this->assertSame('PayMongo Webhook', $payment->verified_by);
        $this->assertSame('pay_valid_123', $payment->paymongo_payment_id);
        $this->assertNotNull($payment->verified_at);
        $this->assertDatabaseHas('payment_events', [
            'payment_id' => $payment->id,
            'event_type' => 'webhook_paid',
            'source' => 'paymongo',
            'provider_event_id' => 'evt_valid_paid',
        ]);
    }

    public function test_invalid_paymongo_webhook_signature_is_rejected(): void
    {
        $payment = $this->payment($this->booking($this->user('Client')));
        $payload = $this->paidPayload($payment, ['event_id' => 'evt_bad_signature']);

        $this->withHeader('Paymongo-Signature', 't='.time().',te=not-a-real-signature')
            ->postJson('/webhook/paymongo', $payload)
            ->assertUnauthorized();

        $this->assertSame('Pending', $payment->fresh()->status);
        $this->assertDatabaseMissing('payment_events', [
            'provider_event_id' => 'evt_bad_signature',
        ]);
    }

    public function test_amount_mismatch_is_recorded_without_marking_payment_paid(): void
    {
        $payment = $this->payment($this->booking($this->user('Client')), ['amount' => 5000]);

        $this->postWebhook($this->paidPayload($payment, [
            'event_id' => 'evt_amount_mismatch',
            'amount' => 499900,
        ]))->assertOk()->assertJsonPath('result.status', 'mismatch');

        $this->assertSame('Pending', $payment->fresh()->status);
        $this->assertDatabaseHas('payment_events', [
            'payment_id' => $payment->id,
            'event_type' => 'webhook_mismatch',
            'provider_event_id' => 'evt_amount_mismatch',
        ]);
    }

    public function test_currency_mismatch_is_recorded_without_marking_payment_paid(): void
    {
        $payment = $this->payment($this->booking($this->user('Client')), ['amount' => 5000]);

        $this->postWebhook($this->paidPayload($payment, [
            'event_id' => 'evt_currency_mismatch',
            'currency' => 'USD',
        ]))->assertOk()->assertJsonPath('result.status', 'mismatch');

        $this->assertSame('Pending', $payment->fresh()->status);
        $this->assertDatabaseHas('payment_events', [
            'payment_id' => $payment->id,
            'event_type' => 'webhook_mismatch',
            'provider_event_id' => 'evt_currency_mismatch',
        ]);
    }

    public function test_duplicate_webhook_event_is_idempotent(): void
    {
        $payment = $this->payment($this->booking($this->user('Client')), ['amount' => 5000]);
        $payload = $this->paidPayload($payment, ['event_id' => 'evt_duplicate_paid']);

        $this->postWebhook($payload)->assertOk();
        $firstVerifiedAt = $payment->fresh()->verified_at;

        $this->postWebhook($payload)->assertOk();

        $payment->refresh();

        $this->assertSame('Paid', $payment->status);
        $this->assertEquals($firstVerifiedAt, $payment->verified_at);
        $this->assertSame(1, PaymentEvent::where('provider_event_id', 'evt_duplicate_paid')->count());
    }

    private function postWebhook(array $payload)
    {
        config([
            'services.paymongo.webhook_secret' => 'whsec_test_secret',
            'services.paymongo.webhook_tolerance' => 300,
        ]);

        $json = json_encode($payload);
        $timestamp = (string) time();
        $signature = hash_hmac('sha256', $timestamp.'.'.$json, 'whsec_test_secret');

        return $this->call('POST', '/webhook/paymongo', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_PAYMONGO_SIGNATURE' => "t={$timestamp},te={$signature}",
        ], $json);
    }

    private function paidPayload(Payment $payment, array $overrides = []): array
    {
        $eventId = $overrides['event_id'] ?? 'evt_paid_'.uniqid();
        $checkoutId = $overrides['checkout_id'] ?? ($payment->paymongo_checkout_session_id ?: 'cs_'.uniqid());
        $providerPaymentId = $overrides['payment_id'] ?? 'pay_'.uniqid();

        return [
            'data' => [
                'id' => $eventId,
                'attributes' => [
                    'type' => 'checkout_session.payment.paid',
                    'data' => [
                        'id' => $checkoutId,
                        'attributes' => [
                            'amount' => $overrides['amount'] ?? (int) round(((float) $payment->amount) * 100),
                            'currency' => $overrides['currency'] ?? 'PHP',
                            'reference_number' => $payment->paymongo_reference_number ?: "ECS-{$payment->booking_id}-P{$payment->id}",
                            'metadata' => [
                                'booking_id' => (string) $payment->booking_id,
                                'payment_id' => (string) $payment->id,
                            ],
                            'payments' => [
                                [
                                    'id' => $providerPaymentId,
                                    'attributes' => [
                                        'amount' => $overrides['amount'] ?? (int) round(((float) $payment->amount) * 100),
                                        'currency' => $overrides['currency'] ?? 'PHP',
                                        'source' => ['type' => 'gcash'],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ];
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
            'event_name' => 'Webhook Test Event',
            'event_type' => 'Wedding',
            'pax' => 100,
            'budget' => 50000,
            'package_id' => 'custom',
            'client_full_name' => 'Webhook Client',
            'client_email' => $client->email,
            'client_phone' => '09170000000',
            'venue_city' => 'Quezon City',
            'venue_address_line' => 'Webhook venue',
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
            'paymongo_reference_number' => null,
        ], $overrides));
    }
}
