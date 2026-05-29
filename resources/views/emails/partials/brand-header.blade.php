<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $emailTitle ?? 'Eloquente Catering' }}</title>
</head>
<body style="margin:0;background:#f7f4ee;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">
        {{ $preheader ?? 'An update from Eloquente Catering.' }}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f4ee;margin:0;padding:0;">
        <tr>
            <td align="center" style="padding:32px 16px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #ead8cc;border-radius:18px;overflow:hidden;">
                    <tr>
                        <td style="background:#720101;padding:26px 28px;color:#ffffff;">
                            <div style="font-size:12px;font-weight:800;letter-spacing:2.8px;text-transform:uppercase;color:#f0aa0b;">Eloquente Catering</div>
                            <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;font-weight:900;color:#ffffff;">{{ $headline ?? $emailTitle ?? 'Eloquente update' }}</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:28px;color:#374151;font-size:15px;line-height:1.7;">
