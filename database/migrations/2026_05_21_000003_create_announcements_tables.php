<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('announcements')) {
            Schema::create('announcements', function (Blueprint $table) {
                $table->id();
                $table->string('title');
                $table->string('slug')->unique();
                $table->string('summary')->nullable();
                $table->longText('body')->nullable();
                $table->string('type')->default('general');
                $table->string('status')->default('draft')->index();
                $table->string('visibility')->default('all_customers')->index();
                $table->json('visibility_roles')->nullable();
                $table->json('specific_user_ids')->nullable();
                $table->timestamp('starts_at')->nullable()->index();
                $table->timestamp('ends_at')->nullable()->index();
                $table->timestamp('published_at')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
                $table->boolean('send_email')->default(false);
                $table->string('email_subject')->nullable();
                $table->longText('email_body')->nullable();
                $table->string('cta_label')->nullable();
                $table->string('cta_url')->nullable();
                $table->string('image_path')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('announcement_recipients')) {
            Schema::create('announcement_recipients', function (Blueprint $table) {
                $table->id();
                $table->foreignId('announcement_id')->constrained('announcements')->cascadeOnDelete();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('email')->nullable()->index();
                $table->string('status')->default('pending')->index();
                $table->timestamp('sent_at')->nullable();
                $table->timestamp('opened_at')->nullable();
                $table->timestamp('clicked_at')->nullable();
                $table->timestamps();
                $table->unique(['announcement_id', 'user_id']);
            });
        }

        if (! Schema::hasTable('announcement_reads')) {
            Schema::create('announcement_reads', function (Blueprint $table) {
                $table->id();
                $table->foreignId('announcement_id')->constrained('announcements')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->timestamp('read_at');
                $table->timestamps();
                $table->unique(['announcement_id', 'user_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('announcement_reads');
        Schema::dropIfExists('announcement_recipients');
        Schema::dropIfExists('announcements');
    }
};
