<?php

namespace App\Services;

use App\Events\OperationalResourceChanged;
use App\Models\Booking;
use Illuminate\Support\Facades\Log;

class OperationalBroadcastService
{
    public function changed(
        string $resource,
        string $entityType,
        int|string|null $entityId,
        string $action,
        ?string $message = null,
        array $channels = []
    ): void {
        try {
            broadcast(new OperationalResourceChanged(
                resource: $resource,
                entityType: $entityType,
                entityId: $entityId,
                action: $action,
                message: $message,
                channels: $channels ?: ['staff.queue', 'marketing.dashboard', 'accounting.dashboard', 'admin.dashboard'],
            ))->toOthers();
        } catch (\Throwable $exception) {
            Log::warning('Operational realtime broadcast skipped.', [
                'resource' => $resource,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'action' => $action,
                'message' => $exception->getMessage(),
            ]);
        }
    }

    public function bookingChanged(Booking $booking, string $action, ?string $message = null): void
    {
        $channels = ['staff.queue', 'marketing.dashboard', 'accounting.dashboard', 'admin.dashboard'];

        if ($booking->user_id) {
            $channels[] = 'client.'.$booking->user_id;
        }

        $this->changed('bookings', 'booking', $booking->id, $action, $message, $channels);
    }

    public function financeChanged(?Booking $booking, string $entityType, int|string|null $entityId, string $action, ?string $message = null): void
    {
        $channels = ['accounting.dashboard', 'admin.dashboard'];

        if ($booking?->user_id) {
            $channels[] = 'client.'.$booking->user_id;
        }

        $this->changed('finance', $entityType, $entityId, $action, $message, $channels);
    }

    public function staffQueueChanged(string $resource, string $entityType, int|string|null $entityId, string $action, ?string $message = null): void
    {
        $this->changed($resource, $entityType, $entityId, $action, $message, ['staff.queue', 'marketing.dashboard', 'admin.dashboard']);
    }

    public function adminChanged(string $resource, string $entityType, int|string|null $entityId, string $action, ?string $message = null): void
    {
        $this->changed($resource, $entityType, $entityId, $action, $message, ['staff.queue', 'marketing.dashboard', 'accounting.dashboard', 'admin.dashboard']);
    }
}
