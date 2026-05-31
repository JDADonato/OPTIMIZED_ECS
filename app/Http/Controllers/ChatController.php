<?php

namespace App\Http\Controllers;

use App\Events\ConversationClaimed;
use App\Events\ConversationCreated;
use App\Events\MessageSent;
use App\Models\Booking;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\User;
use App\Notifications\NewChatMessageNotification;
use App\Services\ChatModerationService;
use App\Services\NotificationRecipientService;
use App\Services\OperationalBroadcastService;
use App\Support\CustomerIdentity;
use App\Support\ResourceVersion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\QueryException;
use Illuminate\Support\Str;

/**
 * Phase 2: WebSocket-powered Ticket/Claiming Chat Controller.
 *
 * Replaces the polling-based MessageController with a conversation-centric
 * approach. Clients send messages into a general queue; Marketing staff
 * claim and handle conversations individually.
 */
class ChatController extends Controller
{
    // ─────────────────────────────────────────────
    //  Conversation Listing
    // ─────────────────────────────────────────────

    /**
     * GET /api/chat/conversations
     *
     * Returns conversations based on the user's role:
     * - Client: their own conversations
     * - Marketing/Admin: two lists (unassigned + my active chats)
     */
    public function conversations(Request $request)
    {
        $user = Auth::user();
        $limit = $this->pageLimit($request);
        $versionQuery = $user->role === 'Client'
            ? Conversation::query()->where('client_id', $user->id)
            : Conversation::query();
        $conversationIds = (clone $versionQuery)->pluck('id');
        $messageQuery = Message::query()->when($conversationIds->isNotEmpty(), fn ($query) => $query->whereIn('conversation_id', $conversationIds), fn ($query) => $query->whereRaw('1=0'));
        $versionMeta = ResourceVersion::make(
            $conversationIds->count() + (clone $messageQuery)->count(),
            collect([(clone $versionQuery)->max('updated_at'), (clone $messageQuery)->max('updated_at')])->filter()->max(),
            collect([$conversationIds->max(), (clone $messageQuery)->max('id')])->filter()->max()
        );

        if (ResourceVersion::matches($request, $versionMeta)) {
            return ResourceVersion::unchanged($versionMeta);
        }

        if ($user->role === 'Client') {
            return response()->json([
                'conversations' => $this->getClientConversations($user, $limit),
                'meta' => [
                    ...$versionMeta,
                    'changed' => true,
                ],
            ]);
        }

        // Staff gets both lists
        $payload = [
            'unassigned' => $this->getUnassignedQueue($limit),
            'my_chats' => $this->getMyActiveChats($user, $limit),
        ];

        if ($user->role === 'Admin') {
            $adminLists = $this->getAdminOversightChats($user, $limit);
            $payload = array_merge($payload, $adminLists);
        }

        $payload['meta'] = [
            ...$versionMeta,
            'changed' => true,
        ];

        return response()->json($payload);
    }

    /**
     * GET /api/chat/unassigned
     *
     * Fetch conversations where staff_id is null (the unassigned queue).
     * Only accessible by Marketing/Admin.
     */
    public function unassigned(Request $request)
    {
        return response()->json($this->getUnassignedQueue($this->pageLimit($request)));
    }

    /**
     * GET /api/chat/my-chats
     *
     * Fetch active conversations claimed by the authenticated staff member.
     */
    public function myChats(Request $request)
    {
        $user = Auth::user();

        return response()->json($this->getMyActiveChats($user, $this->pageLimit($request)));
    }

    // ─────────────────────────────────────────────
    //  Messages
    // ─────────────────────────────────────────────

    /**
     * GET /api/chat/conversations/{conversation}/messages
     *
     * Fetch all messages for a given conversation.
     * Authorization: user must be the client or the assigned staff (or any staff for unassigned).
     */
    public function messages(Request $request, Conversation $conversation)
    {
        $user = Auth::user();
        $this->authorizeConversationAccess($user, $conversation);

        $limit = $this->pageLimit($request, 20, 75);
        $query = Message::query()
            ->where('conversation_id', $conversation->id)
            ->with('sender:id,username,role');
        $isDeltaSync = $request->filled('after_id');

        if ($isDeltaSync) {
            $query->where('id', '>', (int) $request->query('after_id'))
                ->oldest('id');
        } else {
            $query->latest('id');

            if ($request->filled('before_id')) {
                $query->where('id', '<', (int) $request->query('before_id'));
            }
        }

        $rows = $query->limit($limit + 1)->get();
        $hasMore = $rows->count() > $limit;
        $limitedRows = $rows->take($limit);
        $messages = ($isDeltaSync ? $limitedRows : $limitedRows->reverse())
            ->values()
            ->map(fn ($msg) => $this->formatMessage($msg, $user));

        // Monitoring should not steal unread state from the assigned owner.
        if ($user->role === 'Client' || $this->canReplyToConversation($user, $conversation)) {
            $conversation->messages()
                ->where('sender_id', '!=', $user->id)
                ->whereNull('read_at')
                ->update(['read_at' => now()]);
        }

        return response()->json([
            'data' => $messages,
            'pagination' => [
                'has_more' => $hasMore,
                'before_id' => $messages->first()['id'] ?? null,
                'after_id' => $messages->last()['id'] ?? null,
            ],
        ]);
    }

    /**
     * POST /api/chat/conversations/{conversation}/messages
     *
     * Send a message within a conversation and broadcast it via Reverb.
     */
    public function sendMessage(Request $request, Conversation $conversation)
    {
        $request->validate([
            'message' => 'required|string|max:5000',
            'client_temp_id' => 'nullable|string|max:80',
        ]);

        $user = Auth::user();
        $clientTempId = $this->clientTempId($request);
        $this->authorizeConversationAccess($user, $conversation);

        if ($this->hasInactiveClient($conversation)) {
            return response()->json([
                'error' => 'This conversation is archived because the customer account is deactivated.',
            ], 403);
        }

        // Staff can only send if they own, collaborate on, or observe this conversation.
        if (in_array($user->role, ['Marketing', 'Admin']) && ! $this->canReplyToConversation($user, $conversation)) {
            return response()->json([
                'error' => 'You must claim this conversation before sending messages.',
            ], 403);
        }

        if ($response = $this->blockedChatMessageResponse($request->input('message'))) {
            return $response;
        }

        [$message, $wasCreated] = $this->createChatMessage($conversation, $user, $request->message, $clientTempId);

        $message->load('sender:id,username,role');

        if (! $wasCreated) {
            return response()->json($this->formatMessage($message, $user), 200);
        }

        // Broadcast the message to the conversation channel. If Reverb is offline,
        // message delivery still succeeds and polling/refresh can catch up.
        $this->broadcastSafely(new MessageSent($message), true);
        app(OperationalBroadcastService::class)
            ->staffQueueChanged('chat', 'message', $message->id, 'sent', 'New chat message.');

        // ── Step 4: Email notification with 15-minute cooldown ──
        // Only send when staff replies to a client (not the other way around)
        if (in_array($user->role, ['Marketing', 'Admin'])) {
            $client = $conversation->client;
            if ($client && $client->isReachableForNotifications()) {
                $cacheKey = "chat_email_cooldown:{$conversation->id}";

                if (! Cache::has($cacheKey)) {
                    // Dispatch the queued email notification
                    app(NotificationRecipientService::class)
                        ->sendToUser($client, new NewChatMessageNotification($message, $conversation, $user), 'chat_message_email');

                    // Set the 15-minute cooldown
                    Cache::put($cacheKey, true, now()->addMinutes(15));
                }
            }
        }

        return response()->json($this->formatMessage($message, $user), 201);
    }

    // ─────────────────────────────────────────────
    //  Client: Start a Conversation
    // ─────────────────────────────────────────────

    /**
     * POST /api/chat/conversations
     *
     * Client starts a new conversation (or resumes their existing active one).
     * The first message is included in the request.
     */
    public function startConversation(Request $request)
    {
        $request->validate([
            'message' => 'required|string|max:5000',
            'booking_id' => 'nullable|integer|exists:bookings,id',
            'client_temp_id' => 'nullable|string|max:80',
        ]);

        $user = Auth::user();
        $clientTempId = $this->clientTempId($request);

        if ($user->role !== 'Client') {
            return response()->json(['error' => 'Only clients can start conversations.'], 403);
        }

        if (! $user->isActive()) {
            return response()->json(['error' => 'This account is deactivated.'], 403);
        }

        $bookingId = $request->input('booking_id');
        if ($bookingId && ! Booking::where('id', $bookingId)->where('user_id', $user->id)->exists()) {
            return response()->json(['error' => 'Choose one of your own bookings for this conversation.'], 422);
        }

        if ($response = $this->blockedChatMessageResponse($request->input('message'))) {
            return $response;
        }

        // Check if the client already has an active conversation for this booking or general inquiry.
        $conversation = Conversation::where('client_id', $user->id)
            ->where('status', 'active')
            ->when($bookingId, fn ($query) => $query->where('booking_id', $bookingId), fn ($query) => $query->whereNull('booking_id'))
            ->first();

        $isNew = false;
        if (! $conversation) {
            $conversation = Conversation::create([
                'client_id' => $user->id,
                'booking_id' => $bookingId,
                'status' => 'active',
            ]);
            $isNew = true;
        }

        // Create the first message
        [$message, $wasCreated] = $this->createChatMessage($conversation, $user, $request->message, $clientTempId);

        $message->load('sender:id,username,role');

        if (! $wasCreated) {
            return response()->json([
                'conversation' => [
                    'id' => $conversation->id,
                    'client_id' => $conversation->client_id,
                    'staff_id' => $conversation->staff_id,
                    'booking_id' => $conversation->booking_id,
                    'status' => $conversation->status,
                ],
                'message' => $this->formatMessage($message, $user),
            ], 200);
        }

        // Broadcast events. Fail softly so an offline Reverb server does not block chat.
        if ($isNew) {
            $conversation->load('client:id,full_name,username,email');
            $this->broadcastSafely(new ConversationCreated($conversation));
        }
        $this->broadcastSafely(new MessageSent($message), true);
        app(OperationalBroadcastService::class)
            ->staffQueueChanged('chat', 'conversation', $conversation->id, $isNew ? 'created' : 'updated', 'Conversation updated.');

        return response()->json([
            'conversation' => [
                'id' => $conversation->id,
                'client_id' => $conversation->client_id,
                'staff_id' => $conversation->staff_id,
                'booking_id' => $conversation->booking_id,
                'status' => $conversation->status,
            ],
            'message' => $this->formatMessage($message, $user),
        ], $isNew ? 201 : 200);
    }

    // ─────────────────────────────────────────────
    //  Staff: Claim & Resolve
    // ─────────────────────────────────────────────

    /**
     * POST /api/chat/conversations/{conversation}/claim
     *
     * Staff claims an unassigned conversation.
     * Uses optimistic locking to prevent two staff from claiming simultaneously.
     */
    public function claim(Conversation $conversation)
    {
        $user = Auth::user();

        if (! in_array($user->role, ['Marketing', 'Admin'])) {
            return response()->json(['error' => 'Only staff can claim conversations.'], 403);
        }

        if ($this->hasInactiveClient($conversation)) {
            return response()->json(['error' => 'This conversation is archived because the customer account is deactivated.'], 403);
        }

        if ($conversation->isClaimed()) {
            return response()->json([
                'error' => 'This conversation has already been claimed by '.($conversation->staff->username ?? 'another staff member').'.',
            ], 409); // 409 Conflict
        }

        // Atomically claim (prevents race conditions)
        $updated = Conversation::where('id', $conversation->id)
            ->whereNull('staff_id')
            ->update(['staff_id' => $user->id]);

        if (! $updated) {
            return response()->json([
                'error' => 'This conversation was just claimed by another staff member.',
            ], 409);
        }

        $conversation->refresh();
        $this->upsertParticipant($conversation, $user->id, 'owner', $user->id);
        $conversation->load(['client:id,full_name,username,email', 'staff:id,username', 'participants.user:id,username,full_name,role']);

        // Broadcast to all staff and the client. Fail softly when Reverb is offline.
        $this->broadcastSafely(new ConversationClaimed($conversation));
        app(OperationalBroadcastService::class)
            ->staffQueueChanged('chat', 'conversation', $conversation->id, 'claimed', 'Conversation claimed.');

        return response()->json([
            'success' => true,
            'conversation' => $this->formatConversation($conversation->fresh(['client', 'staff', 'booking', 'latestMessage', 'participants.user']), $user),
        ]);
    }

    /**
     * POST /api/chat/conversations/{conversation}/resolve
     *
     * Staff marks a conversation as resolved (closed).
     */
    public function resolve(Conversation $conversation)
    {
        $user = Auth::user();

        if (! in_array($user->role, ['Marketing', 'Admin'])) {
            return response()->json(['error' => 'Only staff can resolve conversations.'], 403);
        }

        if (! $this->canResolveConversation($user, $conversation)) {
            return response()->json(['error' => 'You can only resolve your own claimed conversations.'], 403);
        }

        $conversation->update(['status' => 'resolved']);
        app(OperationalBroadcastService::class)
            ->staffQueueChanged('chat', 'conversation', $conversation->id, 'resolved', 'Conversation resolved.');

        return response()->json([
            'success' => true,
            'message' => 'Conversation resolved successfully.',
        ]);
    }

    public function reopen(Conversation $conversation)
    {
        $user = Auth::user();
        $this->authorizeConversationAccess($user, $conversation);

        if (! in_array($user->role, ['Marketing', 'Admin']) && $user->id !== $conversation->client_id) {
            return response()->json(['error' => 'You cannot reopen this conversation.'], 403);
        }

        if ($this->hasInactiveClient($conversation)) {
            return response()->json(['error' => 'This conversation cannot be reopened while the customer account is deactivated.'], 403);
        }

        $conversation->update([
            'status' => 'active',
            'reopened_at' => now(),
        ]);

        $this->addSystemMessage($conversation, "{$user->username} reopened this conversation.", [
            'actor_id' => $user->id,
            'actor_role' => $user->role,
        ]);
        app(OperationalBroadcastService::class)
            ->staffQueueChanged('chat', 'conversation', $conversation->id, 'reopened', 'Conversation reopened.');

        return response()->json([
            'message' => 'Conversation reopened.',
            'conversation' => $this->formatConversation($conversation->fresh(['client', 'staff', 'booking', 'latestMessage']), $user),
        ]);
    }

    public function adminJoin(Conversation $conversation)
    {
        $user = Auth::user();

        if ($user->role !== 'Admin') {
            return response()->json(['error' => 'Only admins can join for monitoring.'], 403);
        }

        if ($this->hasInactiveClient($conversation)) {
            return response()->json(['error' => 'This conversation is archived because the customer account is deactivated.'], 403);
        }

        $conversation->update(['joined_by_admin_at' => now()]);
        $this->upsertParticipant($conversation, $user->id, 'admin_observer', $user->id);

        $this->addSystemMessage($conversation, 'Admin joined this conversation for support.', [
            'actor_id' => $user->id,
            'actor_role' => $user->role,
        ]);
        app(OperationalBroadcastService::class)
            ->staffQueueChanged('chat', 'conversation', $conversation->id, 'admin_joined', 'Admin joined conversation.');

        return response()->json([
            'message' => 'Admin joined the conversation.',
            'conversation' => $this->formatConversation($conversation->fresh(['client', 'staff', 'booking', 'latestMessage', 'participants.user']), $user),
        ]);
    }

    public function internalNotes(Request $request, Conversation $conversation)
    {
        $user = Auth::user();

        if (! in_array($user->role, ['Marketing', 'Admin'])) {
            return response()->json(['error' => 'Only staff can update internal notes.'], 403);
        }

        $request->validate([
            'internal_notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $conversation->update(['internal_notes' => $request->input('internal_notes')]);
        app(OperationalBroadcastService::class)
            ->staffQueueChanged('chat', 'conversation', $conversation->id, 'internal_notes_updated', 'Conversation note updated.');

        return response()->json(['message' => 'Internal notes saved.', 'internal_notes' => $conversation->internal_notes]);
    }

    /**
     * POST /api/chat/conversations/{conversation}/transfer
     *
     * Staff transfers a conversation to another staff member.
     */
    public function transfer(Request $request, Conversation $conversation)
    {
        return $this->transferOwner($request, $conversation);
    }

    public function transferOwner(Request $request, Conversation $conversation)
    {
        $request->validate([
            'new_staff_id' => 'required|exists:users,id',
            'keep_previous_owner' => 'sometimes|boolean',
        ]);

        $user = Auth::user();

        if (! in_array($user->role, ['Marketing', 'Admin'])) {
            return response()->json(['error' => 'Only staff can transfer conversations.'], 403);
        }

        if (! $this->canTransferConversation($user, $conversation)) {
            return response()->json(['error' => 'Only the owner or an admin can transfer this conversation.'], 403);
        }

        $newStaff = User::find($request->new_staff_id);
        if ($this->hasInactiveClient($conversation)) {
            return response()->json(['error' => 'This conversation is archived because the customer account is deactivated.'], 403);
        }

        if ($newStaff->role !== 'Marketing' || ! $newStaff->isActive()) {
            return response()->json(['error' => 'Can only transfer ownership to Marketing staff.'], 422);
        }

        DB::transaction(function () use ($conversation, $newStaff, $user, $request) {
            $previousOwnerId = $conversation->staff_id;

            $conversation->update(['staff_id' => $newStaff->id]);

            $this->softRemoveParticipants(
                ConversationParticipant::where('conversation_id', $conversation->id)->where('role', 'owner'),
                'ownership_changed',
                $user->id
            );

            if ($previousOwnerId && $previousOwnerId !== $newStaff->id && $request->boolean('keep_previous_owner')) {
                $this->upsertParticipant($conversation, $previousOwnerId, 'collaborator', $user->id);
            } elseif ($previousOwnerId && $previousOwnerId !== $newStaff->id) {
                $this->softRemoveParticipants(
                    ConversationParticipant::where('conversation_id', $conversation->id)
                        ->where('user_id', $previousOwnerId)
                        ->where('role', 'collaborator'),
                    'ownership_changed',
                    $user->id
                );
            }

            $this->upsertParticipant($conversation, $newStaff->id, 'owner', $user->id);
        });

        $conversation->refresh();
        $conversation->load(['client:id,full_name,username,email', 'staff:id,username', 'participants.user:id,username,full_name,role']);

        // Broadcast claim event so UI updates for everyone. Fail softly when Reverb is offline.
        $this->broadcastSafely(new ConversationClaimed($conversation));
        app(OperationalBroadcastService::class)
            ->staffQueueChanged('chat', 'conversation', $conversation->id, 'transferred', 'Conversation transferred.');

        return response()->json([
            'success' => true,
            'message' => 'Conversation transferred successfully.',
            'conversation' => $this->formatConversation($conversation, $user),
        ]);
    }

    public function addCollaborator(Request $request, Conversation $conversation)
    {
        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
        ]);

        $user = Auth::user();

        if (! $this->canInviteConversation($user, $conversation)) {
            return response()->json(['error' => 'Only the owner or an admin can invite staff.'], 403);
        }

        $staff = User::find($data['user_id']);
        if ($this->hasInactiveClient($conversation)) {
            return response()->json(['error' => 'This conversation is archived because the customer account is deactivated.'], 403);
        }

        if ($staff->role !== 'Marketing' || ! $staff->isActive()) {
            return response()->json(['error' => 'Only Marketing staff can be added as collaborators.'], 422);
        }

        if ((int) $conversation->staff_id === (int) $staff->id) {
            return response()->json(['error' => 'The owner is already on this chat.'], 422);
        }

        $this->upsertParticipant($conversation, $staff->id, 'collaborator', $user->id);
        app(OperationalBroadcastService::class)
            ->staffQueueChanged('chat', 'conversation', $conversation->id, 'collaborator_added', 'Conversation collaborator added.');

        return response()->json([
            'success' => true,
            'message' => 'Collaborator added.',
            'conversation' => $this->formatConversation($conversation->fresh(['client', 'staff', 'booking', 'latestMessage', 'participants.user']), $user),
        ]);
    }

    public function removeCollaborator(Conversation $conversation, User $user)
    {
        $currentUser = Auth::user();

        if (! $this->canInviteConversation($currentUser, $conversation) && (int) $currentUser->id !== (int) $user->id) {
            return response()->json(['error' => 'You cannot remove this collaborator.'], 403);
        }

        if ((int) $conversation->staff_id === (int) $user->id) {
            return response()->json(['error' => 'Transfer ownership before removing the owner.'], 422);
        }

        $this->softRemoveParticipants(
            ConversationParticipant::where('conversation_id', $conversation->id)
                ->where('user_id', $user->id)
                ->where('role', 'collaborator'),
            'removed_by_staff',
            $currentUser->id
        );
        app(OperationalBroadcastService::class)
            ->staffQueueChanged('chat', 'conversation', $conversation->id, 'collaborator_removed', 'Conversation collaborator removed.');

        return response()->json([
            'success' => true,
            'message' => (int) $currentUser->id === (int) $user->id ? 'You left the chat.' : 'Collaborator removed.',
            'conversation' => $this->formatConversation($conversation->fresh(['client', 'staff', 'booking', 'latestMessage', 'participants.user']), $currentUser),
        ]);
    }

    public function updateMessage(Request $request, Message $message)
    {
        $user = Auth::user();
        $message->load('conversation');
        $this->authorizeConversationAccess($user, $message->conversation);

        if ($message->sender_id !== $user->id) {
            return response()->json(['error' => 'You can only edit your own messages.'], 403);
        }

        if ($message->created_at->lt(now()->subMinutes(15))) {
            return response()->json(['error' => 'Messages can only be edited within 15 minutes.'], 422);
        }

        if ($message->deleted_at) {
            return response()->json(['error' => 'Deleted messages cannot be edited.'], 422);
        }

        $request->validate([
            'message' => ['required', 'string', 'max:5000'],
        ]);

        if ($response = $this->blockedChatMessageResponse($request->input('message'))) {
            return $response;
        }

        $message->update([
            'message' => $request->input('message'),
            'edited_at' => now(),
        ]);

        $message->load('sender:id,username,role');
        app(OperationalBroadcastService::class)
            ->staffQueueChanged('chat', 'message', $message->id, 'edited', 'Chat message edited.');

        return response()->json($this->formatMessage($message, $user));
    }

    public function deleteMessage(Request $request, Message $message)
    {
        $user = Auth::user();
        $message->load('conversation');
        $this->authorizeConversationAccess($user, $message->conversation);

        $isOwnRecentMessage = $message->sender_id === $user->id && $message->created_at->gte(now()->subMinutes(15));
        $isModerator = $user->role === 'Admin' || ($user->role === 'Marketing' && (int) $message->conversation->staff_id === (int) $user->id);

        if (! $isOwnRecentMessage && ! $isModerator) {
            return response()->json(['error' => 'You cannot delete this message.'], 403);
        }

        $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $message->forceFill([
            'deleted_at' => now(),
            'deleted_by' => $user->id,
            'delete_reason' => $request->input('reason'),
        ])->save();
        app(OperationalBroadcastService::class)
            ->staffQueueChanged('chat', 'message', $message->id, 'deleted', 'Chat message deleted.');

        return response()->json([
            'message' => 'Message deleted.',
            'data' => $this->formatMessage($message->fresh('sender'), $user),
        ]);
    }

    // ─────────────────────────────────────────────
    //  Utility: Staff & Unread
    // ─────────────────────────────────────────────

    /**
     * GET /api/chat/staff/available
     */
    public function availableStaff()
    {
        $user = Auth::user();
        if (! in_array($user->role, ['Marketing', 'Admin'])) {
            return response()->json([]);
        }

        $staff = User::where('role', 'Marketing')
            ->where('id', '!=', $user->id)
            ->activeAccounts()
            ->select('id', 'username', 'role')
            ->get();

        return response()->json($staff);
    }

    /**
     * GET /api/chat/unread-count
     *
     * Returns the total unread message count for the authenticated user.
     */
    public function unreadCount()
    {
        $user = Auth::user();

        if ($user->role === 'Client') {
            // Count unread messages in the client's active conversations
            $count = Message::whereIn('conversation_id', function ($q) use ($user) {
                $q->select('id')
                    ->from('conversations')
                    ->where('client_id', $user->id)
                    ->where('status', 'active')
                    ->whereExists(function ($client) {
                        $client->selectRaw('1')
                            ->from('users')
                            ->whereColumn('users.id', 'conversations.client_id')
                            ->where(fn ($account) => $account
                                ->whereNull('users.account_status')
                                ->orWhere('users.account_status', 'active'));
                    });
            })
                ->where('sender_id', '!=', $user->id)
                ->whereNull('read_at')
                ->count();
        } else {
            // Staff: count unread across their claimed conversations
            $count = Message::whereIn('conversation_id', function ($q) use ($user) {
                $q->select('id')
                    ->from('conversations')
                    ->where('staff_id', $user->id)
                    ->where('status', 'active')
                    ->whereExists(function ($client) {
                        $client->selectRaw('1')
                            ->from('users')
                            ->whereColumn('users.id', 'conversations.client_id')
                            ->where(fn ($account) => $account
                                ->whereNull('users.account_status')
                                ->orWhere('users.account_status', 'active'));
                    });
            })
                ->where('sender_id', '!=', $user->id)
                ->whereNull('read_at')
                ->count();

            // Also count total unassigned conversations as "pending attention"
            $unassignedCount = Conversation::unassigned()->count();

            return response()->json([
                'count' => $count,
                'unassigned_count' => $unassignedCount,
            ]);
        }

        return response()->json(['count' => $count]);
    }

    /**
     * GET /api/chat/my-bookings
     *
     * Returns the client's bookings for sharing in chat (unchanged from original).
     */
    public function myBookings()
    {
        $user = Auth::user();

        if ($user->role !== 'Client') {
            return response()->json([]);
        }

        // Issue 4: Exclude cancelled and expired bookings from the chat share dropdown
        $bookings = Booking::where('user_id', $user->id)
            ->with('user:id,full_name,username,email,phone,account_status')
            ->whereNotIn('status', ['Cancelled', 'Canceled', 'Expired'])
            ->orderBy('event_date', 'desc')
            ->get()
            ->map(fn ($b) => [
                'id' => $b->id,
                'event_date' => $b->event_date,
                'event_time' => $b->event_time,
                'event_type' => $b->event_type,
                'pax' => $b->pax,
                'status' => $b->status,
                'total_cost' => $b->total_cost,
                'venue_city' => $b->venue_city,
                'client_full_name' => $b->client_full_name,
                ...CustomerIdentity::forBooking($b),
            ]);

        return response()->json($bookings);
    }

    // ─────────────────────────────────────────────
    //  Private Helpers
    // ─────────────────────────────────────────────

    /**
     * Authorize that a user can access a conversation.
     */
    private function authorizeConversationAccess($user, Conversation $conversation): void
    {
        $isClient = $user->id === $conversation->client_id;
        $isAssignedStaff = $user->id === $conversation->staff_id;
        $isParticipant = $conversation->participants()
            ->where('user_id', $user->id)
            ->whereIn('role', ['collaborator', 'admin_observer', 'owner'])
            ->exists();
        $isStaffViewingUnassigned = in_array($user->role, ['Marketing', 'Admin']) && is_null($conversation->staff_id);
        $isAdmin = $user->role === 'Admin';

        if (! $isClient && ! $isAssignedStaff && ! $isParticipant && ! $isStaffViewingUnassigned && ! $isAdmin) {
            abort(403, 'You do not have access to this conversation.');
        }
    }

    /**
     * Format a message for JSON response.
     */
    private function formatMessage($msg, $currentUser, ?string $clientTempId = null): array
    {
        // Convert created_at to Asia/Manila for display
        $localTime = $msg->created_at->setTimezone('Asia/Manila');

        $payload = [
            'id' => $msg->id,
            'conversation_id' => $msg->conversation_id,
            'sender_id' => $msg->sender_id,
            'message' => $msg->deleted_at ? 'Message deleted' : $msg->message,
            'message_type' => $msg->message_type ?? 'message',
            'is_mine' => $msg->sender_id === $currentUser->id,
            'read_at' => $msg->read_at,
            'edited_at' => $msg->edited_at,
            'deleted_at' => $msg->deleted_at,
            'delete_reason' => $msg->deleted_at && in_array($currentUser->role, ['Marketing', 'Admin']) ? $msg->delete_reason : null,
            'metadata' => $msg->metadata,
            'created_at' => $msg->created_at->toISOString(),
            'time' => $localTime->format('g:i A'),
            'sender_name' => $msg->sender->username ?? 'Unknown',
            'sender_role' => $msg->sender->role ?? 'Unknown',
            'is_booking_card' => str_starts_with($msg->message, '📋 BOOKING DETAILS'),
        ];

        if ($msg->client_temp_id || $clientTempId) {
            $payload['client_temp_id'] = $msg->client_temp_id ?: $clientTempId;
        }

        return $payload;
    }

    private function existingClientTempMessage(Conversation $conversation, int $senderId, ?string $clientTempId): ?Message
    {
        if (! $clientTempId) {
            return null;
        }

        return Message::query()
            ->with('sender:id,username,role')
            ->where('conversation_id', $conversation->id)
            ->where('sender_id', $senderId)
            ->where('client_temp_id', $clientTempId)
            ->first();
    }

    private function createChatMessage(Conversation $conversation, $sender, string $text, ?string $clientTempId): array
    {
        try {
            $message = Message::create([
                'conversation_id' => $conversation->id,
                'sender_id' => $sender->id,
                'client_temp_id' => $clientTempId,
                'receiver_id' => $this->messageReceiverId($conversation, $sender),
                'message' => $text,
            ]);
        } catch (QueryException $error) {
            if ($existing = $this->existingClientTempMessage($conversation, (int) $sender->id, $clientTempId)) {
                return [$existing, false];
            }

            throw $error;
        }

        $message->load('sender:id,username,role');

        return [$message, true];
    }

    private function clientTempId(Request $request): ?string
    {
        $clientTempId = trim((string) $request->input('client_temp_id', ''));

        return $clientTempId !== '' ? $clientTempId : null;
    }

    private function blockedChatMessageResponse(?string $message)
    {
        $moderation = app(ChatModerationService::class);
        $result = $moderation->inspect($message);

        if (! ($result['blocked'] ?? false)) {
            return null;
        }

        return response()->json($moderation->blockedPayload(Auth::user(), $result), 422);
    }

    private function broadcastSafely(object $event, bool $toOthers = false): void
    {
        try {
            $pendingBroadcast = broadcast($event);

            if ($toOthers) {
                $pendingBroadcast->toOthers();
            }

            unset($pendingBroadcast);
        } catch (\Throwable $e) {
            Log::warning('Realtime chat broadcast skipped.', [
                'event' => $event::class,
                'reason' => $e->getMessage(),
            ]);
        }
    }

    private function addSystemMessage(Conversation $conversation, string $text, array $metadata = []): Message
    {
        return Message::create([
            'conversation_id' => $conversation->id,
            'sender_id' => Auth::id() ?: $conversation->client_id,
            'receiver_id' => $conversation->client_id,
            'message' => $text,
            'message_type' => 'system',
            'metadata' => $metadata,
        ]);
    }

    private function messageReceiverId(Conversation $conversation, $sender): int
    {
        if ((int) $sender->id === (int) $conversation->client_id) {
            return (int) ($conversation->staff_id ?: $conversation->client_id);
        }

        return (int) $conversation->client_id;
    }

    private function formatConversation(Conversation $conv, $currentUser): array
    {
        $conv->loadMissing([
            'staff:id,username,full_name,role,account_status',
            'participants.user:id,username,full_name,role,account_status',
            'participantHistory.user:id,username,full_name,role,account_status',
        ]);
        $booking = $conv->booking;
        $owner = $conv->staff;
        $client = $conv->client;
        $clientIsDeactivated = $client && ! $client->isActive();
        $clientEmail = $client && ! $client->hasPlaceholderEmail() ? $client->email : null;
        $customerAccount = CustomerIdentity::accountForUser($client, $conv->client_id);
        $bookingContact = $booking ? CustomerIdentity::contactForBooking($booking, $customerAccount) : null;

        return [
            'id' => $conv->id,
            'client_id' => $conv->client_id,
            'client_name' => $customerAccount['name'],
            'client_email' => $clientEmail,
            'client_phone' => $client->phone ?? null,
            'customer_account' => [
                ...$customerAccount,
                'email' => $clientEmail,
            ],
            'booking_contact' => $bookingContact,
            'has_different_booking_contact' => $bookingContact ? CustomerIdentity::differs($customerAccount, $bookingContact) : false,
            'client_account_status' => $client->account_status ?? 'active',
            'client_is_deactivated' => $clientIsDeactivated,
            'client_status_label' => $clientIsDeactivated ? 'Deactivated customer' : null,
            'staff_id' => $conv->staff_id,
            'staff_name' => $conv->staff
                ? ($conv->staff->isActive() ? $conv->staff->username : 'Former staff: '.$conv->staff->username)
                : null,
            'owner' => $this->participantUser($owner, 'owner'),
            'collaborators' => $this->participantUsers($conv, 'collaborator'),
            'admin_observers' => $this->participantUsers($conv, 'admin_observer'),
            'former_participants' => $currentUser->role === 'Admin'
                ? $this->formerParticipantUsers($conv)
                : [],
            'can_reply' => ! $clientIsDeactivated && $this->canReplyToConversation($currentUser, $conv),
            'can_transfer' => ! $clientIsDeactivated && $this->canTransferConversation($currentUser, $conv),
            'can_resolve' => ! $clientIsDeactivated && $this->canResolveConversation($currentUser, $conv),
            'can_invite' => ! $clientIsDeactivated && $this->canInviteConversation($currentUser, $conv),
            'booking_id' => $conv->booking_id,
            'booking_label' => $booking ? ($booking->event_name ?: $booking->event_type ?: "Booking #{$booking->id}") : 'General inquiry',
            'booking_event_date' => $booking?->event_date,
            'booking_status' => $booking?->status,
            'conversation_context' => $booking && strtolower((string) $booking->status) === 'completed' ? 'Post-event' : 'Planning',
            'status' => $conv->status,
            'internal_notes' => in_array($currentUser->role, ['Marketing', 'Admin']) ? $conv->internal_notes : null,
            'last_message' => $conv->latestMessage
                ? Str::limit($conv->latestMessage->deleted_at ? 'Message deleted' : $conv->latestMessage->message, 60)
                : '',
            'last_message_id' => $conv->latestMessage?->id,
            'last_message_created_at' => $conv->latestMessage
                ? $conv->latestMessage->created_at?->toIso8601String()
                : $conv->created_at?->toIso8601String(),
            'last_message_time' => $conv->latestMessage
                ? $conv->latestMessage->created_at->diffForHumans()
                : $conv->created_at->diffForHumans(),
            'unread_count' => $conv->unread_count ?? 0,
        ];
    }

    /**
     * Get conversations in the unassigned queue.
     */
    private function pageLimit(Request $request, int $default = 25, int $max = 50): int
    {
        return min(max((int) $request->query('limit', $default), 1), $max);
    }

    private function getUnassignedQueue(int $limit = 25): array
    {
        return Conversation::unassigned()
            ->with(['client:id,full_name,username,email,phone,account_status,deactivated_at', 'booking:id,user_id,event_name,event_type,event_date,status,client_full_name,client_email,client_phone', 'latestMessage.sender:id,username', 'participants.user:id,username,full_name,role'])
            ->withCount(['messages as unread_count' => function ($q) {
                $q->whereNull('read_at');
            }])
            ->latest()
            ->limit($limit)
            ->get()
            ->map(fn ($conv) => $this->formatConversation($conv, Auth::user()))
            ->toArray();
    }

    /**
     * Get active conversations claimed by the given staff user.
     */
    private function getMyActiveChats($user, int $limit = 25): array
    {
        return Conversation::claimedBy($user->id)
            ->with(['client:id,full_name,username,email,phone,account_status,deactivated_at', 'staff:id,username,full_name,role,account_status', 'booking:id,user_id,event_name,event_type,event_date,status,client_full_name,client_email,client_phone', 'latestMessage.sender:id,username', 'participants.user:id,username,full_name,role,account_status'])
            ->withCount(['messages as unread_count' => function ($q) use ($user) {
                $q->where('sender_id', '!=', $user->id)->whereNull('read_at');
            }])
            ->latest()
            ->limit($limit)
            ->get()
            ->map(fn ($conv) => $this->formatConversation($conv, $user))
            ->toArray();
    }

    /**
     * Get conversations for a client user.
     */
    private function getClientConversations($user, int $limit = 10): array
    {
        return Conversation::where('client_id', $user->id)
            ->where('status', 'active')
            ->with(['client:id,full_name,username,email,phone,account_status,deactivated_at', 'staff:id,username,full_name,role,account_status', 'booking:id,user_id,event_name,event_type,event_date,status,client_full_name,client_email,client_phone', 'latestMessage.sender:id,username', 'participants.user:id,username,full_name,role,account_status'])
            ->withCount(['messages as unread_count' => function ($q) use ($user) {
                $q->where('sender_id', '!=', $user->id)->whereNull('read_at');
            }])
            ->latest()
            ->limit($limit)
            ->get()
            ->map(fn ($conv) => $this->formatConversation($conv, $user))
            ->toArray();
    }

    private function getAllStaffChats($user, int $limit = 25): array
    {
        return Conversation::query()
            ->withActiveClient()
            ->with(['client:id,full_name,username,email,phone,account_status,deactivated_at', 'staff:id,username,full_name,role,account_status', 'booking:id,user_id,event_name,event_type,event_date,status,client_full_name,client_email,client_phone', 'latestMessage.sender:id,username', 'participants.user:id,username,full_name,role,account_status'])
            ->withCount(['messages as unread_count' => function ($q) use ($user) {
                $q->where('sender_id', '!=', $user->id)->whereNull('read_at');
            }])
            ->latest()
            ->limit($limit)
            ->get()
            ->map(fn ($conv) => $this->formatConversation($conv, $user))
            ->toArray();
    }

    private function getAdminOversightChats($user, int $limit = 25): array
    {
        $baseRelations = ['client:id,full_name,username,email,phone,account_status,deactivated_at', 'staff:id,username,full_name,role,account_status', 'booking:id,user_id,event_name,event_type,event_date,status,client_full_name,client_email,client_phone', 'latestMessage.sender:id,username', 'participants.user:id,username,full_name,role,account_status'];
        $unreadCount = function ($q) use ($user) {
            $q->where('sender_id', '!=', $user->id)->whereNull('read_at');
        };

        $allActive = Conversation::query()
            ->where('status', 'active')
            ->withActiveClient()
            ->with($baseRelations)
            ->withCount(['messages as unread_count' => $unreadCount])
            ->latest()
            ->limit($limit)
            ->get();

        $needsAttention = $allActive
            ->filter(fn ($conv) => is_null($conv->staff_id) || (int) ($conv->unread_count ?? 0) > 0)
            ->values();

        $resolved = Conversation::query()
            ->where(function ($query) {
                $query->where('status', 'resolved')
                    ->orWhereHas('client', fn ($client) => $client->where('account_status', 'deactivated'));
            })
            ->with($baseRelations)
            ->withCount(['messages as unread_count' => $unreadCount])
            ->latest('updated_at')
            ->limit($limit)
            ->get();

        $resolvedToday = Conversation::query()
            ->where('status', 'resolved')
            ->whereDate('updated_at', now()->toDateString())
            ->count();

        return [
            'needs_attention' => $needsAttention
                ->map(fn ($conv) => $this->formatConversation($conv, $user))
                ->toArray(),
            'all_active' => $allActive
                ->map(fn ($conv) => $this->formatConversation($conv, $user))
                ->toArray(),
            'resolved' => $resolved
                ->map(fn ($conv) => $this->formatConversation($conv, $user))
                ->toArray(),
            'all_chats' => $allActive
                ->map(fn ($conv) => $this->formatConversation($conv, $user))
                ->toArray(),
            'summary' => [
                'open_conversations' => $allActive->count(),
                'needs_attention' => $needsAttention->count(),
                'unassigned' => $allActive->whereNull('staff_id')->count(),
                'resolved_today' => $resolvedToday,
            ],
        ];
    }

    private function upsertParticipant(Conversation $conversation, int $userId, string $role, ?int $joinedBy): ConversationParticipant
    {
        return ConversationParticipant::updateOrCreate(
            ['conversation_id' => $conversation->id, 'user_id' => $userId],
            [
                'role' => $role,
                'joined_by' => $joinedBy,
                'joined_at' => now(),
                'removed_at' => null,
                'removed_by' => null,
                'removal_reason' => null,
            ]
        );
    }

    private function formerParticipantUsers(Conversation $conversation): array
    {
        return $conversation->participantHistory
            ->whereNotNull('removed_at')
            ->map(function ($participant) {
                $user = $this->participantUser($participant->user, $participant->role);

                if (! $user) {
                    return null;
                }

                return array_merge($user, [
                    'participant_status_label' => $participant->user?->isActive() ? 'Former participant' : 'Former staff',
                    'removed_at' => optional($participant->removed_at)->toIso8601String(),
                    'removal_reason' => $participant->removal_reason,
                ]);
            })
            ->filter()
            ->values()
            ->toArray();
    }

    private function softRemoveParticipants($query, string $reason, ?int $removedBy): int
    {
        return $query->active()->update([
            'removed_at' => now(),
            'removed_by' => $removedBy,
            'removal_reason' => $reason,
        ]);
    }

    private function canReplyToConversation($user, Conversation $conversation): bool
    {
        if (! $user) {
            return false;
        }

        if ((int) $conversation->client_id === (int) $user->id) {
            return true;
        }

        if (is_null($conversation->staff_id)) {
            return false;
        }

        return (int) $conversation->staff_id === (int) $user->id
            || $conversation->participants()
                ->where('user_id', $user->id)
                ->whereIn('role', ['collaborator', 'admin_observer', 'owner'])
                ->exists();
    }

    private function canTransferConversation($user, Conversation $conversation): bool
    {
        return $user
            && in_array($user->role, ['Marketing', 'Admin'], true)
            && ($user->role === 'Admin' || (int) $conversation->staff_id === (int) $user->id);
    }

    private function canResolveConversation($user, Conversation $conversation): bool
    {
        return $this->canTransferConversation($user, $conversation);
    }

    private function canInviteConversation($user, Conversation $conversation): bool
    {
        return $this->canTransferConversation($user, $conversation);
    }

    private function participantUser(?User $user, string $role): ?array
    {
        if (! $user) {
            return null;
        }

        $name = $user->full_name ?: $user->username;

        return [
            'id' => $user->id,
            'name' => $user->isActive() ? $name : 'Former staff: '.$name,
            'username' => $user->username,
            'role' => $role,
            'user_role' => $user->role,
            'account_status' => $user->account_status ?? 'active',
        ];
    }

    private function participantUsers(Conversation $conversation, string $role): array
    {
        return $conversation->participants
            ->where('role', $role)
            ->whereNull('removed_at')
            ->map(fn ($participant) => $this->participantUser($participant->user, $role))
            ->filter()
            ->values()
            ->all();
    }

    private function hasInactiveClient(Conversation $conversation): bool
    {
        $conversation->loadMissing('client');

        return $conversation->client && ! $conversation->client->isActive();
    }
}
