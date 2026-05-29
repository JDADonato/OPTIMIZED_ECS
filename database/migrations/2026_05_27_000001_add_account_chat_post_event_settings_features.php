<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'account_status')) {
                $table->string('account_status')->default('active')->after('role')->index();
            }
            if (!Schema::hasColumn('users', 'deactivated_at')) {
                $table->timestamp('deactivated_at')->nullable()->after('account_status');
            }
            if (!Schema::hasColumn('users', 'deactivated_by')) {
                $table->foreignId('deactivated_by')->nullable()->after('deactivated_at')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('users', 'deactivation_reason')) {
                $table->text('deactivation_reason')->nullable()->after('deactivated_by');
            }
            if (!Schema::hasColumn('users', 'must_change_password')) {
                $table->boolean('must_change_password')->default(false)->after('deactivation_reason')->index();
            }
            if (!Schema::hasColumn('users', 'password_changed_at')) {
                $table->timestamp('password_changed_at')->nullable()->after('must_change_password');
            }
            if (!Schema::hasColumn('users', 'temporary_password_expires_at')) {
                $table->timestamp('temporary_password_expires_at')->nullable()->after('password_changed_at');
            }
            if (!Schema::hasColumn('users', 'last_login_at')) {
                $table->timestamp('last_login_at')->nullable()->after('temporary_password_expires_at');
            }
        });

        Schema::table('bookings', function (Blueprint $table) {
            if (!Schema::hasColumn('bookings', 'post_event_status')) {
                $table->string('post_event_status')->nullable()->after('live_status')->index();
            }
            if (!Schema::hasColumn('bookings', 'closed_at')) {
                $table->timestamp('closed_at')->nullable()->after('post_event_status');
            }
            if (!Schema::hasColumn('bookings', 'closed_by')) {
                $table->foreignId('closed_by')->nullable()->after('closed_at')->constrained('users')->nullOnDelete();
            }
        });

        Schema::table('conversations', function (Blueprint $table) {
            if (!Schema::hasColumn('conversations', 'booking_id')) {
                $table->foreignId('booking_id')->nullable()->after('staff_id')->constrained()->nullOnDelete();
            }
            if (!Schema::hasColumn('conversations', 'joined_by_admin_at')) {
                $table->timestamp('joined_by_admin_at')->nullable()->after('status');
            }
            if (!Schema::hasColumn('conversations', 'internal_notes')) {
                $table->text('internal_notes')->nullable()->after('joined_by_admin_at');
            }
            if (!Schema::hasColumn('conversations', 'reopened_at')) {
                $table->timestamp('reopened_at')->nullable()->after('internal_notes');
            }
        });

        Schema::table('messages', function (Blueprint $table) {
            if (!Schema::hasColumn('messages', 'message_type')) {
                $table->string('message_type')->default('message')->after('message')->index();
            }
            if (!Schema::hasColumn('messages', 'edited_at')) {
                $table->timestamp('edited_at')->nullable()->after('read_at');
            }
            if (!Schema::hasColumn('messages', 'deleted_at')) {
                $table->timestamp('deleted_at')->nullable()->after('edited_at')->index();
            }
            if (!Schema::hasColumn('messages', 'deleted_by')) {
                $table->foreignId('deleted_by')->nullable()->after('deleted_at')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('messages', 'delete_reason')) {
                $table->text('delete_reason')->nullable()->after('deleted_by');
            }
            if (!Schema::hasColumn('messages', 'metadata')) {
                $table->json('metadata')->nullable()->after('delete_reason');
            }
        });

        Schema::table('feedback_responses', function (Blueprint $table) {
            if (!Schema::hasColumn('feedback_responses', 'assigned_to')) {
                $table->foreignId('assigned_to')->nullable()->after('follow_up_required')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('feedback_responses', 'follow_up_due_at')) {
                $table->timestamp('follow_up_due_at')->nullable()->after('assigned_to')->index();
            }
        });

        if (!Schema::hasTable('business_settings')) {
            Schema::create('business_settings', function (Blueprint $table) {
                $table->id();
                $table->string('key')->unique();
                $table->json('value')->nullable();
                $table->string('group')->default('general')->index();
                $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('business_settings');

        Schema::table('feedback_responses', function (Blueprint $table) {
            if (Schema::hasColumn('feedback_responses', 'assigned_to')) {
                $table->dropConstrainedForeignId('assigned_to');
            }
            if (Schema::hasColumn('feedback_responses', 'follow_up_due_at')) {
                $table->dropColumn('follow_up_due_at');
            }
        });

        Schema::table('messages', function (Blueprint $table) {
            if (Schema::hasColumn('messages', 'deleted_by')) {
                $table->dropConstrainedForeignId('deleted_by');
            }
            foreach (['metadata', 'delete_reason', 'deleted_at', 'edited_at', 'message_type'] as $column) {
                if (Schema::hasColumn('messages', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('conversations', function (Blueprint $table) {
            if (Schema::hasColumn('conversations', 'booking_id')) {
                $table->dropConstrainedForeignId('booking_id');
            }
            foreach (['reopened_at', 'internal_notes', 'joined_by_admin_at'] as $column) {
                if (Schema::hasColumn('conversations', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('bookings', function (Blueprint $table) {
            if (Schema::hasColumn('bookings', 'closed_by')) {
                $table->dropConstrainedForeignId('closed_by');
            }
            foreach (['closed_at', 'post_event_status'] as $column) {
                if (Schema::hasColumn('bookings', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'deactivated_by')) {
                $table->dropConstrainedForeignId('deactivated_by');
            }
            foreach ([
                'last_login_at',
                'temporary_password_expires_at',
                'password_changed_at',
                'must_change_password',
                'deactivation_reason',
                'deactivated_at',
                'account_status',
            ] as $column) {
                if (Schema::hasColumn('users', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
