<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class RecordPerformanceTiming
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!filter_var(env('PERFORMANCE_TIMING_ENABLED', false), FILTER_VALIDATE_BOOLEAN)) {
            return $next($request);
        }

        $startedAt = microtime(true);
        $startMemory = memory_get_usage(true);
        $queryCount = 0;
        $queryTime = 0.0;

        DB::listen(function ($query) use (&$queryCount, &$queryTime) {
            $queryCount++;
            $queryTime += (float) $query->time;
        });

        $response = $next($request);

        $durationMs = round((microtime(true) - $startedAt) * 1000, 2);
        $memoryMb = round((memory_get_peak_usage(true) - $startMemory) / 1024 / 1024, 2);
        $responseSizeKb = $this->responseSizeKb($response);
        $thresholdMs = (float) env('PERFORMANCE_TIMING_THRESHOLD_MS', 750);

        if ($durationMs >= $thresholdMs || $request->is('api/*')) {
            Log::info('performance.timing', [
                'method' => $request->method(),
                'path' => $request->path(),
                'route' => optional($request->route())->getName(),
                'role' => optional($request->user())->role,
                'status' => $response->getStatusCode(),
                'duration_ms' => $durationMs,
                'query_count' => $queryCount,
                'query_time_ms' => round($queryTime, 2),
                'memory_delta_mb' => $memoryMb,
                'response_kb' => $responseSizeKb,
            ]);
        }

        return $response;
    }

    private function responseSizeKb(Response $response): ?float
    {
        if (!$response->headers->has('Content-Length') && !method_exists($response, 'getContent')) {
            return null;
        }

        $bytes = $response->headers->get('Content-Length');

        if (!$bytes && method_exists($response, 'getContent')) {
            $content = $response->getContent();
            $bytes = is_string($content) ? strlen($content) : null;
        }

        return $bytes ? round(((int) $bytes) / 1024, 2) : null;
    }
}
