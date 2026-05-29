<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('business_rules', function (Blueprint $table) {
            // Payment Tranche Percentages
            $table->decimal('reservation_fee_percentage', 5, 2)->default(10.00);
            $table->decimal('downpayment_percentage', 5, 2)->default(70.00);
            $table->decimal('final_payment_percentage', 5, 2)->default(20.00);

            // Due Date Thresholds
            $table->integer('reservation_validity_hours')->default(24);
            $table->integer('downpayment_due_days')->default(30);
            $table->integer('final_payment_due_days')->default(14);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('business_rules', function (Blueprint $table) {
            $table->dropColumn([
                'reservation_fee_percentage',
                'downpayment_percentage',
                'final_payment_percentage',
                'reservation_validity_hours',
                'downpayment_due_days',
                'final_payment_due_days',
            ]);
        });
    }
};
