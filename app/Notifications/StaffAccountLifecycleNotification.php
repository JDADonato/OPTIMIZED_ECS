<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class StaffAccountLifecycleNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly string $event,
        private readonly ?string $role = null,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $name = $notifiable->full_name ?: $notifiable->username;

        $content = match ($this->event) {
            'force_password_change' => [
                'subject' => 'Password change required for your Eloquente account',
                'line' => 'An administrator marked your staff account to require a password change on your next sign-in.',
                'action' => 'Sign in',
            ],
            'deactivated' => [
                'subject' => 'Your Eloquente staff access was deactivated',
                'line' => 'Your staff account access has been deactivated. Operational records remain preserved.',
                'action' => null,
            ],
            'reactivated' => [
                'subject' => 'Your Eloquente staff access was restored',
                'line' => 'Your staff account has been reactivated. You can sign in again using your current password.',
                'action' => 'Sign in',
            ],
            'role_changed' => [
                'subject' => 'Your Eloquente staff role was updated',
                'line' => 'Your staff account role was updated'.($this->role ? " to {$this->role}." : '.'),
                'action' => 'Sign in',
            ],
            default => [
                'subject' => 'Your Eloquente staff account was updated',
                'line' => 'An administrator updated your staff account.',
                'action' => 'Sign in',
            ],
        };

        $message = (new MailMessage)
            ->subject($content['subject'])
            ->view('emails.generic', [
                'emailTitle' => $content['subject'],
                'headline' => 'Account access update',
                'preheader' => 'An Eloquente account access setting was updated.',
                'greeting' => "Hello {$name},",
                'lines' => [
                    $content['line'],
                ],
                'details' => [
                    'Username' => $notifiable->username,
                    'Role' => $this->role ?: $notifiable->role,
                ],
                'ctaUrl' => $content['action'] ? url('/login') : null,
                'ctaLabel' => $content['action'],
                'note' => 'If you were not expecting this change, please contact the administrator.',
            ]);

        return $message;
    }
}
