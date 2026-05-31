<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BusinessRule;
use App\Models\EventType;
use App\Models\MenuItem;
use App\Models\Package;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkflowCleanupTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_people_filters_search_staff_and_customers(): void
    {
        $admin = $this->user('Admin');
        $marketing = $this->user('Marketing', [
            'full_name' => 'Mika Marketing',
            'email' => 'mika@example.test',
            'must_change_password' => true,
        ]);
        $accounting = $this->user('Accounting', ['full_name' => 'Arman Accounting']);
        $customer = $this->user('Client', ['full_name' => 'Carla Client', 'email' => 'carla@example.test']);

        $this->actingAs($admin)
            ->getJson('/api/admin/employees?paginated=1&role=Marketing&must_change_password=1&search=mika')
            ->assertOk()
            ->assertJsonFragment(['id' => $marketing->id])
            ->assertJsonMissing(['id' => $accounting->id]);

        $this->actingAs($admin)
            ->getJson('/api/admin/customers?paginated=1&search=carla')
            ->assertOk()
            ->assertJsonFragment(['id' => $customer->id])
            ->assertJsonMissing(['id' => $marketing->id]);
    }

    public function test_accounting_active_booking_queue_hides_completed_by_default(): void
    {
        $accounting = $this->user('Accounting');
        $client = $this->user('Client');
        $active = $this->booking($client, ['status' => 'Confirmed']);
        $completed = $this->booking($client, ['status' => 'Completed']);

        Payment::create(['booking_id' => $active->id, 'amount' => 1000, 'payment_method' => 'Pending', 'status' => 'Pending', 'payment_type' => 'Reservation']);
        Payment::create(['booking_id' => $completed->id, 'amount' => 1000, 'payment_method' => 'Pending', 'status' => 'Pending', 'payment_type' => 'Reservation']);

        $payload = $this->actingAs($accounting)
            ->getJson('/api/accounting/bookings')
            ->assertOk()
            ->json('data');

        $this->assertContains($active->id, collect($payload)->pluck('id')->all());
        $this->assertNotContains($completed->id, collect($payload)->pluck('id')->all());

        $this->actingAs($accounting)
            ->getJson('/api/accounting/bookings?include_completed=1')
            ->assertOk()
            ->assertJsonFragment(['id' => $completed->id]);
    }

    public function test_customer_pax_update_recalculates_menu_total_and_unpaid_balance(): void
    {
        $client = $this->user('Client');
        BusinessRule::create([
            'minimum_lead_days' => 7,
            'maximum_capacity_per_day' => 7,
            'maximum_pax_per_event' => 1000,
            'minimum_pax_per_event' => 1,
            'is_active' => true,
        ]);
        $dish = MenuItem::create([
            'dish_id' => 'menu-test-main',
            'name' => 'Braised Beef',
            'category' => 'main',
            'cost_per_head' => 100,
            'price_adj' => 20,
            'is_active' => true,
        ]);
        $booking = $this->booking($client, [
            'pax' => 10,
            'total_cost' => 1200,
            'selected_menu' => ['main' => [['id' => $dish->id, 'name' => $dish->name]]],
        ]);
        $paid = Payment::create(['booking_id' => $booking->id, 'amount' => 500, 'payment_method' => 'Cash', 'status' => 'Verified', 'payment_type' => 'Reservation']);
        $pending = Payment::create(['booking_id' => $booking->id, 'amount' => 700, 'payment_method' => 'Pending', 'status' => 'Pending', 'payment_type' => 'Final']);

        $this->actingAs($client)
            ->putJson("/api/bookings/{$booking->id}/update", [
                'event_date' => $booking->event_date->toDateString(),
                'pax' => 20,
            ])
            ->assertOk()
            ->assertJsonPath('pricing_change.old_pax', 10)
            ->assertJsonPath('pricing_change.new_pax', 20)
            ->assertJsonPath('pricing_change.new_total', 2400)
            ->assertJsonPath('pricing_change.remaining_balance', 1900);

        $this->assertSame('2400.00', (string) $booking->fresh()->total_cost);
        $this->assertSame('500.00', (string) $paid->fresh()->amount);
        $this->assertSame('1900.00', (string) $pending->fresh()->amount);
    }

    public function test_booking_resources_report_unchanged_when_version_matches(): void
    {
        $admin = $this->user('Admin');
        $client = $this->user('Client');
        $booking = $this->booking($client, ['status' => 'Confirmed']);
        Payment::create(['booking_id' => $booking->id, 'amount' => 1000, 'payment_method' => 'Pending', 'status' => 'Pending', 'payment_type' => 'Reservation']);

        $initial = $this->actingAs($admin)
            ->getJson('/api/admin/bookings?paginated=1')
            ->assertOk()
            ->assertJsonPath('meta.changed', true);

        $version = $initial->json('meta.resource_version');
        $this->assertNotEmpty($version);

        $this->actingAs($admin)
            ->getJson('/api/admin/bookings?paginated=1&since_version='.$version)
            ->assertOk()
            ->assertJsonPath('meta.changed', false)
            ->assertJsonPath('data', null);
    }

    public function test_client_dashboard_resource_version_includes_payment_changes(): void
    {
        BusinessRule::create([
            'minimum_lead_days' => 7,
            'maximum_capacity_per_day' => 7,
            'maximum_pax_per_event' => 1000,
            'minimum_pax_per_event' => 1,
            'is_active' => true,
            'reservation_fee_percentage' => 10,
            'downpayment_percentage' => 70,
            'final_payment_percentage' => 20,
        ]);
        $client = $this->user('Client');
        $booking = $this->booking($client, ['status' => 'Confirmed']);
        $payment = Payment::create(['booking_id' => $booking->id, 'amount' => 1000, 'payment_method' => 'Pending', 'status' => 'Pending', 'payment_type' => 'Reservation']);

        $initial = $this->actingAs($client)
            ->getJson('/api/dashboard/client')
            ->assertOk()
            ->assertJsonPath('meta.changed', true);

        $version = $initial->json('meta.resource_version');

        $this->actingAs($client)
            ->getJson('/api/dashboard/client?since_version='.$version)
            ->assertOk()
            ->assertJsonPath('meta.changed', false);

        $payment->forceFill(['status' => 'Verified', 'updated_at' => now()->addSecond()])->save();

        $this->actingAs($client)
            ->getJson('/api/dashboard/client?since_version='.$version)
            ->assertOk()
            ->assertJsonPath('meta.changed', true)
            ->assertJsonPath('payments.0.status', 'Verified');
    }

    public function test_archiving_menu_item_hides_from_public_catalog_but_preserves_admin_record(): void
    {
        $admin = $this->user('Admin');
        $item = MenuItem::create([
            'dish_id' => 'archive-me-main',
            'name' => 'Archive Me Main',
            'category' => 'main',
            'cost_per_head' => 200,
            'price_adj' => 25,
            'is_active' => true,
        ]);

        $this->actingAs($admin)
            ->deleteJson("/api/admin/menu-items/{$item->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Menu item archived successfully');

        $this->assertDatabaseHas('menu_items', ['id' => $item->id]);
        $this->assertFalse((bool) $item->fresh()->is_active);

        $this->actingAs($this->user('Client'))
            ->getJson('/api/menu-items')
            ->assertOk()
            ->assertJsonMissing(['id' => $item->id]);

        $this->actingAs($admin)
            ->getJson('/api/admin/menu-items')
            ->assertOk()
            ->assertJsonFragment(['id' => $item->id]);

        $second = MenuItem::create([
            'dish_id' => 'archive-alias-main',
            'name' => 'Archive Alias Main',
            'category' => 'main',
            'cost_per_head' => 180,
            'price_adj' => 0,
            'is_active' => true,
        ]);

        $this->actingAs($admin)
            ->patchJson("/api/admin/menu-items/{$second->id}/archive")
            ->assertOk()
            ->assertJsonPath('message', 'Menu item archived successfully');
        $this->assertFalse((bool) $second->fresh()->is_active);
    }

    public function test_archiving_event_type_hides_public_choices_without_rewriting_history(): void
    {
        $admin = $this->user('Admin');
        $type = EventType::create([
            'slug' => 'archive-gala',
            'label' => 'Archive Gala',
            'icon' => 'sparkles',
            'description' => 'Private event type',
            'is_active' => true,
        ]);
        $package = Package::create([
            'name' => 'Archive Gala Package',
            'type' => $type->slug,
            'event_type_slugs' => [$type->slug],
            'base_price_per_head' => 1500,
            'minimum_pax' => 30,
            'is_active' => true,
        ]);
        $booking = $this->booking($this->user('Client'), ['event_type' => $type->label]);

        $this->actingAs($admin)
            ->deleteJson("/api/admin/event-types/{$type->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Event type archived successfully.');

        $this->assertDatabaseHas('event_types', ['id' => $type->id, 'slug' => 'archive-gala']);
        $this->assertFalse((bool) $type->fresh()->is_active);
        $this->assertSame('archive-gala', $package->fresh()->type);
        $this->assertSame('Archive Gala', $booking->fresh()->event_type);

        $this->getJson('/api/event-types?per_page=100')
            ->assertOk()
            ->assertJsonMissing(['slug' => 'archive-gala']);

        $this->actingAs($admin)
            ->getJson('/api/admin/event-types')
            ->assertOk()
            ->assertJsonFragment(['slug' => 'archive-gala']);

        $second = EventType::create([
            'slug' => 'archive-alias-gala',
            'label' => 'Archive Alias Gala',
            'icon' => 'sparkles',
            'description' => 'Alias event type',
            'is_active' => true,
        ]);

        $this->actingAs($admin)
            ->patchJson("/api/admin/event-types/{$second->id}/archive")
            ->assertOk()
            ->assertJsonPath('message', 'Event type archived successfully.');
        $this->assertFalse((bool) $second->fresh()->is_active);
    }

    private function user(string $role, array $overrides = []): User
    {
        return User::create(array_merge([
            'full_name' => "{$role} Tester",
            'username' => strtolower($role).'_'.uniqid(),
            'email' => uniqid(strtolower($role).'_').'@example.test',
            'password' => 'password',
            'phone' => '09170000000',
            'role' => $role,
            'email_verified_at' => now(),
            'account_status' => 'active',
        ], $overrides));
    }

    private function booking(User $client, array $overrides = []): Booking
    {
        return Booking::create(array_merge([
            'user_id' => $client->id,
            'event_date' => now()->addMonth()->toDateString(),
            'event_time' => '18:00',
            'pax' => 80,
            'event_name' => 'Family Celebration',
            'event_type' => 'Birthday',
            'client_full_name' => $client->full_name,
            'status' => 'Confirmed',
            'total_cost' => 1000,
        ], $overrides));
    }
}
