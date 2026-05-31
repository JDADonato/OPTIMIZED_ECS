<?php

namespace App\Mail;

use App\Models\Announcement;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class AnnouncementEmail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public Announcement $announcement) {}

    public function build(): self
    {
        return $this
            ->subject($this->announcement->email_subject ?: $this->announcement->title)
            ->view('emails.announcement', [
                'announcement' => $this->announcement,
            ]);
    }
}
