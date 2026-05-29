<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\CalendarAvailabilityOverride;
use App\Services\CalendarAvailabilityService;
use App\Services\OperationalBroadcastService;
use App\Support\ResourceVersion;
use Carbon\Carbon;
use Illuminate\Http\Request;
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

        $start = !empty($data['start']) && !empty($data['end'])
            ? Carbon::parse($data['start'])->startOfDay()
            : Carbon::createFromFormat('Y-m', $data['month'])->startOfMonth();
        $end = !empty($data['start']) && !empty($data['end'])
            ? Carbon::parse($data['end'])->endOfDay()
            : $start->copy()->endOfMonth();
        $events = Booking::query()
            ->with(['assignee:id,full_name,username', 'payments:id,booking_id,status', 'preparationTasks:id,booking_id,status'])
            ->select([
                'id',
                'event_date',
                'event_time',
                'event_name',
                'event_type',
                'client_full_name',
                'pax',
                'status',
                'venue_city',
                'budget',
                'total_cost',
                'selected_menu',
                'assigned_to',
                'updated_at',
            ])
            ->whereBetween('event_date', [$start->toDateString(), $end->toDateString()])
            ->whereNotIn('status', ['Cancelled', 'cancelled'])
            ->when($data['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($data['event_type'] ?? null, fn ($q, $type) => $q->where('event_type', $type))
            ->when($data['city'] ?? null, fn ($q, $city) => $q->where('venue_city', $city))
            ->when($data['owner'] ?? null, fn ($q, $owner) => $q->where('assigned_to', $owner))
            ->when($data['search'] ?? null, function ($q, $search) {
                $term = '%' . mb_strtolower(trim((string) $search)) . '%';
                $q->where(fn ($inner) => $inner
                    ->whereRaw('LOWER(event_name) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(event_type) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(client_full_name) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(venue_city) LIKE ?', [$term]));
            })
            ->orderBy('event_date')
            ->orderBy('event_time')
            ->get();

        $overrides = $availability->monthOverrides($data['month'] ?? $start->format('Y-m'))->values();
        $versionMeta = ResourceVersion::make(
            $events->count() + $overrides->count(),
            collect([
                $events->max('updated_at'),
                $overrides->max('updated_at'),
            ])->filter()->max(),
            collect([
                $events->max('id'),
                $overrides->max('id'),
            ])->filter()->max()
        );

        if (ResourceVersion::matches($request, $versionMeta)) {
            return ResourceVersion::unchanged($versionMeta);
        }

        $events = $events
            ->map(function (Booking $booking) use ($request) {
                $taskCount = $booking->preparationTasks->count();
                $doneTasks = $booking->preparationTasks->where('status', 'Done')->count();
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
                    'payment_state' => $booking->payments->whereIn('status', ['Paid', 'Verified'])->count() . '/' . $booking->payments->count() . ' paid',
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
            'is_locked' => DB::raw(!empty($data['is_locked']) ? 'true' : 'false'),
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

    public function destroy(string $date): \Illuminate\Http\JsonResponse
    {
        $dateString = Carbon::parse($date)->toDateString();
        $ids = CalendarAvailabilityOverride::whereDate('date', $dateString)->pluck('id');
        CalendarAvailabilityOverride::whereIn('id', $ids)->delete();

        app(OperationalBroadcastService::class)
            ->staffQueueChanged('availability', 'calendar_availability_override', $ids->first() ?: $dateString, 'cleared', 'Availability override cleared.');

        return response()->json(['message' => 'Availability override cleared.']);
    }
}
