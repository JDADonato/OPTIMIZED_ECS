<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\BusinessRule;
use App\Models\CalendarAvailabilityOverride;
use App\Services\BusinessRulesService;
use App\Services\CalendarAvailabilityService;
use App\Services\OperationalBroadcastService;
use App\Support\CustomerIdentity;
use App\Support\ResourceVersion;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class CalendarAvailabilityController extends Controller
{
    public function index(Request $request, CalendarAvailabilityService $availability)
    {
        $data = $request->validate([
            'month' => ['nullable', 'date_format:Y-m'],
            'start' => ['nullable', 'date'],
            'end' => ['nullable', 'date', 'after_or_equal:start'],
            'status' => ['nullable', 'string', 'max:80'],
            'event_type' => ['nullable', 'string', 'max:120'],
            'city' => ['nullable', 'string', 'max:120'],
            'owner' => ['nullable', 'integer', 'exists:users,id'],
            'search' => ['nullable', 'string', 'max:120'],
        ]);
        if (empty($data['month']) && (empty($data['start']) || empty($data['end']))) {
            $data['month'] = now()->format('Y-m');
        }

        $start = ! empty($data['start']) && ! empty($data['end'])
            ? Carbon::parse($data['start'])->startOfDay()
            : Carbon::createFromFormat('Y-m', $data['month'])->startOfMonth();
        $end = ! empty($data['start']) && ! empty($data['end'])
            ? Carbon::parse($data['end'])->endOfDay()
            : $start->copy()->endOfMonth();

        $eventQuery = Booking::query()
            ->whereBetween('event_date', [$start->toDateString(), $end->toDateString()])
            ->whereNotIn('status', ['Cancelled', 'cancelled'])
            ->when($data['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($data['event_type'] ?? null, fn ($q, $type) => $q->where('event_type', $type))
            ->when($data['city'] ?? null, fn ($q, $city) => $q->where('venue_city', $city))
            ->when($data['owner'] ?? null, fn ($q, $owner) => $q->where('assigned_to', $owner))
            ->when($data['search'] ?? null, function ($q, $search) {
                $term = '%'.mb_strtolower(trim((string) $search)).'%';
                $q->where(fn ($inner) => $inner
                    ->whereRaw('LOWER(event_name) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(event_type) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(client_full_name) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(client_email) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(client_phone) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(venue_city) LIKE ?', [$term])
                    ->orWhereHas('user', fn ($userQuery) => $userQuery
                        ->whereRaw('LOWER(full_name) LIKE ?', [$term])
                        ->orWhereRaw('LOWER(username) LIKE ?', [$term])
                        ->orWhereRaw('LOWER(email) LIKE ?', [$term])
                        ->orWhereRaw('LOWER(phone) LIKE ?', [$term])));
            });
        $overrideQuery = CalendarAvailabilityOverride::query()
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()]);
        $eventVersion = ResourceVersion::fromQuery(clone $eventQuery);
        $overrideVersion = ResourceVersion::fromQuery(clone $overrideQuery);
        $versionMeta = ResourceVersion::make(
            (int) $eventVersion['count'] + (int) $overrideVersion['count'],
            collect([$eventVersion['updated_at'], $overrideVersion['updated_at']])->filter()->max(),
            collect([$eventVersion['latest_id'], $overrideVersion['latest_id']])->filter()->max()
        );

        if (ResourceVersion::matches($request, $versionMeta)) {
            return ResourceVersion::unchanged($versionMeta);
        }

        $events = (clone $eventQuery)
            ->with(['assignee:id,full_name,username', 'user:id,full_name,username,email,phone,account_status'])
            ->withCount([
                'payments',
                'payments as paid_payments_count' => fn ($query) => $query->whereIn('status', ['Paid', 'Verified']),
                'preparationTasks',
                'preparationTasks as done_preparation_tasks_count' => fn ($query) => $query->where('status', 'Done'),
            ])
            ->select([
                'id',
                'user_id',
                'event_date',
                'event_time',
                'event_name',
                'event_type',
                'client_full_name',
                'client_email',
                'client_phone',
                'pax',
                'status',
                'venue_city',
                'budget',
                'total_cost',
                'selected_menu',
                'assigned_to',
                'updated_at',
            ])
            ->orderBy('event_date')
            ->orderBy('event_time')
            ->get();

        $overrides = $this->serializeOverrides(
            (clone $overrideQuery)
                ->with(['creator:id,username,full_name', 'updater:id,username,full_name'])
                ->orderBy('date')
                ->get(),
            $start,
            $end
        );

        $events = $events
            ->map(function (Booking $booking) use ($request) {
                $taskCount = (int) ($booking->preparation_tasks_count ?? 0);
                $doneTasks = (int) ($booking->done_preparation_tasks_count ?? 0);
                $user = $request->user();
                $canClaim = $user && in_array($user->role, ['Marketing', 'Admin'], true) && is_null($booking->assigned_to);
                $canEdit = $user && in_array($user->role, ['Marketing', 'Admin'], true)
                    && ($user->role === 'Admin' || (int) $booking->assigned_to === (int) $user->id);

                return [
                    'id' => $booking->id,
                    'date' => optional($booking->event_date)->toDateString(),
                    'time' => $booking->event_time,
                    'name' => $booking->event_display_name,
                    'event_display_name' => $booking->event_display_name,
                    'type' => $booking->event_type,
                    'client' => $booking->client_full_name,
                    ...CustomerIdentity::forBooking($booking),
                    'pax' => $booking->pax,
                    'status' => $booking->status === 'Reserved' ? 'Confirmed' : $booking->status,
                    'city' => $booking->venue_city,
                    'budget' => $booking->budget,
                    'total_cost' => $booking->total_cost,
                    'totalCost' => (float) ($booking->total_cost ?? $booking->budget ?? 0),
                    'selected_menu' => $booking->selected_menu,
                    'assigned_to' => $booking->assigned_to,
                    'owner_id' => $booking->assigned_to,
                    'owner_name' => $booking->assignee?->full_name ?: $booking->assignee?->username,
                    'owner' => $booking->assignee?->full_name ?: $booking->assignee?->username,
                    'can_claim' => $canClaim,
                    'can_edit' => $canEdit,
                    'payment_state' => (int) ($booking->paid_payments_count ?? 0).'/'.(int) ($booking->payments_count ?? 0).' paid',
                    'preparation_state' => $taskCount ? "{$doneTasks}/{$taskCount} ready" : 'No tasks yet',
                ];
            });

        return response()->json([
            'data' => $overrides,
            'events' => $events->values(),
            'meta' => [
                ...$versionMeta,
                'changed' => true,
            ],
        ]);
    }

    public function upsert(Request $request, string $date, CalendarAvailabilityService $availability)
    {
        $dateString = Carbon::parse($date)->toDateString();
        $data = $request->validate([
            'is_locked' => ['nullable', 'boolean'],
            'remaining_events' => ['nullable', 'integer', 'min:0'],
            'remaining_pax' => ['nullable', 'integer', 'min:0'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $current = $availability->availabilityForDate($dateString);
        $maxEventsOverride = array_key_exists('remaining_events', $data) && $data['remaining_events'] !== null
            ? $current['currentEvents'] + (int) $data['remaining_events']
            : null;
        $maxPaxOverride = array_key_exists('remaining_pax', $data) && $data['remaining_pax'] !== null
            ? $current['currentPax'] + (int) $data['remaining_pax']
            : null;

        $override = CalendarAvailabilityOverride::whereDate('date', $dateString)->first();
        $payload = [
            'is_locked' => DB::raw(! empty($data['is_locked']) ? 'true' : 'false'),
            'max_events_override' => $maxEventsOverride,
            'max_pax_override' => $maxPaxOverride,
            'note' => $data['note'] ?? null,
            'updated_by' => Auth::id(),
            'updated_at' => now(),
        ];

        if ($override) {
            DB::table('calendar_availability_overrides')
                ->where('id', $override->id)
                ->update($payload);
        } else {
            $id = DB::table('calendar_availability_overrides')->insertGetId([
                'date' => $dateString,
                ...$payload,
                'created_by' => Auth::id(),
                'created_at' => now(),
            ]);
            $override = CalendarAvailabilityOverride::find($id);
        }

        app(OperationalBroadcastService::class)
            ->staffQueueChanged('availability', 'calendar_availability_override', $override->id, 'updated', 'Availability updated.');

        return response()->json([
            'message' => 'Availability updated.',
            'override' => $availability->serializeOverride($override->fresh(['creator', 'updater'])),
        ]);
    }

    public function destroy(string $date): JsonResponse
    {
        $dateString = Carbon::parse($date)->toDateString();
        $ids = CalendarAvailabilityOverride::whereDate('date', $dateString)->pluck('id');
        CalendarAvailabilityOverride::whereIn('id', $ids)->delete();

        app(OperationalBroadcastService::class)
            ->staffQueueChanged('availability', 'calendar_availability_override', $ids->first() ?: $dateString, 'cleared', 'Availability override cleared.');

        return response()->json(['message' => 'Availability override cleared.']);
    }

    private function serializeOverrides(Collection $overrides, Carbon $start, Carbon $end): Collection
    {
        if ($overrides->isEmpty()) {
            return collect();
        }

        $stats = DB::table('bookings')
            ->select(
                DB::raw('DATE(event_date) as booking_date'),
                DB::raw('COUNT(*) as event_count'),
                DB::raw('COALESCE(SUM(pax), 0) as total_pax')
            )
            ->whereBetween('event_date', [$start->toDateString(), $end->toDateString()])
            ->whereNotIn('status', ['Cancelled', 'cancelled'])
            ->groupBy('booking_date')
            ->get()
            ->keyBy(fn ($row) => Carbon::parse($row->booking_date)->toDateString());
        $rules = BusinessRule::getActive();
        $baseMaxEvents = $rules ? (int) $rules->maximum_capacity_per_day : BusinessRulesService::MAX_EVENTS_PER_DAY;
        $baseMaxPax = BusinessRulesService::MAX_PAX_PER_DAY;

        return $overrides->map(function (CalendarAvailabilityOverride $override) use ($baseMaxEvents, $baseMaxPax, $stats) {
            $date = $override->date->toDateString();
            $stat = $stats->get($date);
            $currentEvents = (int) ($stat->event_count ?? 0);
            $currentPax = (int) ($stat->total_pax ?? 0);
            $isLocked = (bool) $override->is_locked;
            $maxEvents = $override->max_events_override ?? $baseMaxEvents;
            $maxPax = $override->max_pax_override ?? $baseMaxPax;

            return [
                'id' => $override->id,
                'date' => $date,
                'is_locked' => $isLocked,
                'max_events_override' => $override->max_events_override,
                'max_pax_override' => $override->max_pax_override,
                'remainingEvents' => $isLocked ? 0 : max(0, (int) $maxEvents - $currentEvents),
                'remainingPax' => $isLocked ? 0 : max(0, (int) $maxPax - $currentPax),
                'currentEvents' => $currentEvents,
                'currentPax' => $currentPax,
                'note' => $override->note,
                'created_by_name' => $override->creator?->full_name ?: $override->creator?->username,
                'updated_by_name' => $override->updater?->full_name ?: $override->updater?->username,
                'updated_at' => $override->updated_at,
            ];
        })->values();
    }
}
