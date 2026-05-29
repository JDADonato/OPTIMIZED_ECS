<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Ported from: server/db/schema.sql — Bookings Table (lines 16-49)
     */
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->date('event_date');
            $table->string('event_time');
            $table->integer('pax');
            $table->integer('budget')->nullable();
            $table->string('package_id')->nullable();
            $table->string('event_type')->nullable();
            $table->string('client_full_name')->nullable();
            $table->string('venue_address_line')->nullable();
            $table->string('venue_street')->nullable();
            $table->string('venue_city')->nullable();
            $table->string('venue_province')->nullable();
            $table->string('venue_zip_code')->nullable();
            $table->string('venue_building_details')->nullable();
            $table->string('client_email')->nullable();
            $table->string('client_phone')->nullable();
            $table->string('reservation_time')->nullable();
            $table->string('serving_time')->nullable();
            $table->text('event_timeline')->nullable();
            $table->string('color_motif')->nullable();
            $table->unsignedBigInteger('food_tasting_id')->nullable();
            $table->decimal('total_cost', 10, 2)->nullable();
            $table->string('status')->default('Pending');
            $table->text('outsourced_services')->nullable(); // JSON string
            $table->text('theme_uploads')->nullable(); // JSON string
            $table->text('special_instructions')->nullable();
            $table->text('selected_menu')->nullable(); // JSON string
            $table->string('live_status')->default('Not Started');
            $table->decimal('transport_fee', 10, 2)->default(0);
            $table->decimal('labor_surcharge', 10, 2)->default(0);
            $table->decimal('discount_value', 10, 2)->default(0);
            $table->string('discount_type')->default('fixed');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
