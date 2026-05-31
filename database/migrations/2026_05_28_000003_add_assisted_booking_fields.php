<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            if (! Schema::hasColumn('bookings', 'booking_source')) {
                $table->string('booking_source')->default('customer')->after('user_id')->index();
            }

            if (! Schema::hasColumn('bookings', 'created_by_staff_id')) {
                $table->foreignId('created_by_staff_id')->nullable()->after('booking_source')->constrained('users')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            if (Schema::hasColumn('bookings', 'created_by_staff_id')) {
                $table->dropConstrainedForeignId('created_by_staff_id');
            }

            if (Schema::hasColumn('bookings', 'booking_source')) {
                $table->dropColumn('booking_source');
            }
        });
    }
};
