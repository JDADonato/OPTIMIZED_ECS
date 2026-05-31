<?php

namespace App\Mail;

use App\Models\Booking;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;

class BookingLiveStatusUpdate extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public Booking $booking,
        public string $liveStatus,
        public ?User $updatedBy = null
    ) {}

    public function build(): self
    {
        $copy = $this->statusCopy($this->liveStatus);
        $eventDate = $this->booking->event_date
            ? Carbon::parse($this->booking->event_date)->format('F j, Y')
            : 'Date pending';
        $eventTime = $this->booking->event_time ?: 'Time pending';
        $reference = str_pad((string) $this->booking->id, 5, '0', STR_PAD_LEFT);

        return $this
            ->subject($copy['subject'])
            ->view('emails.generic', [
                'emailTitle' => 'Event live status update',
                'headline' => $copy['headline'],
                'preheader' => $copy['preheader'],
                'greeting' => 'Hello '.($this->booking->client_full_name ?: $this->booking->user?->username ?: 'there').',',
                'lines' => $copy['lines'],
                'details' => [
                    'Current status' => $this->liveStatus,
                    'Event date' => $eventDate,
                    'Event time' => $eventTime,
                    'Booking reference' => "#{$reference}",
                    'Venue' => $this->venueLabel(),
                ],
                'ctaLabel' => 'View live tracker',
                'ctaUrl' => route('dashboard.client'),
                'note' => 'This update was sent by the Eloquente team so you can follow your event progress from your dashboard.',
            ]);
    }

    private function venueLabel(): string
    {
        return collect([
            $this->booking->venue_address_line,
            $this->booking->venue_city,
            $this->booking->venue_province,
        ])->filter()->join(', ') ?: 'Venue pending';
    }

    private function statusCopy(string $status): array
    {
        return match ($status) {
            'On the Way' => [
                'subject' => 'Your Eloquente team is on the way',
                'headline' => 'Our team is on the way',
                'preheader' => 'Your Eloquente event team is traveling to your venue.',
                'lines' => [
                    'Your Eloquente event team is now on the way to your venue.',
                    'We will continue updating your dashboard as the team arrives, prepares the setup, and begins service.',
                ],
            ],
            'Preparing' => [
                'subject' => 'Eloquente is preparing your event setup',
                'headline' => 'Preparation is underway',
                'preheader' => 'Your Eloquente team is setting up for your event.',
                'lines' => [
                    'Your Eloquente team has started preparing your event setup.',
                    'We are coordinating the venue, service flow, and catering details so everything is ready for your guests.',
                ],
            ],
            'Serving' => [
                'subject' => 'Eloquente service has started',
                'headline' => 'Service is underway',
                'preheader' => 'Your event service has started.',
                'lines' => [
                    'Your Eloquente team has started serving at your event.',
                    'The live tracker in your dashboard will remain updated as the event service continues.',
                ],
            ],
            'Completed' => [
                'subject' => 'Your Eloquente event service is complete',
                'headline' => 'Event service completed',
                'preheader' => 'Your event service has been marked complete.',
                'lines' => [
                    'Your Eloquente event service has been marked complete.',
                    'Thank you for letting us be part of your occasion. Receipts, records, and post-event updates will remain available from your dashboard.',
                ],
            ],
            default => [
                'subject' => 'Your Eloquente live tracker was updated',
                'headline' => 'Live tracker updated',
                'preheader' => 'Your event live tracker has been updated.',
                'lines' => [
                    'Your Eloquente event live tracker has been updated.',
                    'You can view the latest status from your customer dashboard.',
                ],
            ],
        };
    }
}
