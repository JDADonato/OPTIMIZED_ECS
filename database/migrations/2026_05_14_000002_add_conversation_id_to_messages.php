<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Phase 2: Add conversation_id to messages table.
     * Messages now belong to a Conversation instead of relying on sender_id/receiver_id pairs.
     * We keep sender_id to identify who sent each message.
     * receiver_id is kept for backwards compatibility but becomes nullable.
     *
     * NOTE: Must drop and recreate Supabase RLS policies that reference receiver_id
     * before altering the column, then recreate them with conversation-aware rules.
     */
    public function up(): void
    {
        $isPostgres = DB::connection()->getDriverName() === 'pgsql';

        if ($isPostgres) {
            // 1. Drop RLS policies that reference receiver_id on messages
            DB::statement("drop policy if exists messages_select_participant_or_staff on public.messages");
            DB::statement("drop policy if exists messages_update_participant_or_staff on public.messages");
            DB::statement("drop policy if exists messages_delete_participant_or_staff on public.messages");
        }

        // 2. Alter the table
        Schema::table('messages', function (Blueprint $table) {
            $table->foreignId('conversation_id')
                  ->nullable()
                  ->after('id')
                  ->constrained('conversations')
                  ->onDelete('cascade');

            $table->index('conversation_id');
        });

        if (!$isPostgres) {
            return;
        }

        // Make receiver_id nullable via raw SQL (avoids doctrine/dbal requirement)
        DB::statement('ALTER TABLE messages ALTER COLUMN receiver_id DROP NOT NULL');

        // 3. Recreate RLS policies with conversation-aware rules
        //    Messages are accessible if:
        //    - User is staff (Marketing/Admin)
        //    - User is sender
        //    - User is receiver (legacy)
        //    - User owns the conversation (client_id on conversations table)
        $messageParty = <<<'SQL'
            app.is_staff()
            OR sender_id = app.current_user_id()
            OR receiver_id = app.current_user_id()
            OR EXISTS (
                SELECT 1 FROM public.conversations c
                WHERE c.id = messages.conversation_id
                AND c.client_id = app.current_user_id()
            )
        SQL;

        DB::statement("create policy messages_select_participant_or_staff on public.messages for select using ({$messageParty})");
        DB::statement("create policy messages_update_participant_or_staff on public.messages for update using ({$messageParty}) with check ({$messageParty})");
        DB::statement("create policy messages_delete_participant_or_staff on public.messages for delete using ({$messageParty})");

        // 4. Add RLS policies for the new conversations table
        DB::statement("alter table public.conversations enable row level security");

        // Server can do everything
        DB::statement("create policy conversations_server_manage on public.conversations for all using (app.is_server_role()) with check (app.is_server_role())");

        // Staff can see all conversations
        // Clients can see their own conversations
        $convAccess = "app.is_staff() OR client_id = app.current_user_id()";
        DB::statement("create policy conversations_select_own_or_staff on public.conversations for select using ({$convAccess})");
        DB::statement("create policy conversations_insert_own_or_staff on public.conversations for insert with check ({$convAccess})");
        DB::statement("create policy conversations_update_own_or_staff on public.conversations for update using ({$convAccess}) with check ({$convAccess})");
        DB::statement("create policy conversations_delete_staff on public.conversations for delete using (app.is_staff())");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            Schema::table('messages', function (Blueprint $table) {
                $table->dropForeign(['conversation_id']);
                $table->dropColumn('conversation_id');
            });

            return;
        }

        // Drop conversation policies
        DB::statement("drop policy if exists conversations_server_manage on public.conversations");
        DB::statement("drop policy if exists conversations_select_own_or_staff on public.conversations");
        DB::statement("drop policy if exists conversations_insert_own_or_staff on public.conversations");
        DB::statement("drop policy if exists conversations_update_own_or_staff on public.conversations");
        DB::statement("drop policy if exists conversations_delete_staff on public.conversations");

        // Drop updated message policies
        DB::statement("drop policy if exists messages_select_participant_or_staff on public.messages");
        DB::statement("drop policy if exists messages_update_participant_or_staff on public.messages");
        DB::statement("drop policy if exists messages_delete_participant_or_staff on public.messages");

        // Restore original column and policies
        Schema::table('messages', function (Blueprint $table) {
            $table->dropForeign(['conversation_id']);
            $table->dropColumn('conversation_id');
        });

        DB::statement('ALTER TABLE messages ALTER COLUMN receiver_id SET NOT NULL');

        // Restore original policies
        $messageParty = 'app.is_staff() or sender_id = app.current_user_id() or receiver_id = app.current_user_id()';
        DB::statement("create policy messages_select_participant_or_staff on public.messages for select using ({$messageParty})");
        DB::statement("create policy messages_update_participant_or_staff on public.messages for update using ({$messageParty}) with check ({$messageParty})");
        DB::statement("create policy messages_delete_participant_or_staff on public.messages for delete using ({$messageParty})");
    }
};
