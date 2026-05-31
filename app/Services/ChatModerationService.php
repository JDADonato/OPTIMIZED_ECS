<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class ChatModerationService
{
    private const WARNING_THRESHOLD = 3;
    private const WINDOW_MINUTES = 30;

    private const BLOCKED_TERMS = [
        'fuck',
        'fucking',
        'motherfucker',
        'shit',
        'bullshit',
        'bitch',
        'asshole',
        'bastard',
        'cunt',
        'dickhead',
        'whore',
        'slut',
        'faggot',
        'fag',
        'nigger',
        'nigga',
        'chink',
        'gook',
        'spic',
        'kike',
        'retard',
        'tranny',
    ];

    public function inspect(?string $message): array
    {
        $text = trim((string) $message);
        if ($text === '' || $this->isTrustedStructuredPayload($text)) {
            return ['blocked' => false];
        }

        $normalized = $this->normalize($text);
        $tokens = $normalized === '' ? [] : explode(' ', $normalized);

        foreach (self::BLOCKED_TERMS as $term) {
            $termNormalized = $this->normalize($term);

            if ($termNormalized === '') {
                continue;
            }

            $exactTokenMatch = ! str_contains($termNormalized, ' ') && in_array($termNormalized, $tokens, true);
            $obfuscatedMatch = ! str_contains($termNormalized, ' ') && $this->hasSeparatedLetterMatch($normalized, $termNormalized);

            if ($exactTokenMatch || $obfuscatedMatch) {
                return [
                    'blocked' => true,
                    'category' => 'restricted_language',
                ];
            }
        }

        return ['blocked' => false];
    }

    public function blockedPayload($user, array $result): array
    {
        $attempts = $this->recordBlockedAttempt($user);
        $warning = $attempts >= self::WARNING_THRESHOLD
            ? 'Repeated blocked messages may lead to staff review or account action.'
            : null;

        if ($warning) {
            Log::notice('Repeated blocked chat message attempts.', [
                'user_id' => $user?->id,
                'role' => $user?->role,
                'attempts' => $attempts,
                'category' => $result['category'] ?? 'restricted_language',
            ]);
        }

        return [
            'error' => 'Message blocked because it contains inappropriate or abusive language. Please rewrite it respectfully.',
            'moderation' => [
                'blocked' => true,
                'category' => $result['category'] ?? 'restricted_language',
                'attempts' => $attempts,
                'warning' => $warning,
            ],
        ];
    }

    private function recordBlockedAttempt($user): int
    {
        $key = 'chat_moderation_blocks:user:'.($user?->id ?: 'guest');
        $attempts = (int) Cache::get($key, 0) + 1;
        Cache::put($key, $attempts, now()->addMinutes(self::WINDOW_MINUTES));

        return $attempts;
    }

    private function normalize(string $text): string
    {
        $text = mb_strtolower($text);
        $text = strtr($text, [
            '0' => 'o',
            '1' => 'i',
            '3' => 'e',
            '4' => 'a',
            '@' => 'a',
            '$' => 's',
            '5' => 's',
            '7' => 't',
            '!' => 'i',
        ]);
        $text = preg_replace('/[^a-z0-9]+/u', ' ', $text) ?? '';

        return trim(preg_replace('/\s+/u', ' ', $text) ?? '');
    }

    private function hasSeparatedLetterMatch(string $normalizedText, string $term): bool
    {
        if (strlen($term) < 4) {
            return false;
        }

        $letters = str_split($term);
        $pattern = '/(?:^|\s)'.implode('\s+', array_map(fn ($letter) => preg_quote($letter, '/'), $letters)).'(?:\s|$)/';

        return (bool) preg_match($pattern, $normalizedText);
    }

    private function isTrustedStructuredPayload(string $message): bool
    {
        $decoded = json_decode($message, true);

        return is_array($decoded) && ($decoded['type'] ?? null) === 'booking_details';
    }
}
