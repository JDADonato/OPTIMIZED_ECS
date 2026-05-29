<?php

namespace App\Notifications;

use App\Models\Payment;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PaymentReminderNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Payment $payment) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $booking = $this->payment->booking;
        $dueDate = \Carbon\Carbon::parse($this->payment->due_date);
        $daysUntilDue = $dueDate->diffInDays(\Carbon\Carbon::now());

        return (new MailMessage)
            ->subject('Payment Reminder - Eloquente Catering')
            ->view('emails.generic', [
                'emailTitle' => 'Payment reminder',
                'headline' => 'Your payment is coming up',
                'preheader' => 'A friendly reminder for your Eloquente booking payment.',
                'greeting' => "Hello {$notifiable->username},",
                'lines' => ['This is a friendly reminder about an upcoming payment for your booking.'],
                'details' => array_filter([
                    'Payment type' => $this->payment->payment_type,
                    'Amount due' => 'PHP ' . number_format((float) $this->payment->amount, 2),
                    'Due date' => $dueDate->format('F j, Y'),
                    'Days remaining' => $daysUntilDue > 0 ? $daysUntilDue : null,
                    'Booking reference' => '#' . str_pad($booking->id, 5, '0', STR_PAD_LEFT),
                ]),
                'ctaLabel' => 'View payment',
                'ctaUrl' => route('payment.page'),
                'note' => 'Please make your payment on or before the due date to keep your booking on track.',
            ]);
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'payment_id' => $this->payment->id,
            'booking_id' => $this->payment->booking_id,
            'type' => 'payment_reminder',
            'message' => 'Payment reminder: PHP ' . number_format((float) $this->payment->amount, 2) . " ({$this->payment->payment_type}) due on " . \Carbon\Carbon::parse($this->payment->due_date)->format('F j, Y'),
        ];
    }
}
