<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\PaymentEvent;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class PaymentEventService
{
    public static function record(
        string $eventType,
        string $source,
        ?Payment $payment = null,
        array $metadata = [],
        ?string $providerReference = null,
        ?string $providerEventId = null,
        ?int $bookingId = null
    ): ?PaymentEvent {
        try {
            $payload = [
                'payment_id' => $payment?->id,
                'booking_id' => $payment?->booking_id ?? $bookingId,
                'event_type' => $eventType,
                'source' => $source,
                'provider_reference' => $providerReference,
                'provider_event_id' => $providerEventId,
                'metadata' => $metadata,
                'created_by' => Auth::id(),
            ];

            if ($providerEventId) {
                return PaymentEvent::firstOrCreate(
                    ['provider_event_id' => $providerEventId],
                    $payload
                );
            }

            return PaymentEvent::create($payload);
        } catch (\Throwable $e) {
            Log::warning('Payment event could not be recorded.', [
                'event_type' => $eventType,
                'source' => $source,
                'payment_id' => $payment?->id,
                'booking_id' => $payment?->booking_id ?? $bookingId,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
