<?php

namespace App\Notifications;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Phase 2 Step 4: Email notification sent to a client when a staff member
 * replies to their conversation.
 *
 * Implements ShouldQueue so emails don't block the HTTP response.
 * Uses a 15-minute cache cooldown (managed in ChatController) to prevent
 * email spam when staff sends multiple quick replies.
 */
class NewChatMessageNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Message $message,
        public Conversation $conversation,
        public User $staffMember
    ) {}

    /**
     * Deliver via both mail and database (in-app notification bell).
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    /**
     * Build the email.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $staffName = $this->staffMember->username;
        $preview = \Illuminate\Support\Str::limit($this->message->message, 120);
        $appUrl = config('app.url', 'http://localhost:8080');

        return (new MailMessage)
            ->subject("New Message from Eloquente Catering")
            ->view('emails.new_message', [
                'clientName' => $notifiable->username,
                'staffName' => $staffName,
                'preview' => $preview,
                'appUrl' => $appUrl,
            ]);
    }

    /**
     * Store in the notifications table for the in-app notification bell.
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'type' => 'chat_reply',
            'conversation_id' => $this->conversation->id,
            'staff_name' => $this->staffMember->username,
            'message_preview' => \Illuminate\Support\Str::limit($this->message->message, 100),
            'message' => "{$this->staffMember->username} replied to your inquiry.",
        ];
    }
}
