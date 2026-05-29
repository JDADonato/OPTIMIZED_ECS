@php
    $body = $announcement->email_body ?: $announcement->body ?: $announcement->summary;
@endphp

@include('emails.partials.brand-header', [
    'emailTitle' => $announcement->email_subject ?: $announcement->title,
    'headline' => $announcement->title,
    'preheader' => $announcement->summary ?: 'A new announcement from Eloquente Catering.',
])

@if($announcement->summary)
    <p style="margin:0 0 18px;font-size:16px;color:#475569;">{{ $announcement->summary }}</p>
@endif

<div style="white-space:pre-line;">{{ $body }}</div>

@if($announcement->cta_label && $announcement->cta_url)
    <p style="margin:26px 0 0;">
        <a href="{{ $announcement->cta_url }}" style="display:inline-block;background:#720101;color:#ffffff;text-decoration:none;font-weight:900;border-radius:12px;padding:13px 18px;">{{ $announcement->cta_label }}</a>
    </p>
@endif

@include('emails.partials.brand-footer')
