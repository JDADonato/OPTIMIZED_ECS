<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Event Types table
        if (! Schema::hasTable('event_types')) {
            Schema::create('event_types', function (Blueprint $table) {
                $table->id();
                $table->string('slug')->unique();
                $table->string('label');
                $table->string('icon');
                $table->text('description')->nullable();
                $table->string('image')->nullable();
                $table->timestamps();
            });
        }

        // Packages table
        if (! Schema::hasTable('packages')) {
            Schema::create('packages', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('type');
                $table->integer('base_price_per_head');
                $table->integer('minimum_pax')->default(50);
                $table->text('description')->nullable();
                $table->json('inclusions')->nullable();
                $table->json('menu_structure')->nullable(); // {starters: 2, mains: 4, ...}
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        // Booking Business Rules table (for lead time & capacity management)
        if (! Schema::hasTable('business_rules')) {
            Schema::create('business_rules', function (Blueprint $table) {
                $table->id();
                $table->integer('minimum_lead_days')->default(7); // Must book 7 days ahead
                $table->integer('maximum_capacity_per_day')->default(7); // Max 7 events per day
                $table->integer('maximum_pax_per_event')->default(1000);
                $table->integer('minimum_pax_per_event')->default(30);
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        // Inventory table (Basic inventory tracking)
        if (! Schema::hasTable('inventory_items')) {
            Schema::create('inventory_items', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('unit'); // kg, liters, pcs, etc.
                $table->integer('quantity_in_stock');
                $table->integer('minimum_threshold');
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        // Dish-Inventory link table (tracks which dishes use which ingredients)
        if (! Schema::hasTable('dish_ingredients')) {
            Schema::create('dish_ingredients', function (Blueprint $table) {
                $table->id();
                $table->foreignId('menu_item_id')->constrained('menu_items')->onDelete('cascade');
                $table->foreignId('inventory_item_id')->constrained('inventory_items')->onDelete('cascade');
                $table->decimal('quantity_needed', 8, 2); // How much per event (for reference)
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('dish_ingredients');
        Schema::dropIfExists('inventory_items');
        Schema::dropIfExists('business_rules');
        Schema::dropIfExists('packages');
        Schema::dropIfExists('menu_items');
        Schema::dropIfExists('event_types');
    }
};
