<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'paymongo' => [
        'base_url' => env('PAYMONGO_BASE_URL', 'https://api.paymongo.com'),
        'checkout_endpoint' => env('PAYMONGO_CHECKOUT_ENDPOINT', '/v1/checkout_sessions'),
        'public_key' => env('PAYMONGO_PUBLIC_KEY'),
        'secret_key' => env('PAYMONGO_SECRET_KEY'),
        'live_public_key' => env('PAYMONGO_LIVE_PUBLIC_KEY'),
        'live_secret_key' => env('PAYMONGO_LIVE_SECRET_KEY'),
        'webhook_secret' => env('PAYMONGO_WEBHOOK_SECRET'),
        'currency' => env('PAYMONGO_CURRENCY', 'PHP'),
        'payment_method_types' => array_values(array_filter(array_map(
            'trim',
            explode(',', env('PAYMONGO_PAYMENT_METHOD_TYPES', 'card,gcash,paymaya'))
        ))),
        'send_email_receipt' => env('PAYMONGO_SEND_EMAIL_RECEIPT', true),
        'statement_descriptor' => env('PAYMONGO_STATEMENT_DESCRIPTOR', 'ELOQUENTE'),
        'timeout' => env('PAYMONGO_TIMEOUT', 20),
        'ca_bundle' => env('PAYMONGO_CA_BUNDLE', storage_path('app/cacert.pem')),
        'webhook_tolerance' => env('PAYMONGO_WEBHOOK_TOLERANCE', 300),
    ],

];
