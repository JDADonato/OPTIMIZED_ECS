<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Sent to the client when their payment is approved/verified by accounting.
 */
class PaymentApprovedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Booking $booking,
        public string $paymentType,
        public float $amount
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        $typeLabels = [
            'Reservation' => 'Reservation Fee (10%)',
            'DownPayment' => 'Down Payment (70%)',
            'Final' => 'Final Payment (20%)',
        ];

        $label = $typeLabels[$this->paymentType] ?? $this->paymentType;

        return [
            'booking_id' => $this->booking->id,
            'type' => 'payment_approved',
            'message' => "Your {$label} of ₱" . number_format($this->amount, 2) . " for Booking #{$this->booking->id} has been verified.",
        ];
    }
}
