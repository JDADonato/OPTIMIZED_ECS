<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CustomerAssistedBookingInviteNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly Booking $booking,
        private readonly ?string $temporaryPassword = null,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $name = $notifiable->full_name ?: $notifiable->username;
        $details = [
            'Booking reference' => "#{$this->booking->id}",
            'Event' => $this->booking->event_display_name,
            'Event date' => optional($this->booking->event_date)->format('M d, Y') ?? 'To be confirmed',
            'Guests' => number_format((int) $this->booking->pax),
        ];

        if ($this->temporaryPassword) {
            $details['Username'] = $notifiable->username;
            $details['Temporary password'] = $this->temporaryPassword;
        }

        return (new MailMessage)
            ->subject('Your Eloquente booking was prepared')
            ->view('emails.generic', [
                'emailTitle' => 'Your Eloquente booking was prepared',
                'headline' => 'Your event plan is ready to review',
                'preheader' => 'Our team created a booking record for your event so you can continue online.',
                'greeting' => "Hello {$name},",
                'lines' => [
                    'An Eloquente staff member prepared a booking record for your event.',
                    $this->temporaryPassword
                        ? 'Use the temporary password below to sign in, then set your own password.'
                        : 'You can sign in with your existing account to review your booking, payments, receipts, and messages.',
                ],
                'details' => $details,
                'ctaUrl' => url('/login'),
                'ctaLabel' => 'Open my booking',
                'note' => 'If any event detail is incorrect, reply through your dashboard chat or contact the Eloquente team.',
            ]);
    }
}
