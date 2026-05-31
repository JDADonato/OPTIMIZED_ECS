<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BookingReviewTask;
use App\Models\ContactInquiry;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\EventPreparationTask;
use App\Models\FeedbackResponse;
use App\Models\Message;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AccountLifecycleService
{
    public const CUSTOMER_ARCHIVE_NOTE = 'Conversation archived because customer account was deactivated.';

    public function archiveCustomerConversations(User $customer, ?int $actorId = null): int
    {
        if ($customer->role !== 'Client') {
            return 0;
        }

        return DB::transaction(function () use ($customer, $actorId) {
            $conversations = Conversation::where('client_id', $customer->id)
                ->where('status', 'active')
                ->get();

            foreach ($conversations as $conversation) {
                $conversation->forceFill([
                    'status' => 'resolved',
                    'internal_notes' => trim(implode("\n\n", array_filter([
                        $conversation->internal_notes,
                        self::CUSTOMER_ARCHIVE_NOTE,
                    ]))),
                ])->save();

                Message::create([
                    'conversation_id' => $conversation->id,
                    'sender_id' => $actorId ?: $customer->id,
                    'receiver_id' => $conversation->client_id,
                    'message' => self::CUSTOMER_ARCHIVE_NOTE,
                    'message_type' => 'system',
                    'metadata' => [
                        'type' => 'customer_deactivated_archive',
                        'actor_id' => $actorId,
                    ],
                    'read_at' => now(),
                ]);
            }

            return $conversations->count();
        });
    }

    public function releaseStaffOwnership(User $staff, ?int $actorId = null): array
    {
        if (! in_array($staff->role, ['Marketing', 'Accounting'], true)) {
            return [
                'conversations' => 0,
                'bookings' => 0,
                'contact_inquiries' => 0,
                'feedback_followups' => 0,
                'booking_review_tasks' => 0,
                'event_preparation_tasks' => 0,
            ];
        }

        return DB::transaction(function () use ($staff, $actorId) {
            $conversationIds = Conversation::where('staff_id', $staff->id)
                ->where('status', 'active')
                ->pluck('id');

            $conversations = Conversation::whereIn('id', $conversationIds)
                ->update(['staff_id' => null]);

            ConversationParticipant::where('user_id', $staff->id)
                ->whereIn('role', ['owner', 'collaborator', 'admin_observer'])
                ->active()
                ->update([
                    'removed_at' => now(),
                    'removed_by' => $actorId,
                    'removal_reason' => 'staff_deactivated',
                ]);

            $bookings = Booking::where('assigned_to', $staff->id)
                ->update([
                    'assigned_to' => null,
                    'transfer_requested_to' => null,
                    'transfer_requested_by' => null,
                    'transfer_requested_at' => null,
                ]);

            $contactInquiries = ContactInquiry::where('assigned_to', $staff->id)
                ->whereNull('resolved_at')
                ->update(['assigned_to' => null]);

            $feedbackFollowups = FeedbackResponse::where('assigned_to', $staff->id)
                ->where(function ($query) {
                    $query->whereNull('review_status')
                        ->orWhereNotIn('review_status', ['approved', 'dismissed', 'closed']);
                })
                ->update(['assigned_to' => null]);

            $bookingReviewTasks = BookingReviewTask::where('assigned_to', $staff->id)
                ->where(function ($query) {
                    $query->whereNull('status')
                        ->orWhereNotIn('status', ['Done', 'Completed', 'done', 'completed']);
                })
                ->update(['assigned_to' => null]);

            $eventPreparationTasks = EventPreparationTask::where('assigned_to', $staff->id)
                ->where(function ($query) {
                    $query->whereNull('status')
                        ->orWhereNotIn('status', ['Done', 'Completed', 'done', 'completed']);
                })
                ->update(['assigned_to' => null]);

            return [
                'conversations' => $conversations,
                'bookings' => $bookings,
                'contact_inquiries' => $contactInquiries,
                'feedback_followups' => $feedbackFollowups,
                'booking_review_tasks' => $bookingReviewTasks,
                'event_preparation_tasks' => $eventPreparationTasks,
            ];
        });
    }
}
