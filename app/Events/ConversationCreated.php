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
 * Broadcast when a client starts a new conversation.
 * Staff dashboard listens for this to add it to the unassigned queue in real-time.
 */
class ConversationCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $conversationData;

    public function __construct(Conversation $conversation)
    {
        $this->conversationData = [
            'id' => $conversation->id,
            'client_id' => $conversation->client_id,
            'client_name' => $conversation->client->username ?? 'Unknown',
            'client_email' => $conversation->client->email ?? null,
            'staff_id' => null,
            'status' => 'active',
            'created_at' => $conversation->created_at->toISOString(),
            'last_message' => null,
            'last_message_time' => $conversation->created_at->diffForHumans(),
            'unread_count' => 0,
        ];
    }

    /**
     * Broadcast to the staff queue channel so all Marketing/Admin staff see the new inquiry.
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('staff.queue'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'conversation.created';
    }
}
