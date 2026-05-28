<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('conversion_events')) {
            return;
        }

        Schema::create('conversion_events', function (Blueprint $table) {
            $table->id();
            $table->string('event_name')->index();
            $table->foreignId('user_id')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->foreignId('booking_id')->nullable()->index()->constrained('bookings')->nullOnDelete();
            $table->string('role')->nullable()->index();
            $table->string('source')->nullable()->index();
            $table->string('step')->nullable()->index();
            $table->json('metadata')->nullable();
            $table->timestamp('occurred_at')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversion_events');
    }
};
