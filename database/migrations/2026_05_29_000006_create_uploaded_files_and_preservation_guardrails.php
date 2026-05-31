<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('uploaded_files')) {
            Schema::create('uploaded_files', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('disk')->default('public');
                $table->string('path');
                $table->string('url');
                $table->string('mime_type')->nullable();
                $table->unsignedBigInteger('size')->nullable();
                $table->string('original_name')->nullable();
                $table->string('purpose')->default('theme_upload')->index();
                $table->string('status')->default('temporary')->index();
                $table->nullableMorphs('attachable');
                $table->timestamp('attached_at')->nullable();
                $table->timestamp('expires_at')->nullable()->index();
                $table->timestamps();

                $table->unique(['disk', 'path']);
                $table->index(['user_id', 'status']);
            });
        }

        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach ($this->restrictForeignKeys() as [$table, $constraint, $column, $references]) {
            $this->replacePostgresForeign($table, $constraint, $column, $references, 'RESTRICT');
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            foreach ($this->originalForeignKeys() as [$table, $constraint, $column, $references, $onDelete]) {
                $this->replacePostgresForeign($table, $constraint, $column, $references, $onDelete);
            }
        }

        Schema::dropIfExists('uploaded_files');
    }

    private function replacePostgresForeign(string $table, string $constraint, string $column, string $references, string $onDelete): void
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column)) {
            return;
        }

        DB::statement(sprintf('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %s', $table, $constraint));
        DB::statement(sprintf(
            'ALTER TABLE %s ADD CONSTRAINT %s FOREIGN KEY (%s) REFERENCES %s(id) ON DELETE %s',
            $table,
            $constraint,
            $column,
            $references,
            $onDelete
        ));
    }

    private function restrictForeignKeys(): array
    {
        return [
            ['bookings', 'bookings_user_id_foreign', 'user_id', 'users'],
            ['payments', 'payments_booking_id_foreign', 'booking_id', 'bookings'],
            ['booking_items', 'booking_items_booking_id_foreign', 'booking_id', 'bookings'],
            ['booking_review_tasks', 'booking_review_tasks_booking_id_foreign', 'booking_id', 'bookings'],
            ['event_preparation_tasks', 'event_preparation_tasks_booking_id_foreign', 'booking_id', 'bookings'],
            ['refund_cases', 'refund_cases_booking_id_foreign', 'booking_id', 'bookings'],
            ['payment_events', 'payment_events_booking_id_foreign', 'booking_id', 'bookings'],
            ['payment_events', 'payment_events_payment_id_foreign', 'payment_id', 'payments'],
            ['feedback_requests', 'feedback_requests_booking_id_foreign', 'booking_id', 'bookings'],
            ['feedback_responses', 'feedback_responses_booking_id_foreign', 'booking_id', 'bookings'],
            ['feedback_responses', 'feedback_responses_feedback_request_id_foreign', 'feedback_request_id', 'feedback_requests'],
            ['conversations', 'conversations_client_id_foreign', 'client_id', 'users'],
            ['messages', 'messages_sender_id_foreign', 'sender_id', 'users'],
            ['messages', 'messages_receiver_id_foreign', 'receiver_id', 'users'],
            ['messages', 'messages_conversation_id_foreign', 'conversation_id', 'conversations'],
            ['conversation_participants', 'conversation_participants_conversation_id_foreign', 'conversation_id', 'conversations'],
            ['conversation_participants', 'conversation_participants_user_id_foreign', 'user_id', 'users'],
            ['booking_history_notes', 'booking_history_notes_booking_id_foreign', 'booking_id', 'bookings'],
            ['booking_history_notes', 'booking_history_notes_user_id_foreign', 'user_id', 'users'],
        ];
    }

    private function originalForeignKeys(): array
    {
        return [
            ['bookings', 'bookings_user_id_foreign', 'user_id', 'users', 'CASCADE'],
            ['payments', 'payments_booking_id_foreign', 'booking_id', 'bookings', 'CASCADE'],
            ['booking_items', 'booking_items_booking_id_foreign', 'booking_id', 'bookings', 'CASCADE'],
            ['booking_review_tasks', 'booking_review_tasks_booking_id_foreign', 'booking_id', 'bookings', 'CASCADE'],
            ['event_preparation_tasks', 'event_preparation_tasks_booking_id_foreign', 'booking_id', 'bookings', 'CASCADE'],
            ['refund_cases', 'refund_cases_booking_id_foreign', 'booking_id', 'bookings', 'CASCADE'],
            ['payment_events', 'payment_events_booking_id_foreign', 'booking_id', 'bookings', 'SET NULL'],
            ['payment_events', 'payment_events_payment_id_foreign', 'payment_id', 'payments', 'SET NULL'],
            ['feedback_requests', 'feedback_requests_booking_id_foreign', 'booking_id', 'bookings', 'CASCADE'],
            ['feedback_responses', 'feedback_responses_booking_id_foreign', 'booking_id', 'bookings', 'CASCADE'],
            ['feedback_responses', 'feedback_responses_feedback_request_id_foreign', 'feedback_request_id', 'feedback_requests', 'CASCADE'],
            ['conversations', 'conversations_client_id_foreign', 'client_id', 'users', 'CASCADE'],
            ['messages', 'messages_sender_id_foreign', 'sender_id', 'users', 'CASCADE'],
            ['messages', 'messages_receiver_id_foreign', 'receiver_id', 'users', 'CASCADE'],
            ['messages', 'messages_conversation_id_foreign', 'conversation_id', 'conversations', 'CASCADE'],
            ['conversation_participants', 'conversation_participants_conversation_id_foreign', 'conversation_id', 'conversations', 'CASCADE'],
            ['conversation_participants', 'conversation_participants_user_id_foreign', 'user_id', 'users', 'CASCADE'],
            ['booking_history_notes', 'booking_history_notes_booking_id_foreign', 'booking_id', 'bookings', 'CASCADE'],
            ['booking_history_notes', 'booking_history_notes_user_id_foreign', 'user_id', 'users', 'CASCADE'],
        ];
    }
};
