<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CustomerAccountLifecycleNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly string $event)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $content = match ($this->event) {
            'deactivated' => [
                'subject' => 'Your Eloquente account was deactivated',
                'line' => 'Your customer account access has been deactivated. Existing booking, payment, and event records remain preserved.',
                'action' => null,
            ],
            'reactivated' => [
                'subject' => 'Your Eloquente account was reactivated',
                'line' => 'Your customer account access has been restored. You can sign in again using your current password.',
                'action' => 'Sign in',
            ],
            default => [
                'subject' => 'Your Eloquente account was updated',
                'line' => 'Your customer account was updated by an administrator.',
                'action' => 'Sign in',
            ],
        };

        $message = (new MailMessage)
            ->subject($content['subject'])
            ->greeting('Hello,')
            ->line($content['line']);

        if ($content['action']) {
            $message->action($content['action'], url('/login'));
        }

        return $message->line('If you have questions, please contact Eloquente Catering.');
    }
}
