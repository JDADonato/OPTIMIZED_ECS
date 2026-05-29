<?php

return [
    'headers' => [
        'enabled' => env('SECURITY_HEADERS_ENABLED', true),
        'csp_enabled' => env('SECURITY_CSP_ENABLED', true),
        'csp_report_in_local' => env('SECURITY_CSP_REPORT_IN_LOCAL', false),
        'csp_enforce' => env('SECURITY_CSP_ENFORCE', false),
        'hsts_enabled' => env('SECURITY_HSTS_ENABLED', true),
        'hsts_max_age' => (int) env('SECURITY_HSTS_MAX_AGE', 31536000),
        'permissions_policy' => env('SECURITY_PERMISSIONS_POLICY', 'camera=(), microphone=(), geolocation=(), payment=(self)'),
    ],

    'trusted_proxies' => env('TRUSTED_PROXIES'),

    'public_routes' => [
        ['path' => '/', 'priority' => '1.0', 'changefreq' => 'weekly'],
        ['path' => '/about', 'priority' => '0.7', 'changefreq' => 'monthly'],
        ['path' => '/amenities', 'priority' => '0.7', 'changefreq' => 'monthly'],
        ['path' => '/contact', 'priority' => '0.7', 'changefreq' => 'monthly'],
        ['path' => '/book', 'priority' => '0.9', 'changefreq' => 'weekly'],
        ['path' => '/menu', 'priority' => '0.9', 'changefreq' => 'weekly'],
        ['path' => '/food-tasting', 'priority' => '0.8', 'changefreq' => 'monthly'],
    ],
];
