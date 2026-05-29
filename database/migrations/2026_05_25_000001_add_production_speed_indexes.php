<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        foreach ([
            'CREATE INDEX IF NOT EXISTS bookings_event_date_status_idx ON bookings (event_date, status)',
            'CREATE INDEX IF NOT EXISTS bookings_package_event_date_idx ON bookings (package_id, event_date)',
            'CREATE INDEX IF NOT EXISTS bookings_event_type_date_idx ON bookings (event_type, event_date)',
            'CREATE INDEX IF NOT EXISTS bookings_city_event_date_idx ON bookings (venue_city, event_date)',
            'CREATE INDEX IF NOT EXISTS payments_status_due_booking_idx ON payments (status, due_date, booking_id)',
            'CREATE INDEX IF NOT EXISTS payments_verified_status_idx ON payments (verified_at, status)',
            'CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages (conversation_id, id)',
            'CREATE INDEX IF NOT EXISTS messages_conversation_read_sender_idx ON messages (conversation_id, read_at, sender_id)',
            'CREATE INDEX IF NOT EXISTS conversations_status_staff_updated_idx ON conversations (status, staff_id, updated_at)',
            'CREATE INDEX IF NOT EXISTS conversations_client_status_updated_idx ON conversations (client_id, status, updated_at)',
        ] as $statement) {
            DB::statement($statement);
        }
    }

    public function down(): void
    {
        foreach ([
            'bookings_event_date_status_idx',
            'bookings_package_event_date_idx',
            'bookings_event_type_date_idx',
            'bookings_city_event_date_idx',
            'payments_status_due_booking_idx',
            'payments_verified_status_idx',
            'messages_conversation_id_idx',
            'messages_conversation_read_sender_idx',
            'conversations_status_staff_updated_idx',
            'conversations_client_status_updated_idx',
        ] as $index) {
            DB::statement('DROP INDEX IF EXISTS ' . $index);
        }
    }
};
