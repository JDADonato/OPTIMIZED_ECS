<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\ConversionEvent;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ConversionEventService
{
    private const BLOCKED_METADATA_KEYS = [
        'password',
        'temporary_password',
        'temporary_password_secret',
        'otp',
        'otp_code',
        'token',
        'reset_token',
        'csrf',
        'secret',
        'authorization',
        'cookie',
        'paymongo_payload',
    ];

    public static function record(string $eventName, array $context = []): void
    {
        try {
            if (! Schema::hasTable('conversion_events')) {
                return;
            }

            $user = $context['user'] ?? Auth::user();
            $booking = $context['booking'] ?? null;

            ConversionEvent::create([
                'event_name' => Str::of($eventName)->lower()->replace(' ', '_')->limit(120, '')->value(),
                'user_id' => $context['user_id'] ?? ($user instanceof User ? $user->id : null),
                'booking_id' => $context['booking_id'] ?? ($booking instanceof Booking ? $booking->id : null),
                'role' => $context['role'] ?? ($user instanceof User ? $user->role : null),
                'source' => $context['source'] ?? null,
                'step' => $context['step'] ?? null,
                'metadata' => self::sanitizeMetadata($context['metadata'] ?? []),
                'occurred_at' => now(),
            ]);
        } catch (\Throwable $exception) {
            Log::warning('Unable to record conversion event.', [
                'event_name' => $eventName,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    public static function summarize(?\DateTimeInterface $from = null, ?\DateTimeInterface $to = null): array
    {
        if (! Schema::hasTable('conversion_events')) {
            return self::emptySummary();
        }

        $query = ConversionEvent::query()
            ->when($from, fn ($q) => $q->where('occurred_at', '>=', $from))
            ->when($to, fn ($q) => $q->where('occurred_at', '<=', $to));

        $counts = (clone $query)
            ->selectRaw('event_name, COUNT(*) as aggregate')
            ->groupBy('event_name')
            ->pluck('aggregate', 'event_name')
            ->map(fn ($value) => (int) $value)
            ->all();

        $bookingStarts = ($counts['booking_started'] ?? 0) + ($counts['assisted_booking_started'] ?? 0);
        $bookingSubmissions = ($counts['booking_submitted'] ?? 0) + ($counts['assisted_booking_submitted'] ?? 0);
        $paymentStarts = $counts['payment_checkout_started'] ?? 0;
        $paymentConfirmed = ($counts['payment_confirmed'] ?? 0) + ($counts['payment_verified'] ?? 0);

        return [
            'booking_starts' => $bookingStarts,
            'booking_submissions' => $bookingSubmissions,
            'booking_completion_rate' => self::percent($bookingSubmissions, max($bookingStarts, 1)),
            'assisted_booking_submissions' => $counts['assisted_booking_submitted'] ?? 0,
            'clarification_responses' => $counts['clarification_responded'] ?? 0,
            'payment_checkout_starts' => $paymentStarts,
            'payment_confirmations' => $paymentConfirmed,
            'payment_completion_rate' => self::percent($paymentConfirmed, max($paymentStarts, 1)),
            'feedback_submissions' => $counts['feedback_submitted'] ?? 0,
            'testimonial_candidates' => $counts['testimonial_candidate_created'] ?? 0,
            'low_feedback_followups' => $counts['low_feedback_followup_created'] ?? 0,
            'raw_counts' => $counts,
        ];
    }

    private static function sanitizeMetadata(array $metadata): array
    {
        $safe = [];

        foreach ($metadata as $key => $value) {
            $normalizedKey = strtolower((string) $key);

            if (collect(self::BLOCKED_METADATA_KEYS)->contains(fn ($blocked) => str_contains($normalizedKey, $blocked))) {
                continue;
            }

            if (is_array($value)) {
                $safe[$key] = self::sanitizeMetadata($value);

                continue;
            }

            if (is_scalar($value) || $value === null) {
                $safe[$key] = is_string($value) ? Str::limit($value, 500, '') : $value;
            }
        }

        return $safe;
    }

    private static function percent(int|float $value, int|float $total): int
    {
        if ($total <= 0) {
            return 0;
        }

        return (int) round(($value / $total) * 100);
    }

    private static function emptySummary(): array
    {
        return [
            'booking_starts' => 0,
            'booking_submissions' => 0,
            'booking_completion_rate' => 0,
            'assisted_booking_submissions' => 0,
            'clarification_responses' => 0,
            'payment_checkout_starts' => 0,
            'payment_confirmations' => 0,
            'payment_completion_rate' => 0,
            'feedback_submissions' => 0,
            'testimonial_candidates' => 0,
            'low_feedback_followups' => 0,
            'raw_counts' => [],
        ];
    }
}
