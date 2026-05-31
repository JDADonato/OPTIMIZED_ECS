<?php

namespace App\Services;

use App\Models\Booking;
use Carbon\Carbon;

class PostEventLifecycleService
{
    private const REVIEW_FLOW_STATUSES = [
        'Submitted',
        'Under Review',
        'Needs Customer Details',
        'Clarification Received',
    ];

    public static function completePastSubmitted(?Carbon $today = null): int
    {
        $cutoff = ($today ?: now())->toDateString();
        $completed = 0;

        Booking::query()
            ->whereDate('event_date', '<', $cutoff)
            ->whereIn('status', ['Pending', 'Completed'])
            ->whereIn('review_status', self::REVIEW_FLOW_STATUSES)
            ->orderBy('id')
            ->chunkById(100, function ($bookings) use (&$completed) {
                foreach ($bookings as $booking) {
                    $booking->forceFill([
                        'status' => 'Completed',
                        'review_status' => 'Completed',
                        'live_status' => 'Completed',
                        'reviewed_at' => $booking->reviewed_at ?: now(),
                    ])->save();

                    EventPreparationService::ensureFeedbackRequest($booking->fresh());
                    self::refresh($booking->fresh());
                    $completed += 1;
                }
            });

        return $completed;
    }

    public static function refresh(Booking $booking): string
    {
        if (strtolower((string) $booking->status) !== 'completed') {
            if ($booking->post_event_status || $booking->closed_at) {
                $booking->forceFill([
                    'post_event_status' => null,
                    'closed_at' => null,
                    'closed_by' => null,
                ])->save();
            }

            return 'Active';
        }

        $booking->loadMissing(['payments' => fn ($query) => $query->active(), 'refundCases', 'feedbackRequest.response']);

        $paid = (float) $booking->payments->whereIn('status', ['Paid', 'Verified'])->sum('amount');
        $refunded = (float) $booking->payments->where('status', 'Refunded')->sum('amount');
        $total = (float) ($booking->total_cost ?? $booking->budget ?? 0);
        $pendingPayment = $booking->payments->contains(fn ($payment) => ! in_array($payment->status, ['Paid', 'Verified', 'Refunded'], true));
        $openRefund = $booking->refundCases->contains(fn ($case) => ! in_array($case->status, ['completed', 'rejected', 'cancelled'], true));
        $feedbackRequest = $booking->feedbackRequest;
        $feedbackResponse = $feedbackRequest?->response;

        $status = match (true) {
            $openRefund => 'Refund Pending',
            $pendingPayment || (($paid + $refunded) < $total) => 'Balance Due',
            ! $feedbackRequest => 'Feedback Pending',
            $feedbackRequest->status !== 'Completed' => 'Feedback Pending',
            $feedbackResponse && in_array($feedbackResponse->review_status, ['Open', 'Needs Follow Up', 'In Progress'], true) => 'Feedback Review Needed',
            default => 'Ready to Close',
        };

        $booking->forceFill(['post_event_status' => $status])->save();

        return $status;
    }

    public static function close(Booking $booking, ?int $userId = null): string
    {
        $status = self::refresh($booking);

        if ($status !== 'Ready to Close') {
            return $status;
        }

        $booking->forceFill([
            'post_event_status' => 'Closed',
            'closed_at' => now(),
            'closed_by' => $userId,
        ])->save();

        return 'Closed';
    }
}
