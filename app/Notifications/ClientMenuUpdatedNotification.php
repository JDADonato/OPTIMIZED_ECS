<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class ClientMenuUpdatedNotification extends Notification
{
    use Queueable;

    public $booking;
    public $newTotal;

    public function __construct(Booking $booking, $newTotal)
    {
        $this->booking = $booking;
        $this->newTotal = $newTotal;
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'menu_updated',
            'booking_id' => $this->booking->id,
            'title' => 'Menu Selection Updated',
            'message' => 'Your menu was updated. Your new total is ₱' . number_format($this->newTotal, 2) . ' and your remaining balance has been adjusted.',
        ];
    }
}
