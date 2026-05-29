<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('contact_inquiries')) {
            return;
        }

        Schema::table('contact_inquiries', function (Blueprint $table) {
            if (!Schema::hasColumn('contact_inquiries', 'concern_type')) {
                $table->string('concern_type')->default('general')->index()->after('event_type');
            }
            if (!Schema::hasColumn('contact_inquiries', 'assigned_to')) {
                $table->foreignId('assigned_to')->nullable()->after('source')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('contact_inquiries', 'resolved_at')) {
                $table->timestamp('resolved_at')->nullable()->index()->after('assigned_to');
            }
            if (!Schema::hasColumn('contact_inquiries', 'staff_notes')) {
                $table->text('staff_notes')->nullable()->after('resolved_at');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('contact_inquiries')) {
            return;
        }

        Schema::table('contact_inquiries', function (Blueprint $table) {
            if (Schema::hasColumn('contact_inquiries', 'assigned_to')) {
                $table->dropConstrainedForeignId('assigned_to');
            }
            foreach (['concern_type', 'resolved_at', 'staff_notes'] as $column) {
                if (Schema::hasColumn('contact_inquiries', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
