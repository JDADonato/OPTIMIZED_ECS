<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            if (! Schema::hasColumn('messages', 'client_temp_id')) {
                $table->string('client_temp_id', 80)->nullable()->after('sender_id');
            }
        });

        if (! Schema::hasIndex('messages', 'messages_conversation_sender_temp_unique')) {
            Schema::table('messages', function (Blueprint $table) {
                $table->unique(['conversation_id', 'sender_id', 'client_temp_id'], 'messages_conversation_sender_temp_unique');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasIndex('messages', 'messages_conversation_sender_temp_unique')) {
            Schema::table('messages', function (Blueprint $table) {
                $table->dropUnique('messages_conversation_sender_temp_unique');
            });
        }

        Schema::table('messages', function (Blueprint $table) {
            if (Schema::hasColumn('messages', 'client_temp_id')) {
                $table->dropColumn('client_temp_id');
            }
        });
    }
};
