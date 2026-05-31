<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            if (! Schema::hasColumn('payments', 'voided_at')) {
                $table->timestamp('voided_at')->nullable()->index()->after('verified_at');
            }
            if (! Schema::hasColumn('payments', 'voided_by')) {
                $table->foreignId('voided_by')->nullable()->after('voided_at')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('payments', 'void_reason')) {
                $table->string('void_reason')->nullable()->index()->after('voided_by');
            }
            if (! Schema::hasColumn('payments', 'superseded_by_payment_id')) {
                $table->foreignId('superseded_by_payment_id')->nullable()->after('void_reason')->constrained('payments')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            if (Schema::hasColumn('payments', 'superseded_by_payment_id')) {
                $table->dropConstrainedForeignId('superseded_by_payment_id');
            }
            if (Schema::hasColumn('payments', 'voided_by')) {
                $table->dropConstrainedForeignId('voided_by');
            }
            foreach (['void_reason', 'voided_at'] as $column) {
                if (Schema::hasColumn('payments', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
