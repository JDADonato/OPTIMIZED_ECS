<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BookingSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'booking_source' => $this->booking_source ?? 'customer',
            'created_by_staff_id' => $this->created_by_staff_id,
            'created_by_staff_name' => $this->createdByStaff?->full_name ?: ($this->createdByStaff->username ?? null),
            'created_by_staff_label' => $this->created_by_staff_id ? 'Created by staff' : 'Customer submitted',
            'event_date' => $this->event_date,
            'event_time' => $this->event_time,
            'pax' => (int) $this->pax,
            'budget' => $this->budget,
            'package_id' => $this->package_id,
            'event_type' => $this->event_type,
            'event_name' => $this->event_name,
            'event_display_name' => $this->event_display_name,
            'client_full_name' => $this->client_full_name,
            'client_email' => $this->client_email,
            'client_phone' => $this->client_phone,
            'venue_address_line' => $this->venue_address_line,
            'venue_street' => $this->venue_street,
            'venue_city' => $this->venue_city,
            'venue_province' => $this->venue_province,
            'venue_zip_code' => $this->venue_zip_code,
            'venue_building_details' => $this->venue_building_details,
            'reservation_time' => $this->reservation_time,
            'serving_time' => $this->serving_time,
            'event_timeline' => $this->event_timeline,
            'color_motif' => $this->color_motif,
            'theme_uploads' => $this->theme_uploads,
            'special_instructions' => $this->special_instructions,
            'selected_menu' => $this->selected_menu,
            'outsourced_services' => $this->outsourced_services,
            'transport_fee' => $this->transport_fee,
            'labor_surcharge' => $this->labor_surcharge,
            'discount_value' => $this->discount_value,
            'discount_type' => $this->discount_type,
            'total_cost' => $this->total_cost,
            'totalCost' => (float) ($this->total_cost ?? $this->budget ?? 0),
            'status' => $this->normalizedBookingStatus(),
            'review_status' => $this->review_status ?? 'Submitted',
            'assigned_to' => $this->assigned_to,
            'assigned_name' => $this->assignee?->full_name ?: ($this->assignee->username ?? null),
            'owner_id' => $this->assigned_to,
            'owner_name' => $this->assignee?->full_name ?: ($this->assignee->username ?? null),
            'transfer_requested_to' => $this->transfer_requested_to,
            'transfer_requested_to_name' => $this->transferRequestedTo?->full_name ?: ($this->transferRequestedTo->username ?? null),
            'transfer_requested_by' => $this->transfer_requested_by,
            'transfer_requested_by_name' => $this->transferRequestedBy?->full_name ?: ($this->transferRequestedBy->username ?? null),
            'transfer_requested_at' => $this->transfer_requested_at,
            'can_accept_transfer' => $this->canAcceptTransfer($request),
            'can_claim' => $this->canClaim($request),
            'can_edit' => $this->canEdit($request),
            'ownership_label' => $this->ownershipLabel($request),
            'clarification_request' => $this->clarification_request,
            'clarification_response' => $this->clarification_response,
            'clarification_requested_at' => $this->clarification_requested_at,
            'clarification_responded_at' => $this->clarification_responded_at,
            'reviewed_at' => $this->reviewed_at,
            'live_status' => $this->live_status,
            'post_event_status' => $this->post_event_status,
            'closed_at' => $this->closed_at,
            'closed_by' => $this->closed_by,
            'created_at' => $this->created_at,
            'username' => $this->user->username ?? null,
            'user_email' => $this->user->email ?? null,
            'user_phone' => $this->user->phone ?? null,
            'role' => $this->user->role ?? null,
            'payments_count' => $this->whenLoaded('payments', fn () => $this->payments->count()),
            'paid_total' => $this->whenLoaded('payments', fn () => $this->payments->whereIn('status', ['Paid', 'Verified'])->sum(fn ($payment) => (float) $payment->amount)),
            'pending_payment_total' => $this->whenLoaded('payments', fn () => $this->payments->whereNotIn('status', ['Paid', 'Verified', 'Refunded'])->sum(fn ($payment) => (float) $payment->amount)),
            'payments' => PaymentResource::collection($this->whenLoaded('payments', fn () => $this->payments, collect())),
            'review_tasks' => $this->whenLoaded('reviewTasks', fn () => $this->reviewTasks->map(fn ($task) => [
                'id' => $task->id,
                'task_type' => $task->task_type,
                'label' => $task->label,
                'status' => $task->status,
                'customer_visible' => $task->customer_visible,
                'customer_response' => $task->customer_response,
                'completed_at' => $task->completed_at,
            ])->values()),
            'preparation_tasks' => $this->whenLoaded('preparationTasks', fn () => $this->preparationTasks->map(fn ($task) => [
                'id' => $task->id,
                'department' => $task->department,
                'responsible_area' => $this->responsibleArea($task->department),
                'label' => $task->label,
                'status' => $task->status,
                'due_at' => $task->due_at,
                'completed_at' => $task->completed_at,
            ])->values()),
            'history_notes' => $this->whenLoaded('historyNotes', fn () => $this->historyNotes
                ->sortByDesc('created_at')
                ->take(5)
                ->map(fn ($note) => [
                    'id' => $note->id,
                    'body' => $note->body,
                    'created_at' => $note->created_at,
                ])->values()),
        ];
    }

    private function canClaim(Request $request): bool
    {
        $user = $request->user();

        return $user && in_array($user->role, ['Marketing', 'Admin'], true) && is_null($this->assigned_to);
    }

    private function canEdit(Request $request): bool
    {
        $user = $request->user();

        if (!$user || !in_array($user->role, ['Marketing', 'Admin'], true)) {
            return false;
        }

        return $user->role === 'Admin' || (int) $this->assigned_to === (int) $user->id;
    }

    private function canAcceptTransfer(Request $request): bool
    {
        $user = $request->user();

        return $user
            && $user->role === 'Marketing'
            && !is_null($this->transfer_requested_to)
            && (int) $this->transfer_requested_to === (int) $user->id;
    }

    private function ownershipLabel(Request $request): string
    {
        $user = $request->user();

        if (is_null($this->assigned_to)) {
            return 'Unassigned';
        }

        if ($user && (int) $this->assigned_to === (int) $user->id) {
            return 'My booking';
        }

        return 'Owned by another staff member';
    }

    private function normalizedBookingStatus(): ?string
    {
        return $this->status === 'Reserved' ? 'Confirmed' : $this->status;
    }

    private function responsibleArea(?string $department): string
    {
        return match ($department) {
            'Operations', 'Admin', 'Service prep', null, '' => 'Service prep',
            default => $department,
        };
    }
}
