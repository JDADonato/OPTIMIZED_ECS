<?php

namespace App\Support;

use Illuminate\Support\Arr;

class SensitiveDataRedactor
{
    private const SENSITIVE_KEYS = [
        'authorization',
        'auth',
        'cookie',
        'csrf',
        'csrf_token',
        '_token',
        'password',
        'password_confirmation',
        'current_password',
        'new_password',
        'otp',
        'otp_code',
        'token',
        'secret',
        'secret_key',
        'api_key',
        'paymongo_secret_key',
        'paymongo_payment_id',
        'paymongo_payment_intent_id',
        'paymongo_checkout_session_id',
        'provider_payment_id',
        'provider_reference',
        'card',
    ];

    public static function redact(mixed $value): mixed
    {
        if (is_array($value)) {
            return collect($value)
                ->mapWithKeys(fn ($item, $key) => [
                    $key => self::isSensitiveKey((string) $key)
                        ? '[redacted]'
                        : self::redact($item),
                ])
                ->all();
        }

        if (is_string($value)) {
            return self::redactString($value);
        }

        return $value;
    }

    public static function onlySafe(array $payload, array $keys): array
    {
        return self::redact(Arr::only($payload, $keys));
    }

    private static function isSensitiveKey(string $key): bool
    {
        $normalized = strtolower(str_replace(['-', ' '], '_', $key));

        return collect(self::SENSITIVE_KEYS)
            ->contains(fn (string $sensitive) => str_contains($normalized, $sensitive));
    }

    private static function redactString(string $value): string
    {
        $patterns = [
            '/Bearer\s+[A-Za-z0-9._~+\/=-]+/i',
            '/Basic\s+[A-Za-z0-9._~+\/=-]+/i',
            '/sk_(test|live)_[A-Za-z0-9]+/i',
            '/pk_(test|live)_[A-Za-z0-9]+/i',
            '/pay_[A-Za-z0-9]+/i',
            '/pi_[A-Za-z0-9]+/i',
            '/cs_[A-Za-z0-9]+/i',
        ];

        return preg_replace($patterns, '[redacted]', $value) ?? '[redacted]';
    }
}
