<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('refund_cases') || Schema::hasColumn('refund_cases', 'provider_refund_status')) {
            return;
        }

        Schema::table('refund_cases', function (Blueprint $table) {
            $table->string('provider_refund_status')->nullable()->after('provider_refund_id')->index();
            $table->timestamp('provider_synced_at')->nullable()->after('provider_refund_status');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('refund_cases') || ! Schema::hasColumn('refund_cases', 'provider_refund_status')) {
            return;
        }

        Schema::table('refund_cases', function (Blueprint $table) {
            $table->dropColumn(['provider_refund_status', 'provider_synced_at']);
        });
    }
};
