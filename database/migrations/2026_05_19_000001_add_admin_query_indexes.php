<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('CREATE INDEX IF NOT EXISTS bookings_status_event_date_idx ON bookings (status, event_date)');
            DB::statement('CREATE INDEX IF NOT EXISTS bookings_status_package_id_idx ON bookings (status, package_id)');
            DB::statement('CREATE INDEX IF NOT EXISTS bookings_event_type_id_idx ON bookings (event_type_id)');
            DB::statement('CREATE INDEX IF NOT EXISTS booking_items_booking_menu_idx ON booking_items (booking_id, menu_item_id)');
            DB::statement('CREATE INDEX IF NOT EXISTS booking_items_menu_booking_idx ON booking_items (menu_item_id, booking_id)');
            DB::statement('CREATE INDEX IF NOT EXISTS menu_items_category_idx ON menu_items (category)');
            DB::statement('CREATE INDEX IF NOT EXISTS payments_status_due_date_idx ON payments (status, due_date)');
            DB::statement('CREATE INDEX IF NOT EXISTS users_role_created_at_idx ON users (role, created_at)');

            return;
        }

        DB::statement('CREATE INDEX IF NOT EXISTS bookings_status_event_date_idx ON bookings (status, event_date)');
        DB::statement('CREATE INDEX IF NOT EXISTS bookings_status_package_id_idx ON bookings (status, package_id)');
        DB::statement('CREATE INDEX IF NOT EXISTS bookings_event_type_id_idx ON bookings (event_type_id)');
        DB::statement('CREATE INDEX IF NOT EXISTS booking_items_booking_menu_idx ON booking_items (booking_id, menu_item_id)');
        DB::statement('CREATE INDEX IF NOT EXISTS booking_items_menu_booking_idx ON booking_items (menu_item_id, booking_id)');
        DB::statement('CREATE INDEX IF NOT EXISTS menu_items_category_idx ON menu_items (category)');
        DB::statement('CREATE INDEX IF NOT EXISTS payments_status_due_date_idx ON payments (status, due_date)');
        DB::statement('CREATE INDEX IF NOT EXISTS users_role_created_at_idx ON users (role, created_at)');
    }

    public function down(): void
    {
        foreach ([
            'bookings_status_event_date_idx',
            'bookings_status_package_id_idx',
            'bookings_event_type_id_idx',
            'booking_items_booking_menu_idx',
            'booking_items_menu_booking_idx',
            'menu_items_category_idx',
            'payments_status_due_date_idx',
            'users_role_created_at_idx',
        ] as $index) {
            DB::statement('DROP INDEX IF EXISTS ' . $index);
        }
    }
};
