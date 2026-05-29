<?php

namespace App\Events;

use App\Models\Booking;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class BookingUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $booking;
    public $message;

    /**
     * Create a new event instance.
     */
    public function __construct(Booking $booking, $message = 'A booking has been updated')
    {
        $this->booking = $booking;
        $this->message = $message;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        // Broadcast to marketing, accounting, and the specific client
        return [
            new PrivateChannel('marketing.dashboard'),
            new PrivateChannel('accounting.dashboard'),
            new PrivateChannel('client.' . $this->booking->user_id)
        ];
    }

    public function broadcastWith(): array
    {
        return [
            'booking_id' => $this->booking->id,
            'status' => $this->booking->status,
            'live_status' => $this->booking->live_status,
            'message' => $this->message,
        ];
    }
}
