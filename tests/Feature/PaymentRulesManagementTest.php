<?php

namespace Tests\Feature;

use App\Models\BusinessRule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentRulesManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_view_and_update_payment_rules(): void
    {
        $admin = $this->user('Admin');

        BusinessRule::create([
            'minimum_lead_days' => 7,
            'maximum_capacity_per_day' => 3,
            'maximum_pax_per_event' => 1000,
            'minimum_pax_per_event' => 20,
            'is_active' => true,
            'reservation_fee_percentage' => 10,
            'downpayment_percentage' => 70,
            'final_payment_percentage' => 20,
            'reservation_validity_hours' => 24,
            'downpayment_due_days' => 30,
            'final_payment_due_days' => 14,
        ]);

        $this->actingAs($admin)
            ->getJson('/api/admin/payment-rules')
            ->assertOk()
            ->assertJsonPath('reservation_fee_percentage', '10.00');

        $this->actingAs($admin)
            ->putJson('/api/admin/payment-rules', [
                'reservation_fee_percentage' => 15,
                'downpayment_percentage' => 65,
                'final_payment_percentage' => 20,
                'reservation_validity_hours' => 48,
                'downpayment_due_days' => 45,
                'final_payment_due_days' => 10,
            ])
            ->assertOk()
            ->assertJsonPath('rules.reservation_fee_percentage', '15.00')
            ->assertJsonPath('rules.reservation_validity_hours', 48);

        $this->assertDatabaseHas('business_rules', [
            'reservation_validity_hours' => 48,
            'downpayment_due_days' => 45,
            'final_payment_due_days' => 10,
        ]);
    }

    public function test_payment_rule_percentages_must_total_one_hundred(): void
    {
        $admin = $this->user('Admin');

        BusinessRule::create([
            'minimum_lead_days' => 7,
            'maximum_capacity_per_day' => 3,
            'maximum_pax_per_event' => 1000,
            'minimum_pax_per_event' => 20,
            'is_active' => true,
        ]);

        $this->actingAs($admin)
            ->putJson('/api/admin/payment-rules', [
                'reservation_fee_percentage' => 10,
                'downpayment_percentage' => 60,
                'final_payment_percentage' => 20,
                'reservation_validity_hours' => 24,
                'downpayment_due_days' => 30,
                'final_payment_due_days' => 14,
            ])
            ->assertUnprocessable()
            ->assertJsonPath('error', 'Payment tranche percentages must total 100%.');
    }

    public function test_marketing_cannot_manage_admin_payment_rules(): void
    {
        $marketing = $this->user('Marketing');

        $this->actingAs($marketing)
            ->getJson('/api/admin/payment-rules')
            ->assertForbidden();
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
}
