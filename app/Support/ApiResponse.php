<?php

namespace App\Support;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;

class ApiResponse
{
    public static function ok(mixed $data = null, ?string $message = null, array $meta = []): JsonResponse
    {
        return response()->json(array_filter([
            'data' => $data,
            'message' => $message,
            'meta' => $meta ?: null,
        ], fn ($value) => $value !== null));
    }

    public static function paginated(LengthAwarePaginator $paginator, mixed $data = null, array $extraMeta = []): JsonResponse
    {
        return response()->json([
            'data' => $data ?? $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
                ...$extraMeta,
            ],
            'links' => [
                'first' => $paginator->url(1),
                'last' => $paginator->url($paginator->lastPage()),
                'prev' => $paginator->previousPageUrl(),
                'next' => $paginator->nextPageUrl(),
            ],
        ]);
    }

    public static function message(string $message, int $status = 200, array $extra = []): JsonResponse
    {
        return response()->json(['message' => $message, ...$extra], $status);
    }
}
