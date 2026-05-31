<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'password_policy_version')) {
                $table->unsignedTinyInteger('password_policy_version')
                    ->default(1)
                    ->after('password_changed_at')
                    ->index();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'password_policy_version')) {
                $table->dropColumn('password_policy_version');
            }
        });
    }
};
