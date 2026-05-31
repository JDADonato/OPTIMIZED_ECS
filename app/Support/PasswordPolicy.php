<?php

namespace App\Support;

class PasswordPolicy
{
    public const CURRENT_VERSION = 2;

    public const MIN_LENGTH = 10;

    public const REQUIRED_CHARACTER_TYPES = 3;

    public static function failures(string $password, array $context = []): array
    {
        $failures = [];

        if (strlen($password) < self::MIN_LENGTH) {
            $failures[] = 'Use at least '.self::MIN_LENGTH.' characters.';
        }

        if (self::characterTypeCount($password) < self::REQUIRED_CHARACTER_TYPES) {
            $failures[] = 'Use at least three of these: lowercase letters, uppercase letters, numbers, or symbols.';
        }

        if (self::containsPersonalInfo($password, $context)) {
            $failures[] = 'Do not include your username or email name in the password.';
        }

        return $failures;
    }

    public static function passes(string $password, array $context = []): bool
    {
        return self::failures($password, $context) === [];
    }

    public static function isCurrent(?int $version): bool
    {
        return (int) ($version ?? 1) >= self::CURRENT_VERSION;
    }

    private static function characterTypeCount(string $password): int
    {
        $types = 0;
        $types += preg_match('/[a-z]/', $password) ? 1 : 0;
        $types += preg_match('/[A-Z]/', $password) ? 1 : 0;
        $types += preg_match('/[0-9]/', $password) ? 1 : 0;
        $types += preg_match('/[^A-Za-z0-9]/', $password) ? 1 : 0;

        return $types;
    }

    private static function containsPersonalInfo(string $password, array $context): bool
    {
        $password = strtolower($password);
        $needles = [];

        foreach (['username', 'email'] as $key) {
            $value = strtolower(trim((string) ($context[$key] ?? '')));
            if ($key === 'email' && str_contains($value, '@')) {
                $value = explode('@', $value, 2)[0];
            }

            $value = preg_replace('/[^a-z0-9._-]/', '', $value);
            if (strlen($value) >= 3) {
                $needles[] = $value;
            }
        }

        foreach (array_unique($needles) as $needle) {
            if ($needle !== '' && str_contains($password, $needle)) {
                return true;
            }
        }

        return false;
    }
}
