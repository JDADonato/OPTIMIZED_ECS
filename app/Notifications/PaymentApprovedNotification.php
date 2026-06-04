<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the client when their payment is approved/verified by accounting.
 */
class PaymentApprovedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Booking $booking,
        public string $paymentType,
        public float $amount
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $label = $this->paymentLabel();
        $reference = str_pad($this->booking->id, 5, '0', STR_PAD_LEFT);

        return (new MailMessage)
            ->subject('Payment Approved - Eloquente Catering')
            ->view('emails.generic', [
                'emailTitle' => 'Payment approved',
                'headline' => 'Your payment has been verified',
                'preheader' => 'Accounting has verified your Eloquente Catering payment.',
                'greeting' => "Hello {$notifiable->username},",
                'lines' => ["Accounting has verified your {$label}. Your dashboard now shows the updated payment status and next payment step."],
                'details' => [
                    'Booking reference' => "#{$reference}",
                    'Payment term' => $label,
                    'Verified amount' => 'PHP '.number_format($this->amount, 2),
                ],
                'ctaLabel' => 'View payments',
                'ctaUrl' => route('dashboard.client'),
            ]);
    }

    public function toDatabase(object $notifiable): array
    {
        $label = $this->paymentLabel();

        return [
            'booking_id' => $this->booking->id,
            'type' => 'payment_approved',
            'message' => "Your {$label} of PHP ".number_format($this->amount, 2)." for Booking #{$this->booking->id} has been verified.",
        ];
    }

    private function paymentLabel(): string
    {
        return match ($this->paymentType) {
            'Reservation' => 'Reservation Fee',
            'DownPayment' => 'Down Payment',
            'Final' => 'Final Payment',
            default => $this->paymentType ?: 'Payment',
        };
    }
}
