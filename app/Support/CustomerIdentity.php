<?php

namespace App\Support;

use App\Models\Booking;
use App\Models\User;

class CustomerIdentity
{
    public static function forBooking(?Booking $booking): array
    {
        $account = self::accountForUser($booking?->user, $booking?->user_id);
        $contact = self::contactForBooking($booking, $account);

        return [
            'customer_account' => $account,
            'booking_contact' => $contact,
            'has_different_booking_contact' => self::differs($account, $contact),
        ];
    }

    public static function accountForUser(?User $user, ?int $fallbackId = null): array
    {
        $id = $user?->id ?? $fallbackId;
        $name = self::clean($user?->full_name) ?: self::clean($user?->username) ?: ($id ? "Customer #{$id}" : 'Customer account');

        return [
            'id' => $id,
            'name' => $name,
            'username' => self::clean($user?->username),
            'email' => self::clean($user?->email),
            'phone' => self::clean($user?->phone),
            'status' => self::clean($user?->account_status) ?: 'active',
        ];
    }

    public static function contactForBooking(?Booking $booking, ?array $account = null): array
    {
        $account ??= self::accountForUser($booking?->user, $booking?->user_id);

        return [
            'name' => self::clean($booking?->client_full_name) ?: $account['name'],
            'email' => self::clean($booking?->client_email) ?: $account['email'],
            'phone' => self::clean($booking?->client_phone) ?: $account['phone'],
        ];
    }

    public static function differs(?array $account, ?array $contact): bool
    {
        if (! $account || ! $contact) {
            return false;
        }

        return self::fieldDiffers($contact['name'] ?? null, $account['name'] ?? null)
            || self::fieldDiffers($contact['email'] ?? null, $account['email'] ?? null)
            || self::fieldDiffers($contact['phone'] ?? null, $account['phone'] ?? null);
    }

    private static function fieldDiffers(?string $left, ?string $right): bool
    {
        $left = self::normalize($left);
        $right = self::normalize($right);

        return $left !== '' && $right !== '' && $left !== $right;
    }

    private static function clean(?string $value): ?string
    {
        $value = trim((string) $value);

        return $value !== '' ? $value : null;
    }

    private static function normalize(?string $value): string
    {
        return mb_strtolower(preg_replace('/\s+/', ' ', trim((string) $value)));
    }
}
