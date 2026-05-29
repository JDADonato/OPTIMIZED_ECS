<?php

namespace App\Http\Controllers;

use App\Services\OperationalBroadcastService;
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

        $format = function ($notification) {
                $type = $notification->data['type'] ?? 'general';
                $message = $notification->data['message'] ?? '';
                $priority = $notification->data['priority'] ?? $this->notificationPriority($type, $message);
                $category = $notification->data['category'] ?? $this->notificationCategory($type, $message);

                return [
                    'id' => $notification->id,
                    'type' => $type,
                    'message' => $message,
                    'booking_id' => $notification->data['booking_id'] ?? null,
                    'target_type' => $notification->data['target_type'] ?? (isset($notification->data['booking_id']) ? 'booking' : null),
                    'target_id' => $notification->data['target_id'] ?? ($notification->data['booking_id'] ?? null),
                    'action_url' => $notification->data['action_url'] ?? null,
                    'priority' => $priority,
                    'category' => $category,
                    'read_at' => $notification->read_at,
                    'created_at' => $notification->created_at->toISOString(),
                    'time_ago' => $notification->created_at->diffForHumans(),
                ];
            };

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

        $notifications = $query->take(50)->get()->map($format);

        return response()->json($notifications);
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

    private function broadcastNotificationChange($user, ?string $id, string $action): void
    {
        $channels = match ($user->role) {
            'Client' => ['client.' . $user->id],
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
        $text = strtolower($type . ' ' . $message);

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
        $text = strtolower($type . ' ' . $message);

        if (str_contains($text, 'booking') || str_contains($text, 'event')) return 'booking';
        if (str_contains($text, 'payment') || str_contains($text, 'refund')) return 'finance';
        if (str_contains($text, 'chat') || str_contains($text, 'message')) return 'message';
        if (str_contains($text, 'feedback') || str_contains($text, 'testimonial')) return 'feedback';

        return 'update';
    }
}
