<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{{ $title }} {{ $documentNumber }}</title>
    @include('pdf.partials.styles')
</head>
<body>
    <header class="brand-bar">
        <div class="brand-kicker">{{ $brandName }} · Management Export</div>
        <h1 class="brand-title">Management Report</h1>
        <div class="brand-meta">
            Report {{ $documentNumber }} · Generated {{ $generatedAt->format('M j, Y g:i A') }}
            · Created by {{ $run->creator?->full_name ?: $run->creator?->username ?: 'Admin' }}
        </div>
    </header>

    @if ($truncated)
        <div class="note danger-note">This PDF includes the first {{ $maxLines }} report lines for readability. Download the spreadsheet export for the complete detail set.</div>
    @endif

    <section class="section">
        <table class="flat-table">
            <tbody>
                @forelse ($sections as $line)
                    @php
                        $text = trim((string) $line);
                        $isHeading = $text !== '' && mb_strtoupper($text) === $text && mb_strlen($text) < 90;
                    @endphp
                    @if ($text === '')
                        <tr><td style="border-bottom: 0; padding: 3px;"></td></tr>
                    @elseif ($isHeading)
                        <tr>
                            <th colspan="2" style="color: #a16207;">{{ $text }}</th>
                        </tr>
                    @else
                        <tr>
                            <td style="width: 100%;">{{ $text }}</td>
                        </tr>
                    @endif
                @empty
                    <tr><td>No report data was generated.</td></tr>
                @endforelse
            </tbody>
        </table>
    </section>
</body>
</html>
