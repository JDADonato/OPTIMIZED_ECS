<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\User;
use Carbon\Carbon;
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
        $this->assertPdfResponse($response->getContent(), $response->headers->get('content-type'));
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
        $this->assertPdfResponse($response->getContent(), $response->headers->get('content-type'));
    }

    public function test_admin_can_download_calendar_pdf_and_large_ranges_are_blocked(): void
    {
        $admin = $this->user('Admin');
        $client = $this->user('Client');
        Booking::create([
            'user_id' => $client->id,
            'event_date' => now()->addWeeks(2)->toDateString(),
            'event_time' => '14:00',
            'event_name' => 'Long Address Launch Dinner With A Very Long Operational Name',
            'event_type' => 'Corporate',
            'client_full_name' => 'Client With A Long Company Name',
            'pax' => 180,
            'total_cost' => 250000,
            'status' => 'Confirmed',
        ]);

        $response = $this->actingAs($admin)->get('/documents/calendar.pdf?start='.now()->startOfMonth()->toDateString().'&end='.now()->addMonth()->endOfMonth()->toDateString());

        $response->assertOk();
        $this->assertPdfResponse($response->getContent(), $response->headers->get('content-type'));

        $this->actingAs($admin)
            ->get('/documents/calendar.pdf?start=2026-01-01&end=2027-12-31')
            ->assertStatus(422)
            ->assertJsonPath('error', 'Calendar PDF exports are limited to one year. Narrow the date range or use reports for larger exports.');
    }

    public function test_document_routes_are_authorized(): void
    {
        $client = $this->user('Client');
        $otherClient = $this->user('Client');
        $booking = Booking::create([
            'user_id' => $client->id,
            'event_date' => Carbon::parse('2026-07-15')->toDateString(),
            'event_time' => '10:00',
            'event_name' => 'Private Receipt Event',
            'event_type' => 'Birthday',
            'client_full_name' => 'Client Tester',
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

        $this->actingAs($otherClient)
            ->get("/documents/payments/{$payment->id}/receipt.pdf")
            ->assertForbidden();

        $this->actingAs($client)
            ->get("/documents/bookings/{$booking->id}/preparation.pdf")
            ->assertForbidden();
    }

    private function assertPdfResponse(string $content, ?string $contentType): void
    {
        $this->assertSame('application/pdf', $contentType);
        $this->assertStringStartsWith('%PDF', $content);
        $this->assertGreaterThan(1000, strlen($content));
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
            'account_status' => 'active',
        ]);
    }
}
