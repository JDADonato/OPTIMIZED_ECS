<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Custom menu items added by the admin through the Configuration panel.
     * These are merged with the static DISHES catalog on the frontend.
     */
    public function up(): void
    {
        Schema::create('menu_items', function (Blueprint $table) {
            $table->id();
            $table->string('dish_id')->unique();      // e.g., "custom_abc123"
            $table->string('name');
            $table->string('category');                // starters, mains, sides, desserts, drinks
            $table->decimal('cost_per_head', 10, 2)->default(0);
            $table->decimal('price_adj', 10, 2)->default(0);
            $table->string('image')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_best_seller')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('menu_items');
    }
};
