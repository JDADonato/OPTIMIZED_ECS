<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PayMongoWebhookSync extends Command
{
    protected $signature = 'paymongo:webhook-sync
                            {--ngrok-path= : Full path to ngrok.exe (defaults to env NGROK_PATH or common locations)}
                            {--port=8080 : Local Laravel server port}
                            {--skip-ngrok : Skip starting ngrok (use if already running)}
                            {--force-production : Allow this dev/staging helper to run in production}
                            {--no-disable-old : Do not disable old PayMongo webhooks pointing at /webhook/paymongo}';

    protected $description = 'Dev/staging helper: start ngrok, detect the public URL, and register/update the PayMongo webhook.';

    /**
     * PayMongo webhook events we need to subscribe to.
     */
    private const WEBHOOK_EVENTS = [
        'checkout_session.payment.paid',
        'payment.paid',
    ];

    /**
     * The webhook path on our Laravel app.
     */
    private const WEBHOOK_PATH = '/webhook/paymongo';

    public function handle(): int
    {
        if (app()->environment('production') && ! $this->option('force-production')) {
            $this->error('paymongo:webhook-sync is a dev/staging helper. Refusing to run in production without --force-production.');

            return self::FAILURE;
        }

        $this->info('🔄 PayMongo Webhook Sync');
        $this->newLine();

        // ── Step 1: Ensure ngrok is running ──
        $ngrokUrl = $this->ensureNgrokRunning();

        if (! $ngrokUrl) {
            $this->error('❌ Could not obtain ngrok public URL. Aborting.');

            return self::FAILURE;
        }

        $this->info("✅ Ngrok public URL: {$ngrokUrl}");

        $webhookUrl = rtrim($ngrokUrl, '/').self::WEBHOOK_PATH;
        $this->info("📍 Webhook endpoint: {$webhookUrl}");
        $this->newLine();

        // ── Step 2: Manage PayMongo webhooks ──
        $secretKey = config('services.paymongo.secret_key');
        $caBundle = $this->resolveCaBundle();

        if (! $secretKey) {
            $this->error('❌ PAYMONGO_SECRET_KEY is not set in .env. Cannot manage webhooks.');

            return self::FAILURE;
        }

        // List existing webhooks
        $this->info('📋 Fetching existing PayMongo webhooks...');
        $existingWebhooks = $this->listWebhooks($secretKey, $caBundle);

        if ($existingWebhooks === null) {
            $this->error('❌ Failed to fetch existing webhooks from PayMongo.');

            return self::FAILURE;
        }

        $this->info(sprintf('   Found %d existing webhook(s).', count($existingWebhooks)));

        // Strategy:
        // 1. Look for an existing webhook that matches the current ngrok URL
        // 2. If found and enabled → reuse it (no action needed, just sync the secret)
        // 3. If found and disabled → re-enable it
        // 4. If not found → disable all old /webhook/paymongo webhooks, then create a new one

        $matchingWebhook = null;
        $oldWebhooks = [];

        foreach ($existingWebhooks as $webhook) {
            $existingUrl = $webhook['attributes']['url'] ?? '';

            if ($existingUrl === $webhookUrl) {
                $matchingWebhook = $webhook;
            } elseif (str_contains($existingUrl, '/webhook/paymongo')) {
                $oldWebhooks[] = $webhook;
            }
        }

        if ($this->shouldDisableOldWebhooks()) {
            foreach ($oldWebhooks as $webhook) {
                $status = $webhook['attributes']['status'] ?? '';
                if ($status === 'enabled') {
                    $existingUrl = $webhook['attributes']['url'] ?? '';
                    $this->warn("   ⏸️  Disabling old webhook: {$existingUrl} (ID: {$webhook['id']})");
                    $this->disableWebhook($secretKey, $webhook['id'], $caBundle);
                }
            }
        } elseif (count($oldWebhooks) > 0) {
            $this->warn('Old PayMongo webhooks were left unchanged because --no-disable-old was set.');
        }

        $webhookId = null;
        $webhookSecret = null;

        if ($matchingWebhook) {
            // Webhook for this exact URL already exists
            $webhookId = $matchingWebhook['id'];
            $webhookSecret = $matchingWebhook['attributes']['secret_key'] ?? null;
            $status = $matchingWebhook['attributes']['status'] ?? '';

            if ($status === 'enabled') {
                $this->info("✅ Webhook already exists and is enabled: {$webhookId}");
            } else {
                $this->info("🔄 Re-enabling existing webhook: {$webhookId}");
                $reEnabled = $this->enableWebhook($secretKey, $webhookId, $caBundle);

                if (! $reEnabled) {
                    $this->error('❌ Failed to re-enable the existing webhook.');

                    return self::FAILURE;
                }

                // The enable response may include the secret
                if (isset($reEnabled['attributes']['secret_key'])) {
                    $webhookSecret = $reEnabled['attributes']['secret_key'];
                }

                $this->info("✅ Webhook re-enabled: {$webhookId}");
            }
        } else {
            // No matching webhook exists — create a new one
            $this->newLine();
            $this->info('🆕 Creating new PayMongo webhook...');
            $result = $this->createWebhook($secretKey, $webhookUrl, $caBundle);

            if (! $result) {
                $this->error('❌ Failed to create PayMongo webhook.');

                return self::FAILURE;
            }

            $webhookId = $result['id'];
            $webhookSecret = $result['attributes']['secret_key'] ?? null;
            $this->info("✅ Webhook created: {$webhookId}");
        }

        // ── Step 3: Update .env with the webhook secret ──
        if ($webhookSecret) {
            $currentSecret = config('services.paymongo.webhook_secret');

            if ($currentSecret !== $webhookSecret) {
                $this->info('🔑 Updating PAYMONGO_WEBHOOK_SECRET in .env...');
                $this->updateEnvValue('PAYMONGO_WEBHOOK_SECRET', $webhookSecret);
                $this->info('✅ .env updated with webhook secret.');

                // Clear config cache so Laravel picks up the new value
                $this->call('config:clear');
            } else {
                $this->info('🔑 PAYMONGO_WEBHOOK_SECRET is already up to date.');
            }
        } else {
            $this->warn('⚠️  No webhook secret available. You may need to set PAYMONGO_WEBHOOK_SECRET manually.');
        }

        $this->newLine();
        $this->info('════════════════════════════════════════════════');
        $this->info('  ✅ PayMongo webhook sync complete!');
        $this->info("  📍 Webhook URL: {$webhookUrl}");
        $this->info("  🔑 Webhook ID: {$webhookId}");
        $this->info('  📊 Ngrok inspector: http://127.0.0.1:4040');
        $this->info('════════════════════════════════════════════════');

        Log::info('PayMongo webhook synced.', [
            'webhook_id' => $webhookId,
            'webhook_url' => $webhookUrl,
        ]);

        return self::SUCCESS;
    }

    /**
     * Ensure ngrok is running and return the public HTTPS URL.
     */
    private function ensureNgrokRunning(): ?string
    {
        // First, check if ngrok is already running by querying its local API
        $existingUrl = $this->getNgrokPublicUrl();

        if ($existingUrl) {
            $this->info('📡 Ngrok is already running.');

            return $existingUrl;
        }

        if ($this->option('skip-ngrok')) {
            $this->error('Ngrok is not running and --skip-ngrok was specified.');

            return null;
        }

        // Find ngrok executable
        $ngrokPath = $this->resolveNgrokPath();

        if (! $ngrokPath) {
            $this->error('Could not find ngrok executable. Specify --ngrok-path or set NGROK_PATH in .env.');

            return null;
        }

        $port = $this->option('port');
        $this->info("🚀 Starting ngrok on port {$port}...");

        // Start ngrok in background
        $command = "\"{$ngrokPath}\" http {$port}";

        if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
            pclose(popen("start /B \"\" {$command} > NUL 2>&1", 'r'));
        } else {
            exec("{$command} > /dev/null 2>&1 &");
        }

        // Wait for ngrok to start (poll for up to 10 seconds)
        $this->info('⏳ Waiting for ngrok to initialize...');
        $url = null;
        for ($i = 0; $i < 20; $i++) {
            usleep(500000); // 0.5 seconds
            $url = $this->getNgrokPublicUrl();
            if ($url) {
                break;
            }
        }

        return $url;
    }

    /**
     * Query ngrok's local API to get the current public URL.
     */
    private function getNgrokPublicUrl(): ?string
    {
        try {
            $response = Http::timeout(3)
                ->withOptions(['verify' => false])
                ->get('http://127.0.0.1:4040/api/tunnels');

            if (! $response->successful()) {
                return null;
            }

            $tunnels = $response->json('tunnels', []);

            foreach ($tunnels as $tunnel) {
                $publicUrl = $tunnel['public_url'] ?? '';
                if (str_starts_with($publicUrl, 'https://')) {
                    return $publicUrl;
                }
            }

            // Fall back to any tunnel URL
            foreach ($tunnels as $tunnel) {
                $publicUrl = $tunnel['public_url'] ?? '';
                if ($publicUrl) {
                    return $publicUrl;
                }
            }
        } catch (\Throwable) {
            // Ngrok not running
        }

        return null;
    }

    /**
     * Old webhook cleanup is enabled by default for local/staging convenience.
     */
    public function shouldDisableOldWebhooks(): bool
    {
        return ! $this->option('no-disable-old');
    }

    /**
     * Find the ngrok executable.
     */
    private function resolveNgrokPath(): ?string
    {
        // 1. Explicit option
        $path = $this->option('ngrok-path');
        if ($path && is_file($path)) {
            return $path;
        }

        // 2. .env setting (normalize forward slashes to native separators)
        $envPath = config('services.ngrok.path');
        if ($envPath) {
            $envPath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $envPath);

            // Bypass is_file() because it returns false for WindowsApp execution aliases
            return $envPath;
        }

        // 3. Project-local executable
        $commonPaths = [
            base_path('ngrok.exe'),
        ];

        foreach ($commonPaths as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        // 4. Try PATH
        $which = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' ? 'where ngrok 2>NUL' : 'which ngrok 2>/dev/null';
        $result = trim((string) shell_exec($which));

        if ($result && is_file(explode("\n", $result)[0])) {
            return explode("\n", $result)[0];
        }

        return null;
    }

    /**
     * List all PayMongo webhooks.
     */
    private function listWebhooks(string $secretKey, string|bool $caBundle): ?array
    {
        try {
            $response = Http::baseUrl('https://api.paymongo.com')
                ->withBasicAuth($secretKey, '')
                ->acceptJson()
                ->withOptions(['verify' => $caBundle])
                ->timeout(15)
                ->get('/v1/webhooks');

            if (! $response->successful()) {
                $this->warn('   PayMongo API returned: '.$response->status());

                return null;
            }

            return $response->json('data', []);
        } catch (\Throwable $e) {
            $this->warn('   Error listing webhooks: '.$e->getMessage());

            return null;
        }
    }

    /**
     * Disable a PayMongo webhook by ID.
     */
    private function disableWebhook(string $secretKey, string $webhookId, string|bool $caBundle): bool
    {
        try {
            $response = Http::baseUrl('https://api.paymongo.com')
                ->withBasicAuth($secretKey, '')
                ->acceptJson()
                ->asJson()
                ->withOptions(['verify' => $caBundle])
                ->timeout(15)
                ->post("/v1/webhooks/{$webhookId}/disable");

            return $response->successful();
        } catch (\Throwable $e) {
            $this->warn("   Failed to disable webhook {$webhookId}: ".$e->getMessage());

            return false;
        }
    }

    /**
     * Enable a disabled PayMongo webhook by ID.
     */
    private function enableWebhook(string $secretKey, string $webhookId, string|bool $caBundle): ?array
    {
        try {
            $response = Http::baseUrl('https://api.paymongo.com')
                ->withBasicAuth($secretKey, '')
                ->acceptJson()
                ->asJson()
                ->withOptions(['verify' => $caBundle])
                ->timeout(15)
                ->post("/v1/webhooks/{$webhookId}/enable");

            if (! $response->successful()) {
                $this->warn('   PayMongo enable webhook returned: '.$response->status());

                return null;
            }

            return $response->json('data');
        } catch (\Throwable $e) {
            $this->warn("   Failed to enable webhook {$webhookId}: ".$e->getMessage());

            return null;
        }
    }

    /**
     * Create a new PayMongo webhook.
     */
    private function createWebhook(string $secretKey, string $url, string|bool $caBundle): ?array
    {
        try {
            $response = Http::baseUrl('https://api.paymongo.com')
                ->withBasicAuth($secretKey, '')
                ->acceptJson()
                ->asJson()
                ->withOptions(['verify' => $caBundle])
                ->timeout(15)
                ->post('/v1/webhooks', [
                    'data' => [
                        'attributes' => [
                            'url' => $url,
                            'events' => self::WEBHOOK_EVENTS,
                        ],
                    ],
                ]);

            if (! $response->successful()) {
                $errors = $response->json('errors', []);
                foreach ($errors as $error) {
                    $this->warn('   PayMongo error: '.($error['detail'] ?? $error['code'] ?? json_encode($error)));
                }

                return null;
            }

            return $response->json('data');
        } catch (\Throwable $e) {
            $this->warn('   Error creating webhook: '.$e->getMessage());

            return null;
        }
    }

    /**
     * Update a value in the .env file.
     */
    private function updateEnvValue(string $key, string $value): void
    {
        $envPath = base_path('.env');

        if (! file_exists($envPath)) {
            $this->warn('.env file not found.');

            return;
        }

        $envContent = file_get_contents($envPath);

        // Check if key already exists
        $pattern = '/^'.preg_quote($key, '/').'=.*/m';

        if (preg_match($pattern, $envContent)) {
            // Replace existing value
            $envContent = preg_replace($pattern, "{$key}={$value}", $envContent);
        } else {
            // Append new value
            $envContent .= "\n{$key}={$value}\n";
        }

        file_put_contents($envPath, $envContent);

        // Also set it in the current runtime so config:clear picks it up
        putenv("{$key}={$value}");
    }

    /**
     * Resolve the CA bundle path (mirrors PayMongoService logic).
     */
    private function resolveCaBundle(): string|bool
    {
        $path = config('services.paymongo.ca_bundle');

        if (! $path) {
            return true;
        }

        if (! preg_match('/^[A-Za-z]:[\\\\\/]/', $path) && ! str_starts_with($path, DIRECTORY_SEPARATOR)) {
            $path = base_path($path);
        }

        return is_file($path) ? $path : true;
    }
}
