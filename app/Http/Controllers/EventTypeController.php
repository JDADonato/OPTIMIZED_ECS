<?php

namespace App\Http\Controllers;

use App\Models\EventType;
use Illuminate\Http\Request;

class EventTypeController extends Controller
{
    /**
     * Get all event types
     */
    public function index(Request $request)
    {
        $types = EventType::query()
            ->whereRaw('is_active is true')
            ->orderBy('label')
            ->paginate($request->get('per_page', 50));

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
