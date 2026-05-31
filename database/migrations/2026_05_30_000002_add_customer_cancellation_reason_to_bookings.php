<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            if (! Schema::hasColumn('bookings', 'cancellation_reason')) {
                $table->string('cancellation_reason')->nullable()->after('hidden_from_customer_history_at');
                $table->index('cancellation_reason');
            }

            if (! Schema::hasColumn('bookings', 'cancellation_reason_details')) {
                $table->text('cancellation_reason_details')->nullable()->after('cancellation_reason');
            }

            if (! Schema::hasColumn('bookings', 'cancelled_at')) {
                $table->timestamp('cancelled_at')->nullable()->after('cancellation_reason_details');
                $table->index('cancelled_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            if (Schema::hasColumn('bookings', 'cancelled_at')) {
                $table->dropIndex(['cancelled_at']);
                $table->dropColumn('cancelled_at');
            }

            if (Schema::hasColumn('bookings', 'cancellation_reason_details')) {
                $table->dropColumn('cancellation_reason_details');
            }

            if (Schema::hasColumn('bookings', 'cancellation_reason')) {
                $table->dropIndex(['cancellation_reason']);
                $table->dropColumn('cancellation_reason');
            }
        });
    }
};
