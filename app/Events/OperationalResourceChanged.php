<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OperationalResourceChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $resource,
        public string $entityType,
        public int|string|null $entityId,
        public string $action,
        public ?string $message = null,
        public array $channels = [],
    ) {}

    public function broadcastOn(): array
    {
        $channels = $this->channels ?: ['staff.queue'];

        return collect($channels)
            ->filter()
            ->unique()
            ->map(fn (string $channel) => new PrivateChannel($channel))
            ->values()
            ->all();
    }

    public function broadcastAs(): string
    {
        return 'operational.resource.changed';
    }

    public function broadcastWith(): array
    {
        return [
            'resource' => $this->resource,
            'entity_type' => $this->entityType,
            'entity_id' => $this->entityId,
            'action' => $this->action,
            'message' => $this->message,
            'occurred_at' => now()->toIso8601String(),
        ];
    }
}
