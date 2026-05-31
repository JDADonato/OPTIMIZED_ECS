<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Conversation;
use App\Services\OperationalBroadcastService;
use App\Support\CustomerIdentity;
use App\Support\ResourceVersion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Handles notification retrieval and management for all user roles.
 * Uses Laravel's built-in notification system with the database channel.
 */
class NotificationController extends Controller
{
    /**
     * Get all notifications for the authenticated user.
     * Returns the most recent 50 notifications.
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        $query = $user->notifications()->latest();
        $latestNotificationId = (clone $query)
            ->orderByDesc('created_at')
            ->value('id');
        $versionMeta = ResourceVersion::make(
            (clone $query)->count(),
            collect([(clone $query)->max('created_at'), (clone $query)->max('read_at')])->filter()->max(),
            $latestNotificationId
        );

        if (ResourceVersion::matches($request, $versionMeta)) {
            return ResourceVersion::unchanged($versionMeta);
        }

        if ($request->boolean('paginated') || $request->has('page') || $request->has('per_page')) {
            $perPage = min(max((int) $request->query('per_page', 25), 1), 75);
            $paginator = $query->paginate($perPage);
            $items = collect($paginator->items());
            $context = $this->notificationContext($items);

            return response()->json([
                'data' => $items->map(fn ($notification) => $this->formatNotification($notification, $context))->values(),
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

        $notifications = $query->take(50)->get();
        $context = $this->notificationContext($notifications);

        return response()->json($notifications->map(fn ($notification) => $this->formatNotification($notification, $context)));
    }

    private function formatNotification($notification, array $context): array
    {
        $type = $notification->data['type'] ?? 'general';
        $message = $notification->data['message'] ?? '';
        $priority = $notification->data['priority'] ?? $this->notificationPriority($type, $message);
        $category = $notification->data['category'] ?? $this->notificationCategory($type, $message);

        return [
            'id' => $notification->id,
            'type' => $type,
            'title' => $notification->data['title'] ?? null,
            'message' => $message,
            'message_preview' => $notification->data['message_preview'] ?? null,
            'conversation_id' => $this->notificationConversationId($notification->data),
            'staff_name' => $notification->data['staff_name'] ?? null,
            'booking_id' => $this->notificationBookingId($notification->data),
            'target_type' => $notification->data['target_type'] ?? (isset($notification->data['booking_id']) ? 'booking' : null),
            'target_id' => $notification->data['target_id'] ?? ($notification->data['booking_id'] ?? null),
            'action_url' => $notification->data['action_url'] ?? null,
            ...$this->notificationCustomerContext($notification->data, $context),
            'priority' => $priority,
            'category' => $category,
            'read_at' => $notification->read_at,
            'created_at' => $notification->created_at->toISOString(),
            'time_ago' => $notification->created_at->diffForHumans(),
        ];
    }

    private function notificationContext($notifications): array
    {
        $items = collect($notifications);
        $bookingIds = $items
            ->map(fn ($notification) => $this->notificationBookingId($notification->data))
            ->filter()
            ->unique()
            ->values();
        $conversationIds = $items
            ->map(fn ($notification) => $this->notificationConversationId($notification->data))
            ->filter()
            ->unique()
            ->values();

        return [
            'bookings' => $bookingIds->isEmpty()
                ? collect()
                : Booking::query()
                    ->select(['id', 'user_id', 'client_full_name', 'client_email', 'client_phone'])
                    ->with('user:id,full_name,username,email,phone,account_status')
                    ->whereIn('id', $bookingIds)
                    ->get()
                    ->keyBy('id'),
            'conversations' => $conversationIds->isEmpty()
                ? collect()
                : Conversation::query()
                    ->select(['id', 'client_id', 'booking_id'])
                    ->with([
                        'client:id,full_name,username,email,phone,account_status',
                        'booking:id,user_id,client_full_name,client_email,client_phone',
                        'booking.user:id,full_name,username,email,phone,account_status',
                    ])
                    ->whereIn('id', $conversationIds)
                    ->get()
                    ->keyBy('id'),
        ];
    }

    private function notificationBookingId(array $data): ?int
    {
        $bookingId = $data['booking_id'] ?? null;
        if (! $bookingId && ($data['target_type'] ?? null) === 'booking') {
            $bookingId = $data['target_id'] ?? null;
        }

        return $bookingId ? (int) $bookingId : null;
    }

    private function notificationConversationId(array $data): ?int
    {
        $conversationId = $data['conversation_id'] ?? null;
        if (! $conversationId && ($data['target_type'] ?? null) === 'conversation') {
            $conversationId = $data['target_id'] ?? null;
        }

        return $conversationId ? (int) $conversationId : null;
    }

    private function notificationCustomerContext(array $data, array $context): array
    {
        $customerId = $data['customer_id'] ?? $data['client_id'] ?? null;
        $customerName = $data['customer_name'] ?? $data['client_name'] ?? $data['client_full_name'] ?? null;
        $customerEmail = $data['customer_email'] ?? $data['client_email'] ?? null;
        $customerPhone = $data['customer_phone'] ?? $data['client_phone'] ?? null;

        $booking = $context['bookings']->get($this->notificationBookingId($data));
        $identity = null;
        if ($booking) {
            $identity = CustomerIdentity::forBooking($booking);
            $customerId ??= $booking->user_id ?: $booking->user?->id;
            $customerName ??= $identity['booking_contact']['name'];
            $customerEmail ??= $identity['booking_contact']['email'];
            $customerPhone ??= $identity['booking_contact']['phone'];
        }

        $conversation = $context['conversations']->get($this->notificationConversationId($data));
        if ($conversation) {
            $account = CustomerIdentity::accountForUser($conversation->client, $conversation->client_id);
            $bookingContact = $conversation->booking ? CustomerIdentity::contactForBooking($conversation->booking, $account) : null;
            $identity = [
                'customer_account' => [
                    ...$account,
                    'email' => $conversation->client?->email,
                ],
                'booking_contact' => $bookingContact,
                'has_different_booking_contact' => $bookingContact ? CustomerIdentity::differs($account, $bookingContact) : false,
            ];
            $customerId ??= $conversation->client_id ?: ($conversation->booking?->user_id ?: $conversation->booking?->user?->id);
            $customerName ??= $identity['customer_account']['name'];
            $customerEmail ??= $identity['customer_account']['email'] ?: ($identity['booking_contact']['email'] ?? null);
            $customerPhone ??= $identity['customer_account']['phone'] ?: ($identity['booking_contact']['phone'] ?? null);
        }

        return [
            'customer_id' => $customerId ? (int) $customerId : null,
            'customer_name' => $customerName,
            'customer_email' => $customerEmail,
            'customer_phone' => $customerPhone,
            'customer_account' => $identity['customer_account'] ?? null,
            'booking_contact' => $identity['booking_contact'] ?? null,
            'has_different_booking_contact' => $identity['has_different_booking_contact'] ?? false,
        ];
    }

    /**
     * Get the count of unread notifications.
     */
    public function unreadCount()
    {
        $count = Auth::user()->unreadNotifications()->count();

        return response()->json(['count' => $count]);
    }

    /**
     * Mark a specific notification as read.
     */
    public function markAsRead(string $id)
    {
        $user = Auth::user();
        $notification = $user->notifications()->findOrFail($id);
        $notification->markAsRead();
        $this->broadcastNotificationChange($user, $id, 'read');

        return response()->json(['success' => true]);
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllAsRead()
    {
        $user = Auth::user();
        $user->unreadNotifications->markAsRead();
        $this->broadcastNotificationChange($user, null, 'read_all');

        return response()->json(['success' => true]);
    }

    /**
     * Remove a notification from the authenticated user's list.
     */
    public function destroy(string $id)
    {
        $user = Auth::user();
        $notification = $user->notifications()->findOrFail($id);
        $notification->delete();
        $this->broadcastNotificationChange($user, $id, 'dismissed');

        return response()->json(['success' => true]);
    }

    /**
     * Remove all read notifications from the authenticated user's list.
     */
    public function destroyRead()
    {
        $user = Auth::user();
        $deleted = $user->readNotifications()->delete();
        $this->broadcastNotificationChange($user, null, 'dismissed_read');

        return response()->json(['success' => true, 'deleted' => $deleted]);
    }

    private function broadcastNotificationChange($user, ?string $id, string $action): void
    {
        $channels = match ($user->role) {
            'Client' => ['client.'.$user->id],
            'Admin' => ['admin.dashboard'],
            'Marketing' => ['marketing.dashboard', 'staff.queue'],
            'Accounting' => ['accounting.dashboard'],
            default => [],
        };

        app(OperationalBroadcastService::class)
            ->changed('notifications', 'notification', $id, $action, null, $channels);
    }

    private function notificationPriority(string $type, string $message): string
    {
        $text = strtolower($type.' '.$message);

        if (str_contains($text, 'failed') || str_contains($text, 'rejected') || str_contains($text, 'overdue') || str_contains($text, 'refund')) {
            return 'urgent';
        }

        if (str_contains($text, 'new_booking') || str_contains($text, 'clarification') || str_contains($text, 'payment') || str_contains($text, 'transfer')) {
            return 'action';
        }

        return 'info';
    }

    private function notificationCategory(string $type, string $message): string
    {
        $text = strtolower($type.' '.$message);

        if (str_contains($text, 'booking') || str_contains($text, 'event')) {
            return 'booking';
        }
        if (str_contains($text, 'payment') || str_contains($text, 'refund')) {
            return 'finance';
        }
        if (str_contains($text, 'chat') || str_contains($text, 'message')) {
            return 'message';
        }
        if (str_contains($text, 'feedback') || str_contains($text, 'testimonial')) {
            return 'feedback';
        }

        return 'update';
    }
}
