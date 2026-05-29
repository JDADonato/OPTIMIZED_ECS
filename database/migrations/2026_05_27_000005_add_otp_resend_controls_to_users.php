<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'otp_resend_available_at')) {
                $table->timestamp('otp_resend_available_at')->nullable()->after('otp_expires_at');
            }

            if (!Schema::hasColumn('users', 'otp_resend_attempts')) {
                $table->unsignedTinyInteger('otp_resend_attempts')->default(0)->after('otp_resend_available_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            foreach (['otp_resend_attempts', 'otp_resend_available_at'] as $column) {
                if (Schema::hasColumn('users', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
