<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        foreach ([
            'CREATE INDEX IF NOT EXISTS menu_items_active_category_name_idx ON menu_items (is_active, category, name)',
            'CREATE INDEX IF NOT EXISTS menu_items_active_best_seller_name_idx ON menu_items (is_active, is_best_seller, name)',
            'CREATE INDEX IF NOT EXISTS event_types_active_label_idx ON event_types (is_active, label)',
            'CREATE INDEX IF NOT EXISTS event_types_slug_active_idx ON event_types (slug, is_active)',
            'CREATE INDEX IF NOT EXISTS packages_active_type_name_idx ON packages (is_active, type, name)',
            'CREATE INDEX IF NOT EXISTS pricing_overrides_item_idx ON pricing_overrides (item_type, item_id)',
            'CREATE INDEX IF NOT EXISTS audit_logs_created_role_method_idx ON audit_logs (created_at, role, method)',
            'CREATE INDEX IF NOT EXISTS booking_review_tasks_booking_status_idx ON booking_review_tasks (booking_id, status)',
            'CREATE INDEX IF NOT EXISTS event_preparation_tasks_booking_status_idx ON event_preparation_tasks (booking_id, status)',
        ] as $statement) {
            DB::statement($statement);
        }
    }

    public function down(): void
    {
        foreach ([
            'menu_items_active_category_name_idx',
            'menu_items_active_best_seller_name_idx',
            'event_types_active_label_idx',
            'event_types_slug_active_idx',
            'packages_active_type_name_idx',
            'pricing_overrides_item_idx',
            'audit_logs_created_role_method_idx',
            'booking_review_tasks_booking_status_idx',
            'event_preparation_tasks_booking_status_idx',
        ] as $index) {
            DB::statement('DROP INDEX IF EXISTS '.$index);
        }
    }
};
