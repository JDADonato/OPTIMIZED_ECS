<?php

namespace App\Services;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification as NotificationFacade;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class EmailDeliveryService
{
    public function sendToNotifiable(object $notifiable, Notification $notification, string $context = 'email', bool $allowInactiveRecipient = false): array
    {
        if (empty($notifiable->email)) {
            return $this->result('skipped_no_email', 'No email address was set, so no email was sent.');
        }

        if (! $allowInactiveRecipient && method_exists($notifiable, 'isReachableForNotifications') && ! $notifiable->isReachableForNotifications()) {
            return $this->result('skipped_unreachable_account', 'The account is not reachable for operational email.');
        }

        if (str_ends_with((string) $notifiable->email, '@eloquente.invalid')) {
            return $this->result('skipped_no_email', 'No reachable email address was set, so no email was sent.');
        }

        if ($this->mailIsNotConfigured()) {
            return $this->result('mail_not_configured', 'Mail is not configured. Copy the password or message manually.');
        }

        try {
            $notifiable->notify($notification);

            return $this->successResult($notification);
        } catch (\Throwable $e) {
            if (Str::contains($e->getMessage(), ['cafile', 'certificate', 'STARTTLS'])) {
                Log::warning('Email delivery certificate configuration failed.', [
                    'context' => $context,
                    'notifiable_id' => $notifiable->id ?? null,
                    'notifiable_type' => get_debug_type($notifiable),
                    'message' => $e->getMessage(),
                    'openssl_cafile' => ini_get('openssl.cafile') ?: null,
                    'mail_ca_bundle' => Config::get('mail.mailers.smtp.stream.ssl.cafile'),
                ]);

                return $this->result('failed', 'Email could not be delivered because the mail certificate path is invalid. Restart the local server, then try again.');
            }

            Log::warning('Email delivery failed.', [
                'context' => $context,
                'notifiable_id' => $notifiable->id ?? null,
                'notifiable_type' => get_debug_type($notifiable),
                'message' => $e->getMessage(),
            ]);

            return $this->result('failed', 'Email could not be delivered. Copy and share the information manually.');
        }
    }

    public function sendToAddress(?string $email, Notification $notification, string $context = 'email', bool $shouldSend = true): array
    {
        if (! $shouldSend) {
            return $this->result('skipped_by_admin', 'Email notification was skipped by admin.');
        }

        if (! $email || str_ends_with($email, '@eloquente.invalid')) {
            return $this->result('skipped_no_email', 'No reachable email address was set, so no email was sent.');
        }

        if ($this->mailIsNotConfigured()) {
            return $this->result('mail_not_configured', 'Mail is not configured. Account action still succeeded.');
        }

        try {
            NotificationFacade::route('mail', $email)->notify($notification);

            return $this->successResult($notification);
        } catch (\Throwable $e) {
            if (Str::contains($e->getMessage(), ['cafile', 'certificate', 'STARTTLS'])) {
                Log::warning('Routed email certificate configuration failed.', [
                    'context' => $context,
                    'email' => $email,
                    'message' => $e->getMessage(),
                    'openssl_cafile' => ini_get('openssl.cafile') ?: null,
                    'mail_ca_bundle' => Config::get('mail.mailers.smtp.stream.ssl.cafile'),
                ]);

                return $this->result('failed', 'Email could not be delivered because the mail certificate path is invalid. Restart the local server, then try again.');
            }

            Log::warning('Routed email delivery failed.', [
                'context' => $context,
                'email' => $email,
                'message' => $e->getMessage(),
            ]);

            return $this->result('failed', 'Email could not be delivered. Account action still succeeded.');
        }
    }

    public function sendDiagnostic(string $email): array
    {
        if ($this->mailIsNotConfigured()) {
            return $this->result('mail_not_configured', 'Mail is not configured. Set a real mailer and sender before sending test email.');
        }

        try {
            Mail::raw('This is a test email from Eloquente system delivery diagnostics.', function ($message) use ($email) {
                $message->to($email)->subject('Eloquente mail diagnostics test');
            });

            return $this->result('sent', 'Diagnostic email was sent immediately.');
        } catch (\Throwable $e) {
            if (Str::contains($e->getMessage(), ['cafile', 'certificate', 'STARTTLS'])) {
                Log::warning('Diagnostic email certificate configuration failed.', [
                    'email' => $email,
                    'message' => $e->getMessage(),
                    'openssl_cafile' => ini_get('openssl.cafile') ?: null,
                    'mail_ca_bundle' => Config::get('mail.mailers.smtp.stream.ssl.cafile'),
                ]);

                return $this->result('failed', 'Diagnostic email could not be delivered because the mail certificate path is invalid. Restart the local server, then try again.');
            }

            Log::warning('Diagnostic email failed.', [
                'email' => $email,
                'message' => $e->getMessage(),
            ]);

            return $this->result('failed', 'Diagnostic email could not be delivered. Check SMTP credentials and host access.');
        }
    }

    public function diagnostics(): array
    {
        $mailer = (string) Config::get('mail.default');
        $queue = (string) Config::get('queue.default');
        $host = (string) Config::get("mail.mailers.{$mailer}.host", '');
        $from = (string) Config::get('mail.from.address', '');
        $failedJobsCount = null;

        try {
            if (Schema::hasTable('failed_jobs')) {
                $failedJobsCount = DB::table('failed_jobs')->count();
            }
        } catch (\Throwable) {
            $failedJobsCount = null;
        }

        return [
            'session' => [
                'current_host' => request()->getHost(),
                'app_url' => Config::get('app.url'),
                'session_domain' => Config::get('session.domain'),
                'secure_cookie' => (bool) Config::get('session.secure'),
                'same_site' => Config::get('session.same_site'),
                'authenticated' => (bool) request()->user(),
            ],
            'mail' => [
                'mailer' => $mailer,
                'host' => $host ?: null,
                'port' => Config::get("mail.mailers.{$mailer}.port"),
                'from_address' => $from ?: null,
                'ca_bundle' => Config::get('mail.mailers.smtp.stream.ssl.cafile'),
                'ca_bundle_exists' => is_file((string) Config::get('mail.mailers.smtp.stream.ssl.cafile')),
                'openssl_cafile' => ini_get('openssl.cafile') ?: null,
                'openssl_cafile_exists' => ini_get('openssl.cafile') ? is_file((string) ini_get('openssl.cafile')) : null,
                'configured' => ! $this->mailIsNotConfigured(),
                'is_log_mailer' => $mailer === 'log',
                'is_array_mailer' => $mailer === 'array',
            ],
            'queue' => [
                'connection' => $queue,
                'worker_required' => ! in_array($queue, ['sync', 'deferred', 'background'], true),
                'failed_jobs_count' => $failedJobsCount,
            ],
            'operations' => [
                'scheduler' => [
                    'configured' => str_contains((string) @file_get_contents(base_path('bootstrap/app.php')), 'announcements:publish-due'),
                    'status' => 'Requires deployment verification',
                    'description' => 'Laravel scheduler must run in production for scheduled announcements and recurring maintenance.',
                ],
                'queue_worker' => [
                    'configured' => ! in_array($queue, ['sync', 'deferred', 'background'], true),
                    'status' => ! in_array($queue, ['sync', 'deferred', 'background'], true) ? 'Requires deployment verification' : 'Synchronous in this environment',
                    'description' => 'Queue workers must run when background mail, notifications, or jobs are enabled.',
                ],
                'reverb' => [
                    'configured' => (bool) Config::get('broadcasting.connections.reverb.app_id'),
                    'status' => 'Requires deployment verification',
                    'description' => 'Reverb must be reachable for realtime chat and staff updates in production.',
                ],
                'paymongo_webhook' => [
                    'configured' => filled((string) Config::get('services.paymongo.webhook_secret')),
                    'status' => 'Requires deployment verification',
                    'description' => 'PayMongo webhooks must point to the deployed HTTPS webhook endpoint.',
                ],
                'production_flags' => [
                    'app_debug_disabled' => Config::get('app.debug') === false,
                    'https_app_url' => str_starts_with((string) Config::get('app.url'), 'https://'),
                    'secure_cookie' => (bool) Config::get('session.secure'),
                ],
            ],
            'guidance' => $this->guidance($mailer, $queue),
        ];
    }

    private function successResult(Notification $notification): array
    {
        $mailer = (string) Config::get('mail.default');

        if ($notification instanceof ShouldQueue && ! in_array((string) Config::get('queue.default'), ['sync', 'deferred', 'background'], true)) {
            return $this->result('queued', 'Email is waiting for the queue worker.');
        }

        if ($mailer === 'log') {
            return $this->result('sent', 'Email was written to the application log.');
        }

        if ($mailer === 'array') {
            return $this->result('sent', 'Email was captured by the test mailer.');
        }

        return $this->result('sent', 'Email was sent immediately.');
    }

    private function result(string $status, string $message): array
    {
        return [
            'status' => $status,
            'message' => $message,
        ];
    }

    private function mailIsNotConfigured(): bool
    {
        $mailer = (string) Config::get('mail.default');

        if (in_array($mailer, ['log', 'array'], true)) {
            return false;
        }

        $from = (string) Config::get('mail.from.address', '');

        if (! $from || Str::contains($from, ['example.com', 'your-domain.example'])) {
            return true;
        }

        if ($mailer === 'smtp') {
            $host = (string) Config::get('mail.mailers.smtp.host', '');

            return ! $host || in_array($host, ['127.0.0.1', 'localhost', 'smtp.your-mail-provider.example'], true);
        }

        return false;
    }

    private function guidance(string $mailer, string $queue): array
    {
        $items = [];

        if ($this->mailIsNotConfigured()) {
            $items[] = 'Set a real mail provider, from address, username, and password before expecting external delivery.';
        }

        $caBundle = (string) Config::get('mail.mailers.smtp.stream.ssl.cafile', '');
        if ($mailer === 'smtp' && (! $caBundle || ! is_file($caBundle))) {
            $items[] = 'Mail certificate bundle is missing or points to the wrong path.';
        }

        $opensslCafile = (string) ini_get('openssl.cafile');
        if ($mailer === 'smtp' && $opensslCafile && ! is_file($opensslCafile)) {
            $items[] = 'The running PHP process has an invalid openssl.cafile path. Restart the local server after fixing php.ini.';
        }

        if ($mailer === 'log') {
            $items[] = 'Local log mailer writes emails to storage logs instead of sending inbox mail.';
        }

        if (! in_array($queue, ['sync', 'deferred', 'background'], true)) {
            $items[] = 'Run php artisan queue:work so queued notifications leave the jobs table.';
        }

        return $items;
    }
}
