<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class BookingContinuationReminder extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public array $draft
    ) {}

    public function build(): self
    {
        return $this
            ->subject('Continue your Eloquente booking')
            ->view('emails.booking_continuation_reminder');
    }
}
