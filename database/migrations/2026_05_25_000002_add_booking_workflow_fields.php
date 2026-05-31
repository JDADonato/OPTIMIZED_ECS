<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            if (! Schema::hasColumn('bookings', 'review_status')) {
                $table->string('review_status')->default('Submitted')->after('status')->index();
            }
            if (! Schema::hasColumn('bookings', 'assigned_to')) {
                $table->foreignId('assigned_to')->nullable()->after('review_status')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('bookings', 'clarification_request')) {
                $table->text('clarification_request')->nullable()->after('assigned_to');
            }
            if (! Schema::hasColumn('bookings', 'clarification_response')) {
                $table->text('clarification_response')->nullable()->after('clarification_request');
            }
            if (! Schema::hasColumn('bookings', 'clarification_requested_at')) {
                $table->timestamp('clarification_requested_at')->nullable()->after('clarification_response');
            }
            if (! Schema::hasColumn('bookings', 'clarification_responded_at')) {
                $table->timestamp('clarification_responded_at')->nullable()->after('clarification_requested_at');
            }
            if (! Schema::hasColumn('bookings', 'reviewed_at')) {
                $table->timestamp('reviewed_at')->nullable()->after('clarification_responded_at');
            }
        });

        if (! Schema::hasTable('booking_review_tasks')) {
            Schema::create('booking_review_tasks', function (Blueprint $table) {
                $table->id();
                $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
                $table->string('task_type')->default('review');
                $table->string('label');
                $table->string('status')->default('Pending')->index();
                $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('completed_at')->nullable();
                $table->boolean('customer_visible')->default(false);
                $table->text('customer_response')->nullable();
                $table->timestamps();

                $table->index(['booking_id', 'status']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_review_tasks');

        Schema::table('bookings', function (Blueprint $table) {
            if (Schema::hasColumn('bookings', 'assigned_to')) {
                $table->dropConstrainedForeignId('assigned_to');
            }

            foreach ([
                'reviewed_at',
                'clarification_responded_at',
                'clarification_requested_at',
                'clarification_response',
                'clarification_request',
                'review_status',
            ] as $column) {
                if (Schema::hasColumn('bookings', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
