<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('bookings') || !Schema::hasColumn('bookings', 'status')) {
            return;
        }

        $updates = ['status' => 'Confirmed'];

        if (Schema::hasColumn('bookings', 'review_status')) {
            $updates['review_status'] = DB::raw("COALESCE(review_status, 'Approved For Reservation')");
        }

        DB::table('bookings')
            ->where('status', 'Reserved')
            ->update($updates);
    }

    public function down(): void
    {
        // Intentionally left empty: reserved was a legacy payment-derived booking status.
    }
};
