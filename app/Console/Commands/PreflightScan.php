<?php

namespace App\Console\Commands;

use App\Http\Middleware\SecurityHeaders;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;

class PreflightScan extends Command
{
    protected $signature = 'preflight:scan {--json : Output machine-readable JSON} {--write : Store the scan artifact in storage/app/preflight} {--external : Include skills.sh @preflight --json when available}';

    protected $description = 'Run production readiness checks for environment, security, SEO, SSL, and deployment structure';

    public function handle(): int
    {
        $results = [
            'generated_at' => now()->toIso8601String(),
            'app' => config('app.name'),
            'environment' => app()->environment(),
            'summary' => ['pass' => 0, 'warning' => 0, 'fail' => 0],
            'checks' => [],
            'manual_launch_items' => [],
        ];

        $checks = array_merge(
            $this->environmentChecks(),
            $this->securityChecks(),
            $this->seoChecks(),
            $this->deploymentChecks(),
            $this->externalChecks()
        );

        foreach ($checks as $check) {
            $results['summary'][$check['status']]++;
            $results['checks'][] = $check;
        }

        $results['manual_launch_items'] = [
            'Set real production APP_KEY, APP_URL, database, Redis, mail, Reverb, and PayMongo credentials on the host.',
            'Point the web server document root to the Laravel public/ directory.',
            'Install and verify a valid SSL certificate before enabling strict HSTS.',
            'Run storage:link, migrations, queue workers, scheduler, and Reverb on production infrastructure.',
        ];

        if ($this->option('write')) {
            $this->writeArtifact($results);
        }

        if ($this->option('json')) {
            $this->line(json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        } else {
            $this->renderTable($results);
        }

        return $results['summary']['fail'] > 0 ? self::FAILURE : self::SUCCESS;
    }

    private function environmentChecks(): array
    {
        $example = $this->envExample();
        $required = [
            'APP_NAME', 'APP_ENV', 'APP_KEY', 'APP_DEBUG', 'APP_URL',
            'DB_CONNECTION', 'DB_HOST', 'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD', 'DB_SSLMODE',
            'SESSION_DRIVER', 'SESSION_SECURE_COOKIE', 'SESSION_HTTP_ONLY', 'SESSION_SAME_SITE',
            'CACHE_STORE', 'QUEUE_CONNECTION', 'REDIS_HOST',
            'MAIL_MAILER', 'MAIL_HOST', 'MAIL_FROM_ADDRESS',
            'REVERB_APP_ID', 'REVERB_APP_KEY', 'REVERB_APP_SECRET', 'REVERB_HOST',
            'VITE_REVERB_APP_KEY', 'VITE_REVERB_HOST', 'VITE_REVERB_PORT', 'VITE_REVERB_SCHEME',
            'PAYMONGO_BASE_URL', 'PAYMONGO_PUBLIC_KEY', 'PAYMONGO_SECRET_KEY', 'PAYMONGO_WEBHOOK_SECRET',
            'TRUSTED_PROXIES', 'SECURITY_HEADERS_ENABLED', 'SECURITY_CSP_ENABLED', 'SECURITY_CSP_ENFORCE', 'SECURITY_HSTS_ENABLED',
        ];

        $checks = [];
        foreach ($required as $key) {
            $checks[] = $this->check(
                (bool) preg_match('/^'.preg_quote($key, '/').'=/m', $example),
                'env.example.'.strtolower($key),
                ".env.example documents {$key}",
                'fail',
                'Add the key to .env.example without real secrets.'
            );
        }

        $checks[] = $this->check(config('app.debug') === false, 'env.app_debug', 'APP_DEBUG is false in the loaded environment', 'warning', 'Set APP_DEBUG=false before launch.');
        $checks[] = $this->check(str_starts_with((string) config('app.url'), 'https://'), 'env.app_url_https', 'APP_URL uses HTTPS', 'warning', 'Use a real HTTPS production domain.');
        $checks[] = $this->check(config('database.default') === 'pgsql', 'env.db_connection_pgsql', 'DB_CONNECTION is pgsql for production parity', 'warning', 'Set DB_CONNECTION=pgsql in production.');
        $checks[] = $this->check(config('session.secure') === true, 'env.secure_cookie', 'Secure session cookies are enabled', 'warning', 'Set SESSION_SECURE_COOKIE=true on production.');
        $checks[] = $this->check(! blank(config('services.paymongo.webhook_secret')), 'env.paymongo_webhook_secret', 'PayMongo webhook secret is configured', 'warning', 'Set PAYMONGO_WEBHOOK_SECRET on production.');

        return $checks;
    }

    private function securityChecks(): array
    {
        return [
            $this->check(class_exists(SecurityHeaders::class), 'security.middleware_exists', 'Security headers middleware exists'),
            $this->check((bool) config('security.headers.enabled'), 'security.headers_enabled', 'Security headers are enabled'),
            $this->check((bool) config('security.headers.csp_enabled'), 'security.csp_enabled', 'CSP header is enabled'),
            $this->check(app()->environment('production') ? (bool) config('security.headers.hsts_enabled') : true, 'security.hsts_configured', 'HSTS is configured for production HTTPS requests'),
            $this->check(str_contains(File::get(base_path('bootstrap/app.php')), 'SecurityHeaders::class'), 'security.middleware_registered', 'Security headers middleware is registered'),
        ];
    }

    private function seoChecks(): array
    {
        return [
            $this->check(File::exists(public_path('robots.txt')), 'seo.robots', 'robots.txt exists'),
            $this->check(Route::has('sitemap'), 'seo.sitemap_route', 'sitemap.xml route exists'),
            $this->check(str_contains(File::get(resource_path('views/app.blade.php')), '<title inertia>'), 'seo.inertia_title', 'Inertia page titles are supported'),
            $this->check(str_contains(File::get(resource_path('js/Pages/LandingPage.jsx')), '<Head'), 'seo.home_meta', 'Home page includes Inertia Head metadata', 'warning', 'Add title and description metadata to the home page.'),
            $this->check(! str_contains(File::get(resource_path('views/app.blade.php')), 'Laravel'), 'seo.no_laravel_placeholder', 'Base app shell does not show Laravel placeholder text', 'warning', 'Replace framework placeholders with Eloquente copy.'),
        ];
    }

    private function deploymentChecks(): array
    {
        return [
            $this->check(File::exists(public_path('index.php')), 'deploy.public_index', 'public/index.php exists for document root'),
            $this->check(File::exists(public_path('build/manifest.json')), 'deploy.vite_manifest', 'Vite build manifest exists', 'warning', 'Run npm.cmd run build before deployment.'),
            $this->check(is_writable(storage_path()), 'deploy.storage_writable', 'storage directory is writable', 'fail', 'Ensure the web user can write to storage/.'),
            $this->check(is_writable(base_path('bootstrap/cache')), 'deploy.bootstrap_cache_writable', 'bootstrap/cache directory is writable', 'fail', 'Ensure the web user can write to bootstrap/cache.'),
            $this->check(str_contains(File::get(base_path('bootstrap/app.php')), 'withSchedule'), 'deploy.scheduler_configured', 'Laravel scheduler is configured'),
            $this->check(str_contains(File::get(base_path('bootstrap/app.php')), 'announcements:publish-due'), 'deploy.announcement_scheduler', 'Due scheduled announcements are published by the scheduler', 'warning', 'Register announcements:publish-due in the Laravel scheduler.'),
            $this->check(str_contains(File::get(base_path('bootstrap/app.php')), 'uploads:purge-orphans'), 'deploy.upload_purge_scheduler', 'Temporary upload cleanup is scheduled', 'warning', 'Register uploads:purge-orphans in the Laravel scheduler.'),
            $this->check(config('queue.default') !== 'sync', 'deploy.queue_not_sync', 'Queue driver is production-capable', 'warning', 'Use redis or database queue workers in production.'),
            $this->check(class_exists(Pdf::class), 'deploy.pdf_renderer_installed', 'PDF renderer package is installed', 'fail', 'Install barryvdh/laravel-dompdf before deployment.'),
            $this->check(config('broadcasting.default') === 'reverb' || ! app()->environment('production'), 'deploy.reverb_expected', 'Reverb broadcasting is expected in production', 'warning', 'Run Reverb and set BROADCAST_CONNECTION=reverb in production.'),
        ];
    }

    private function externalChecks(): array
    {
        if (! $this->option('external')) {
            return [];
        }

        $skills = File::exists(base_path('skills.sh'))
            ? base_path('skills.sh')
            : (new ExecutableFinder)->find('skills.sh');

        if (! $skills) {
            return [$this->check(false, 'external.skills_sh', 'skills.sh preflight scanner is available', 'warning', 'Install skills.sh or run the native preflight scan only.')];
        }

        $process = new Process([$skills, '@preflight', '--json'], base_path());
        $process->setTimeout(120);
        $process->run();

        return [$this->check($process->isSuccessful(), 'external.skills_sh', 'skills.sh @preflight --json completed', 'warning', trim($process->getErrorOutput()) ?: 'External preflight returned a non-zero exit code.')];
    }

    private function check(bool $passes, string $id, string $label, string $failureStatus = 'fail', ?string $recommendation = null): array
    {
        return [
            'id' => $id,
            'label' => $label,
            'status' => $passes ? 'pass' : $failureStatus,
            'recommendation' => $passes ? null : $recommendation,
        ];
    }

    private function envExample(): string
    {
        return File::exists(base_path('.env.example')) ? File::get(base_path('.env.example')) : '';
    }

    private function writeArtifact(array $results): void
    {
        File::ensureDirectoryExists(storage_path('app/preflight'));

        File::put(
            storage_path('app/preflight/preflight-'.now()->format('Ymd-His').'.json'),
            json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
    }

    private function renderTable(array $results): void
    {
        $this->info("Preflight scan: {$results['summary']['pass']} passed, {$results['summary']['warning']} warnings, {$results['summary']['fail']} failed.");
        $this->table(['Status', 'Check', 'Recommendation'], array_map(
            fn ($check) => [$check['status'], $check['label'], $check['recommendation'] ?? ''],
            $results['checks']
        ));
    }
}
