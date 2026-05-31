<?php

namespace Tests\Feature;

use App\Models\ContactInquiry;
use App\Models\MenuItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ContactInquiryTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_contact_form_creates_staff_visible_inquiry(): void
    {
        $response = $this->postJson('/api/contact-inquiries', [
            'full_name' => 'Maria Client',
            'email' => 'maria@example.test',
            'phone' => '09170000000',
            'event_date' => now()->addMonth()->toDateString(),
            'pax' => 120,
            'event_type' => 'Wedding',
            'concern_type' => 'availability',
            'subject' => 'Wedding package inquiry',
            'message' => 'We want to ask about packages and availability.',
        ]);

        $response->assertCreated()
            ->assertJsonPath('message', 'Your inquiry has been sent to our planning team.');

        $this->assertDatabaseHas('contact_inquiries', [
            'email' => 'maria@example.test',
            'concern_type' => 'availability',
            'status' => 'New',
            'source' => 'public_contact',
        ]);
    }

    public function test_marketing_can_list_public_contact_inquiries(): void
    {
        ContactInquiry::create([
            'full_name' => 'Lead Client',
            'email' => 'lead@example.test',
            'subject' => 'Event inquiry',
            'message' => 'Please contact me.',
        ]);

        $marketing = User::create([
            'full_name' => 'Marketing Tester',
            'username' => 'marketing_'.uniqid(),
            'email' => uniqid('marketing_').'@example.test',
            'password' => 'password',
            'phone' => '09170000000',
            'role' => 'Marketing',
        ]);

        $this->actingAs($marketing)
            ->getJson('/api/marketing/contact-inquiries')
            ->assertOk()
            ->assertJsonPath('data.0.email', 'lead@example.test')
            ->assertJsonPath('meta.total', 1);
    }

    public function test_contact_inquiry_validation_rejects_invalid_payload(): void
    {
        $this->postJson('/api/contact-inquiries', [
            'full_name' => '',
            'email' => 'not-an-email',
            'subject' => '',
            'message' => '',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['full_name', 'email', 'subject', 'message']);
    }

    public function test_marketing_can_filter_and_update_public_contact_inquiries(): void
    {
        $marketing = User::create([
            'full_name' => 'Marketing Tester',
            'username' => 'marketing_'.uniqid(),
            'email' => uniqid('marketing_').'@example.test',
            'password' => 'password',
            'phone' => '09170000000',
            'role' => 'Marketing',
        ]);

        $lead = ContactInquiry::create([
            'full_name' => 'Filtered Lead',
            'email' => 'filtered@example.test',
            'concern_type' => 'tasting',
            'event_date' => now()->addDays(10)->toDateString(),
            'subject' => 'Tasting question',
            'message' => 'Can we schedule tasting?',
        ]);

        $this->actingAs($marketing)
            ->getJson('/api/marketing/contact-inquiries?concern_type=tasting&search=Filtered')
            ->assertOk()
            ->assertJsonPath('data.0.email', 'filtered@example.test');

        $this->actingAs($marketing)
            ->patchJson("/api/marketing/contact-inquiries/{$lead->id}", [
                'status' => 'Resolved',
                'assigned_to' => $marketing->id,
                'staff_notes' => 'Called client and resolved.',
            ])
            ->assertOk()
            ->assertJsonPath('inquiry.status', 'Resolved')
            ->assertJsonPath('inquiry.assigned_to', $marketing->id);

        $this->assertNotNull($lead->fresh()->resolved_at);
    }

    public function test_public_menu_endpoint_excludes_inactive_items_by_default(): void
    {
        MenuItem::create([
            'dish_id' => 'active_dish',
            'name' => 'Active Dish',
            'category' => 'main',
            'cost_per_head' => 100,
            'price_adj' => 0,
            'is_best_seller' => false,
            'is_active' => true,
        ]);

        MenuItem::create([
            'dish_id' => 'inactive_dish',
            'name' => 'Inactive Dish',
            'category' => 'main',
            'cost_per_head' => 100,
            'price_adj' => 0,
            'is_best_seller' => false,
            'is_active' => false,
        ]);

        $this->getJson('/api/menu')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Active Dish'])
            ->assertJsonMissing(['name' => 'Inactive Dish']);
    }
}
