<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Conversation;
use App\Models\EventPreparationTask;
use App\Models\FoodTasting;
use App\Services\EventPreparationService;
use App\Support\ApiResponse;
use App\Support\CustomerIdentity;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class OperationsController extends Controller
{
    private const READINESS_PRIORITY = ['payment', 'menu', 'headcount', 'venue', 'tasting', 'customer_messages'];

    private const TASK_GROUP_ORDER = ['Marketing', 'Accounting', 'Service prep', 'Customer'];

    public function preparationBoard(Request $request)
    {
        $query = $this->preparationBoardQuery($request);

        if ($request->boolean('paginated')) {
            $perPage = min(max((int) $request->query('per_page', 10), 1), 50);
            $bookings = $query->paginate($perPage);
            $rowFormatter = $request->boolean('lightweight')
                ? fn (Booking $booking) => $this->preparationListRow($booking)
                : fn (Booking $booking) => $this->preparationRow($booking);
            $rows = $bookings->getCollection()
                ->map($rowFormatter)
                ->values();

            return response()->json([
                'data' => $rows,
                'meta' => [
                    'current_page' => $bookings->currentPage(),
                    'last_page' => $bookings->lastPage(),
                    'per_page' => $bookings->perPage(),
                    'total' => $bookings->total(),
                    'from' => $bookings->firstItem(),
                    'to' => $bookings->lastItem(),
                    'summary' => $this->preparationSummary($request),
                    'departments' => $this->preparationDepartmentOptions($request),
                ],
                'links' => [
                    'first' => $bookings->url(1),
                    'last' => $bookings->url($bookings->lastPage()),
                    'prev' => $bookings->previousPageUrl(),
                    'next' => $bookings->nextPageUrl(),
                ],
            ]);
        }

        $rows = $query->get()
            ->map($request->boolean('lightweight')
                ? fn (Booking $booking) => $this->preparationListRow($booking)
                : fn (Booking $booking) => $this->preparationRow($booking))
            ->values();

        return response()->json($rows);
    }

    public function preparationBoardSummary(Request $request)
    {
        return ApiResponse::ok($this->preparationSummary($request));
    }

    public function preparationBoardDetail(Booking $booking)
    {
        abort_unless($booking->status === 'Confirmed', 404);

        $booking->load([
            'payments:id,booking_id,status,voided_at',
            'preparationTasks' => fn ($query) => $query->orderBy('department')->orderBy('id'),
            'assignee:id,full_name,username',
            'user:id,full_name,username,email,phone,account_status',
        ]);

        return response()->json($this->preparationRow($booking));
    }

    private function preparationBoardQuery(Request $request)
    {
        $start = $request->filled('date_from')
            ? Carbon::parse($request->query('date_from'))->startOfDay()
            : Carbon::today();
        $end = $request->filled('date_to')
            ? Carbon::parse($request->query('date_to'))->endOfDay()
            : Carbon::today()->addDays((int) $request->query('days', 30));

        $query = Booking::query()
            ->with([
                'payments:id,booking_id,status,voided_at',
                'preparationTasks' => fn ($query) => $query->orderBy('department')->orderBy('id'),
                'assignee:id,full_name,username',
                'user:id,full_name,username,email,phone,account_status',
            ])
            ->whereBetween('event_date', [$start->toDateString(), $end->toDateString()])
            ->where('status', 'Confirmed')
            ->orderBy('event_date')
            ->orderBy('event_time');

        if ($request->filled('search')) {
            $search = '%'.mb_strtolower(trim((string) $request->query('search'))).'%';
            $query->where(function ($inner) use ($search) {
                $inner->whereRaw('LOWER(client_full_name) LIKE ?', [$search])
                    ->orWhereRaw('LOWER(client_email) LIKE ?', [$search])
                    ->orWhereRaw('LOWER(client_phone) LIKE ?', [$search])
                    ->orWhereRaw('LOWER(event_name) LIKE ?', [$search])
                    ->orWhereRaw('LOWER(event_type) LIKE ?', [$search])
                    ->orWhereRaw('LOWER(status) LIKE ?', [$search])
                    ->orWhereHas('user', fn ($userQuery) => $userQuery
                        ->whereRaw('LOWER(full_name) LIKE ?', [$search])
                        ->orWhereRaw('LOWER(username) LIKE ?', [$search])
                        ->orWhereRaw('LOWER(email) LIKE ?', [$search])
                        ->orWhereRaw('LOWER(phone) LIKE ?', [$search]));
            });
        }

        $attention = $request->query('attention', 'all');
        if ($attention && $attention !== 'all') {
            $this->applyAttentionFilter($query, $attention);
        }

        if ($request->filled('department') && $request->query('department') !== 'all') {
            $department = (string) $request->query('department');
            $query->whereHas('preparationTasks', function ($taskQuery) use ($department) {
                if ($department === 'Service prep') {
                    $taskQuery->whereIn('department', ['Service prep', 'Admin', 'Operations']);

                    return;
                }

                $taskQuery->where('department', $department);
            });
        }

        return $query;
    }

    private function preparationRow(Booking $booking): array
    {
        EventPreparationService::ensureDefaultTasks($booking);
        $booking->load(['payments', 'preparationTasks', 'user']);

        $tasks = $booking->preparationTasks;
        $completedTasks = $tasks->where('status', 'Done')->count();
        $taskTotal = $tasks->count();
        $readiness = $this->readinessFor($booking);

        $currentUser = Auth::user();
        $readinessDetails = collect($readiness)->map(fn ($ready, $key) => [
            'key' => $key,
            'label' => $this->readinessLabel($key),
            'ready' => $ready,
            'owner_department' => $this->readinessOwner($key),
            'action_hint' => $this->readinessActionHint($key),
            'can_update' => $this->canUpdateReadiness($currentUser?->role, $key),
        ])->values();

        $taskRows = $tasks->map(fn (EventPreparationTask $task) => [
            'id' => $task->id,
            'department' => $this->responsibleArea($task->department),
            'responsible_area' => $this->responsibleArea($task->department),
            'raw_department' => $task->department,
            'label' => $task->label,
            'status' => $task->status,
            'due_at' => $task->due_at,
            'due_state' => $this->dueState($task),
            'can_update' => $this->canUpdateTask($currentUser?->role, $task),
            'action_hint' => $this->taskActionHint($task, $currentUser?->role),
            'assigned_to' => $task->assigned_to,
            'completed_at' => $task->completed_at,
            'completed_by' => $task->completed_by,
        ])->values();

        $blockingItems = $this->blockingItems($readinessDetails);
        $taskGroups = $this->taskGroups($taskRows);

        return [
            'booking' => [
                'id' => $booking->id,
                'event_name' => $booking->event_name,
                'event_type' => $booking->event_type,
                'client_full_name' => $booking->client_full_name ?: $booking->user?->full_name ?: $booking->user?->username,
                'client_email' => $booking->client_email ?: $booking->user?->email,
                ...CustomerIdentity::forBooking($booking),
                'event_date' => $booking->event_date,
                'event_time' => $booking->event_time,
                'pax' => $booking->pax,
                'venue_city' => $booking->venue_city,
                'venue_address_line' => $booking->venue_address_line,
                'status' => $booking->status,
                'review_status' => $booking->review_status,
                'total_cost' => $booking->total_cost,
                'owner_name' => $booking->assignee?->full_name ?: $booking->assignee?->username ?: 'Unassigned',
            ],
            'readiness' => $readiness,
            'readiness_details' => $readinessDetails,
            'blocking_items' => $blockingItems,
            'tasks' => $taskRows,
            'task_groups' => $taskGroups,
            'task_progress' => [
                'completed' => $completedTasks,
                'total' => $taskTotal,
                'percent' => $taskTotal > 0 ? (int) round(($completedTasks / $taskTotal) * 100) : 0,
            ],
            'readiness_progress' => $this->readinessProgress($readiness),
            'attention_flags' => $this->attentionFlags($readiness),
            'next_action' => $this->nextAction($booking, $blockingItems, $taskGroups, $currentUser?->role),
            'contextual_actions' => $this->contextualActions($booking, $blockingItems, $currentUser?->role),
            'event_sheet' => $this->eventSheet($booking, $readiness),
        ];
    }

    private function preparationListRow(Booking $booking): array
    {
        EventPreparationService::ensureDefaultTasks($booking);
        $booking->load(['payments', 'preparationTasks', 'user', 'assignee']);

        $tasks = $booking->preparationTasks;
        $completedTasks = $tasks->where('status', 'Done')->count();
        $taskTotal = $tasks->count();
        $readiness = $this->readinessFor($booking);

        return [
            'booking' => [
                'id' => $booking->id,
                'event_name' => $booking->event_name,
                'event_type' => $booking->event_type,
                'client_full_name' => $booking->client_full_name ?: $booking->user?->full_name ?: $booking->user?->username,
                'client_email' => $booking->client_email ?: $booking->user?->email,
                ...CustomerIdentity::forBooking($booking),
                'event_date' => $booking->event_date,
                'event_time' => $booking->event_time,
                'pax' => $booking->pax,
                'venue_city' => $booking->venue_city,
                'venue_address_line' => $booking->venue_address_line,
                'status' => $booking->status,
                'review_status' => $booking->review_status,
                'total_cost' => $booking->total_cost,
                'owner_name' => $booking->assignee?->full_name ?: $booking->assignee?->username ?: 'Unassigned',
            ],
            'readiness' => $readiness,
            'task_progress' => [
                'completed' => $completedTasks,
                'total' => $taskTotal,
                'percent' => $taskTotal > 0 ? (int) round(($completedTasks / $taskTotal) * 100) : 0,
            ],
            'readiness_progress' => $this->readinessProgress($readiness),
            'attention_flags' => $this->attentionFlags($readiness),
        ];
    }

    private function applyAttentionFilter($query, string $attention): void
    {
        if ($attention === 'payment') {
            $query->where(function ($inner) {
                $inner->whereDoesntHave('payments')
                    ->orWhereHas('payments', fn ($paymentQuery) => $paymentQuery->whereNotIn('status', ['Paid', 'Verified', 'Refunded']));
            });

            return;
        }

        if ($attention === 'menu') {
            $query->where(fn ($inner) => $this->whereMissingSelectedMenu($inner));

            return;
        }

        if ($attention === 'venue') {
            $query->where(function ($inner) {
                $inner->where(fn ($address) => $address->whereNull('venue_address_line')->orWhere('venue_address_line', ''))
                    ->orWhere(fn ($city) => $city->whereNull('venue_city')->orWhere('venue_city', ''));
            });

            return;
        }

        if ($attention === 'headcount') {
            $query->where(fn ($inner) => $inner->whereNull('pax')->orWhere('pax', '<=', 0));

            return;
        }

        if ($attention === 'customer_messages') {
            $query->whereHas('user', fn ($userQuery) => $userQuery->whereHas('clientConversations', fn ($conversationQuery) => $conversationQuery->where('status', 'active')));

            return;
        }

        if ($attention === 'needs_attention') {
            $query->where(function ($inner) {
                $inner->whereDoesntHave('payments')
                    ->orWhereHas('payments', fn ($paymentQuery) => $paymentQuery->whereNotIn('status', ['Paid', 'Verified', 'Refunded']))
                    ->orWhere(fn ($menu) => $this->whereMissingSelectedMenu($menu))
                    ->orWhereNull('venue_address_line')
                    ->orWhere('venue_address_line', '')
                    ->orWhereNull('pax')
                    ->orWhere('pax', '<=', 0);
            });
        }
    }

    private function preparationSummary(Request $request): array
    {
        $base = $this->preparationBoardQuery($request->duplicate(query: array_diff_key($request->query(), array_flip(['attention', 'department', 'search', 'page']))));

        return [
            'upcoming' => (clone $base)->count(),
            'needs_attention' => tap(clone $base, fn ($query) => $this->applyAttentionFilter($query, 'needs_attention'))->count(),
            'payment_not_clear' => tap(clone $base, fn ($query) => $this->applyAttentionFilter($query, 'payment'))->count(),
            'menu_missing' => tap(clone $base, fn ($query) => $this->applyAttentionFilter($query, 'menu'))->count(),
            'venue_missing' => tap(clone $base, fn ($query) => $this->applyAttentionFilter($query, 'venue'))->count(),
        ];
    }

    private function preparationDepartmentOptions(Request $request): array
    {
        $base = $this->preparationBoardQuery($request->duplicate(query: array_diff_key($request->query(), array_flip(['department', 'page', 'per_page', 'paginated']))));
        $bookingIds = (clone $base)->pluck('id');
        $departments = $bookingIds->isEmpty()
            ? collect()
            : EventPreparationTask::query()
                ->whereIn('booking_id', $bookingIds)
                ->distinct()
                ->pluck('department')
                ->map(fn ($department) => $this->responsibleArea($department));

        return collect([...self::TASK_GROUP_ORDER, 'Customer'])
            ->merge($departments)
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    public function updatePreparationTask(Request $request, EventPreparationTask $task)
    {
        if (! $this->canUpdateTask(Auth::user()?->role, $task)) {
            abort(403, $this->taskActionHint($task, Auth::user()?->role));
        }

        $data = $request->validate([
            'status' => ['required', 'in:Pending,Done'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $isDone = $data['status'] === 'Done';

        $task->update([
            'status' => $data['status'],
            'assigned_to' => $data['assigned_to'] ?? $task->assigned_to,
            'completed_by' => $isDone ? Auth::id() : null,
            'completed_at' => $isDone ? now() : null,
        ]);

        return response()->json([
            'message' => 'Preparation task updated.',
            'task' => $task->fresh(),
        ]);
    }

    private function readinessFor(Booking $booking): array
    {
        $payments = $booking->payments->whereNull('voided_at');
        $hasPayments = $payments->isNotEmpty();
        $paymentReady = $hasPayments && $payments->every(fn ($payment) => in_array($payment->status, ['Paid', 'Verified', 'Refunded'], true));
        $menuReady = ! empty($booking->selected_menu);
        $venueReady = filled($booking->venue_address_line) || filled($booking->venue_city);
        $headcountReady = (int) $booking->pax > 0;
        $tastingReady = true;

        if ($booking->food_tasting_id) {
            $tastingReady = FoodTasting::whereKey($booking->food_tasting_id)
                ->whereIn('status', ['Approved', 'Confirmed', 'Completed'])
                ->exists();
        }

        $customerMessagesReady = ! Conversation::query()
            ->where('client_id', $booking->user_id)
            ->where('status', 'active')
            ->exists();

        return [
            'payment' => $paymentReady,
            'menu' => $menuReady,
            'venue' => $venueReady,
            'headcount' => $headcountReady,
            'tasting' => $tastingReady,
            'customer_messages' => $customerMessagesReady,
        ];
    }

    private function attentionFlags(array $readiness): array
    {
        $labels = [
            'payment' => 'Accounting: payment clearance pending',
            'menu' => 'Customer: final menu needed',
            'venue' => 'Service prep: venue access not ready',
            'headcount' => 'Customer: final headcount needed',
            'tasting' => 'Marketing: tasting outcome not recorded',
            'customer_messages' => 'Marketing: customer messages open',
        ];

        return collect($readiness)
            ->filter(fn ($ready) => ! $ready)
            ->keys()
            ->map(fn ($key) => ['key' => $key, 'label' => $labels[$key] ?? $key])
            ->values()
            ->all();
    }

    private function eventSheet(Booking $booking, array $readiness): array
    {
        return [
            'booking_ref' => str_pad((string) $booking->id, 5, '0', STR_PAD_LEFT),
            'client' => $booking->client_full_name ?: $booking->user?->full_name ?: $booking->user?->username,
            'event' => $booking->event_name ?: $booking->event_type,
            'schedule' => trim(($booking->event_date?->toDateString() ?? 'Date TBD').' '.($booking->event_time ?: 'Time TBD')),
            'headcount' => (int) $booking->pax,
            'venue' => trim(collect([$booking->venue_address_line, $booking->venue_city])->filter()->join(', ')) ?: 'Venue TBD',
            'menu_ready' => $readiness['menu'] ?? false,
            'payment_ready' => $readiness['payment'] ?? false,
            'operations_notes' => $booking->special_instructions,
        ];
    }

    private function whereMissingSelectedMenu($query): void
    {
        $query->whereNull('selected_menu');

        if (DB::connection()->getDriverName() === 'pgsql') {
            $query->orWhereRaw("\"selected_menu\"::text in ('[]', '{}', 'null', '\"\"')");
            return;
        }

        $query->orWhereIn('selected_menu', ['[]', '{}', 'null', '""', '']);
    }

    private function readinessOwner(string $key): string
    {
        return match ($key) {
            'payment' => 'Accounting',
            'venue' => 'Service prep',
            'menu', 'headcount' => 'Customer',
            default => 'Marketing',
        };
    }

    private function canUpdateReadiness(?string $role, string $key): bool
    {
        if ($role === 'Admin') {
            return true;
        }

        return in_array($key, ['tasting', 'customer_messages'], true);
    }

    private function readinessActionHint(string $key): string
    {
        return match ($key) {
            'payment' => 'Accounting clears this after payment verification.',
            'menu' => 'Ask the customer to complete or confirm their menu.',
            'venue' => 'Service prep needs venue/logistics confirmation. Admin can step in if this blocks the event.',
            'headcount' => 'Ask the customer to confirm final pax.',
            'tasting' => 'Record or confirm the tasting outcome.',
            'customer_messages' => 'Resolve or reply to the linked customer conversation.',
            default => 'Review this handoff item.',
        };
    }

    private function taskActionHint(EventPreparationTask $task, ?string $role = null): string
    {
        if ($this->canUpdateTask($role, $task)) {
            return 'You can mark this task done when the handoff work is complete.';
        }

        return match ($this->responsibleArea($task->department)) {
            'Accounting' => 'Accounting owns this task.',
            'Service prep' => 'Service prep needs confirmation. Admin override is available when needed.',
            'Customer' => 'Customer needs to provide or confirm this detail.',
            default => 'Marketing can update this task.',
        };
    }

    private function readinessLabel(string $key): string
    {
        return match ($key) {
            'payment' => 'Accounting: payment clearance',
            'menu' => 'Customer: final menu',
            'venue' => 'Service prep: venue access',
            'headcount' => 'Customer: final headcount',
            'tasting' => 'Marketing: tasting outcome',
            'customer_messages' => 'Marketing: customer messages',
            default => ucfirst(str_replace('_', ' ', $key)),
        };
    }

    private function readinessProgress(array $readiness): array
    {
        $total = count($readiness);
        $ready = collect($readiness)->filter()->count();

        return [
            'ready' => $ready,
            'total' => $total,
            'percent' => $total > 0 ? (int) round(($ready / $total) * 100) : 0,
        ];
    }

    private function blockingItems($readinessDetails)
    {
        return collect($readinessDetails)
            ->filter(fn ($item) => ! ($item['ready'] ?? false))
            ->sortBy(fn ($item) => $this->readinessRank($item['key'] ?? ''))
            ->values()
            ->all();
    }

    private function readinessRank(string $key): int
    {
        $rank = array_search($key, self::READINESS_PRIORITY, true);

        return $rank === false ? 999 : $rank;
    }

    private function taskGroups($tasks)
    {
        return collect($tasks)
            ->groupBy(fn ($task) => $task['responsible_area'] ?? 'Service prep')
            ->map(fn ($groupTasks, $owner) => [
                'owner' => $owner,
                'completed' => $groupTasks->where('status', 'Done')->count(),
                'total' => $groupTasks->count(),
                'tasks' => $groupTasks
                    ->sortBy(fn ($task) => sprintf(
                        '%02d-%s-%08d',
                        $this->taskRank($task),
                        $task['due_at'] ? Carbon::parse($task['due_at'])->timestamp : PHP_INT_MAX,
                        $task['id'] ?? 0
                    ))
                    ->values()
                    ->all(),
            ])
            ->sortBy(fn ($group) => $this->taskGroupRank($group['owner']))
            ->values()
            ->all();
    }

    private function taskRank(array $task): int
    {
        if (($task['status'] ?? null) === 'Done') {
            return 4;
        }

        return match ($task['due_state'] ?? 'Pending') {
            'Overdue' => 0,
            'Due soon' => 1,
            'Pending' => 2,
            default => 3,
        };
    }

    private function taskGroupRank(string $owner): int
    {
        $rank = array_search($owner, self::TASK_GROUP_ORDER, true);

        return $rank === false ? 999 : $rank;
    }

    private function canUpdateTask(?string $role, EventPreparationTask $task): bool
    {
        if ($role === 'Admin') {
            return true;
        }

        return $role === 'Marketing' && $this->responsibleArea($task->department) === 'Marketing';
    }

    private function nextAction(Booking $booking, array $blockingItems, array $taskGroups, ?string $role): array
    {
        if (! empty($blockingItems)) {
            return $this->nextActionForBlocker($booking, $blockingItems[0], $role);
        }

        $pendingTask = collect($taskGroups)
            ->flatMap(fn ($group) => $group['tasks'])
            ->first(fn ($task) => ($task['status'] ?? null) !== 'Done');

        if ($pendingTask) {
            $owner = $pendingTask['responsible_area'] ?? 'Service prep';

            return [
                'kind' => 'task',
                'tone' => ($pendingTask['can_update'] ?? false) ? 'warn' : 'muted',
                'label' => ($pendingTask['can_update'] ?? false)
                    ? 'Complete '.$pendingTask['label']
                    : 'Follow up with '.$owner,
                'description' => ($pendingTask['can_update'] ?? false)
                    ? 'Mark this task done once the handoff work is complete.'
                    : (($pendingTask['action_hint'] ?? null) ?: $owner.' owns this handoff task.'),
                'owner_department' => $owner,
                'primary_action_label' => $owner === 'Service prep' ? 'Download prep list' : 'Open booking',
                'primary_action_url' => $owner === 'Service prep'
                    ? "/documents/bookings/{$booking->id}/preparation.pdf"
                    : $this->bookingUrl($booking, $role),
            ];
        }

        return [
            'kind' => 'ready',
            'tone' => 'good',
            'label' => 'Ready for service prep',
            'description' => 'Readiness checks are clear and handoff tasks are complete.',
            'owner_department' => 'Service prep',
            'primary_action_label' => 'Download prep list',
            'primary_action_url' => "/documents/bookings/{$booking->id}/preparation.pdf",
        ];
    }

    private function nextActionForBlocker(Booking $booking, array $blocker, ?string $role): array
    {
        return match ($blocker['key'] ?? null) {
            'payment' => [
                'kind' => 'payment',
                'tone' => 'danger',
                'label' => 'Accounting must clear payment',
                'description' => 'Payment is not clear yet. Coordinate with Accounting before service prep continues.',
                'owner_department' => 'Accounting',
                'primary_action_label' => $role === 'Admin' ? 'Open payment review' : 'Coordinate with Accounting',
                'primary_action_url' => $role === 'Admin' ? '/dashboard/admin?tab=finance' : null,
            ],
            'menu' => [
                'kind' => 'menu',
                'tone' => 'warn',
                'label' => 'Ask customer to confirm final menu',
                'description' => 'The final menu is still missing from this booking.',
                'owner_department' => 'Customer',
                'primary_action_label' => 'Open messages',
                'primary_action_url' => $this->messagesUrl($role),
            ],
            'headcount' => [
                'kind' => 'headcount',
                'tone' => 'warn',
                'label' => 'Ask customer to confirm final headcount',
                'description' => 'Final pax is missing or invalid, so service quantities are not ready.',
                'owner_department' => 'Customer',
                'primary_action_label' => 'Open messages',
                'primary_action_url' => $this->messagesUrl($role),
            ],
            'venue' => [
                'kind' => 'venue',
                'tone' => 'warn',
                'label' => 'Confirm venue access and setup details',
                'description' => 'Service prep needs the venue address or access details before the event sheet is reliable.',
                'owner_department' => 'Service prep',
                'primary_action_label' => 'Download prep list',
                'primary_action_url' => "/documents/bookings/{$booking->id}/preparation.pdf",
            ],
            'tasting' => [
                'kind' => 'tasting',
                'tone' => 'warn',
                'label' => 'Record or confirm tasting outcome',
                'description' => 'The linked tasting needs an approved, confirmed, or completed outcome.',
                'owner_department' => 'Marketing',
                'primary_action_label' => 'Open tastings',
                'primary_action_url' => $this->tastingsUrl($role),
            ],
            'customer_messages' => [
                'kind' => 'customer_messages',
                'tone' => 'warn',
                'label' => 'Resolve the open customer conversation',
                'description' => 'Customer messages are still active, so the handoff is not fully settled.',
                'owner_department' => 'Marketing',
                'primary_action_label' => 'Open messages',
                'primary_action_url' => $this->messagesUrl($role),
            ],
            default => [
                'kind' => 'handoff',
                'tone' => 'warn',
                'label' => 'Review this handoff item',
                'description' => $blocker['action_hint'] ?? 'One readiness item needs staff attention.',
                'owner_department' => $blocker['owner_department'] ?? 'Staff',
                'primary_action_label' => 'Open booking',
                'primary_action_url' => $this->bookingUrl($booking, $role),
            ],
        };
    }

    private function contextualActions(Booking $booking, array $blockingItems, ?string $role): array
    {
        $blockingKeys = collect($blockingItems)->pluck('key')->all();
        $actions = [[
            'key' => 'booking',
            'label' => 'Open booking',
            'url' => $this->bookingUrl($booking, $role),
        ], [
            'key' => 'prep_list',
            'label' => 'Download prep list',
            'url' => "/documents/bookings/{$booking->id}/preparation.pdf",
        ]];

        if (array_intersect($blockingKeys, ['menu', 'headcount', 'customer_messages'])) {
            $actions[] = [
                'key' => 'messages',
                'label' => 'Open messages',
                'url' => $this->messagesUrl($role),
            ];
        }

        if (in_array('payment', $blockingKeys, true) && $role === 'Admin') {
            $actions[] = [
                'key' => 'payment_review',
                'label' => 'Open payment review',
                'url' => '/dashboard/admin?tab=finance',
            ];
        }

        if (in_array('tasting', $blockingKeys, true)) {
            $actions[] = [
                'key' => 'tastings',
                'label' => 'Open tastings',
                'url' => $this->tastingsUrl($role),
            ];
        }

        return collect($actions)->filter(fn ($action) => filled($action['url'] ?? null))->values()->all();
    }

    private function bookingUrl(Booking $booking, ?string $role): string
    {
        return $role === 'Admin'
            ? "/dashboard/admin?tab=bookings-intake&booking={$booking->id}"
            : "/dashboard/marketing?tab=bookings&booking={$booking->id}";
    }

    private function messagesUrl(?string $role): string
    {
        return $role === 'Admin'
            ? '/dashboard/admin?tab=messages-inquiries'
            : '/dashboard/marketing?tab=messages';
    }

    private function tastingsUrl(?string $role): string
    {
        return $role === 'Admin'
            ? '/dashboard/admin?tab=tastings'
            : '/dashboard/marketing?tab=tastings';
    }

    private function responsibleArea(?string $department): string
    {
        return match ($department) {
            'Operations', 'Admin', 'Service prep', null, '' => 'Service prep',
            default => $department,
        };
    }

    private function dueState(EventPreparationTask $task): string
    {
        if ($task->status === 'Done') {
            return 'Ready';
        }

        if (! $task->due_at) {
            return 'Pending';
        }

        $due = Carbon::parse($task->due_at);
        if ($due->isPast()) {
            return 'Overdue';
        }

        return $due->diffInDays(now()) <= 3 ? 'Due soon' : 'Pending';
    }
}
