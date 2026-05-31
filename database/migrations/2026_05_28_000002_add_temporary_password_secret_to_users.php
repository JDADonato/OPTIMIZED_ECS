<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'temporary_password_secret')) {
                $table->text('temporary_password_secret')->nullable()->after('temporary_password_expires_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'temporary_password_secret')) {
                $table->dropColumn('temporary_password_secret');
            }
        });
    }
};
