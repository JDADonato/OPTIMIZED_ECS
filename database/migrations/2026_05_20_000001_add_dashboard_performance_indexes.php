<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $indexes = [
            'CREATE INDEX IF NOT EXISTS bookings_user_status_event_date_idx ON bookings (user_id, status, event_date)',
            'CREATE INDEX IF NOT EXISTS bookings_user_event_date_idx ON bookings (user_id, event_date)',
            'CREATE INDEX IF NOT EXISTS bookings_status_created_at_idx ON bookings (status, created_at)',
            'CREATE INDEX IF NOT EXISTS payments_booking_status_type_due_idx ON payments (booking_id, status, payment_type, due_date)',
            'CREATE INDEX IF NOT EXISTS payments_status_created_at_idx ON payments (status, created_at)',
            'CREATE INDEX IF NOT EXISTS payments_paymongo_checkout_session_id_idx ON payments (paymongo_checkout_session_id)',
            'CREATE INDEX IF NOT EXISTS payments_paymongo_payment_id_idx ON payments (paymongo_payment_id)',
            'CREATE INDEX IF NOT EXISTS payments_paymongo_event_id_idx ON payments (paymongo_event_id)',
            'CREATE INDEX IF NOT EXISTS messages_conversation_created_at_idx ON messages (conversation_id, created_at)',
        ];

        foreach ($indexes as $statement) {
            DB::statement($statement);
        }
    }

    public function down(): void
    {
        foreach ([
            'bookings_user_status_event_date_idx',
            'bookings_user_event_date_idx',
            'bookings_status_created_at_idx',
            'payments_booking_status_type_due_idx',
            'payments_status_created_at_idx',
            'payments_paymongo_checkout_session_id_idx',
            'payments_paymongo_payment_id_idx',
            'payments_paymongo_event_id_idx',
            'messages_conversation_created_at_idx',
        ] as $index) {
            DB::statement('DROP INDEX IF EXISTS ' . $index);
        }
    }
};
