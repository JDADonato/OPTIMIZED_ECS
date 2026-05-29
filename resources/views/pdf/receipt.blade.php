<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{{ $title }} {{ $documentNumber }}</title>
    @include('pdf.partials.styles')
</head>
<body>
    @php
        $clientName = $booking->client_full_name ?: $booking->user?->full_name ?: $booking->user?->username ?: 'Client';
        $eventDate = $booking->event_date ? $booking->event_date->format('M j, Y') : 'Date pending';
        $money = fn ($value) => 'PHP ' . number_format((float) $value, 2);
        $label = fn ($value) => ucwords(str_replace(['_', '-'], ' ', (string) $value));
    @endphp

    <header class="brand-bar">
        <div class="brand-kicker">{{ $brandName }}</div>
        <h1 class="brand-title">Official Receipt</h1>
        <div class="brand-meta">
            Receipt {{ $documentNumber }} · Booking #{{ str_pad((string) $booking->id, 4, '0', STR_PAD_LEFT) }} · Generated {{ $generatedAt->format('M j, Y g:i A') }}
        </div>
    </header>

    <section class="grid">
        <div class="grid-row">
            <div class="grid-cell" style="width: 58%;">
                <p class="eyebrow">Received from</p>
                <div class="box">
                    <div class="value">{{ $clientName }}</div>
                    <div class="muted">{{ $booking->client_email ?: $booking->user?->email ?: 'No email on file' }}</div>
                    <div class="muted">{{ $booking->client_phone ?: $booking->user?->phone ?: 'No phone on file' }}</div>
                </div>
            </div>
            <div class="grid-cell" style="width: 42%;">
                <p class="eyebrow">Amount paid</p>
                <div class="box">
                    <div class="value">{{ $money($payment->amount) }}</div>
                    <div class="muted">{{ $label($payment->status ?? 'Pending') }} · {{ $paymentMethodLabel }}</div>
                    <div class="muted">{{ $paidAt ? $paidAt->format('M j, Y g:i A') : 'Payment date not recorded' }}</div>
                </div>
            </div>
        </div>
    </section>

    <section class="section">
        <h2 class="section-title">Payment Details</h2>
        <table class="flat-table">
            <tbody>
                <tr>
                    <th style="width: 32%;">Payment Type</th>
                    <td>{{ $label($payment->payment_type ?? 'Payment') }}</td>
                </tr>
                <tr>
                    <th>Reference</th>
                    <td>{{ $payment->paymongo_reference_number ?: $payment->paymongo_payment_id ?: $payment->paymongo_checkout_session_id ?: 'Not provided' }}</td>
                </tr>
                <tr>
                    <th>Event</th>
                    <td>{{ $booking->event_name ?: $booking->event_type ?: 'Booked event' }}</td>
                </tr>
                <tr>
                    <th>Event Date</th>
                    <td>{{ $eventDate }}{{ $booking->event_time ? ' at ' . $booking->event_time : '' }}</td>
                </tr>
                <tr>
                    <th>Total Booking Cost</th>
                    <td>{{ $money($booking->total_cost ?? 0) }}</td>
                </tr>
                <tr>
                    <th>Remaining Balance</th>
                    <td>{{ $money($remainingBalance) }}</td>
                </tr>
            </tbody>
        </table>
    </section>

    <p class="footer-note">This is a computer-generated receipt for Eloquente Catering records. For disputes or corrections, contact the planning desk through official channels.</p>
</body>
</html>
