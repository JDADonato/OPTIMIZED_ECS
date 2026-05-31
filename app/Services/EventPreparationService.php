<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\EventPreparationTask;
use App\Models\FeedbackRequest;
use Carbon\Carbon;
use Illuminate\Support\Str;

class EventPreparationService
{
    public static function ensureDefaultTasks(Booking $booking): void
    {
        $dueAt = $booking->event_date ? Carbon::parse($booking->event_date)->subDays(7) : null;

        $tasks = [
            ['department' => 'Marketing', 'label' => 'Confirm final menu'],
            ['department' => 'Marketing', 'label' => 'Confirm final headcount'],
            ['department' => 'Service prep', 'label' => 'Confirm venue access'],
            ['department' => 'Accounting', 'label' => 'Confirm payment clearance'],
            ['department' => 'Service prep', 'label' => 'Prepare kitchen/service sheet'],
            ['department' => 'Service prep', 'label' => 'Assign service crew'],
            ['department' => 'Service prep', 'label' => 'Confirm equipment checklist'],
            ['department' => 'Service prep', 'label' => 'Confirm transport plan'],
            ['department' => 'Service prep', 'label' => 'Confirm setup layout'],
            ['department' => 'Marketing', 'label' => 'Confirm tasting outcome if applicable'],
        ];

        foreach ($tasks as $task) {
            EventPreparationTask::firstOrCreate(
                [
                    'booking_id' => $booking->id,
                    'label' => $task['label'],
                ],
                [
                    'department' => $task['department'],
                    'status' => 'Pending',
                    'due_at' => $dueAt,
                ]
            );
        }
    }

    public static function ensureFeedbackRequest(Booking $booking): ?FeedbackRequest
    {
        if (! $booking->user_id) {
            return null;
        }

        return FeedbackRequest::firstOrCreate(
            ['booking_id' => $booking->id],
            [
                'user_id' => $booking->user_id,
                'token' => Str::random(40),
                'status' => 'Pending',
                'sent_at' => now(),
                'expires_at' => now()->addDays(30),
            ]
        );
    }
}
