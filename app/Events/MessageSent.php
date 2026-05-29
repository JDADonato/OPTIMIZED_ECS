<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast when a new message is sent within a conversation.
 * Listeners on the conversation channel receive this in real-time via Reverb.
 */
class MessageSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $messageData;
    public int $conversationId;

    public function __construct(Message $message)
    {
        $this->conversationId = $message->conversation_id;

        $this->messageData = [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'sender_id' => $message->sender_id,
            'message' => $message->message,
            'sender_name' => $message->sender->username ?? 'Unknown',
            'sender_role' => $message->sender->role ?? 'Unknown',
            'is_booking_card' => str_starts_with($message->message, '📋 BOOKING DETAILS'),
            'read_at' => null,
            'created_at' => $message->created_at->toISOString(),
            'time' => $message->created_at->format('g:i A'),
        ];
    }

    /**
     * The channel the event should broadcast on.
     * Only users in this conversation can listen.
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('conversation.' . $this->conversationId),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'message.sent';
    }
}
