<?php

namespace App\Support;

class PaymentLabels
{
    public static function method(?string $method): array
    {
        $raw = trim((string) $method);
        $normalized = strtolower($raw);

        $label = match (true) {
            $raw === '' || $normalized === 'pending' => 'Pending',
            str_contains($normalized, 'gcash') => str_contains($normalized, 'paymongo') ? 'GCash via PayMongo' : 'GCash',
            str_contains($normalized, 'paymaya') || str_contains($normalized, 'maya') => str_contains($normalized, 'paymongo') ? 'Maya via PayMongo' : 'Maya',
            str_contains($normalized, 'card') => str_contains($normalized, 'paymongo') ? 'Card via PayMongo' : 'Card',
            str_contains($normalized, 'bank') => 'Bank Transfer',
            str_contains($normalized, 'cash') => 'Cash',
            str_contains($normalized, 'paymongo') || str_contains($normalized, 'online checkout') => 'PayMongo Checkout',
            str_contains($normalized, 'manual') => 'Manual Payment',
            default => $raw,
        };

        return [
            'raw' => $raw,
            'label' => $label,
            'is_cash' => $label === 'Cash' || str_contains($normalized, 'cash'),
            'is_online' => str_contains($normalized, 'paymongo') || str_contains($normalized, 'online') || in_array($label, ['Card via PayMongo', 'GCash via PayMongo', 'Maya via PayMongo'], true),
        ];
    }
}
