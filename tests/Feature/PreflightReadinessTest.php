<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class PreflightReadinessTest extends TestCase
{
    public function test_security_headers_are_sent_without_hsts_or_csp_noise_in_local_requests(): void
    {
        $response = $this->get('/');

        $response->assertOk();
        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $response->assertHeader('X-Frame-Options', 'SAMEORIGIN');
        $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        $this->assertFalse($response->headers->has('Content-Security-Policy-Report-Only'));
        $this->assertFalse($response->headers->has('Content-Security-Policy'));
        $this->assertFalse($response->headers->has('Strict-Transport-Security'));
    }

    public function test_local_csp_report_can_be_enabled_for_debugging(): void
    {
        config(['security.headers.csp_report_in_local' => true]);

        $response = $this->get('/');

        $response->assertOk();
        $response->assertHeader('Content-Security-Policy-Report-Only');
        $this->assertStringContainsString('http://[::1]:*', $response->headers->get('Content-Security-Policy-Report-Only'));
        $this->assertStringNotContainsString('upgrade-insecure-requests', $response->headers->get('Content-Security-Policy-Report-Only'));
    }

    public function test_hsts_and_enforced_csp_are_sent_for_secure_production_requests(): void
    {
        $this->app->detectEnvironment(fn () => 'production');
        config(['app.env' => 'production', 'security.headers.csp_enforce' => true]);

        $response = $this->call('GET', 'https://example.test/about', [], [], [], [
            'HTTPS' => 'on',
            'SERVER_PORT' => 443,
        ]);

        $response->assertOk();
        $response->assertHeader('Strict-Transport-Security');
        $response->assertHeader('Content-Security-Policy');
        $this->assertStringContainsString('upgrade-insecure-requests', $response->headers->get('Content-Security-Policy'));
        $this->assertStringNotContainsString('http://[::1]:*', $response->headers->get('Content-Security-Policy'));
        $this->assertFalse($response->headers->has('Content-Security-Policy-Report-Only'));
    }

    public function test_sitemap_and_robots_are_available(): void
    {
        $this->get('/robots.txt')
            ->assertOk()
            ->assertSee('User-agent: *');

        $this->get('/sitemap.xml')
            ->assertOk()
            ->assertHeader('Content-Type', 'application/xml')
            ->assertSee('<urlset', false)
            ->assertSee('/menu', false)
            ->assertSee('/food-tasting', false);
    }

    public function test_preflight_scan_outputs_json_without_critical_failures(): void
    {
        Artisan::call('preflight:scan', ['--json' => true]);

        $payload = json_decode(Artisan::output(), true);

        $this->assertIsArray($payload);
        $this->assertArrayHasKey('summary', $payload);
        $this->assertSame(0, $payload['summary']['fail']);
        $this->assertNotEmpty($payload['checks']);
        $this->assertContains('Set real production APP_KEY, APP_URL, database, Redis, mail, Reverb, and PayMongo credentials on the host.', $payload['manual_launch_items']);
    }

    public function test_preflight_scan_can_write_storage_artifact(): void
    {
        Artisan::call('preflight:scan', ['--json' => true, '--write' => true]);

        $files = glob(storage_path('app/preflight/preflight-*.json'));

        $this->assertNotEmpty($files);
    }

    public function test_paymongo_webhook_sync_refuses_production_without_force(): void
    {
        $this->app->detectEnvironment(fn () => 'production');
        config(['app.env' => 'production']);

        $this->artisan('paymongo:webhook-sync', ['--skip-ngrok' => true])
            ->expectsOutput('paymongo:webhook-sync is a dev/staging helper. Refusing to run in production without --force-production.')
            ->assertExitCode(1);
    }

    public function test_paymongo_webhook_sync_documents_safe_options_and_has_no_user_specific_ngrok_path(): void
    {
        $source = file_get_contents(app_path('Console/Commands/PayMongoWebhookSync.php'));

        $this->assertStringContainsString('{--force-production', $source);
        $this->assertStringContainsString('{--no-disable-old', $source);
        $this->assertStringContainsString('shouldDisableOldWebhooks', $source);
        $this->assertStringNotContainsString('Joshua Aquino', $source);
    }
}
