<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PasswordResetLinkNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly string $url) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Reset your Eloquente password')
            ->greeting('Password reset request')
            ->line('We received a request to reset the password for your Eloquente account.')
            ->line('This link is valid for 60 minutes and can be used once.')
            ->action('Reset password', $this->url)
            ->line('If you did not request this, you can ignore this email.');
    }
}
