<?php

namespace App\Http\Controllers;

use App\Models\EventType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class EventTypeController extends Controller
{
    /**
     * Get all event types
     */
    public function index(Request $request)
    {
        $perPage = min(max((int) $request->get('per_page', 50), 1), 100);
        $page = max((int) $request->get('page', 1), 1);
        $version = (int) Cache::get('catalog.version', 1);
        $types = Cache::remember("catalog.public.event_types.v{$version}.page:{$page}.per:{$perPage}", now()->addMinutes(10), fn () => (
            EventType::query()
                ->whereRaw('is_active is true')
                ->orderBy('label')
                ->paginate($perPage)
                ->toArray()
        ));

        return response()->json($types);
    }

    /**
     * Get a single event type
     */
    public function show($id)
    {
        $type = EventType::whereRaw('is_active is true')->findOrFail($id);

        return response()->json($type);
    }

    /**
     * Get event type by slug
     */
    public function bySlug($slug)
    {
        $type = EventType::where('slug', $slug)->whereRaw('is_active is true')->firstOrFail();

        return response()->json($type);
    }
}
