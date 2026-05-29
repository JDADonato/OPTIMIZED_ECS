<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('bookings')) {
            return;
        }

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE bookings ALTER COLUMN outsourced_services TYPE jsonb USING CASE WHEN outsourced_services IS NULL OR outsourced_services = '' THEN NULL ELSE outsourced_services::jsonb END");
            DB::statement("ALTER TABLE bookings ALTER COLUMN selected_menu TYPE jsonb USING CASE WHEN selected_menu IS NULL OR selected_menu = '' THEN NULL ELSE selected_menu::jsonb END");
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('bookings')) {
            return;
        }

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE bookings ALTER COLUMN outsourced_services TYPE text USING outsourced_services::text');
            DB::statement('ALTER TABLE bookings ALTER COLUMN selected_menu TYPE text USING selected_menu::text');
        }
    }
};
