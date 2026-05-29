<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->string('paymongo_checkout_session_id')->nullable()->after('verified_at');
            $table->string('paymongo_payment_id')->nullable()->after('paymongo_checkout_session_id');
            $table->string('paymongo_payment_intent_id')->nullable()->after('paymongo_payment_id');
            $table->string('paymongo_reference_number')->nullable()->after('paymongo_payment_intent_id');
            $table->string('paymongo_event_id')->nullable()->after('paymongo_reference_number');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn([
                'paymongo_checkout_session_id',
                'paymongo_payment_id',
                'paymongo_payment_intent_id',
                'paymongo_reference_number',
                'paymongo_event_id',
            ]);
        });
    }
};
