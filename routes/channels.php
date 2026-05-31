<?php

use App\Models\Booking;
use App\Models\Conversation;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
|
| Phase 2: WebSocket channel authorization rules for Laravel Reverb.
|
*/

/**
 * Private conversation channel.
 * Only the client who owns the conversation or the assigned staff
 * (or any Marketing/Admin staff for unassigned ones) can listen.
 */
Broadcast::channel('conversation.{conversationId}', function ($user, $conversationId) {
    $conversation = Conversation::find($conversationId);

    if (! $conversation) {
        return false;
    }

    // Client owns the conversation
    if ($user->id === $conversation->client_id) {
        return true;
    }

    // Staff is assigned to the conversation
    if ($user->id === $conversation->staff_id) {
        return true;
    }

    // Any Marketing/Admin staff can listen (for unassigned preview)
    if (in_array($user->role, ['Marketing', 'Admin'])) {
        return true;
    }

    return false;
});

/**
 * Staff queue channel.
 * Only Marketing and Admin staff can listen for new/unassigned conversations.
 */
Broadcast::channel('staff.queue', function ($user) {
    return in_array($user->role, ['Marketing', 'Admin']);
});

/**
 * Dashboard sync channels
 */
Broadcast::channel('marketing.dashboard', function ($user) {
    return in_array($user->role, ['Marketing', 'Admin']);
});

Broadcast::channel('accounting.dashboard', function ($user) {
    return in_array($user->role, ['Accounting', 'Admin']);
});

Broadcast::channel('admin.dashboard', function ($user) {
    return $user->role === 'Admin';
});

Broadcast::channel('booking.{bookingId}', function ($user, $bookingId) {
    $booking = Booking::query()->select(['id', 'user_id'])->find($bookingId);

    if (! $booking) {
        return false;
    }

    if ((int) $user->id === (int) $booking->user_id) {
        return true;
    }

    return in_array($user->role, ['Marketing', 'Accounting', 'Admin'], true);
});

Broadcast::channel('client.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});
