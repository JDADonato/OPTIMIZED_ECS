<?php

namespace App\Http\Controllers;

use App\Services\UploadRegistryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Ported from: server/index.js file upload routes
 * Handles file uploads (payment proofs, theme images, etc.)
 */
class FileUploadController extends Controller
{
    public function store(Request $request, UploadRegistryService $uploads)
    {
        $request->validate([
            'image' => 'required|image|mimes:jpg,jpeg,png,webp|max:5120', // 5MB max
            'purpose' => 'nullable|string|max:80',
        ]);

        $record = $uploads->register(
            $request->file('image'),
            Auth::user(),
            $request->input('purpose', 'theme_upload')
        );

        return response()->json([
            'url' => $record->url,
            'upload_id' => $record->id,
        ]);
    }
}
