<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('event_types', function (Blueprint $table) {
            if (! Schema::hasColumn('event_types', 'is_active')) {
                $table->boolean('is_active')->default(true)->index()->after('image');
            }
            if (! Schema::hasColumn('event_types', 'archived_at')) {
                $table->timestamp('archived_at')->nullable()->index()->after('is_active');
            }
        });

        Schema::table('report_templates', function (Blueprint $table) {
            if (! Schema::hasColumn('report_templates', 'archived_at')) {
                $table->timestamp('archived_at')->nullable()->index()->after('visibility');
            }
        });
    }

    public function down(): void
    {
        Schema::table('report_templates', function (Blueprint $table) {
            if (Schema::hasColumn('report_templates', 'archived_at')) {
                $table->dropColumn('archived_at');
            }
        });

        Schema::table('event_types', function (Blueprint $table) {
            if (Schema::hasColumn('event_types', 'archived_at')) {
                $table->dropColumn('archived_at');
            }
            if (Schema::hasColumn('event_types', 'is_active')) {
                $table->dropColumn('is_active');
            }
        });
    }
};
