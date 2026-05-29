<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('drop policy if exists users_insert_staff_or_registration on public.users');
        DB::statement(<<<'SQL'
            create policy users_insert_staff_or_registration
            on public.users
            for insert
            with check (
                app.is_staff()
                or (app.current_user_id() is null and role = 'Client')
            )
        SQL);
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('drop policy if exists users_insert_staff_or_registration on public.users');
        DB::statement(<<<'SQL'
            create policy users_insert_staff_or_registration
            on public.users
            for insert
            with check (
                app.is_staff()
                or app.current_user_id() is null
            )
        SQL);
    }
};
