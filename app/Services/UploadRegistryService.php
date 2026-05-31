<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\UploadedFile;
use App\Models\User;
use Illuminate\Http\UploadedFile as HttpUploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;

class UploadRegistryService
{
    public function register(HttpUploadedFile $file, ?User $user, string $purpose = 'theme_upload'): UploadedFile
    {
        $path = $file->store('uploads', 'public');

        return UploadedFile::create([
            'user_id' => $user?->id,
            'disk' => 'public',
            'path' => $path,
            'url' => '/storage/'.$path,
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
            'original_name' => $file->getClientOriginalName(),
            'purpose' => $purpose ?: 'theme_upload',
            'status' => 'temporary',
            'expires_at' => now()->addDay(),
        ]);
    }

    public function attachBookingThemeUploads(Booking $booking, mixed $uploads, ?User $actor): void
    {
        $records = $this->recordsForUrls($this->extractUrls($uploads));

        foreach ($records as $record) {
            if (! $this->canAttach($record, $actor)) {
                abort(403, 'This upload belongs to another account.');
            }

            $record->forceFill([
                'status' => 'attached',
                'attachable_type' => Booking::class,
                'attachable_id' => $booking->id,
                'attached_at' => now(),
                'expires_at' => null,
            ])->save();
        }
    }

    public function purgeOrphans(): int
    {
        $count = 0;

        UploadedFile::query()
            ->where('status', 'temporary')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->chunkById(100, function ($files) use (&$count) {
                foreach ($files as $file) {
                    Storage::disk($file->disk)->delete($file->path);
                    $file->forceFill(['status' => 'discarded'])->save();
                    $count++;
                }
            });

        return $count;
    }

    public function backfillBookingThemeUploads(bool $dryRun = false): array
    {
        $summary = [
            'scanned_bookings' => 0,
            'local_references' => 0,
            'created' => 0,
            'existing' => 0,
            'missing_files' => 0,
            'external_or_legacy' => 0,
        ];

        Booking::query()
            ->whereNotNull('theme_uploads')
            ->select(['id', 'user_id', 'theme_uploads'])
            ->orderBy('id')
            ->chunkById(100, function ($bookings) use (&$summary, $dryRun) {
                foreach ($bookings as $booking) {
                    $summary['scanned_bookings']++;
                    $urls = $this->extractUrls($booking->theme_uploads);

                    foreach ($urls as $url) {
                        $path = $this->publicStoragePathFromUrl($url);

                        if (! $path) {
                            $summary['external_or_legacy']++;

                            continue;
                        }

                        $summary['local_references']++;

                        $existing = UploadedFile::query()
                            ->where('disk', 'public')
                            ->where('path', $path)
                            ->first();

                        if ($existing) {
                            $summary['existing']++;
                            if (! $dryRun && $existing->status !== 'attached') {
                                $existing->forceFill([
                                    'status' => 'attached',
                                    'attachable_type' => Booking::class,
                                    'attachable_id' => $booking->id,
                                    'attached_at' => $existing->attached_at ?: now(),
                                    'expires_at' => null,
                                ])->save();
                            }

                            continue;
                        }

                        if (! Storage::disk('public')->exists($path)) {
                            $summary['missing_files']++;

                            continue;
                        }

                        $summary['created']++;

                        if ($dryRun) {
                            continue;
                        }

                        UploadedFile::create([
                            'user_id' => $booking->user_id,
                            'disk' => 'public',
                            'path' => $path,
                            'url' => $url,
                            'mime_type' => Storage::disk('public')->mimeType($path),
                            'size' => Storage::disk('public')->size($path),
                            'original_name' => basename($path),
                            'purpose' => 'theme_upload',
                            'status' => 'attached',
                            'attachable_type' => Booking::class,
                            'attachable_id' => $booking->id,
                            'attached_at' => now(),
                            'expires_at' => null,
                        ]);
                    }
                }
            });

        return $summary;
    }

    private function recordsForUrls(array $urls): Collection
    {
        if (empty($urls)) {
            return collect();
        }

        return UploadedFile::query()
            ->whereIn('url', array_values(array_unique($urls)))
            ->get();
    }

    private function extractUrls(mixed $uploads): array
    {
        if (is_string($uploads)) {
            $decoded = json_decode($uploads, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return $this->extractUrls($decoded);
            }

            return trim($uploads) !== '' ? [trim($uploads)] : [];
        }

        if (! is_array($uploads)) {
            return [];
        }

        $urls = [];
        array_walk_recursive($uploads, function ($value) use (&$urls) {
            if (is_string($value) && str_starts_with($value, '/storage/')) {
                $urls[] = $value;
            }
        });

        return $urls;
    }

    private function publicStoragePathFromUrl(string $url): ?string
    {
        $url = trim($url);
        $path = parse_url($url, PHP_URL_PATH) ?: $url;

        if (! str_starts_with($path, '/storage/uploads/')) {
            return null;
        }

        return ltrim(substr($path, strlen('/storage/')), '/');
    }

    private function canAttach(UploadedFile $file, ?User $actor): bool
    {
        if (! $actor || ! $file->user_id) {
            return true;
        }

        return (int) $file->user_id === (int) $actor->id
            || in_array($actor->role, ['Admin', 'Marketing', 'Operations'], true);
    }
}
