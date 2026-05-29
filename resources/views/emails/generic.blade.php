@include('emails.partials.brand-header', [
    'emailTitle' => $emailTitle ?? 'Eloquente Catering',
    'headline' => $headline ?? $emailTitle ?? 'Eloquente update',
    'preheader' => $preheader ?? null,
])

@if(!empty($greeting))
    <p style="margin:0 0 18px;">{{ $greeting }}</p>
@endif

@foreach(($lines ?? []) as $line)
    <p style="margin:0 0 14px;">{{ $line }}</p>
@endforeach

@if(!empty($details))
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border:1px solid #f1e2c5;border-radius:14px;background:#fffaf3;">
        @foreach($details as $label => $value)
            <tr>
                <td style="padding:10px 14px;color:#64748b;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #f1e2c5;">{{ $label }}</td>
                <td style="padding:10px 14px;color:#111827;font-size:14px;font-weight:800;text-align:right;border-bottom:1px solid #f1e2c5;">{{ $value }}</td>
            </tr>
        @endforeach
    </table>
@endif

@if(!empty($ctaUrl) && !empty($ctaLabel))
    <p style="margin:24px 0 8px;">
        <a href="{{ $ctaUrl }}" style="display:inline-block;background:#720101;color:#ffffff;text-decoration:none;font-weight:900;border-radius:12px;padding:13px 18px;">{{ $ctaLabel }}</a>
    </p>
@endif

@if(!empty($note))
    <p style="margin:20px 0 0;color:#64748b;font-size:13px;">{{ $note }}</p>
@endif

@include('emails.partials.brand-footer')
