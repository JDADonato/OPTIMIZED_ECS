<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class BookingConfirmedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Booking $booking) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $eventDate = \Carbon\Carbon::parse($this->booking->event_date)->format('F j, Y');
        $reference = str_pad($this->booking->id, 5, '0', STR_PAD_LEFT);

        return (new MailMessage)
            ->subject('Booking Confirmed - Eloquente Catering')
            ->view('emails.generic', [
                'emailTitle' => 'Booking confirmed',
                'headline' => 'Your booking is confirmed',
                'preheader' => 'Your Eloquente Catering booking has been confirmed.',
                'greeting' => "Hello {$notifiable->username},",
                'lines' => ['Your catering booking has been confirmed. Your payment schedule is now available from your dashboard.'],
                'details' => [
                    'Event date' => $eventDate,
                    'Guests' => $this->booking->pax,
                    'Booking reference' => "#{$reference}",
                    'Total amount' => 'PHP ' . number_format((float) $this->booking->total_cost, 2),
                ],
                'ctaLabel' => 'View booking',
                'ctaUrl' => route('dashboard.client'),
                'note' => 'Thank you for choosing Eloquente Catering.',
            ]);
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'booking_id' => $this->booking->id,
            'type' => 'booking_confirmed',
            'message' => "Your booking for {$this->booking->pax} guests on " . \Carbon\Carbon::parse($this->booking->event_date)->format('F j, Y') . " has been confirmed.",
        ];
    }
}
