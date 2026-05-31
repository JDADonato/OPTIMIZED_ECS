<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE INDEX IF NOT EXISTS event_preparation_tasks_booking_department_status_idx ON event_preparation_tasks (booking_id, department, status)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS event_preparation_tasks_booking_department_status_idx');
    }
};
