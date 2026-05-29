<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->indexIfColumnsExist('payments', ['voided_at', 'status', 'due_date'], 'payments_active_status_due_idx');
        $this->indexIfColumnsExist('payments', ['booking_id', 'voided_at', 'status'], 'payments_booking_active_status_idx');
        $this->indexIfColumnsExist('refund_cases', ['status', 'payment_id'], 'refund_cases_status_payment_idx');
        $this->indexIfColumnsExist('refund_cases', ['booking_id', 'status'], 'refund_cases_booking_status_idx');

        $this->indexIfColumnsExist('conversations', ['status', 'client_id', 'staff_id'], 'conversations_status_client_staff_idx');
        $this->indexIfColumnsExist('messages', ['conversation_id', 'deleted_at', 'created_at'], 'messages_thread_visible_created_idx');
        $this->indexIfColumnsExist('conversation_participants', ['conversation_id', 'removed_at', 'role'], 'conversation_participants_active_role_idx');
        $this->indexIfColumnsExist('conversation_participants', ['user_id', 'removed_at'], 'conversation_participants_user_active_idx');

        $this->indexIfColumnsExist('bookings', ['status', 'event_date', 'assigned_to'], 'bookings_status_date_owner_idx');
        $this->indexIfColumnsExist('bookings', ['user_id', 'hidden_from_customer_history_at', 'event_date'], 'bookings_customer_history_visible_idx');
        $this->indexIfColumnsExist('users', ['role', 'account_status', 'email'], 'users_role_status_email_idx');
        $this->indexIfColumnsExist('users', ['role', 'account_status', 'full_name'], 'users_role_status_name_idx');

        $this->indexIfColumnsExist('contact_inquiries', ['status', 'event_date', 'assigned_to'], 'contact_inquiries_status_date_owner_idx');
        $this->indexIfColumnsExist('contact_inquiries', ['duplicate_user_id', 'status'], 'contact_inquiries_duplicate_status_idx');
        $this->indexIfColumnsExist('food_tastings', ['status', 'preferred_date', 'handled_by'], 'food_tastings_status_date_owner_idx');
        $this->indexIfColumnsExist('food_tastings', ['duplicate_user_id', 'status'], 'food_tastings_duplicate_status_idx');

        $this->indexIfColumnsExist('announcements', ['status', 'published_at'], 'announcements_status_published_idx');
        $this->indexIfColumnsExist('report_templates', ['archived_at', 'updated_at'], 'report_templates_archive_updated_idx');
        $this->indexIfColumnsExist('notifications', ['notifiable_type', 'notifiable_id', 'read_at', 'created_at'], 'notifications_owner_read_created_idx');
    }

    public function down(): void
    {
        foreach ([
            ['payments', 'payments_active_status_due_idx'],
            ['payments', 'payments_booking_active_status_idx'],
            ['refund_cases', 'refund_cases_status_payment_idx'],
            ['refund_cases', 'refund_cases_booking_status_idx'],
            ['conversations', 'conversations_status_client_staff_idx'],
            ['messages', 'messages_thread_visible_created_idx'],
            ['conversation_participants', 'conversation_participants_active_role_idx'],
            ['conversation_participants', 'conversation_participants_user_active_idx'],
            ['bookings', 'bookings_status_date_owner_idx'],
            ['bookings', 'bookings_customer_history_visible_idx'],
            ['users', 'users_role_status_email_idx'],
            ['users', 'users_role_status_name_idx'],
            ['contact_inquiries', 'contact_inquiries_status_date_owner_idx'],
            ['contact_inquiries', 'contact_inquiries_duplicate_status_idx'],
            ['food_tastings', 'food_tastings_status_date_owner_idx'],
            ['food_tastings', 'food_tastings_duplicate_status_idx'],
            ['announcements', 'announcements_status_published_idx'],
            ['report_templates', 'report_templates_archive_updated_idx'],
            ['notifications', 'notifications_owner_read_created_idx'],
        ] as [$table, $index]) {
            if (Schema::hasTable($table)) {
                Schema::table($table, fn (Blueprint $table) => $table->dropIndex($index));
            }
        }
    }

    private function indexIfColumnsExist(string $table, array $columns, string $name): void
    {
        if (! Schema::hasTable($table)) {
            return;
        }

        foreach ($columns as $column) {
            if (! Schema::hasColumn($table, $column)) {
                return;
            }
        }

        Schema::table($table, fn (Blueprint $blueprint) => $blueprint->index($columns, $name));
    }
};
