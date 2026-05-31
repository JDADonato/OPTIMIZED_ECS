<?php

namespace App\Http\Controllers;

use App\Support\SensitiveDataRedactor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ClientErrorController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message' => ['nullable', 'string', 'max:1000'],
            'stack' => ['nullable', 'string', 'max:8000'],
            'componentStack' => ['nullable', 'string', 'max:8000'],
            'url' => ['nullable', 'string', 'max:2000'],
            'userAgent' => ['nullable', 'string', 'max:1000'],
            'context' => ['nullable', 'array'],
            'context.*' => ['nullable'],
        ]);

        $context = SensitiveDataRedactor::redact($validated['context'] ?? []);

        Log::warning('Client runtime error reported.', [
            'request_id' => $request->attributes->get('request_id'),
            'user_id' => $request->user()?->id,
            'role' => $request->user()?->role,
            'message' => SensitiveDataRedactor::redact($validated['message'] ?? 'Unknown client error'),
            'stack' => SensitiveDataRedactor::redact($validated['stack'] ?? null),
            'component_stack' => SensitiveDataRedactor::redact($validated['componentStack'] ?? null),
            'url' => SensitiveDataRedactor::redact($validated['url'] ?? null),
            'user_agent' => $validated['userAgent'] ?? null,
            'context' => $context,
        ]);

        return response()->json(['ok' => true], 202);
    }
}
