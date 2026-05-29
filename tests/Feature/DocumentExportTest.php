<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DocumentExportTest extends TestCase
{
    use RefreshDatabase;

    public function test_client_can_download_branded_receipt_pdf_for_own_payment(): void
    {
        $client = $this->user('Client');
        $booking = Booking::create([
            'user_id' => $client->id,
            'event_date' => now()->addMonth()->toDateString(),
            'event_time' => '10:00',
            'event_name' => 'Family Celebration',
            'event_type' => 'Birthday',
            'client_full_name' => 'Client Tester',
            'client_email' => $client->email,
            'pax' => 80,
            'total_cost' => 100000,
            'status' => 'Confirmed',
        ]);
        $payment = Payment::create([
            'booking_id' => $booking->id,
            'amount' => 10000,
            'payment_method' => 'gcash_paymongo',
            'payment_type' => 'Reservation',
            'status' => 'Verified',
        ]);

        $response = $this->actingAs($client)->get("/documents/payments/{$payment->id}/receipt.pdf");

        $response->assertOk();
        $this->assertSame('application/pdf', $response->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF', $response->getContent());
        $this->assertStringContainsString('Official Receipt', $response->getContent());
    }

    public function test_marketing_can_download_preparation_pdf(): void
    {
        $marketing = $this->user('Marketing');
        $client = $this->user('Client');
        $booking = Booking::create([
            'user_id' => $client->id,
            'event_date' => now()->addMonth()->toDateString(),
            'event_time' => '10:00',
            'event_name' => 'Corporate Dinner',
            'event_type' => 'Corporate',
            'client_full_name' => 'Client Tester',
            'pax' => 120,
            'total_cost' => 200000,
            'status' => 'Confirmed',
        ]);

        $response = $this->actingAs($marketing)->get("/documents/bookings/{$booking->id}/preparation.pdf");

        $response->assertOk();
        $this->assertSame('application/pdf', $response->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF', $response->getContent());
        $this->assertStringContainsString('Event Preparation Checklist', $response->getContent());
    }

    private function user(string $role): User
    {
        return User::create([
            'full_name' => "{$role} Tester",
            'username' => strtolower($role) . '_' . uniqid(),
            'email' => uniqid(strtolower($role) . '_') . '@example.test',
            'password' => 'password',
            'phone' => '09170000000',
            'role' => $role,
            'email_verified_at' => now(),
            'account_status' => 'active',
        ]);
    }
}
