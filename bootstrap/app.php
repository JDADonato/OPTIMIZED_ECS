<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Console\Scheduling\Schedule;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withSchedule(function (Schedule $schedule): void {
        $schedule->command('bookings:complete-past-submitted')->daily();
        $schedule->command('announcements:publish-due')->everyFiveMinutes();
        $schedule->command('uploads:purge-orphans')->daily();
    })
    ->withMiddleware(function (Middleware $middleware): void {
        if ($trustedProxies = env('TRUSTED_PROXIES')) {
            $middleware->trustProxies($trustedProxies === '*' ? '*' : array_map('trim', explode(',', $trustedProxies)));
        }

        $middleware->web(append: [
            \App\Http\Middleware\SecurityHeaders::class,
            \App\Http\Middleware\SetPostgresSessionContext::class,
            \App\Http\Middleware\RecordPerformanceTiming::class,
            \App\Http\Middleware\RecordStaffAuditLog::class,
            \App\Http\Middleware\EnsurePasswordChanged::class,
            \App\Http\Middleware\HandleInertiaRequests::class,
        ]);

        $middleware->alias([
            'role' => \App\Http\Middleware\EnsureRole::class,
            'cache.headers' => \Illuminate\Http\Middleware\SetCacheHeaders::class,
        ]);

        // PayMongo signs webhook requests separately. Browser API calls keep
        // CSRF protection and receive tokens from the frontend fetch wrapper.
        $middleware->validateCsrfTokens(except: [
            'webhook/paymongo',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
