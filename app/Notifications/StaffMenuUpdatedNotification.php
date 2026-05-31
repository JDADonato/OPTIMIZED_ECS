<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class StaffMenuUpdatedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Booking $booking,
        public $newTotal = null,
        public $oldTotal = null,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $oldTotal = is_numeric($this->oldTotal) ? 'PHP '.number_format((float) $this->oldTotal, 2) : 'previous total';
        $newTotal = is_numeric($this->newTotal) ? 'PHP '.number_format((float) $this->newTotal, 2) : 'updated total';

        $message = "Menu updated by customer for Booking #{$this->booking->id}. Total changed from {$oldTotal} to {$newTotal}.";
        if ($notifiable->role === 'Accounting') {
            $message = "Booking #{$this->booking->id} has a customer menu pricing update. Total changed from {$oldTotal} to {$newTotal}.";
        } elseif ($notifiable->role === 'Marketing') {
            $message = "Menu updated by customer for Booking #{$this->booking->id}. Review the selected dishes and preparation notes.";
        }

        return [
            'type' => 'menu_updated',
            'booking_id' => $this->booking->id,
            'target_type' => 'booking',
            'target_id' => $this->booking->id,
            'priority' => 'needs_action',
            'category' => 'booking',
            'action_url' => $notifiable->role === 'Accounting' ? '/dashboard/accounting' : '/dashboard/marketing',
            'title' => 'Menu updated by customer',
            'message' => $message,
            'old_total' => $this->oldTotal,
            'new_total' => $this->newTotal,
        ];
    }
}
