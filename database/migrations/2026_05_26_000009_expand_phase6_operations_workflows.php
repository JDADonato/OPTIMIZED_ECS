<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('food_tastings', function (Blueprint $table) {
            if (! Schema::hasColumn('food_tastings', 'confirmed_at')) {
                $table->timestamp('confirmed_at')->nullable()->after('status');
            }
            if (! Schema::hasColumn('food_tastings', 'completed_at')) {
                $table->timestamp('completed_at')->nullable()->after('confirmed_at');
            }
            if (! Schema::hasColumn('food_tastings', 'outcome_notes')) {
                $table->text('outcome_notes')->nullable()->after('completed_at');
            }
            if (! Schema::hasColumn('food_tastings', 'handled_by')) {
                $table->foreignId('handled_by')->nullable()->after('outcome_notes')->constrained('users')->nullOnDelete();
            }
        });

        Schema::table('feedback_responses', function (Blueprint $table) {
            if (! Schema::hasColumn('feedback_responses', 'review_status')) {
                $table->string('review_status')->default('Open')->index()->after('follow_up_required');
            }
            if (! Schema::hasColumn('feedback_responses', 'testimonial_status')) {
                $table->string('testimonial_status')->default('Not Requested')->index()->after('review_status');
            }
            if (! Schema::hasColumn('feedback_responses', 'retention_notes')) {
                $table->text('retention_notes')->nullable()->after('testimonial_status');
            }
            if (! Schema::hasColumn('feedback_responses', 'reviewed_by')) {
                $table->foreignId('reviewed_by')->nullable()->after('retention_notes')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('feedback_responses', 'reviewed_at')) {
                $table->timestamp('reviewed_at')->nullable()->after('reviewed_by');
            }
        });
    }

    public function down(): void
    {
        Schema::table('feedback_responses', function (Blueprint $table) {
            foreach (['reviewed_at', 'reviewed_by', 'retention_notes', 'testimonial_status', 'review_status'] as $column) {
                if (Schema::hasColumn('feedback_responses', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('food_tastings', function (Blueprint $table) {
            foreach (['handled_by', 'outcome_notes', 'completed_at', 'confirmed_at'] as $column) {
                if (Schema::hasColumn('food_tastings', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
