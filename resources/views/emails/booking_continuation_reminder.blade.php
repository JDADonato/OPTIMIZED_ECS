@php
    $name = $draft['client_full_name'] ?? $user->username ?? 'there';
    $eventDate = !empty($draft['event_date']) ? \Carbon\Carbon::parse($draft['event_date'])->format('F j, Y') : null;
    $eventType = $draft['event_type'] ?? null;
    $guests = $draft['pax'] ?? null;
    $total = isset($draft['total_cost']) ? 'PHP ' . number_format((float) $draft['total_cost'], 2) : null;
    $details = array_filter([
        'Event' => $eventType,
        'Date' => $eventDate,
        'Guests' => $guests,
        'Current estimate' => $total,
        'Saved step' => $draft['step'] ?? 'In progress',
    ]);
@endphp

@include('emails.generic', [
    'emailTitle' => 'Continue your Eloquente booking',
    'headline' => 'Your booking is almost there',
    'preheader' => 'We saved your event planning progress.',
    'greeting' => "Hello {$name},",
    'lines' => [
        'We saved your event planning progress, so you can continue right where you left off.',
        'A few more details will help us check availability, pricing, and service readiness for your event.',
    ],
    'details' => $details,
    'ctaLabel' => 'Continue booking',
    'ctaUrl' => url('/book'),
    'note' => 'If your plans changed, you can also start fresh from the booking page.',
])
