<?php

namespace App\Events;

use App\Models\Conversation;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast when a staff member claims an unassigned conversation.
 * Staff dashboard listens for this to remove the conversation from the unassigned queue.
 */
class ConversationClaimed implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $conversationData;

    public function __construct(Conversation $conversation)
    {
        $this->conversationData = [
            'id' => $conversation->id,
            'client_id' => $conversation->client_id,
            'staff_id' => $conversation->staff_id,
            'status' => $conversation->status,
            'client_name' => $conversation->client->username ?? 'Unknown',
            'staff_name' => $conversation->staff->username ?? 'Unknown',
        ];
    }

    /**
     * Broadcast to two channels:
     * 1. The staff queue channel (so all staff see it was claimed)
     * 2. The specific conversation channel (so the client gets notified)
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('staff.queue'),
            new PrivateChannel('conversation.' . $this->conversationData['id']),
        ];
    }

    public function broadcastAs(): string
    {
        return 'conversation.claimed';
    }
}
