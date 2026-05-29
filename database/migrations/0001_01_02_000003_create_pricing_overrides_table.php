<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Missing from schema.sql but used in adminController.js
     */
    public function up(): void
    {
        Schema::create('pricing_overrides', function (Blueprint $table) {
            $table->string('id')->primary(); // e.g., "dish_chicken_adobo" or "package_buffet_a"
            $table->string('item_type'); // 'dish', 'package', 'service', etc.
            $table->string('item_id'); // identifier of the item being overridden
            $table->decimal('new_price', 10, 2);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pricing_overrides');
    }
};
