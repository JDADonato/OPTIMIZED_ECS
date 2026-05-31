<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification as NotificationFacade;

class NotificationRecipientService
{
    public function reachableUsersForRoles(array $roles): Collection
    {
        return User::query()
            ->reachableForNotifications()
            ->whereIn('role', $roles)
            ->get();
    }

    public function sendToRoles(array $roles, Notification $notification, string $context = 'notification'): int
    {
        return $this->sendToUsers($this->reachableUsersForRoles($roles), $notification, $context);
    }

    public function sendToUsers(iterable $users, Notification $notification, string $context = 'notification'): int
    {
        $recipients = collect($users)
            ->filter(fn ($user) => $user instanceof User && $user->isReachableForNotifications())
            ->values();

        if ($recipients->isEmpty()) {
            return 0;
        }

        try {
            NotificationFacade::send($recipients, $notification);

            return $recipients->count();
        } catch (\Throwable $e) {
            Log::warning('Operational notification delivery failed.', [
                'context' => $context,
                'recipient_count' => $recipients->count(),
                'message' => $e->getMessage(),
            ]);

            return 0;
        }
    }

    public function sendToUser(?User $user, Notification $notification, string $context = 'notification'): bool
    {
        if (! $user || ! $user->isReachableForNotifications()) {
            return false;
        }

        try {
            $user->notify($notification);

            return true;
        } catch (\Throwable $e) {
            Log::warning('Operational notification delivery failed.', [
                'context' => $context,
                'user_id' => $user->id,
                'message' => $e->getMessage(),
            ]);

            return false;
        }
    }
}
