<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BusinessRule;
use App\Models\CalendarAvailabilityOverride;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class CalendarAvailabilityService
{
    public function availabilityForDate(string $date, ?Booking $excludeBooking = null): array
    {
        $dateString = Carbon::parse($date)->toDateString();
        $rules = BusinessRule::getActive();
        $baseMaxEvents = $rules ? (int) $rules->maximum_capacity_per_day : BusinessRulesService::MAX_EVENTS_PER_DAY;
        $baseMaxPax = BusinessRulesService::MAX_PAX_PER_DAY;
        $override = CalendarAvailabilityOverride::whereDate('date', $dateString)->first();

        $query = Booking::whereDate('event_date', $dateString)
            ->whereNotIn('status', ['Cancelled', 'cancelled']);

        if ($excludeBooking) {
            $query->where('id', '!=', $excludeBooking->id);
        }

        $stats = $query
            ->selectRaw('COUNT(*) as event_count, COALESCE(SUM(pax), 0) as total_pax')
            ->first();
        $currentEvents = (int) ($stats->event_count ?? 0);
        $currentPax = (int) ($stats->total_pax ?? 0);
        $maxEvents = $override?->max_events_override ?? $baseMaxEvents;
        $maxPax = $override?->max_pax_override ?? $baseMaxPax;
        $isLocked = (bool) ($override?->is_locked ?? false);
        $remainingEvents = $isLocked ? 0 : max(0, $maxEvents - $currentEvents);
        $remainingPax = $isLocked ? 0 : max(0, $maxPax - $currentPax);

        return [
            'date' => $dateString,
            'isFull' => $isLocked || $remainingEvents === 0 || $remainingPax === 0,
            'isLocked' => $isLocked,
            'remainingPax' => $remainingPax,
            'remainingEvents' => $remainingEvents,
            'currentPax' => $currentPax,
            'currentEvents' => $currentEvents,
            'maxPax' => $maxPax,
            'maxEvents' => $maxEvents,
            'override' => $override,
            'overrideNote' => $isLocked ? 'This date is blocked by the team.' : null,
        ];
    }

    public function monthOverrides(string $month): Collection
    {
        $start = Carbon::createFromFormat('Y-m', $month)->startOfMonth();
        $end = $start->copy()->endOfMonth();

        return CalendarAvailabilityOverride::with(['creator:id,username,full_name', 'updater:id,username,full_name'])
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->orderBy('date')
            ->get()
            ->map(fn (CalendarAvailabilityOverride $override) => $this->serializeOverride($override));
    }

    public function serializeOverride(CalendarAvailabilityOverride $override): array
    {
        $availability = $this->availabilityForDate($override->date->toDateString());

        return [
            'id' => $override->id,
            'date' => $override->date->toDateString(),
            'is_locked' => (bool) $override->is_locked,
            'max_events_override' => $override->max_events_override,
            'max_pax_override' => $override->max_pax_override,
            'remainingEvents' => $availability['remainingEvents'],
            'remainingPax' => $availability['remainingPax'],
            'currentEvents' => $availability['currentEvents'],
            'currentPax' => $availability['currentPax'],
            'note' => $override->note,
            'created_by_name' => $override->creator?->full_name ?: $override->creator?->username,
            'updated_by_name' => $override->updater?->full_name ?: $override->updater?->username,
            'updated_at' => $override->updated_at,
        ];
    }
}
