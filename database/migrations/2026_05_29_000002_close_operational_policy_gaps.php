<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('bookings')) {
            Schema::table('bookings', function (Blueprint $table) {
                if (! Schema::hasColumn('bookings', 'hidden_from_customer_history_at')) {
                    $table->timestamp('hidden_from_customer_history_at')->nullable()->index()->after('closed_at');
                }
            });
        }

        if (Schema::hasTable('refund_cases')) {
            Schema::table('refund_cases', function (Blueprint $table) {
                if (! Schema::hasColumn('refund_cases', 'resolved_by')) {
                    $table->foreignId('resolved_by')->nullable()->after('approved_by')->constrained('users')->nullOnDelete();
                }
                if (! Schema::hasColumn('refund_cases', 'resolved_at')) {
                    $table->timestamp('resolved_at')->nullable()->index()->after('resolved_by');
                }
                if (! Schema::hasColumn('refund_cases', 'last_action')) {
                    $table->string('last_action')->nullable()->index()->after('status');
                }
            });
        }

        if (Schema::hasTable('food_tastings')) {
            Schema::table('food_tastings', function (Blueprint $table) {
                if (! Schema::hasColumn('food_tastings', 'archived_at')) {
                    $table->timestamp('archived_at')->nullable()->index()->after('completed_at');
                }
                if (! Schema::hasColumn('food_tastings', 'duplicate_user_id')) {
                    $table->foreignId('duplicate_user_id')->nullable()->after('handled_by')->constrained('users')->nullOnDelete();
                }
            });
        }

        if (Schema::hasTable('contact_inquiries')) {
            Schema::table('contact_inquiries', function (Blueprint $table) {
                if (! Schema::hasColumn('contact_inquiries', 'archived_at')) {
                    $table->timestamp('archived_at')->nullable()->index()->after('resolved_at');
                }
                if (! Schema::hasColumn('contact_inquiries', 'duplicate_user_id')) {
                    $table->foreignId('duplicate_user_id')->nullable()->after('assigned_to')->constrained('users')->nullOnDelete();
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('contact_inquiries')) {
            Schema::table('contact_inquiries', function (Blueprint $table) {
                if (Schema::hasColumn('contact_inquiries', 'duplicate_user_id')) {
                    $table->dropConstrainedForeignId('duplicate_user_id');
                }
                if (Schema::hasColumn('contact_inquiries', 'archived_at')) {
                    $table->dropColumn('archived_at');
                }
            });
        }

        if (Schema::hasTable('food_tastings')) {
            Schema::table('food_tastings', function (Blueprint $table) {
                if (Schema::hasColumn('food_tastings', 'duplicate_user_id')) {
                    $table->dropConstrainedForeignId('duplicate_user_id');
                }
                if (Schema::hasColumn('food_tastings', 'archived_at')) {
                    $table->dropColumn('archived_at');
                }
            });
        }

        if (Schema::hasTable('refund_cases')) {
            Schema::table('refund_cases', function (Blueprint $table) {
                if (Schema::hasColumn('refund_cases', 'resolved_by')) {
                    $table->dropConstrainedForeignId('resolved_by');
                }
                foreach (['resolved_at', 'last_action'] as $column) {
                    if (Schema::hasColumn('refund_cases', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }

        if (Schema::hasTable('bookings')) {
            Schema::table('bookings', function (Blueprint $table) {
                if (Schema::hasColumn('bookings', 'hidden_from_customer_history_at')) {
                    $table->dropColumn('hidden_from_customer_history_at');
                }
            });
        }
    }
};
