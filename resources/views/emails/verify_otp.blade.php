@include('emails.partials.brand-header', [
    'emailTitle' => 'Your Eloquente verification code',
    'headline' => 'Your verification code',
    'preheader' => "Use this code to continue your {$purpose}.",
])

<p style="margin:0 0 20px;">Use this code to continue your {{ $purpose }}. It expires in {{ $expiresInMinutes }} minutes.</p>

<div style="display:inline-block;border-radius:14px;background:#720101;color:#ffffff;font-size:30px;font-weight:900;letter-spacing:8px;padding:14px 18px;">
    {{ $otpCode }}
</div>

<p style="margin:22px 0 0;color:#64748b;font-size:13px;">If you did not request this code, you can safely ignore this email.</p>

@include('emails.partials.brand-footer')
