<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('contact_inquiries')) {
            Schema::create('contact_inquiries', function (Blueprint $table) {
                $table->id();
                $table->string('full_name');
                $table->string('email')->index();
                $table->string('phone')->nullable();
                $table->date('event_date')->nullable()->index();
                $table->unsignedInteger('pax')->nullable();
                $table->string('event_type')->nullable()->index();
                $table->string('subject');
                $table->text('message');
                $table->string('status')->default('New')->index();
                $table->string('source')->default('public_contact')->index();
                $table->json('metadata')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_inquiries');
    }
};
