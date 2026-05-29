<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{{ $title }}</title>
    @include('pdf.partials.styles')
</head>
<body>
    <header class="brand-bar">
        <div class="brand-kicker">{{ $brandName }} · Calendar Export</div>
        <h1 class="brand-title">{{ $title }}</h1>
        <div class="brand-meta">
            Generated {{ $generatedAt->format('M j, Y g:i A') }}
            @if (! empty($window['start']) && ! empty($window['end']))
                · {{ $window['start']->format('M j, Y') }} to {{ $window['end']->format('M j, Y') }}
            @endif
        </div>
    </header>

    @if ($truncated)
        <div class="note danger-note">This export was truncated for PDF readability. Use filtered views or CSV-style reports for larger data reviews.</div>
    @endif

    <section class="section">
        <table class="flat-table">
            <thead>
                <tr>
                    <th style="width: 18%;">Date</th>
                    <th style="width: 14%;">Time</th>
                    <th style="width: 24%;">Event</th>
                    <th style="width: 20%;">Client</th>
                    <th style="width: 14%;">Status</th>
                    <th style="width: 10%;">Pax</th>
                </tr>
            </thead>
            <tbody>
                @forelse ($events as $event)
                    <tr>
                        <td>{{ $event->event_date ? $event->event_date->format('M j, Y') : 'Date pending' }}</td>
                        <td>{{ $event->event_time ?: 'Time pending' }}</td>
                        <td>{{ $event->event_name ?: $event->event_type ?: 'Booked event' }}</td>
                        <td>{{ $event->client_full_name ?: $event->user?->full_name ?: 'Client' }}</td>
                        <td>{{ ucwords(str_replace(['_', '-'], ' ', (string) $event->status)) }}</td>
                        <td>{{ number_format((int) ($event->pax ?? 0)) }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="6">No events found for this calendar range.</td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </section>
</body>
</html>
