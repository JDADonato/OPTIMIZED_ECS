<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoleAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_client_cannot_access_staff_dashboards_or_apis(): void
    {
        $client = $this->user('Client');

        $this->actingAs($client)->get('/dashboard/marketing')->assertForbidden();
        $this->actingAs($client)->get('/dashboard/accounting')->assertForbidden();
        $this->actingAs($client)->get('/dashboard/admin')->assertForbidden();
        $this->actingAs($client)->getJson('/api/marketing/bookings')->assertForbidden();
        $this->actingAs($client)->getJson('/api/accounting/ledger')->assertForbidden();
        $this->actingAs($client)->getJson('/api/admin/employees')->assertForbidden();
    }

    public function test_marketing_cannot_access_accounting_or_admin_only_resources(): void
    {
        $marketing = $this->user('Marketing');

        $this->actingAs($marketing)->get('/dashboard/marketing')->assertOk();
        $this->actingAs($marketing)->getJson('/api/accounting/ledger')->assertForbidden();
        $this->actingAs($marketing)->getJson('/api/admin/employees')->assertForbidden();
        $this->actingAs($marketing)->getJson('/api/admin/customers')->assertForbidden();
        $this->actingAs($marketing)->getJson('/api/admin/report-templates')->assertForbidden();
    }

    public function test_accounting_cannot_access_marketing_or_admin_only_resources(): void
    {
        $accounting = $this->user('Accounting');

        $this->actingAs($accounting)->get('/dashboard/accounting')->assertOk();
        $this->actingAs($accounting)->getJson('/api/marketing/bookings')->assertForbidden();
        $this->actingAs($accounting)->getJson('/api/admin/employees')->assertForbidden();
        $this->actingAs($accounting)->getJson('/api/admin/report-templates')->assertForbidden();
    }

    public function test_admin_can_access_staff_modules(): void
    {
        $admin = $this->user('Admin');

        $this->actingAs($admin)->get('/dashboard/admin')->assertOk();
        $this->actingAs($admin)->get('/dashboard/marketing')->assertOk();
        $this->actingAs($admin)->get('/dashboard/accounting')->assertOk();
        $this->actingAs($admin)->getJson('/api/admin/employees')->assertOk();
        $this->actingAs($admin)->getJson('/api/marketing/bookings')->assertOk();
        $this->actingAs($admin)->getJson('/api/accounting/ledger')->assertOk();
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
}
