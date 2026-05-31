<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Booking;
use App\Models\BusinessRule;
use App\Models\Conversation;
use App\Models\Payment;
use App\Models\RefundCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\TestCase;

class DetailedAuditTrailTest extends TestCase
{
    use RefreshDatabase;

    public function test_account_audit_records_target_context_and_safe_changed_fields(): void
    {
        Notification::fake();

        $admin = $this->user('Admin');

        $this->actingAs($admin)
            ->postJson('/api/admin/employees', [
                'full_name' => 'Mika Staff',
                'username' => 'mika_staff',
                'email' => 'mika@example.test',
                'phone' => '09170000001',
                'role' => 'Marketing',
            ])
            ->assertCreated();

        $audit = AuditLog::where('action', 'Staff account created')->latest()->firstOrFail();

        $this->assertSame('Admin', $audit->metadata['workspace']);
        $this->assertSame('staff account', $audit->metadata['target_type']);
        $this->assertSame('Staff Account: Mika Staff', $audit->metadata['target_label']);
        $this->assertSame('Mika Staff', $audit->metadata['affected_user_label']);
        $this->assertContains('role', $audit->metadata['changed_fields']);
        $this->assertNotContains('password', $audit->metadata['changed_fields']);
        $this->assertStringNotContainsString('temporary_password', json_encode($audit->metadata));
    }

    public function test_operational_audits_record_targets_without_storing_message_bodies(): void
    {
        Notification::fake();
        $this->businessRule();

        $admin = $this->user('Admin');
        $marketing = $this->user('Marketing');
        $accounting = $this->user('Accounting');
        $customer = $this->user('Client', [
            'full_name' => 'Omar Account',
            'username' => 'omar',
            'email' => 'omar@example.test',
            'phone' => '09175550000',
        ]);
        $booking = $this->booking($customer, [
            'client_full_name' => 'Omar Booking Contact',
            'client_email' => 'booking-contact@example.test',
            'status' => 'Pending',
        ]);
        $payment = Payment::create([
            'booking_id' => $booking->id,
            'amount' => 12000,
            'payment_method' => 'Manual',
            'status' => 'Pending',
            'payment_type' => 'Reservation',
            'due_date' => now()->addDays(5)->toDateString(),
        ]);
        $refundCase = RefundCase::create([
            'booking_id' => $booking->id,
            'payment_id' => $payment->id,
            'amount' => 0,
            'non_refundable_amount' => 12000,
            'reason' => 'manual_review',
            'status' => 'Manual Review',
            'notes' => 'Needs staff review.',
        ]);
        $conversation = Conversation::create([
            'client_id' => $customer->id,
            'staff_id' => $marketing->id,
            'booking_id' => $booking->id,
            'status' => 'active',
        ]);

        $this->actingAs($admin)
            ->putJson("/api/admin/bookings/{$booking->id}/status", ['status' => 'Confirmed'])
            ->assertOk();

        $this->actingAs($accounting)
            ->putJson("/api/accounting/payments/{$payment->id}/verify", ['action' => 'Verify'])
            ->assertOk();

        $this->actingAs($accounting)
            ->postJson("/api/accounting/refund/{$booking->id}/mark_forfeited", [
                'refund_case_id' => $refundCase->id,
                'notes' => 'Approved forfeiture by policy.',
            ])
            ->assertOk();

        $this->actingAs($marketing)
            ->postJson("/api/chat/conversations/{$conversation->id}/messages", ['message' => 'Please confirm this private body text.'])
            ->assertCreated();

        $date = now()->addDays(30)->toDateString();
        $this->actingAs($marketing)
            ->putJson("/api/calendar-availability/{$date}", [
                'remaining_events' => 1,
                'remaining_pax' => 100,
                'note' => 'Reduced for staffing.',
            ])
            ->assertOk();

        $this->actingAs($admin)
            ->postJson('/api/admin/menu-items', [
                'name' => 'Audit Pasta',
                'category' => 'main',
                'cost_per_head' => 125,
                'price_adj' => 25,
            ])
            ->assertCreated();

        $bookingAudit = AuditLog::where('action', 'Updated a booking')->latest()->firstOrFail();
        $this->assertSame('#BK-'.$booking->id, $bookingAudit->metadata['booking_ref']);
        $this->assertSame('Omar Booking Contact', $bookingAudit->metadata['booking_contact_name']);
        $this->assertSame('Omar Account', $bookingAudit->metadata['customer_account_name']);
        $this->assertContains('status', $bookingAudit->metadata['changed_fields']);

        $paymentAudit = AuditLog::where('action', 'Updated payment record')->latest()->firstOrFail();
        $this->assertSame('payment', $paymentAudit->metadata['target_type']);
        $this->assertSame($payment->id, $paymentAudit->metadata['payment_id']);
        $this->assertSame('#BK-'.$booking->id, $paymentAudit->metadata['booking_ref']);

        $refundAudit = AuditLog::where('action', 'Updated refund case')->latest()->firstOrFail();
        $this->assertSame('refund', $refundAudit->metadata['target_type']);
        $this->assertSame('Refund for #BK-'.$booking->id, $refundAudit->metadata['target_label']);

        $chatAudit = AuditLog::where('action', 'Sent a chat message')->latest()->firstOrFail();
        $this->assertSame('conversation', $chatAudit->metadata['target_type']);
        $this->assertSame($conversation->id, $chatAudit->metadata['conversation_id']);
        $this->assertStringNotContainsString('private body text', json_encode($chatAudit->metadata));

        $calendarAudit = AuditLog::where('action', 'Updated date availability')->latest()->firstOrFail();
        $this->assertSame('date availability', $calendarAudit->metadata['target_type']);
        $this->assertSame("Date availability: {$date}", $calendarAudit->metadata['target_label']);

        $menuAudit = AuditLog::where('action', 'Created a menu item')->latest()->firstOrFail();
        $this->assertSame('menu item', $menuAudit->metadata['target_type']);
        $this->assertSame('Audit Pasta', $menuAudit->metadata['target_label']);
    }

    public function test_audit_endpoint_normalizes_legacy_metadata_for_the_admin_ui(): void
    {
        $admin = $this->user('Admin');
        $customer = $this->user('Client', ['full_name' => 'Legacy Customer']);

        $audit = AuditLog::create([
            'user_id' => $admin->id,
            'username' => $admin->username,
            'role' => $admin->role,
            'action' => 'Customer account updated',
            'method' => 'PUT',
            'path' => '/api/admin/customers/'.$customer->id,
            'status_code' => 200,
            'metadata' => [
                'target_user_id' => $customer->id,
                'changed_fields' => ['email', 'password'],
            ],
        ]);

        $row = collect($this->actingAs($admin)
            ->getJson('/api/admin/audits?per_page=10')
            ->assertOk()
            ->json('data'))
            ->firstWhere('id', $audit->id);

        $this->assertSame('Customer Account: Legacy Customer', $row['target_label']);
        $this->assertSame('customer account', $row['target_type']);
        $this->assertSame(['email'], $row['changed_fields']);
        $this->assertSame('Admin', $row['workspace']);
    }

    private function user(string $role, array $overrides = []): User
    {
        $base = strtolower($role).'_'.strtolower(Str::random(6));

        return User::create(array_merge([
            'full_name' => ucfirst(strtolower($role)).' User',
            'username' => $base,
            'email' => "{$base}@example.test",
            'phone' => '09170000000',
            'password' => Hash::make('password'),
            'role' => $role,
            'account_status' => 'active',
        ], $overrides));
    }

    private function booking(User $customer, array $overrides = []): Booking
    {
        return Booking::create(array_merge([
            'user_id' => $customer->id,
            'event_date' => now()->addDays(45)->toDateString(),
            'event_time' => '10:00 AM - 2:00 PM',
            'pax' => 80,
            'budget' => 80000,
            'event_type' => 'Birthday',
            'event_name' => 'Audit Event',
            'client_full_name' => $customer->full_name,
            'client_email' => $customer->email,
            'client_phone' => $customer->phone,
            'venue_city' => 'Quezon City',
            'venue_address_line' => 'Audit venue',
            'total_cost' => 80000,
            'status' => 'Pending',
            'review_status' => 'Submitted',
        ], $overrides));
    }

    private function businessRule(): void
    {
        BusinessRule::create([
            'minimum_lead_days' => 7,
            'maximum_capacity_per_day' => 5,
            'maximum_pax_per_event' => 1000,
            'minimum_pax_per_event' => 20,
            'is_active' => DB::raw('true'),
        ]);
    }
}
