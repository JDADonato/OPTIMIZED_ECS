<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BusinessRule;
use App\Models\Payment;
use App\Models\User;
use App\Services\PayMongoService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class CheckoutRiskTest extends TestCase
{
    use RefreshDatabase;

    public function test_checkout_success_does_not_mark_unpaid_checkout_as_paid(): void
    {
        $client = $this->user('Client');
        $booking = $this->booking($client);
        $payment = $this->payment($booking, [
            'paymongo_checkout_session_id' => 'cs_unpaid_123',
            'payment_method' => 'PayMongo Checkout',
        ]);

        $this->mock(PayMongoService::class, function (MockInterface $mock): void {
            $mock->shouldReceive('retrieveCheckoutSession')
                ->once()
                ->with('cs_unpaid_123')
                ->andReturn([
                    'data' => [
                        'attributes' => [
                            'status' => 'unpaid',
                            'amount_total' => 500000,
                        ],
                    ],
                ]);
        });

        $this->actingAs($client)
            ->get("/checkout/success?booking_id={$booking->id}&payment_id={$payment->id}")
            ->assertOk();

        $payment->refresh();

        $this->assertSame('Pending', $payment->status);
        $this->assertNull($payment->verified_at);
    }

    public function test_existing_paid_payment_cannot_start_checkout_again(): void
    {
        $this->businessRules();

        $client = $this->user('Client');
        $booking = $this->booking($client);
        $payment = $this->payment($booking, [
            'status' => 'Paid',
            'payment_method' => 'PayMongo',
        ]);

        $this->mock(PayMongoService::class, function (MockInterface $mock): void {
            $mock->shouldNotReceive('createCheckoutSession');
        });

        $this->actingAs($client)
            ->from('/dashboard/client')
            ->post('/checkout/initialize', [
                'booking_id' => $booking->id,
                'payment_id' => $payment->id,
            ])
            ->assertRedirect('/dashboard/client')
            ->assertSessionHas('error', 'This payment milestone is not payable.');
    }

    public function test_cancelled_checkout_page_does_not_change_payment_status(): void
    {
        $client = $this->user('Client');
        $booking = $this->booking($client);
        $payment = $this->payment($booking, [
            'paymongo_checkout_session_id' => 'cs_cancelled_123',
            'payment_method' => 'PayMongo Checkout',
        ]);

        $this->actingAs($client)
            ->get('/checkout/cancelled')
            ->assertOk();

        $this->assertSame('Pending', $payment->fresh()->status);
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

    private function booking(User $client): Booking
    {
        return Booking::create([
            'user_id' => $client->id,
            'event_date' => now()->addDays(45)->toDateString(),
            'event_time' => '10:00 AM - 2:00 PM',
            'event_name' => 'Checkout Test Event',
            'event_type' => 'Wedding',
            'pax' => 100,
            'budget' => 50000,
            'package_id' => 'custom',
            'client_full_name' => 'Checkout Client',
            'client_email' => $client->email,
            'client_phone' => '09170000000',
            'venue_city' => 'Quezon City',
            'venue_address_line' => 'Checkout venue',
            'total_cost' => 50000,
            'selected_menu' => ['starter' => [['id' => 1, 'name' => 'Soup']]],
            'status' => 'Confirmed',
            'review_status' => 'Approved For Reservation',
        ]);
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
