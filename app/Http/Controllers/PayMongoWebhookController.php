<?php

namespace App\Http\Controllers;

use App\Events\PaymentProcessed;
use App\Models\Payment;
use App\Services\OperationalBroadcastService;
use App\Services\PaymentCalculationService;
use App\Services\PaymentEventService;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class PayMongoWebhookController extends Controller
{
    private const PAID_EVENTS = [
        'payment.paid',
        'checkout_session.payment.paid',
        'link.payment.paid',
    ];

    public function __invoke(Request $request, PaymentCalculationService $paymentCalculation)
    {
        $payload = $request->getContent();
        $signatureHeader = (string) $request->header('Paymongo-Signature', '');

        if (! $this->hasValidSignature($payload, $signatureHeader)) {
            Log::warning('Rejected PayMongo webhook with invalid signature.', [
                'signature_present' => $signatureHeader !== '',
            ]);

            return response()->json(['message' => 'Invalid signature.'], Response::HTTP_UNAUTHORIZED);
        }

        $event = json_decode($payload, true);

        if (! is_array($event)) {
            return response()->json(['message' => 'Invalid JSON payload.'], Response::HTTP_BAD_REQUEST);
        }

        $eventType = (string) Arr::get($event, 'data.attributes.type');
        $eventId = (string) Arr::get($event, 'data.id');

        if (! in_array($eventType, self::PAID_EVENTS, true)) {
            return response()->json([
                'message' => 'Webhook received. Event ignored.',
                'event_type' => $eventType,
            ]);
        }

        try {
            $result = DB::transaction(function () use ($event, $eventType, $eventId, $paymentCalculation) {
                $payment = $this->resolvePayment($event, $eventType);

                if (! $payment) {
                    Log::warning('PayMongo paid webhook could not be matched to a local payment.', [
                        'event_id' => $eventId,
                        'event_type' => $eventType,
                        'resource_id' => Arr::get($event, 'data.attributes.data.id'),
                        'metadata' => Arr::get($event, 'data.attributes.data.attributes.metadata'),
                        'reference_number' => $this->resourceReferenceNumber($event),
                    ]);

                    PaymentEventService::record(
                        'webhook_unmatched',
                        'paymongo',
                        null,
                        [
                            'event_type' => $eventType,
                            'resource_id' => Arr::get($event, 'data.attributes.data.id'),
                            'reference_number' => $this->resourceReferenceNumber($event),
                        ],
                        Arr::get($event, 'data.attributes.data.id'),
                        $eventId ?: null
                    );

                    return ['status' => 'unmatched'];
                }

                $payment->loadMissing('booking.payments');

                if (! $this->amountAndCurrencyMatch($event, $payment)) {
                    Log::warning('PayMongo webhook amount/currency mismatch.', [
                        'event_id' => $eventId,
                        'payment_id' => $payment->id,
                        'expected_amount' => (float) $payment->amount,
                        'received_amount' => $this->resourceAmount($event),
                        'received_currency' => $this->resourceCurrency($event),
                    ]);

                    PaymentEventService::record(
                        'webhook_mismatch',
                        'paymongo',
                        $payment,
                        [
                            'event_type' => $eventType,
                            'expected_amount' => (float) $payment->amount,
                            'received_amount' => $this->resourceAmount($event),
                            'received_currency' => $this->resourceCurrency($event),
                        ],
                        Arr::get($event, 'data.attributes.data.id'),
                        $eventId ?: null
                    );

                    return ['status' => 'mismatch', 'payment_id' => $payment->id];
                }

                $this->storeProviderReferences($payment, $event, $eventType, $eventId);

                if (! in_array($payment->status, ['Paid', 'Verified'], true)) {
                    $payment->forceFill([
                        'status' => 'Paid',
                        'payment_method' => $this->resourcePaymentMethod($event) ?: 'PayMongo',
                        'verified_by' => 'PayMongo Webhook',
                        'verified_at' => now(),
                    ])->save();
                }

                PaymentEventService::record(
                    'webhook_paid',
                    'paymongo',
                    $payment,
                    [
                        'event_type' => $eventType,
                        'payment_type' => $payment->payment_type,
                        'amount' => (float) $payment->amount,
                    ],
                    $payment->paymongo_payment_id ?: $payment->paymongo_checkout_session_id,
                    $eventId ?: null
                );

                $booking = $payment->booking;

                if ($booking) {
                    $paymentCalculation->updateBookingMilestone($booking);
                }

                try {
                    broadcast(new PaymentProcessed($payment->fresh()))->toOthers();
                } catch (\Throwable $broadcastException) {
                    Log::warning('Payment webhook realtime broadcast skipped.', [
                        'payment_id' => $payment->id,
                        'message' => $broadcastException->getMessage(),
                    ]);
                }

                app(OperationalBroadcastService::class)
                    ->financeChanged($booking, 'payment', $payment->id, 'webhook_paid', 'Payment confirmed.');

                return ['status' => 'processed', 'payment_id' => $payment->id];
            });
        } catch (\Throwable $exception) {
            Log::error('PayMongo webhook processing failed.', [
                'event_id' => $eventId,
                'event_type' => $eventType,
                'message' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'Webhook processing failed.'], Response::HTTP_INTERNAL_SERVER_ERROR);
        }

        return response()->json([
            'message' => 'Webhook received.',
            'event_type' => $eventType,
            'result' => $result,
        ]);
    }

    private function hasValidSignature(string $payload, string $signatureHeader): bool
    {
        $secret = (string) config('services.paymongo.webhook_secret');

        if ($secret === '' || $signatureHeader === '') {
            return false;
        }

        $parts = collect(explode(',', $signatureHeader))
            ->mapWithKeys(function (string $part) {
                [$key, $value] = array_pad(explode('=', trim($part), 2), 2, '');

                return [$key => $value];
            });

        $timestamp = (string) $parts->get('t', '');

        if ($timestamp === '' || ! ctype_digit($timestamp)) {
            return false;
        }

        $tolerance = (int) config('services.paymongo.webhook_tolerance', 300);

        if ($tolerance > 0 && abs(time() - (int) $timestamp) > $tolerance) {
            return false;
        }

        $expected = hash_hmac('sha256', $timestamp.'.'.$payload, $secret);

        foreach (['te', 'li'] as $signatureKey) {
            $provided = (string) $parts->get($signatureKey, '');

            if ($provided !== '' && hash_equals($expected, $provided)) {
                return true;
            }
        }

        return false;
    }

    private function resolvePayment(array $event, string $eventType): ?Payment
    {
        $metadata = Arr::get($event, 'data.attributes.data.attributes.metadata') ?: [];
        $resourceId = Arr::get($event, 'data.attributes.data.id');
        $referenceNumber = $this->resourceReferenceNumber($event);
        $paymentIntentId = Arr::get($event, 'data.attributes.data.attributes.payment_intent_id')
            ?? Arr::get($event, 'data.attributes.data.attributes.payment_intent.id');

        $paymentId = Arr::get($metadata, 'payment_id');

        if ($paymentId && ctype_digit((string) $paymentId)) {
            $payment = Payment::active()->whereKey((int) $paymentId)->lockForUpdate()->first();

            if ($payment) {
                return $payment;
            }
        }

        if ($referenceNumber && preg_match('/^ECS-\d+-P(\d+)$/', $referenceNumber, $matches)) {
            $payment = Payment::active()->whereKey((int) $matches[1])->lockForUpdate()->first();

            if ($payment) {
                return $payment;
            }
        }

        if ($eventType === 'checkout_session.payment.paid' && $resourceId) {
            $payment = Payment::active()->where('paymongo_checkout_session_id', $resourceId)->lockForUpdate()->first();

            if ($payment) {
                return $payment;
            }
        }

        if ($eventType === 'payment.paid' && $resourceId) {
            $payment = Payment::active()->where('paymongo_payment_id', $resourceId)->lockForUpdate()->first();

            if ($payment) {
                return $payment;
            }
        }

        if ($paymentIntentId) {
            return Payment::active()->where('paymongo_payment_intent_id', $paymentIntentId)->lockForUpdate()->first();
        }

        return null;
    }

    private function amountAndCurrencyMatch(array $event, Payment $payment): bool
    {
        $amount = $this->resourceAmount($event);
        $currency = strtoupper((string) $this->resourceCurrency($event));

        if ($amount === null) {
            return false;
        }

        $expectedCentavos = (int) round(((float) $payment->amount) * 100);

        return $expectedCentavos === (int) $amount && $currency === 'PHP';
    }

    private function storeProviderReferences(Payment $payment, array $event, string $eventType, string $eventId): void
    {
        $resourceId = Arr::get($event, 'data.attributes.data.id');
        $providerPaymentId = $this->resourcePaymentId($event);
        $paymentIntentId = Arr::get($event, 'data.attributes.data.attributes.payment_intent_id')
            ?? Arr::get($event, 'data.attributes.data.attributes.payment_intent.id');
        $referenceNumber = $this->resourceReferenceNumber($event);

        $updates = [
            'paymongo_event_id' => $eventId ?: $payment->paymongo_event_id,
            'paymongo_reference_number' => $referenceNumber ?: $payment->paymongo_reference_number,
            'paymongo_payment_intent_id' => $paymentIntentId ?: $payment->paymongo_payment_intent_id,
            'paymongo_payment_id' => $providerPaymentId ?: $payment->paymongo_payment_id,
        ];

        if ($eventType === 'checkout_session.payment.paid') {
            $updates['paymongo_checkout_session_id'] = $resourceId ?: $payment->paymongo_checkout_session_id;
        }

        if ($eventType === 'payment.paid') {
            $updates['paymongo_payment_id'] = $resourceId ?: $payment->paymongo_payment_id;
        }

        $payment->forceFill($updates)->save();
    }

    private function resourceAmount(array $event): ?int
    {
        return Arr::get($event, 'data.attributes.data.attributes.amount')
            ?? Arr::get($event, 'data.attributes.data.attributes.amount_total')
            ?? Arr::get($event, 'data.attributes.data.attributes.total_amount')
            ?? Arr::get($event, 'data.attributes.data.attributes.payments.0.attributes.amount')
            ?? Arr::get($event, 'data.attributes.data.attributes.payment.attributes.amount')
            ?? Arr::get($event, 'data.attributes.data.attributes.line_items.0.amount');
    }

    private function resourceCurrency(array $event): ?string
    {
        return Arr::get($event, 'data.attributes.data.attributes.currency')
            ?? Arr::get($event, 'data.attributes.data.attributes.payments.0.attributes.currency')
            ?? Arr::get($event, 'data.attributes.data.attributes.payment.attributes.currency')
            ?? Arr::get($event, 'data.attributes.data.attributes.line_items.0.currency');
    }

    private function resourcePaymentMethod(array $event): ?string
    {
        return Arr::get($event, 'data.attributes.data.attributes.source.type')
            ?? Arr::get($event, 'data.attributes.data.attributes.payment_method.type')
            ?? Arr::get($event, 'data.attributes.data.attributes.payments.0.attributes.source.type')
            ?? 'PayMongo';
    }

    private function resourcePaymentId(array $event): ?string
    {
        return Arr::get($event, 'data.attributes.data.attributes.payments.0.id')
            ?? Arr::get($event, 'data.attributes.data.attributes.payment.id')
            ?? Arr::get($event, 'data.attributes.data.attributes.payment_id');
    }

    private function resourceReferenceNumber(array $event): ?string
    {
        return Arr::get($event, 'data.attributes.data.attributes.reference_number')
            ?? Arr::get($event, 'data.attributes.data.attributes.external_reference_number')
            ?? Arr::get($event, 'data.attributes.data.attributes.metadata.reference_number');
    }
}
