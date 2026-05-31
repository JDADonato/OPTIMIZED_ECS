<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BusinessRule;
use App\Models\MenuItem;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

class BookingValidationService
{
    /**
     * Validate booking constraints (lead time, capacity, pax limits)
     *
     * @param  array  $data  Booking data
     * @param  Booking|null  $booking  Existing booking for updates
     * @return array Validated data or throws ValidationException
     */
    public static function validateBookingConstraints(array $data, ?Booking $booking = null): array
    {
        $rules = BusinessRule::getActive();

        if (! $rules) {
            throw new \Exception('Business rules not configured');
        }

        $errors = [];

        // ─── Lead Time Validation ───
        if (isset($data['event_date'])) {
            $eventDate = Carbon::parse($data['event_date'])->startOfDay();
            $today = Carbon::now()->startOfDay();
            $minimumDate = $today->copy()->addDays($rules->minimum_lead_days);

            if ($eventDate->isBefore($minimumDate)) {
                $errors['event_date'] = "Event must be booked at least {$rules->minimum_lead_days} days in advance. Earliest available: {$minimumDate->format('Y-m-d')}";
            }
        }

        // ─── Pax Limits Validation ───
        if (isset($data['pax'])) {
            $pax = (int) $data['pax'];

            if ($pax < $rules->minimum_pax_per_event) {
                $errors['pax'] = "Minimum {$rules->minimum_pax_per_event} guests required";
            }

            if ($pax > $rules->maximum_pax_per_event) {
                $errors['pax'] = "Maximum {$rules->maximum_pax_per_event} guests allowed";
            }
        }

        // ─── Capacity Per Day Validation ───
        if (isset($data['event_date'])) {
            $eventDate = Carbon::parse($data['event_date'])->startOfDay();
            $availability = app(CalendarAvailabilityService::class)->availabilityForDate($eventDate->toDateString(), $booking);
            $requestedPax = isset($data['pax'])
                ? (int) $data['pax']
                : ($booking ? (int) $booking->pax : 0);

            if ($availability['isLocked']) {
                $errors['event_date'] = "No availability on {$eventDate->format('Y-m-d')}. This date is locked by the team.";
            } elseif ($availability['remainingEvents'] < 1) {
                $errors['event_date'] = "No availability on {$eventDate->format('Y-m-d')}. Maximum event slots for this date have been reached.";
            } elseif ($requestedPax > $availability['remainingPax']) {
                $errors['pax'] = "Only {$availability['remainingPax']} guest slots are available on {$eventDate->format('Y-m-d')}.";
            }
        }

        if (! empty($errors)) {
            throw ValidationException::withMessages($errors);
        }

        return $data;
    }

    /**
     * Calculate total cost based on menu items and pax count
     * Prevents client-side price manipulation
     *
     * @param  array  $menuItemIds  Menu item IDs with quantities
     * @param  int  $pax  Number of guests
     * @return float Total cost
     */
    public static function calculateTotalCost(array $menuItemIds, int $pax): float
    {
        if (empty($menuItemIds) || $pax < 1) {
            return 0;
        }

        $itemCounts = array_count_values(array_map('intval', $menuItemIds));
        $items = MenuItem::whereIn('id', array_keys($itemCounts))->get()->keyBy('id');

        if ($items->count() !== count($itemCounts)) {
            $missingId = collect(array_keys($itemCounts))->first(fn ($id) => ! isset($items[$id]));
            throw new \Exception("Menu item {$missingId} not found");
        }

        return $items->reduce(function (float $total, $item) use ($itemCounts, $pax) {
            $quantity = (int) ($itemCounts[(int) $item->id] ?? 1);
            $pricePerHead = (float) $item->cost_per_head + (float) ($item->price_adj ?? 0);

            return $total + (($pricePerHead * $pax) * $quantity);
        }, 0.0);
    }

    /**
     * Verify submitted total cost matches server calculation
     *
     * @param  float  $submittedTotal  Client submitted total
     * @param  array  $menuItemIds  Menu item IDs
     * @param  int  $pax  Number of guests
     * @param  float  $allowedVariance  Allowed price variance (default 1%)
     */
    public static function verifyCostAccuracy(
        float $submittedTotal,
        array $menuItemIds,
        int $pax,
        float $allowedVariance = 0.01
    ): bool {
        $calculatedTotal = self::calculateTotalCost($menuItemIds, $pax);
        if ($calculatedTotal <= 0) {
            return $submittedTotal <= 0;
        }

        $variance = abs($submittedTotal - $calculatedTotal) / $calculatedTotal;

        return $variance <= $allowedVariance;
    }
}
