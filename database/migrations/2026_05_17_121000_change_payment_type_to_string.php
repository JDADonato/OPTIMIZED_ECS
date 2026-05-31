<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE payments ALTER COLUMN payment_type TYPE VARCHAR(255) USING payment_type::text');
    }

    public function down(): void
    {
        DB::table('payments')
            ->whereNotIn('payment_type', ['Reservation', 'DownPayment', 'Final'])
            ->update(['payment_type' => 'Final']);

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE payments ALTER COLUMN payment_type TYPE VARCHAR(255) USING payment_type::text');
        }
    }
};
