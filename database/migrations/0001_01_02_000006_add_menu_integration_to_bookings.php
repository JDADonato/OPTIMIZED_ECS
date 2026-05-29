<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add event_type_id foreign key to bookings
        Schema::table('bookings', function (Blueprint $table) {
            if (!Schema::hasColumn('bookings', 'event_type_id')) {
                $table->foreignId('event_type_id')->nullable()->constrained('event_types')->onDelete('set null');
            }
        });

        // Create booking_items junction table
        Schema::create('booking_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->onDelete('cascade');
            $table->foreignId('menu_item_id')->constrained('menu_items')->onDelete('restrict');
            $table->integer('quantity')->default(1);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_items');
        Schema::table('bookings', function (Blueprint $table) {
            if (Schema::hasColumn('bookings', 'event_type_id')) {
                $table->dropForeign(['event_type_id']);
                $table->dropColumn('event_type_id');
            }
        });
    }
};
