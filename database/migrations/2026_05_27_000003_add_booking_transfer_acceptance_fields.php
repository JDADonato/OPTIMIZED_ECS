<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            if (!Schema::hasColumn('bookings', 'transfer_requested_to')) {
                $table->foreignId('transfer_requested_to')->nullable()->after('assigned_to')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('bookings', 'transfer_requested_by')) {
                $table->foreignId('transfer_requested_by')->nullable()->after('transfer_requested_to')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('bookings', 'transfer_requested_at')) {
                $table->timestamp('transfer_requested_at')->nullable()->after('transfer_requested_by');
            }
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            foreach (['transfer_requested_to', 'transfer_requested_by', 'transfer_requested_at'] as $column) {
                if (Schema::hasColumn('bookings', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
