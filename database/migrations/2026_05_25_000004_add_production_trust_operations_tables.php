<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('payment_events')) {
            Schema::create('payment_events', function (Blueprint $table) {
                $table->id();
                $table->foreignId('payment_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('booking_id')->nullable()->constrained()->nullOnDelete();
                $table->string('event_type')->index();
                $table->string('source')->default('system')->index();
                $table->string('provider_reference')->nullable();
                $table->string('provider_event_id')->nullable()->unique();
                $table->json('metadata')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index(['payment_id', 'event_type']);
                $table->index(['booking_id', 'event_type']);
            });
        }

        if (! Schema::hasTable('refund_cases')) {
            Schema::create('refund_cases', function (Blueprint $table) {
                $table->id();
                $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
                $table->foreignId('payment_id')->nullable()->constrained()->nullOnDelete();
                $table->decimal('amount', 12, 2)->default(0);
                $table->decimal('non_refundable_amount', 12, 2)->default(0);
                $table->string('reason')->nullable();
                $table->string('status')->default('Requested')->index();
                $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('provider_refund_id')->nullable();
                $table->json('provider_response')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index(['booking_id', 'status']);
            });
        }

        if (! Schema::hasTable('event_preparation_tasks')) {
            Schema::create('event_preparation_tasks', function (Blueprint $table) {
                $table->id();
                $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
                $table->string('department')->default('Operations');
                $table->string('label');
                $table->string('status')->default('Pending')->index();
                $table->timestamp('due_at')->nullable();
                $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();

                $table->unique(['booking_id', 'label']);
                $table->index(['booking_id', 'department']);
            });
        }

        if (! Schema::hasTable('feedback_requests')) {
            Schema::create('feedback_requests', function (Blueprint $table) {
                $table->id();
                $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
                $table->string('token')->unique();
                $table->string('status')->default('Pending')->index();
                $table->timestamp('sent_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamp('expires_at')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('feedback_responses')) {
            Schema::create('feedback_responses', function (Blueprint $table) {
                $table->id();
                $table->foreignId('feedback_request_id')->constrained()->cascadeOnDelete();
                $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
                $table->unsignedTinyInteger('rating');
                $table->unsignedTinyInteger('food_rating')->nullable();
                $table->unsignedTinyInteger('service_rating')->nullable();
                $table->unsignedTinyInteger('communication_rating')->nullable();
                $table->unsignedTinyInteger('value_rating')->nullable();
                $table->text('comments')->nullable();
                $table->boolean('testimonial_permission')->default(false);
                $table->boolean('follow_up_required')->default(false);
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('feedback_responses');
        Schema::dropIfExists('feedback_requests');
        Schema::dropIfExists('event_preparation_tasks');
        Schema::dropIfExists('refund_cases');
        Schema::dropIfExists('payment_events');
    }
};
