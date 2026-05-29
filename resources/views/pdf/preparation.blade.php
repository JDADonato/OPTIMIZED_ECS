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
    @endphp

    <header class="brand-bar">
        <div class="brand-kicker">{{ $brandName }} · Internal Event Preparation</div>
        <h1 class="brand-title">Event Preparation Checklist</h1>
        <div class="brand-meta">{{ $documentNumber }} · Generated {{ $generatedAt->format('M j, Y g:i A') }}</div>
    </header>

    <section class="grid">
        <div class="grid-row">
            <div class="grid-cell">
                <p class="eyebrow">Event snapshot</p>
                <div class="box">
                    <div class="value">{{ $booking->event_name ?: $booking->event_type ?: 'Booked event' }}</div>
                    <div class="muted">{{ $eventDate }}{{ $booking->event_time ? ' at ' . $booking->event_time : '' }}</div>
                    <div class="muted">{{ number_format((int) ($booking->pax ?? 0)) }} guests · {{ $booking->status ?: 'Status pending' }}</div>
                </div>
            </div>
            <div class="grid-cell">
                <p class="eyebrow">Client contact</p>
                <div class="box">
                    <div class="value">{{ $clientName }}</div>
                    <div class="muted">{{ $booking->client_email ?: $booking->user?->email ?: 'No email on file' }}</div>
                    <div class="muted">{{ $booking->client_phone ?: $booking->user?->phone ?: 'No phone on file' }}</div>
                </div>
            </div>
            <div class="grid-cell">
                <p class="eyebrow">Assigned staff</p>
                <div class="box">
                    <div class="value">{{ $booking->assignee?->full_name ?: $booking->assignee?->username ?: 'Unassigned' }}</div>
                    <div class="muted">Total {{ $money($booking->total_cost ?? 0) }}</div>
                    <div class="muted">Package {{ $booking->package_id ?: 'Custom' }}</div>
                </div>
            </div>
        </div>
    </section>

    <section class="section">
        <h2 class="section-title">Readiness Summary</h2>
        <table class="flat-table">
            <tbody>
                @foreach (array_chunk($readiness, 3) as $row)
                    <tr>
                        @foreach ($row as $item)
                            <td>
                                <span class="pill {{ $item['ready'] ? 'ready' : 'needs-check' }}">{{ $item['ready'] ? 'Ready' : 'Needs check' }}</span>
                                <div style="margin-top: 5px; font-weight: 800;">{{ $item['label'] }}</div>
                            </td>
                        @endforeach
                        @for ($i = count($row); $i < 3; $i++)
                            <td></td>
                        @endfor
                    </tr>
                @endforeach
            </tbody>
        </table>
    </section>

    <section class="section">
        <h2 class="section-title">Venue And Service Notes</h2>
        <table class="flat-table">
            <tbody>
                <tr>
                    <th style="width: 24%;">Venue</th>
                    <td>{{ $venue }}</td>
                </tr>
                <tr>
                    <th>Menu</th>
                    <td>{{ $menuItems->isNotEmpty() ? $menuItems->implode(', ') : 'Menu details pending or not recorded' }}</td>
                </tr>
                <tr>
                    <th>Motif</th>
                    <td>{{ $booking->color_motif ?: 'Not specified' }}</td>
                </tr>
                <tr>
                    <th>Special Instructions</th>
                    <td>{{ $booking->special_instructions ?: 'None recorded' }}</td>
                </tr>
            </tbody>
        </table>
    </section>

    <section class="section">
        <h2 class="section-title">Handoff Checklist</h2>
        @if ($taskGroups->isEmpty())
            <div class="note">No handoff tasks recorded yet.</div>
        @else
            @foreach ($taskGroups as $area => $tasks)
                <div class="avoid-break" style="margin-top: 10px;">
                    <p class="eyebrow">{{ $area }}</p>
                    <table class="flat-table">
                        <thead>
                            <tr>
                                <th style="width: 52%;">Task</th>
                                <th style="width: 18%;">Status</th>
                                <th style="width: 30%;">Due</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($tasks as $task)
                                <tr>
                                    <td>{{ $task->label ?? $task->title ?? 'Handoff task' }}</td>
                                    <td>{{ $task->status ?? 'Pending' }}</td>
                                    <td>{{ $task->due_at ? $task->due_at->format('M j, Y') : 'No due date' }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @endforeach
        @endif
    </section>

    <p class="footer-note">Prepared for staff coordination. Verify details with the customer before final service execution.</p>
</body>
</html>
