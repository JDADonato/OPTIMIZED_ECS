<?php

namespace App\Http\Controllers;

use App\Models\FeedbackRequest;
use App\Models\FeedbackResponse;
use App\Notifications\StaffOperationalNotification;
use App\Services\ConversionEventService;
use App\Services\NotificationRecipientService;
use App\Services\OperationalBroadcastService;
use App\Services\PostEventLifecycleService;
use App\Support\ResourceVersion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class FeedbackController extends Controller
{
    public function index()
    {
        $requests = FeedbackRequest::query()
            ->with('booking:id,event_date,event_name,event_type,client_full_name')
            ->where('user_id', Auth::id())
            ->where('status', 'Pending')
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>=', now());
            })
            ->latest()
            ->get()
            ->map(fn (FeedbackRequest $request) => [
                'token' => $request->token,
                'status' => $request->status,
                'expires_at' => $request->expires_at,
                'booking' => [
                    'id' => $request->booking?->id,
                    'event_date' => $request->booking?->event_date,
                    'event_name' => $request->booking?->event_name,
                    'event_type' => $request->booking?->event_type,
                    'client_full_name' => $request->booking?->client_full_name,
                ],
            ]);

        return response()->json($requests);
    }

    public function store(Request $request, string $token)
    {
        $feedbackRequest = FeedbackRequest::query()
            ->with('response')
            ->where('token', $token)
            ->where('user_id', Auth::id())
            ->first();

        if (! $feedbackRequest) {
            return response()->json(['error' => 'Feedback request not found.'], 404);
        }

        if ($feedbackRequest->status === 'Completed' || $feedbackRequest->response) {
            return response()->json(['error' => 'Feedback was already submitted.'], 422);
        }

        if ($feedbackRequest->expires_at && $feedbackRequest->expires_at->isPast()) {
            return response()->json(['error' => 'This feedback request has expired.'], 422);
        }

        $data = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'food_rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'service_rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'communication_rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'value_rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'comments' => ['nullable', 'string', 'max:3000'],
            'testimonial_permission' => ['boolean'],
        ]);

        $response = FeedbackResponse::create([
            'feedback_request_id' => $feedbackRequest->id,
            'booking_id' => $feedbackRequest->booking_id,
            'user_id' => Auth::id(),
            'rating' => $data['rating'],
            'food_rating' => $data['food_rating'] ?? null,
            'service_rating' => $data['service_rating'] ?? null,
            'communication_rating' => $data['communication_rating'] ?? null,
            'value_rating' => $data['value_rating'] ?? null,
            'comments' => $data['comments'] ?? null,
            'testimonial_permission' => (bool) ($data['testimonial_permission'] ?? false),
            'follow_up_required' => (int) $data['rating'] <= 3,
            'review_status' => (int) $data['rating'] <= 3 ? 'Needs Follow Up' : 'Open',
            'testimonial_status' => ((bool) ($data['testimonial_permission'] ?? false) && (int) $data['rating'] >= 4)
                ? 'Candidate'
                : 'Not Requested',
        ]);

        $feedbackRequest->update([
            'status' => 'Completed',
            'completed_at' => now(),
        ]);

        ConversionEventService::record('feedback_submitted', [
            'booking_id' => $feedbackRequest->booking_id,
            'source' => 'customer_dashboard',
            'metadata' => [
                'rating' => (int) $response->rating,
                'testimonial_permission' => (bool) $response->testimonial_permission,
                'review_status' => $response->review_status,
                'testimonial_status' => $response->testimonial_status,
            ],
        ]);

        if ((int) $response->rating <= 3 || $response->testimonial_status === 'Candidate') {
            ConversionEventService::record((int) $response->rating <= 3 ? 'low_feedback_followup_created' : 'testimonial_candidate_created', [
                'booking_id' => $feedbackRequest->booking_id,
                'source' => 'post_event_feedback',
                'metadata' => [
                    'rating' => (int) $response->rating,
                    'testimonial_status' => $response->testimonial_status,
                ],
            ]);

            $subject = (int) $response->rating <= 3 ? 'Low feedback rating needs follow-up' : 'New testimonial candidate';
            $body = (int) $response->rating <= 3
                ? 'A completed event received a low rating and needs staff follow-up.'
                : 'A customer gave permission for a high-rating testimonial candidate.';
            app(NotificationRecipientService::class)
                ->sendToRoles(['Admin', 'Marketing'], new StaffOperationalNotification($subject, $subject, $body, url('/dashboard/marketing')), 'feedback_follow_up');
        }

        app(OperationalBroadcastService::class)
            ->staffQueueChanged('feedback', 'feedback_response', $response->id, 'submitted', 'Feedback submitted.');

        return response()->json([
            'message' => 'Thank you for your feedback.',
            'response' => $response,
        ], 201);
    }

    public function staffIndex(Request $request)
    {
        $query = FeedbackResponse::query()
            ->with([
                'booking:id,event_date,event_name,event_type,client_full_name,client_email,user_id',
                'booking.user:id,full_name,username,email',
                'assignee:id,full_name,username',
            ])
            ->latest();

        if ($request->boolean('follow_up_only')) {
            $query->whereRaw('follow_up_required is true')
                ->whereNotIn('review_status', ['Resolved', 'Closed']);
        }

        if ($request->filled('testimonial_status') && $request->query('testimonial_status') !== 'All') {
            $query->where('testimonial_status', $request->query('testimonial_status'));
        }

        $versionMeta = ResourceVersion::fromQuery($query);
        if (ResourceVersion::matches($request, $versionMeta)) {
            return ResourceVersion::unchanged($versionMeta);
        }

        $format = fn (FeedbackResponse $response) => [
            'id' => $response->id,
            'booking_id' => $response->booking_id,
            'client_name' => $response->booking?->client_full_name ?: $response->booking?->user?->full_name ?: $response->booking?->user?->username,
            'client_email' => $response->booking?->client_email ?: $response->booking?->user?->email,
            'event_date' => $response->booking?->event_date,
            'event_name' => $response->booking?->event_name,
            'event_type' => $response->booking?->event_type,
            'rating' => $response->rating,
            'food_rating' => $response->food_rating,
            'service_rating' => $response->service_rating,
            'communication_rating' => $response->communication_rating,
            'value_rating' => $response->value_rating,
            'comments' => $response->comments,
            'testimonial_permission' => $response->testimonial_permission,
            'follow_up_required' => $response->follow_up_required,
            'assigned_to' => $response->assigned_to,
            'assigned_name' => $response->assignee?->full_name ?: $response->assignee?->username,
            'follow_up_due_at' => $response->follow_up_due_at,
            'review_status' => $response->review_status,
            'testimonial_status' => $response->testimonial_status,
            'retention_notes' => $response->retention_notes,
            'reviewed_by' => $response->reviewed_by,
            'reviewed_at' => $response->reviewed_at,
        ];

        if ($request->boolean('paginated') || $request->has('page') || $request->has('per_page')) {
            $perPage = min(max((int) $request->query('per_page', 25), 1), 75);
            $paginator = $query->paginate($perPage);

            return response()->json([
                'data' => collect($paginator->items())->map($format)->values(),
                'meta' => [
                    'current_page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                    'last_page' => $paginator->lastPage(),
                    ...$versionMeta,
                    'changed' => true,
                ],
            ]);
        }

        return response()->json($query->limit(200)->get()->map($format));
    }

    public function staffUpdate(Request $request, FeedbackResponse $response)
    {
        $data = $request->validate([
            'review_status' => ['nullable', 'in:Open,Needs Follow Up,In Progress,Resolved,Closed'],
            'testimonial_status' => ['nullable', 'in:Not Requested,Candidate,Approved,Rejected'],
            'retention_notes' => ['nullable', 'string', 'max:3000'],
            'assigned_to' => ['nullable', 'exists:users,id'],
            'follow_up_due_at' => ['nullable', 'date'],
        ]);

        if (($data['testimonial_status'] ?? null) === 'Approved' && (! $response->testimonial_permission || (int) $response->rating < 4)) {
            return response()->json([
                'error' => 'Only high-rating feedback with testimonial permission can be approved.',
            ], 422);
        }

        $response->fill([
            'review_status' => $data['review_status'] ?? $response->review_status,
            'testimonial_status' => $data['testimonial_status'] ?? $response->testimonial_status,
            'retention_notes' => array_key_exists('retention_notes', $data) ? $data['retention_notes'] : $response->retention_notes,
            'assigned_to' => array_key_exists('assigned_to', $data) ? $data['assigned_to'] : $response->assigned_to,
            'follow_up_due_at' => array_key_exists('follow_up_due_at', $data) ? $data['follow_up_due_at'] : $response->follow_up_due_at,
            'reviewed_by' => Auth::id(),
            'reviewed_at' => now(),
        ]);

        if (in_array($response->review_status, ['Resolved', 'Closed'], true)) {
            $response->follow_up_required = false;
        }

        $response->save();

        if ($response->booking) {
            PostEventLifecycleService::refresh($response->booking);
        }

        app(OperationalBroadcastService::class)
            ->staffQueueChanged('feedback', 'feedback_response', $response->id, 'updated', 'Feedback review updated.');

        return response()->json([
            'message' => 'Feedback review updated.',
            'response' => $response->fresh(),
        ]);
    }
}
