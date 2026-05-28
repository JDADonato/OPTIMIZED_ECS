<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class ResourceVersion
{
    public static function fromQuery(Builder $query): array
    {
        $clone = clone $query;
        $count = (clone $clone)->count();
        $latestUpdatedAt = (clone $clone)->max('updated_at');
        $latestId = (clone $clone)->max('id');

        return self::make($count, $latestUpdatedAt, $latestId);
    }

    public static function fromCollection(Collection $items): array
    {
        $latestUpdatedAt = $items
            ->map(fn ($item) => data_get($item, 'updated_at'))
            ->filter()
            ->map(fn ($value) => $value instanceof Carbon ? $value : Carbon::parse($value))
            ->sortDesc()
            ->first();

        return self::make($items->count(), $latestUpdatedAt, $items->max('id'));
    }

    public static function make(int $count, mixed $latestUpdatedAt = null, mixed $latestId = null): array
    {
        $timestamp = $latestUpdatedAt
            ? ($latestUpdatedAt instanceof Carbon ? $latestUpdatedAt : Carbon::parse($latestUpdatedAt))->format('Uu')
            : 0;

        return [
            'resource_version' => sha1("{$count}|{$timestamp}|{$latestId}"),
            'updated_at' => $latestUpdatedAt ? Carbon::parse($latestUpdatedAt)->toIso8601String() : null,
            'count' => $count,
            'latest_id' => $latestId,
            'generated_at' => now()->toIso8601String(),
        ];
    }

    public static function matches(Request $request, array $meta): bool
    {
        return $request->query('since_version') && hash_equals((string) $meta['resource_version'], (string) $request->query('since_version'));
    }

    public static function unchanged(array $meta): JsonResponse
    {
        return response()->json([
            'data' => null,
            'meta' => [
                ...$meta,
                'changed' => false,
            ],
        ]);
    }

    public static function changed(mixed $data, array $meta, array $extra = []): JsonResponse
    {
        return response()->json([
            'data' => $data,
            'meta' => [
                ...$meta,
                'changed' => true,
            ],
            ...$extra,
        ]);
    }
}
