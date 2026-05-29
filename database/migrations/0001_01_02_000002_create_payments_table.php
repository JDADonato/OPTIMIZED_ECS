<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Ported from: server/db/schema.sql — Payments Table (lines 67-80)
     */
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->onDelete('cascade');
            $table->decimal('amount', 10, 2);
            $table->string('payment_method');
            $table->string('proof_image')->nullable();
            $table->string('status')->default('Pending');
            $table->enum('payment_type', ['Reservation', 'DownPayment', 'Final']);
            $table->date('due_date')->nullable();
            $table->string('verified_by')->nullable();
            $table->datetime('verified_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
