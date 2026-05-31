<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;

class BookingLiveStatusNotification extends Notification
{
    use Queueable;

    public function __construct(public Booking $booking, public string $liveStatus) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        $eventDate = $this->booking->event_date
            ? Carbon::parse($this->booking->event_date)->format('F j, Y')
            : 'your event date';

        return [
            'booking_id' => $this->booking->id,
            'type' => 'booking_live_status',
            'category' => 'booking',
            'priority' => 'info',
            'target_type' => 'booking',
            'target_id' => $this->booking->id,
            'action_url' => route('dashboard.client'),
            'message' => $this->messageForStatus($eventDate),
        ];
    }

    private function messageForStatus(string $eventDate): string
    {
        return match ($this->liveStatus) {
            'On the Way' => "Live tracker update: your Eloquente team is on the way for booking #{$this->booking->id} on {$eventDate}.",
            'Preparing' => "Live tracker update: preparation has started for booking #{$this->booking->id} on {$eventDate}.",
            'Serving' => "Live tracker update: service is now underway for booking #{$this->booking->id} on {$eventDate}.",
            'Completed' => "Live tracker update: event service is complete for booking #{$this->booking->id} on {$eventDate}.",
            default => "Live tracker update: booking #{$this->booking->id} is now {$this->liveStatus}.",
        };
    }
}
