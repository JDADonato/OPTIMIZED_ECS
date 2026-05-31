<?php

use App\Http\Middleware\AttachRequestId;
use App\Http\Middleware\EnsurePasswordChanged;
use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\RecordPerformanceTiming;
use App\Http\Middleware\RecordStaffAuditLog;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\SetPostgresSessionContext;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Middleware\SetCacheHeaders;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Inertia\Inertia;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

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
            AttachRequestId::class,
            SecurityHeaders::class,
            SetPostgresSessionContext::class,
            RecordPerformanceTiming::class,
            RecordStaffAuditLog::class,
            EnsurePasswordChanged::class,
            HandleInertiaRequests::class,
        ]);

        $middleware->alias([
            'role' => EnsureRole::class,
            'cache.headers' => SetCacheHeaders::class,
        ]);

        // PayMongo signs webhook requests separately. Browser API calls keep
        // CSRF protection and receive tokens from the frontend fetch wrapper.
        $middleware->validateCsrfTokens(except: [
            'webhook/paymongo',
            'api/client-errors',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (ThrottleRequestsException $exception, Request $request) {
            $retryAfter = $exception->getHeaders()['Retry-After'] ?? null;
            $message = $retryAfter
                ? "Too many attempts. Try again in {$retryAfter} seconds."
                : 'Too many attempts. Please try again in a moment.';

            if ($request->expectsJson() || str_starts_with($request->path(), 'api/')) {
                return response()->json([
                    'error' => $message,
                    'retry_after' => $retryAfter ? (int) $retryAfter : null,
                    'request_id' => $request->attributes->get('request_id'),
                ], 429);
            }

            return Inertia::render('Error', [
                'status' => 429,
                'requestId' => $request->attributes->get('request_id'),
                'message' => $message,
            ])->toResponse($request)->setStatusCode(429);
        });

        $exceptions->render(function (HttpExceptionInterface $exception, Request $request) {
            $status = $exception->getStatusCode();

            if (! in_array($status, [403, 404, 419, 429, 500, 503], true)) {
                return null;
            }

            if ($request->expectsJson() || str_starts_with($request->path(), 'api/')) {
                return response()->json([
                    'error' => Response::$statusTexts[$status] ?? 'Request failed.',
                    'request_id' => $request->attributes->get('request_id'),
                ], $status);
            }

            return Inertia::render('Error', [
                'status' => $status,
                'requestId' => $request->attributes->get('request_id'),
                'message' => $exception->getMessage() ?: null,
            ])->toResponse($request)->setStatusCode($status);
        });
    })->create();
