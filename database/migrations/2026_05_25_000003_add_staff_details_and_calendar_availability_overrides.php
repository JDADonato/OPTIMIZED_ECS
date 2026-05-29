<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'full_name')) {
                $table->string('full_name')->nullable()->after('id');
            }
        });

        Schema::table('bookings', function (Blueprint $table) {
            if (!Schema::hasColumn('bookings', 'event_name')) {
                $table->string('event_name')->nullable()->after('event_type');
            }
        });

        if (!Schema::hasTable('calendar_availability_overrides')) {
            Schema::create('calendar_availability_overrides', function (Blueprint $table) {
                $table->id();
                $table->date('date')->unique();
                $table->boolean('is_locked')->default(false);
                $table->unsignedInteger('max_events_override')->nullable();
                $table->unsignedInteger('max_pax_override')->nullable();
                $table->text('note')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index('date');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('calendar_availability_overrides');

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'full_name')) {
                $table->dropColumn('full_name');
            }
        });

        Schema::table('bookings', function (Blueprint $table) {
            if (Schema::hasColumn('bookings', 'event_name')) {
                $table->dropColumn('event_name');
            }
        });
    }
};
