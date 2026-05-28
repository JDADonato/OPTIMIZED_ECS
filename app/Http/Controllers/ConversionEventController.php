<?php

namespace App\Http\Controllers;

use App\Services\ConversionEventService;
use Illuminate\Http\Request;

class ConversionEventController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'event_name' => ['required', 'string', 'max:120'],
            'booking_id' => ['nullable', 'integer', 'exists:bookings,id'],
            'source' => ['nullable', 'string', 'max:80'],
            'step' => ['nullable', 'string', 'max:80'],
            'metadata' => ['nullable', 'array'],
        ]);

        ConversionEventService::record($data['event_name'], [
            'booking_id' => $data['booking_id'] ?? null,
            'source' => $data['source'] ?? 'frontend',
            'step' => $data['step'] ?? null,
            'metadata' => $data['metadata'] ?? [],
        ]);

        return response()->json(['message' => 'Conversion event recorded.'], 202);
    }
}
