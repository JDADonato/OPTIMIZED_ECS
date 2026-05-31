<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class StaffAccountAccessNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly string $temporaryPassword,
        private readonly string $purpose = 'created',
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $workspaceLabel = $notifiable->role === 'Admin' ? 'admin console' : 'staff workspace';
        $subject = $this->purpose === 'reset'
            ? 'Your Eloquente account password was reset'
            : 'Your Eloquente account is ready';
        $headline = $this->purpose === 'reset'
            ? 'Temporary password reset'
            : 'Welcome to Eloquente';
        $name = $notifiable->full_name ?: $notifiable->username;

        return (new MailMessage)
            ->subject($subject)
            ->view('emails.generic', [
                'emailTitle' => $subject,
                'headline' => $headline,
                'preheader' => 'Use your temporary password to sign in, then set your own password.',
                'greeting' => "Hello {$name},",
                'lines' => [
                    "You can now sign in to the Eloquente {$workspaceLabel}.",
                    'For security, you will be asked to set your own password after signing in.',
                ],
                'details' => [
                    'Username' => $notifiable->username,
                    'Role' => $notifiable->role,
                    'Temporary password' => $this->temporaryPassword,
                ],
                'ctaUrl' => url('/login'),
                'ctaLabel' => 'Sign in',
                'note' => 'If you were not expecting this account access, please contact the administrator.',
            ]);
    }
}
