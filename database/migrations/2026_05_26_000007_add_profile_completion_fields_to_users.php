<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'avatar_path')) {
                $table->string('avatar_path')->nullable()->after('phone');
            }
            if (! Schema::hasColumn('users', 'preferred_contact_method')) {
                $table->string('preferred_contact_method')->nullable()->after('avatar_path');
            }
            if (! Schema::hasColumn('users', 'notification_preferences')) {
                $table->json('notification_preferences')->nullable()->after('preferred_contact_method');
            }
            if (! Schema::hasColumn('users', 'profile_preferences')) {
                $table->json('profile_preferences')->nullable()->after('notification_preferences');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            foreach (['avatar_path', 'preferred_contact_method', 'notification_preferences', 'profile_preferences'] as $column) {
                if (Schema::hasColumn('users', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
