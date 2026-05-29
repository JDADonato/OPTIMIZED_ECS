<?php

namespace App\Models\Concerns;

use Illuminate\Contracts\Database\Query\Expression;

trait StoresPostgresBooleans
{
    protected function storeBooleanAttribute(string $key, mixed $value): void
    {
        if ($value instanceof Expression) {
            $this->attributes[$key] = $value;
            return;
        }

        $enabled = filter_var($value, FILTER_VALIDATE_BOOLEAN);

        $this->attributes[$key] = $this->usesPostgresConnection()
            ? ($enabled ? 'true' : 'false')
            : $enabled;
    }

    protected function readBooleanAttribute(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value === 1;
        }

        $normalized = strtolower(trim((string) $value));

        return in_array($normalized, ['1', 'true', 't', 'yes', 'y', 'on'], true);
    }

    private function usesPostgresConnection(): bool
    {
        $connection = $this->getConnectionName() ?: config('database.default');

        return config("database.connections.{$connection}.driver") === 'pgsql';
    }
}
