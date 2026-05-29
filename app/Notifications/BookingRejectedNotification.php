<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class BookingRejectedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Booking $booking, public ?string $reason = null) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $eventDate = \Carbon\Carbon::parse($this->booking->event_date)->format('F j, Y');
        $reference = str_pad($this->booking->id, 5, '0', STR_PAD_LEFT);

        return (new MailMessage)
            ->subject('Booking Status Update - Eloquente Catering')
            ->view('emails.generic', [
                'emailTitle' => 'Booking status update',
                'headline' => 'We could not confirm this date',
                'preheader' => 'An update about your Eloquente booking request.',
                'greeting' => "Hello {$notifiable->username},",
                'lines' => array_filter([
                    'Unfortunately, your booking request could not be confirmed for the selected date.',
                    $this->reason ? "Reason: {$this->reason}" : null,
                ]),
                'details' => [
                    'Event date' => $eventDate,
                    'Booking reference' => "#{$reference}",
                ],
                'ctaLabel' => 'Browse available dates',
                'ctaUrl' => route('booking.wizard'),
                'note' => 'You may choose a new date or contact our team for assistance.',
            ]);
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'booking_id' => $this->booking->id,
            'type' => 'booking_rejected',
            'message' => "Your booking for " . \Carbon\Carbon::parse($this->booking->event_date)->format('F j, Y') . " has been rejected. " . ($this->reason ? "Reason: {$this->reason}" : ''),
        ];
    }
}
