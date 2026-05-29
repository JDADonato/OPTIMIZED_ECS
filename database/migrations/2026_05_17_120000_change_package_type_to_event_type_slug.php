<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Drop the CHECK constraint that Laravel created for the enum column,
        // otherwise PostgreSQL blocks updates to values outside the original enum list.
        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE packages DROP CONSTRAINT IF EXISTS packages_type_check');
            DB::statement('ALTER TABLE packages ALTER COLUMN type TYPE VARCHAR(255) USING type::text');
        }

        DB::table('packages')->where('type', 'wedding')->update(['type' => 'formal-wedding']);
        DB::table('packages')->where('type', 'corporate')->update(['type' => 'corporate-seminar']);
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE packages ALTER COLUMN type TYPE VARCHAR(255) USING CASE WHEN type IN ('wedding', 'corporate', 'social', 'other') THEN type ELSE 'other' END");
        }
    }
};
