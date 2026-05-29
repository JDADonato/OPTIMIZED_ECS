<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('event_types', function (Blueprint $table) {
            if (!Schema::hasColumn('event_types', 'package_category')) {
                $table->string('package_category')->default('standard')->after('image');
            }
            if (!Schema::hasColumn('event_types', 'applicable_setups')) {
                $table->json('applicable_setups')->nullable()->after('package_category');
            }
            if (!Schema::hasColumn('event_types', 'security_type')) {
                $table->string('security_type')->default('cash_bond')->after('applicable_setups');
            }
            if (!Schema::hasColumn('event_types', 'security_label')) {
                $table->string('security_label')->nullable()->after('security_type');
            }
            if (!Schema::hasColumn('event_types', 'security_description')) {
                $table->text('security_description')->nullable()->after('security_label');
            }
        });

        Schema::table('packages', function (Blueprint $table) {
            if (!Schema::hasColumn('packages', 'package_category')) {
                $table->string('package_category')->default('standard')->after('type');
            }
            if (!Schema::hasColumn('packages', 'event_type_slugs')) {
                $table->json('event_type_slugs')->nullable()->after('package_category');
            }
            if (!Schema::hasColumn('packages', 'amenities')) {
                $table->json('amenities')->nullable()->after('inclusions');
            }
            if (!Schema::hasColumn('packages', 'applicable_setups')) {
                $table->json('applicable_setups')->nullable()->after('amenities');
            }
            if (!Schema::hasColumn('packages', 'security_type')) {
                $table->string('security_type')->nullable()->after('menu_structure');
            }
            if (!Schema::hasColumn('packages', 'security_label')) {
                $table->string('security_label')->nullable()->after('security_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('packages', function (Blueprint $table) {
            foreach (['security_label', 'security_type', 'applicable_setups', 'amenities', 'event_type_slugs', 'package_category'] as $column) {
                if (Schema::hasColumn('packages', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('event_types', function (Blueprint $table) {
            foreach (['security_description', 'security_label', 'security_type', 'applicable_setups', 'package_category'] as $column) {
                if (Schema::hasColumn('event_types', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
