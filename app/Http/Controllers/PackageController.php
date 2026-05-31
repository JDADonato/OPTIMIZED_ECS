<?php

namespace App\Http\Controllers;

use App\Models\EventType;
use App\Models\Package;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class PackageController extends Controller
{
    /**
     * Get all packages
     */
    public function index(Request $request)
    {
        $perPage = min(max((int) $request->get('per_page', 50), 1), 100);
        $page = max((int) $request->get('page', 1), 1);
        $version = (int) Cache::get('catalog.version', 1);
        $packages = Cache::remember("catalog.public.packages.v{$version}.page:{$page}.per:{$perPage}", now()->addMinutes(10), function () use ($perPage) {
            $activeSlugs = EventType::whereRaw('is_active is true')->pluck('slug')->all();

            return Package::whereRaw('is_active is true')
                ->whereIn('type', $activeSlugs)
                ->orderBy('type')
                ->orderBy('name')
                ->paginate($perPage)
                ->toArray();
        });

        return response()->json($packages);
    }

    /**
     * Get a single package
     */
    public function show($id)
    {
        $package = Package::findOrFail($id);

        return response()->json($package);
    }

    /**
     * Get packages by type
     */
    public function byType($type)
    {
        $version = (int) Cache::get('catalog.version', 1);
        $cacheKey = 'catalog.public.packages.type.'.md5((string) $type).".v{$version}";
        $packages = Cache::remember($cacheKey, now()->addMinutes(10), function () use ($type) {
            if (! EventType::where('slug', $type)->whereRaw('is_active is true')->exists()) {
                return null;
            }

            return Package::whereRaw('is_active is true')
                ->where(function ($query) use ($type) {
                    $query->where('type', $type)
                        ->orWhereJsonContains('event_type_slugs', $type);
                })
                ->orderBy('name')
                ->get();
        });

        abort_unless($packages !== null, 404);

        return response()->json($packages);
    }
}
