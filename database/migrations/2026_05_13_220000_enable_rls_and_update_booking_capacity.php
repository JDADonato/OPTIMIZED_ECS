<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            DB::table('business_rules')->update(['maximum_capacity_per_day' => 7]);
            return;
        }

        DB::unprepared(<<<'SQL'
            create schema if not exists app;

            create or replace function app.current_user_id()
            returns bigint
            language sql
            stable
            as $$
                select nullif(current_setting('app.current_user_id', true), '')::bigint
            $$;

            create or replace function app.current_user_role()
            returns text
            language sql
            stable
            as $$
                select nullif(current_setting('app.current_user_role', true), '')
            $$;

            create or replace function app.is_staff()
            returns boolean
            language sql
            stable
            as $$
                select coalesce(app.current_user_role() in ('Admin', 'Marketing', 'Accounting'), false)
            $$;

            create or replace function app.is_server_role()
            returns boolean
            language sql
            stable
            as $$
                select current_user in ('postgres', 'supabase_admin', 'service_role')
            $$;
        SQL);

        DB::table('business_rules')->update(['maximum_capacity_per_day' => 7]);

        foreach ($this->tables() as $table) {
            DB::statement("alter table public.{$table} enable row level security");
        }

        $this->replacePolicy('users_server_manage', 'users', 'for all', 'app.is_server_role()', 'app.is_server_role()');
        $this->replacePolicy('users_select_own_or_staff', 'users', 'for select', 'app.is_staff() or id = app.current_user_id()');
        $this->replacePolicy('users_insert_staff_or_registration', 'users', 'for insert', null, "app.is_staff() or (app.current_user_id() is null and role = 'Client')");
        $this->replacePolicy('users_update_own_or_staff', 'users', 'for update', 'app.is_staff() or id = app.current_user_id()', 'app.is_staff() or id = app.current_user_id()');
        $this->replacePolicy('users_delete_staff', 'users', 'for delete', "app.current_user_role() = 'Admin'");

        $this->replacePolicy('bookings_server_manage', 'bookings', 'for all', 'app.is_server_role()', 'app.is_server_role()');
        $this->replacePolicy('bookings_select_own_or_staff', 'bookings', 'for select', 'app.is_staff() or user_id = app.current_user_id()');
        $this->replacePolicy('bookings_insert_own_or_staff', 'bookings', 'for insert', null, 'app.is_staff() or user_id = app.current_user_id()');
        $this->replacePolicy('bookings_update_own_or_staff', 'bookings', 'for update', 'app.is_staff() or user_id = app.current_user_id()', 'app.is_staff() or user_id = app.current_user_id()');
        $this->replacePolicy('bookings_delete_own_or_staff', 'bookings', 'for delete', 'app.is_staff() or user_id = app.current_user_id()');

        $this->replacePolicy('food_tastings_server_manage', 'food_tastings', 'for all', 'app.is_server_role()', 'app.is_server_role()');
        $this->replacePolicy('food_tastings_select_own_or_staff', 'food_tastings', 'for select', 'app.is_staff() or user_id = app.current_user_id()');
        $this->replacePolicy('food_tastings_insert_public_or_own', 'food_tastings', 'for insert', null, 'user_id is null or user_id = app.current_user_id() or app.is_staff()');
        $this->replacePolicy('food_tastings_update_own_or_staff', 'food_tastings', 'for update', 'app.is_staff() or user_id = app.current_user_id()', 'app.is_staff() or user_id = app.current_user_id()');
        $this->replacePolicy('food_tastings_delete_staff', 'food_tastings', 'for delete', 'app.is_staff()');

        $bookingOwner = 'app.is_staff() or exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = app.current_user_id())';
        foreach (['payments', 'booking_items'] as $table) {
            $this->replacePolicy("{$table}_server_manage", $table, 'for all', 'app.is_server_role()', 'app.is_server_role()');
            $this->replacePolicy("{$table}_select_own_booking_or_staff", $table, 'for select', $bookingOwner);
            $this->replacePolicy("{$table}_insert_own_booking_or_staff", $table, 'for insert', null, $bookingOwner);
            $this->replacePolicy("{$table}_update_own_booking_or_staff", $table, 'for update', $bookingOwner, $bookingOwner);
            $this->replacePolicy("{$table}_delete_own_booking_or_staff", $table, 'for delete', $bookingOwner);
        }

        $this->replacePolicy('notifications_server_manage', 'notifications', 'for all', 'app.is_server_role()', 'app.is_server_role()');
        $this->replacePolicy('notifications_select_own_or_staff', 'notifications', 'for select', "app.is_staff() or (notifiable_type = 'App\\Models\\User' and notifiable_id = app.current_user_id())");
        $this->replacePolicy('notifications_insert_staff', 'notifications', 'for insert', null, 'app.is_staff()');
        $this->replacePolicy('notifications_update_own_or_staff', 'notifications', 'for update', "app.is_staff() or (notifiable_type = 'App\\Models\\User' and notifiable_id = app.current_user_id())", "app.is_staff() or (notifiable_type = 'App\\Models\\User' and notifiable_id = app.current_user_id())");
        $this->replacePolicy('notifications_delete_own_or_staff', 'notifications', 'for delete', "app.is_staff() or (notifiable_type = 'App\\Models\\User' and notifiable_id = app.current_user_id())");

        $messageParty = 'app.is_staff() or sender_id = app.current_user_id() or receiver_id = app.current_user_id()';
        $this->replacePolicy('messages_server_manage', 'messages', 'for all', 'app.is_server_role()', 'app.is_server_role()');
        $this->replacePolicy('messages_select_participant_or_staff', 'messages', 'for select', $messageParty);
        $this->replacePolicy('messages_insert_sender_or_staff', 'messages', 'for insert', null, 'app.is_staff() or sender_id = app.current_user_id()');
        $this->replacePolicy('messages_update_participant_or_staff', 'messages', 'for update', $messageParty, $messageParty);
        $this->replacePolicy('messages_delete_participant_or_staff', 'messages', 'for delete', $messageParty);

        $this->replacePolicy('sessions_server_manage', 'sessions', 'for all', 'app.is_server_role()', 'app.is_server_role()');
        $this->replacePolicy('sessions_own_or_guest_session', 'sessions', 'for all', 'user_id is null or user_id = app.current_user_id()', 'user_id is null or user_id = app.current_user_id()');

        $this->replacePolicy('password_reset_tokens_server_manage', 'password_reset_tokens', 'for all', 'app.is_server_role()', 'app.is_server_role()');
        $this->replacePolicy('password_reset_tokens_own_email', 'password_reset_tokens', 'for all', 'exists (select 1 from public.users u where u.email = password_reset_tokens.email and u.id = app.current_user_id())', 'app.current_user_id() is null or exists (select 1 from public.users u where u.email = password_reset_tokens.email and u.id = app.current_user_id())');

        foreach (['event_types', 'packages', 'menu_items', 'pricing_overrides', 'business_rules', 'inventory_items', 'dish_ingredients'] as $table) {
            $this->replacePolicy("{$table}_server_manage", $table, 'for all', 'app.is_server_role()', 'app.is_server_role()');
            $this->replacePolicy("{$table}_read_shared", $table, 'for select', 'true');
            $this->replacePolicy("{$table}_write_staff", $table, 'for all', 'app.is_staff()', 'app.is_staff()');
        }

        foreach (['cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs', 'migrations'] as $table) {
            $this->replacePolicy("{$table}_server_manage", $table, 'for all', 'app.is_server_role()', 'app.is_server_role()');
        }
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        foreach ($this->tables() as $table) {
            DB::statement("alter table public.{$table} disable row level security");
        }

        DB::unprepared(<<<'SQL'
            drop function if exists app.is_server_role();
            drop function if exists app.is_staff();
            drop function if exists app.current_user_role();
            drop function if exists app.current_user_id();
        SQL);
    }

    private function replacePolicy(string $name, string $table, string $command, ?string $using, ?string $check = null): void
    {
        DB::statement("drop policy if exists {$name} on public.{$table}");

        $clauses = [];
        if ($using !== null) {
            $clauses[] = "using ({$using})";
        }
        if ($check !== null) {
            $clauses[] = "with check ({$check})";
        }

        DB::statement("create policy {$name} on public.{$table} {$command} " . implode(' ', $clauses));
    }

    private function tables(): array
    {
        return [
            'users',
            'password_reset_tokens',
            'sessions',
            'cache',
            'cache_locks',
            'jobs',
            'job_batches',
            'failed_jobs',
            'bookings',
            'food_tastings',
            'payments',
            'pricing_overrides',
            'menu_items',
            'event_types',
            'packages',
            'business_rules',
            'inventory_items',
            'dish_ingredients',
            'booking_items',
            'notifications',
            'messages',
            'migrations',
        ];
    }
};
