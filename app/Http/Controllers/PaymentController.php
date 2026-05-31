<?php

namespace App\Http\Controllers;

use App\Events\PaymentProcessed;
use App\Exceptions\ExternalServiceException;
use App\Models\Booking;
use App\Models\Payment;
use App\Services\ConversionEventService;
use App\Services\OperationalBroadcastService;
use App\Services\PaymentCalculationService;
use App\Services\PaymentEventService;
use App\Services\PayMongoService;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use RuntimeException;

class PaymentController extends Controller
{
    private const MILESTONE_LABELS = [
        'Reservation' => 'Reservation Payment',
        'DownPayment' => 'Progress Payment',
        'Final' => 'Final Payment',
    ];

    public function initializeCheckout(Request $request, PayMongoService $payMongo, PaymentCalculationService $paymentCalculation)
    {
        if (! $request->user()?->email_verified_at) {
            return back()->with('error', 'Please verify your email before making a payment.');
        }

        $validated = $request->validate([
            'booking_id' => ['required', 'integer', 'exists:bookings,id'],
            'payment_id' => ['required', 'integer', 'exists:payments,id'],
        ]);

        $booking = Booking::with(['user', 'payments' => fn ($query) => $query->active()])
            ->where('id', $validated['booking_id'])
            ->where('user_id', Auth::id())
            ->firstOrFail();

        $paymentCalculation->syncPendingTranches($booking);
        $booking->load(['user', 'payments' => fn ($query) => $query->active()]);

        $payment = $booking->payments
            ->firstWhere('id', (int) $validated['payment_id']);

        if (! $payment) {
            return back()->with('error', 'Payment milestone not found for this booking.');
        }

        $validationError = $this->validatePayableMilestone($booking, $payment);

        if ($validationError) {
            return back()->with('error', $validationError);
        }

        $amount = round((float) $payment->amount, 2);
        $description = $this->checkoutDescription($booking, $payment);
        $successUrl = route('checkout.success', [
            'booking_id' => $booking->id,
            'payment_id' => $payment->id,
        ]);
        $cancelUrl = route('checkout.cancelled');

        try {
            $checkout = $payMongo->createCheckoutSession(
                amount: $amount,
                description: $description,
                successUrl: $successUrl,
                cancelUrl: $cancelUrl,
                metadata: [
                    'booking_id' => $booking->id,
                    'payment_id' => $payment->id,
                    'payment_type' => $payment->payment_type,
                    'milestone_percentage' => $this->milestonePercentage($booking, $payment),
                    'reference_number' => $this->referenceNumber($booking, $payment),
                ],
                booking: $booking
            );
        } catch (ExternalServiceException $exception) {
            Log::error('PayMongo checkout initialization failed', [
                'booking_id' => $booking->id,
                'payment_id' => $payment->id,
                'external' => $exception->safePayload(),
                'context' => $exception->context,
            ]);

            return back()->with(
                'error',
                config('app.debug')
                    ? $exception->getMessage()
                    : 'Unable to create PayMongo checkout. Please try again in a moment. Reference: '.$exception->referenceCode()
            );
        } catch (RuntimeException $exception) {
            Log::error('PayMongo checkout initialization failed', [
                'booking_id' => $booking->id,
                'payment_id' => $payment->id,
                'message' => $exception->getMessage(),
            ]);

            return back()->with('error', 'Unable to create PayMongo checkout. Please try again in a moment.');
        }

        $payment->forceFill([
            'amount' => $amount,
            'payment_method' => 'PayMongo Checkout',
            'paymongo_checkout_session_id' => $checkout['id'],
            'paymongo_reference_number' => $this->referenceNumber($booking, $payment),
        ])->save();

        PaymentEventService::record(
            'checkout_created',
            'customer',
            $payment,
            [
                'amount' => $amount,
                'payment_type' => $payment->payment_type,
            ],
            $checkout['id'] ?? null
        );

        ConversionEventService::record('payment_checkout_started', [
            'booking' => $booking,
            'source' => 'customer_dashboard',
            'metadata' => [
                'payment_id' => $payment->id,
                'payment_type' => $payment->payment_type,
                'amount' => $amount,
            ],
        ]);

        Log::info('PayMongo checkout session created', [
            'booking_id' => $booking->id,
            'payment_id' => $payment->id,
            'paymongo_checkout_session_id' => $checkout['id'],
            'amount' => $amount,
        ]);

        return Inertia::location($checkout['checkout_url']);
    }

    public function showSecureCheckout(Request $request)
    {
        abort(410, 'Local secure checkout has been replaced by PayMongo Checkout.');
    }

    public function processPayment(Request $request)
    {
        return response()->json([
            'error' => 'Direct checkout processing is disabled. Payments must be completed through PayMongo and confirmed by webhook.',
        ], 410);
    }

    public function success(Request $request, PayMongoService $payMongo, PaymentCalculationService $paymentCalculation)
    {
        $validated = $request->validate([
            'booking_id' => ['required', 'integer', 'exists:bookings,id'],
            'payment_id' => ['required', 'integer', 'exists:payments,id'],
        ]);

        $payment = Payment::with('booking.payments')
            ->active()
            ->whereKey($validated['payment_id'])
            ->where('booking_id', $validated['booking_id'])
            ->whereHas('booking', fn ($query) => $query->where('user_id', Auth::id()))
            ->firstOrFail();

        $syncStatus = $payment->status;
        $syncMessage = 'Payment is still pending PayMongo confirmation.';

        if (in_array($payment->status, ['Paid', 'Verified'], true)) {
            $syncMessage = 'Payment was already confirmed.';
        } elseif ($payment->paymongo_checkout_session_id) {
            try {
                $checkout = $payMongo->retrieveCheckoutSession($payment->paymongo_checkout_session_id);

                if ($this->checkoutSessionIsPaid($checkout) && $this->checkoutAmountMatches($checkout, $payment)) {
                    DB::transaction(function () use ($payment, $checkout, $paymentCalculation) {
                        $payment->refresh();
                        $payment->loadMissing('booking.payments');

                        $payment->forceFill([
                            'status' => 'Paid',
                            'payment_method' => $this->checkoutPaymentMethod($checkout) ?: 'PayMongo',
                            'verified_by' => 'PayMongo Checkout',
                            'verified_at' => now(),
                            'paymongo_payment_id' => $this->checkoutPaymentId($checkout) ?: $payment->paymongo_payment_id,
                            'paymongo_payment_intent_id' => $this->checkoutPaymentIntentId($checkout) ?: $payment->paymongo_payment_intent_id,
                        ])->save();

                        PaymentEventService::record(
                            'checkout_confirmed',
                            'paymongo',
                            $payment,
                            [
                                'checkout_session_id' => $payment->paymongo_checkout_session_id,
                                'payment_type' => $payment->payment_type,
                            ],
                            $payment->paymongo_payment_id ?: $payment->paymongo_checkout_session_id
                        );

                        if ($payment->booking) {
                            $paymentCalculation->updateBookingMilestone($payment->booking);
                        }
                    });

                    try {
                        broadcast(new PaymentProcessed($payment->fresh()))->toOthers();
                    } catch (\Throwable $broadcastException) {
                        Log::warning('Payment checkout realtime broadcast skipped.', [
                            'payment_id' => $payment->id,
                            'message' => $broadcastException->getMessage(),
                        ]);
                    }
                    app(OperationalBroadcastService::class)
                        ->financeChanged($payment->booking, 'payment', $payment->id, 'confirmed', 'Payment confirmed.');

                    ConversionEventService::record('payment_confirmed', [
                        'booking' => $payment->booking,
                        'source' => 'paymongo_checkout',
                        'metadata' => [
                            'payment_id' => $payment->id,
                            'payment_type' => $payment->payment_type,
                            'status' => 'Paid',
                        ],
                    ]);

                    $syncStatus = 'Paid';
                    $syncMessage = 'Payment confirmed through PayMongo.';
                } elseif (! $this->checkoutAmountMatches($checkout, $payment)) {
                    $syncMessage = 'PayMongo returned a different amount, so payment was not auto-confirmed.';
                    Log::warning('PayMongo checkout success amount mismatch.', [
                        'payment_id' => $payment->id,
                        'checkout_session_id' => $payment->paymongo_checkout_session_id,
                        'expected_amount' => (float) $payment->amount,
                        'received_amount' => $this->checkoutAmount($checkout),
                    ]);
                } else {
                    $syncMessage = 'PayMongo has not marked this checkout as paid yet.';
                }
            } catch (ExternalServiceException $exception) {
                Log::warning('PayMongo checkout success confirmation failed.', [
                    'payment_id' => $payment->id,
                    'checkout_session_id' => $payment->paymongo_checkout_session_id,
                    'external' => $exception->safePayload(),
                ]);

                $syncMessage = config('app.debug')
                    ? $exception->getMessage()
                    : 'Payment is still pending PayMongo confirmation.';
            } catch (RuntimeException $exception) {
                Log::warning('PayMongo checkout success confirmation failed.', [
                    'payment_id' => $payment->id,
                    'checkout_session_id' => $payment->paymongo_checkout_session_id,
                    'message' => $exception->getMessage(),
                ]);

                $syncMessage = 'Payment is still pending PayMongo confirmation.';
            }
        }

        return Inertia::render('client/PaymentSuccess', [
            'paymentStatus' => $syncStatus,
            'syncMessage' => $syncMessage,
        ]);
    }

    private function validatePayableMilestone(Booking $booking, Payment $payment): ?string
    {
        if (! in_array($payment->payment_type, ['Reservation', 'DownPayment', 'Final'], true)) {
            return 'Only configured payment milestones can be paid online.';
        }

        if (! in_array($payment->status, ['Pending', 'Failed', 'Rejected'], true)) {
            return 'This payment milestone is not payable.';
        }

        if ((float) $booking->total_cost <= 0) {
            return 'Booking total must be greater than zero before checkout can be created.';
        }

        if ((float) $payment->amount <= 0) {
            return 'Payment amount must be greater than zero before checkout can be created.';
        }

        $nextPayment = $booking->payments
            ->whereIn('status', ['Pending', 'Failed', 'Rejected'])
            ->whereNull('voided_at')
            ->sortBy(fn (Payment $candidate) => $this->milestoneOrder($candidate->payment_type))
            ->first();

        if ($nextPayment && $nextPayment->id !== $payment->id) {
            return 'Payments must be completed in the required milestone order.';
        }

        return null;
    }

    private function checkoutDescription(Booking $booking, Payment $payment): string
    {
        $eventName = $booking->event_type ?: 'Event';
        $percentage = $this->milestonePercentage($booking, $payment);
        $label = trim($percentage.'% '.self::MILESTONE_LABELS[$payment->payment_type]);

        return sprintf(
            '%s for %s Booking #%d',
            $label,
            $eventName,
            $booking->id
        );
    }

    private function milestonePercentage(Booking $booking, Payment $payment): string
    {
        $totalCost = (float) $booking->total_cost;

        if ($totalCost <= 0) {
            return '0';
        }

        $percentage = ((float) $payment->amount / $totalCost) * 100;

        return rtrim(rtrim(number_format($percentage, 2, '.', ''), '0'), '.');
    }

    private function milestoneOrder(string $paymentType): int
    {
        return match ($paymentType) {
            'Reservation' => 1,
            'DownPayment' => 2,
            'Final' => 3,
            default => 99,
        };
    }

    private function referenceNumber(Booking $booking, Payment $payment): string
    {
        return sprintf('ECS-%d-P%d', $booking->id, $payment->id);
    }

    private function checkoutSessionIsPaid(array $checkout): bool
    {
        $statuses = [
            Arr::get($checkout, 'data.attributes.status'),
            Arr::get($checkout, 'data.attributes.payment_intent.attributes.status'),
            Arr::get($checkout, 'data.attributes.payment_intent.status'),
            Arr::get($checkout, 'data.attributes.payments.0.attributes.status'),
            Arr::get($checkout, 'data.attributes.payment.attributes.status'),
        ];

        return collect($statuses)
            ->filter()
            ->map(fn ($status) => strtolower((string) $status))
            ->contains(fn ($status) => in_array($status, ['paid', 'succeeded', 'success', 'completed'], true));
    }

    private function checkoutAmountMatches(array $checkout, Payment $payment): bool
    {
        $amount = $this->checkoutAmount($checkout);

        if ($amount === null) {
            return true;
        }

        return (int) $amount === (int) round(((float) $payment->amount) * 100);
    }

    private function checkoutAmount(array $checkout): ?int
    {
        return Arr::get($checkout, 'data.attributes.amount_total')
            ?? Arr::get($checkout, 'data.attributes.total_amount')
            ?? Arr::get($checkout, 'data.attributes.payments.0.attributes.amount')
            ?? Arr::get($checkout, 'data.attributes.payment.attributes.amount')
            ?? Arr::get($checkout, 'data.attributes.line_items.0.amount');
    }

    private function checkoutPaymentId(array $checkout): ?string
    {
        return Arr::get($checkout, 'data.attributes.payments.0.id')
            ?? Arr::get($checkout, 'data.attributes.payment.id')
            ?? Arr::get($checkout, 'data.attributes.payment_id');
    }

    private function checkoutPaymentIntentId(array $checkout): ?string
    {
        return Arr::get($checkout, 'data.attributes.payment_intent.id')
            ?? Arr::get($checkout, 'data.attributes.payment_intent_id');
    }

    private function checkoutPaymentMethod(array $checkout): ?string
    {
        return Arr::get($checkout, 'data.attributes.payments.0.attributes.source.type')
            ?? Arr::get($checkout, 'data.attributes.payment.attributes.source.type')
            ?? Arr::get($checkout, 'data.attributes.payment_method_used')
            ?? 'PayMongo';
    }
}
