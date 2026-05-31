<?php

namespace App\Notifications;

use App\Models\Booking;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NewBookingNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Booking $booking) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $booking = $this->booking;
        $eventDate = Carbon::parse($booking->event_date)->format('F j, Y');

        return (new MailMessage)
            ->subject('New Booking Received - Eloquente Catering')
            ->view('emails.generic', [
                'emailTitle' => 'New booking received',
                'headline' => 'A booking needs review',
                'preheader' => 'A new Eloquente booking was submitted.',
                'greeting' => "Hello {$notifiable->username},",
                'lines' => ['A new booking has been submitted and needs staff review.'],
                'details' => [
                    'Client' => $booking->client_full_name,
                    'Event date' => $eventDate,
                    'Guests' => $booking->pax,
                    'Venue' => trim("{$booking->venue_address_line}, {$booking->venue_city}", ', '),
                    'Total cost' => 'PHP '.number_format((float) $booking->total_cost, 2),
                    'Status' => $booking->status,
                ],
                'ctaLabel' => 'Review booking',
                'ctaUrl' => route('dashboard.marketing'),
                'note' => 'Please review this booking and update its status when ready.',
            ]);
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'booking_id' => $this->booking->id,
            'type' => 'new_booking',
            'message' => "New booking from {$this->booking->client_full_name} for {$this->booking->pax} guests on ".Carbon::parse($this->booking->event_date)->format('F j, Y'),
        ];
    }
}
