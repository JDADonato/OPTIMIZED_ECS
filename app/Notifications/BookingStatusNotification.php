<?php

namespace App\Notifications;

use App\Models\Booking;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class BookingStatusNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Booking $booking, public string $newStatus) {}

    public function via(object $notifiable): array
    {
        return $this->newStatus === 'Confirmed'
            ? ['mail', 'database']
            : ['database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $eventDate = Carbon::parse($this->booking->event_date)->format('F j, Y');
        $reference = str_pad($this->booking->id, 5, '0', STR_PAD_LEFT);
        $total = (float) ($this->booking->total_cost ?? $this->booking->budget ?? 0);

        return (new MailMessage)
            ->subject('Booking Approved - Eloquente Catering')
            ->view('emails.generic', [
                'emailTitle' => 'Booking approved',
                'headline' => 'Your booking is approved',
                'preheader' => 'Your Eloquente booking is ready for payment steps.',
                'greeting' => "Hello {$notifiable->username},",
                'lines' => ['Great news. Your catering booking has been approved, and you can now continue with the payment steps from your dashboard.'],
                'details' => [
                    'Event date' => $eventDate,
                    'Guests' => $this->booking->pax,
                    'Booking reference' => "#{$reference}",
                    'Total amount' => 'PHP '.number_format($total, 2),
                ],
                'ctaLabel' => 'View booking',
                'ctaUrl' => route('dashboard.client'),
            ]);
    }

    public function toDatabase(object $notifiable): array
    {
        $eventDate = Carbon::parse($this->booking->event_date)->format('F j, Y');

        $messages = [
            'Confirmed' => "Great news! Your booking #{$this->booking->id} for {$eventDate} has been approved.",
            'Cancelled' => "Your booking #{$this->booking->id} for {$eventDate} has been cancelled.",
            'Completed' => "Your event (Booking #{$this->booking->id}) on {$eventDate} has been marked as completed. Thank you!",
        ];

        return [
            'booking_id' => $this->booking->id,
            'type' => 'booking_'.strtolower($this->newStatus),
            'message' => $messages[$this->newStatus] ?? "Your booking #{$this->booking->id} status changed to {$this->newStatus}.",
        ];
    }
}
