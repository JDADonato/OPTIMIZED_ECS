<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('menu_items', function (Blueprint $table) {
            // Add category if it doesn't exist
            if (!Schema::hasColumn('menu_items', 'category')) {
                $table->string('category')->after('name');
            }

            // Add is_active if it doesn't exist
            if (!Schema::hasColumn('menu_items', 'is_active')) {
                $table->boolean('is_active')->default(true)->after('is_best_seller');
            }
        });
    }

    public function down(): void
    {
        Schema::table('menu_items', function (Blueprint $table) {
            if (Schema::hasColumn('menu_items', 'price_adjustment')) {
                $table->dropColumn('price_adjustment');
            }
            if (Schema::hasColumn('menu_items', 'category')) {
                $table->dropColumn('category');
            }
            if (Schema::hasColumn('menu_items', 'is_active')) {
                $table->dropColumn('is_active');
            }
        });
    }
};
