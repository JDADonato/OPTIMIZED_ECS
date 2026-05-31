<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversation_participants', function (Blueprint $table) {
            if (! Schema::hasColumn('conversation_participants', 'removed_at')) {
                $table->timestamp('removed_at')->nullable()->index()->after('joined_at');
            }
            if (! Schema::hasColumn('conversation_participants', 'removed_by')) {
                $table->foreignId('removed_by')->nullable()->after('removed_at')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('conversation_participants', 'removal_reason')) {
                $table->string('removal_reason')->nullable()->index()->after('removed_by');
            }
        });
    }

    public function down(): void
    {
        Schema::table('conversation_participants', function (Blueprint $table) {
            if (Schema::hasColumn('conversation_participants', 'removed_by')) {
                $table->dropConstrainedForeignId('removed_by');
            }
            foreach (['removal_reason', 'removed_at'] as $column) {
                if (Schema::hasColumn('conversation_participants', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
