<?php

namespace Tests\Feature;

use App\Mail\AnnouncementEmail;
use App\Models\Announcement;
use App\Models\ReportRun;
use App\Models\ReportTemplate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class ReportAndAnnouncementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_update_run_export_and_archive_report_template(): void
    {
        $admin = $this->user('Admin');

        $create = $this->actingAs($admin)
            ->postJson('/api/admin/report-templates', [
                'name' => 'Launch Readiness',
                'description' => 'High-risk launch report',
                'visibility' => 'admin',
                'layout_json' => [['id' => 'revenue_summary']],
                'filters_json' => ['range' => 'month'],
            ])
            ->assertCreated();

        $templateId = $create->json('id');

        $this->actingAs($admin)
            ->patchJson("/api/admin/report-templates/{$templateId}", [
                'name' => 'Launch Readiness Updated',
                'description' => 'Updated report',
                'visibility' => 'admin',
                'layout_json' => [['id' => 'revenue_summary']],
                'filters_json' => ['range' => 'week'],
            ])
            ->assertOk()
            ->assertJsonPath('name', 'Launch Readiness Updated');

        $run = $this->actingAs($admin)
            ->postJson("/api/admin/report-templates/{$templateId}/run", [
                'filters' => ['range' => 'week'],
            ])
            ->assertCreated();

        $runId = $run->json('id');
        $this->assertDatabaseHas('report_runs', [
            'id' => $runId,
            'report_template_id' => $templateId,
            'created_by' => $admin->id,
            'status' => 'completed',
        ]);

        $this->actingAs($admin)
            ->get("/api/admin/report-runs/{$runId}/export?format=csv")
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');

        $pdf = $this->actingAs($admin)
            ->get("/api/admin/report-runs/{$runId}/export?format=pdf")
            ->assertOk();
        $this->assertSame('application/pdf', $pdf->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF', $pdf->getContent());
        $this->assertGreaterThan(1000, strlen($pdf->getContent()));

        $this->actingAs($admin)
            ->deleteJson("/api/admin/report-templates/{$templateId}")
            ->assertOk()
            ->assertJsonPath('message', 'Report template archived.');

        $this->assertDatabaseHas('report_templates', ['id' => $templateId]);
        $this->assertNotNull(ReportTemplate::find($templateId)->archived_at);
        $this->assertTrue(ReportRun::whereKey($runId)->exists());

        $this->actingAs($admin)
            ->getJson('/api/admin/report-templates')
            ->assertOk()
            ->assertJsonMissing(['id' => $templateId]);

        $this->actingAs($admin)
            ->getJson('/api/admin/report-templates?include_archived=1')
            ->assertOk()
            ->assertJsonFragment(['id' => $templateId]);

        $this->actingAs($admin)
            ->postJson("/api/admin/report-templates/{$templateId}/run")
            ->assertStatus(422)
            ->assertJsonPath('error', 'Archived report templates cannot be run.');

        $alias = $this->actingAs($admin)
            ->postJson('/api/admin/report-templates', [
                'name' => 'Alias Archive',
                'description' => 'Alias archive report',
                'visibility' => 'admin',
                'layout_json' => [['id' => 'revenue_summary']],
                'filters_json' => [],
            ])
            ->assertCreated();

        $aliasId = $alias->json('id');

        $this->actingAs($admin)
            ->patchJson("/api/admin/report-templates/{$aliasId}/archive")
            ->assertOk()
            ->assertJsonPath('message', 'Report template archived.');
        $this->assertNotNull(ReportTemplate::find($aliasId)->archived_at);
    }

    public function test_announcement_draft_publish_archive_and_targeting_workflow(): void
    {
        $marketing = $this->user('Marketing');
        $client = $this->user('Client');

        $create = $this->actingAs($marketing)
            ->postJson('/api/admin/announcements', [
                'title' => 'Menu Refresh',
                'summary' => 'New seasonal options are available.',
                'body' => 'The catering team has published new menu options.',
                'type' => 'menu_update',
                'status' => 'draft',
                'visibility' => 'specific_users',
                'specific_user_ids' => [$client->id],
                'send_email' => false,
            ])
            ->assertCreated();

        $announcementId = $create->json('id');

        $this->actingAs($marketing)
            ->get("/preview/announcements/{$announcementId}")
            ->assertOk()
            ->assertSee('AnnouncementPreview', false)
            ->assertSee('Menu Refresh');

        $this->actingAs($marketing)
            ->postJson("/api/admin/announcements/{$announcementId}/publish")
            ->assertOk()
            ->assertJsonPath('status', 'published');

        $this->actingAs($client)
            ->getJson('/api/customer/announcements')
            ->assertOk()
            ->assertJsonFragment(['id' => $announcementId]);

        $otherClient = $this->user('Client');
        $this->actingAs($otherClient)
            ->getJson('/api/customer/announcements')
            ->assertOk()
            ->assertJsonMissing(['id' => $announcementId]);

        $this->actingAs($marketing)
            ->postJson("/api/admin/announcements/{$announcementId}/archive")
            ->assertOk()
            ->assertJsonPath('status', 'archived');
    }

    public function test_announcement_test_email_is_queued(): void
    {
        Mail::fake();

        $marketing = $this->user('Marketing');
        $announcement = Announcement::create([
            'title' => 'Service Notice',
            'slug' => 'service-notice',
            'summary' => 'A short notice.',
            'body' => 'A longer service notice.',
            'type' => 'service_notice',
            'status' => 'draft',
            'visibility' => 'all_customers',
            'send_email' => true,
            'created_by' => $marketing->id,
            'updated_by' => $marketing->id,
        ]);

        $this->actingAs($marketing)
            ->postJson("/api/admin/announcements/{$announcement->id}/send-test", [
                'email' => 'owner@example.test',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Test email queued.');

        Mail::assertQueued(AnnouncementEmail::class);
    }

    public function test_admin_lists_for_reports_and_announcements_support_pagination(): void
    {
        $admin = $this->user('Admin');

        ReportTemplate::create([
            'name' => 'Paginated Template',
            'visibility' => 'admin',
            'layout_json' => [['id' => 'revenue_summary']],
            'filters_json' => [],
            'created_by' => $admin->id,
        ]);

        Announcement::create([
            'title' => 'Paginated Announcement',
            'slug' => 'paginated-announcement',
            'summary' => 'Pagination check.',
            'body' => 'Pagination check body.',
            'type' => 'general',
            'status' => 'draft',
            'visibility' => 'all_customers',
            'created_by' => $admin->id,
            'updated_by' => $admin->id,
        ]);

        $this->actingAs($admin)
            ->getJson('/api/admin/report-templates?paginated=1&per_page=1')
            ->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['current_page', 'per_page', 'total', 'last_page']]);

        $this->actingAs($admin)
            ->getJson('/api/admin/announcements?paginated=1&per_page=1')
            ->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['current_page', 'per_page', 'total', 'last_page']]);
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
