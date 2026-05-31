<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BusinessRule;
use App\Models\CalendarAvailabilityOverride;
use App\Models\User;
use App\Services\CalendarAvailabilityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CalendarAvailabilityManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        BusinessRule::create([
            'minimum_lead_days' => 7,
            'maximum_capacity_per_day' => 3,
            'maximum_pax_per_event' => 1000,
            'minimum_pax_per_event' => 20,
            'is_active' => DB::raw('true'),
        ]);
    }

    public function test_locked_date_with_existing_booking_keeps_booking_but_blocks_new_capacity(): void
    {
        $date = now()->addDays(30)->toDateString();
        $booking = $this->bookingFor($date, 120);

        CalendarAvailabilityOverride::create([
            'date' => $date,
            'is_locked' => DB::raw('true'),
            'note' => 'Private event block',
        ]);

        $availability = app(CalendarAvailabilityService::class)->availabilityForDate($date);

        $this->assertTrue($availability['isLocked']);
        $this->assertTrue($availability['isFull']);
        $this->assertSame(1, $availability['currentEvents']);
        $this->assertSame(120, $availability['currentPax']);
        $this->assertSame(0, $availability['remainingEvents']);
        $this->assertSame(0, $availability['remainingPax']);
        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => 'Confirmed']);
    }

    public function test_staff_can_reduce_remaining_slots_and_pax_for_a_booked_day(): void
    {
        $date = now()->addDays(31)->toDateString();
        $this->bookingFor($date, 200);
        $staff = $this->staffUser();

        $response = $this->actingAs($staff)->putJson("/api/calendar-availability/{$date}", [
            'is_locked' => false,
            'remaining_events' => 1,
            'remaining_pax' => 50,
            'note' => 'Only one small add-on event can fit.',
        ]);

        $response->assertOk()
            ->assertJsonPath('override.remainingEvents', 1)
            ->assertJsonPath('override.remainingPax', 50)
            ->assertJsonPath('override.currentEvents', 1)
            ->assertJsonPath('override.currentPax', 200);

        $availability = app(CalendarAvailabilityService::class)->availabilityForDate($date);

        $this->assertFalse($availability['isFull']);
        $this->assertSame(1, $availability['remainingEvents']);
        $this->assertSame(50, $availability['remainingPax']);
    }

    public function test_zero_remaining_slots_is_allowed_and_negative_slots_are_rejected(): void
    {
        $date = now()->addDays(32)->toDateString();
        $this->bookingFor($date, 100);
        $staff = $this->staffUser();

        $this->actingAs($staff)->putJson("/api/calendar-availability/{$date}", [
            'is_locked' => false,
            'remaining_events' => 0,
            'remaining_pax' => 0,
        ])->assertOk();

        $availability = app(CalendarAvailabilityService::class)->availabilityForDate($date);

        $this->assertTrue($availability['isFull']);
        $this->assertSame(0, $availability['remainingEvents']);
        $this->assertSame(0, $availability['remainingPax']);

        $this->actingAs($staff)->putJson("/api/calendar-availability/{$date}", [
            'remaining_events' => -1,
            'remaining_pax' => -1,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['remaining_events', 'remaining_pax']);
    }

    public function test_booking_submit_is_rejected_if_date_is_locked_after_customer_selected_it(): void
    {
        $date = now()->addDays(33)->toDateString();
        $client = $this->clientUser();

        $this->getJson("/api/bookings/availability/{$date}")
            ->assertOk()
            ->assertJsonPath('isFull', false);

        CalendarAvailabilityOverride::create([
            'date' => $date,
            'is_locked' => DB::raw('true'),
        ]);

        $response = $this->actingAs($client)->postJson('/api/bookings', [
            'event_date' => $date,
            'event_time' => '10:00 AM - 2:00 PM',
            'event_name' => 'Locked Date Smoke Event',
            'event_type' => 'Corporate Seminar',
            'pax' => 80,
            'budget' => 80000,
            'package_id' => 'custom',
            'client_full_name' => 'Client Tester',
            'client_email' => 'client@example.test',
            'client_phone' => '09170000000',
            'venue_city' => 'Quezon City',
            'venue_address_line' => 'Test venue',
            'total_cost' => 80000,
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['event_date']);

        $this->assertDatabaseMissing('bookings', ['event_name' => 'Locked Date Smoke Event']);
    }

    public function test_disabled_dates_include_locked_override_even_without_bookings(): void
    {
        $date = now()->addDays(34)->toDateString();

        CalendarAvailabilityOverride::create([
            'date' => $date,
            'is_locked' => DB::raw('true'),
        ]);

        $this->getJson('/api/bookings/disabled-dates')
            ->assertOk()
            ->assertJson(fn ($json) => $json
                ->whereContains('disabled_dates', $date)
                ->etc()
            );
    }

    public function test_pax_over_remaining_override_capacity_is_rejected(): void
    {
        $date = now()->addDays(35)->toDateString();
        $client = $this->clientUser();

        CalendarAvailabilityOverride::create([
            'date' => $date,
            'is_locked' => DB::raw('false'),
            'max_events_override' => 2,
            'max_pax_override' => 50,
        ]);

        $response = $this->actingAs($client)->postJson('/api/bookings', [
            'event_date' => $date,
            'event_time' => '10:00 AM - 2:00 PM',
            'event_name' => 'Too Large For Override',
            'event_type' => 'Birthday',
            'pax' => 80,
            'budget' => 80000,
            'package_id' => 'custom',
            'client_full_name' => 'Client Tester',
            'client_email' => 'client@example.test',
            'client_phone' => '09170000000',
            'venue_city' => 'Quezon City',
            'venue_address_line' => 'Test venue',
            'total_cost' => 80000,
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['pax']);
    }

    private function bookingFor(string $date, int $pax): Booking
    {
        return Booking::create([
            'user_id' => $this->clientUser()->id,
            'event_date' => $date,
            'event_time' => '10:00 AM - 2:00 PM',
            'event_name' => 'Existing Event',
            'event_type' => 'Wedding',
            'pax' => $pax,
            'budget' => 100000,
            'package_id' => 'custom',
            'client_full_name' => 'Existing Client',
            'client_email' => 'existing@example.test',
            'client_phone' => '09170000000',
            'venue_city' => 'Quezon City',
            'venue_address_line' => 'Existing venue',
            'total_cost' => 100000,
            'status' => 'Confirmed',
            'review_status' => 'Approved For Reservation',
        ]);
    }

    private function staffUser(): User
    {
        return User::create([
            'full_name' => 'Marketing Tester',
            'username' => 'marketing_'.uniqid(),
            'email' => uniqid('marketing_').'@example.test',
            'password' => 'password',
            'phone' => '09170000001',
            'role' => 'Marketing',
        ]);
    }

    private function clientUser(): User
    {
        return User::create([
            'username' => 'client_'.uniqid(),
            'email' => uniqid('client_').'@example.test',
            'password' => 'password',
            'phone' => '09170000002',
            'role' => 'Client',
        ]);
    }
}
