@include('emails.partials.brand-header', [
    'emailTitle' => 'New message from Eloquente Catering',
    'headline' => 'You have a new message',
    'preheader' => "{$staffName} replied to your inquiry.",
])

<p style="margin:0 0 14px;">Hello <strong>{{ $clientName }}</strong>,</p>
<p style="margin:0 0 20px;"><strong>{{ $staffName }}</strong> from our team replied to your inquiry.</p>

<div style="margin:22px 0;padding:18px;border-left:4px solid #720101;border-radius:12px;background:#fffaf3;color:#111827;font-style:italic;">
    "{{ $preview }}"
</div>

<p style="margin:26px 0 0;">
    <a href="{{ $appUrl }}" style="display:inline-block;background:#720101;color:#ffffff;text-decoration:none;font-weight:900;border-radius:12px;padding:13px 18px;">Open message</a>
</p>

<p style="margin:20px 0 0;color:#64748b;font-size:13px;">We look forward to helping make your event feel effortless.</p>

@include('emails.partials.brand-footer')
