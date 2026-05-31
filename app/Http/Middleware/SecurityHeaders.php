<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        if (! config('security.headers.enabled', true)) {
            return $response;
        }

        $headers = $response->headers;
        $headers->set('X-Content-Type-Options', 'nosniff');
        $headers->set('X-Frame-Options', 'SAMEORIGIN');
        $headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $headers->set('Permissions-Policy', config('security.headers.permissions_policy'));
        $headers->set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

        if ($this->shouldSendHsts($request)) {
            $headers->set(
                'Strict-Transport-Security',
                'max-age='.config('security.headers.hsts_max_age').'; includeSubDomains'
            );
        }

        if ($this->shouldSendCsp()) {
            $headers->set($this->cspHeaderName(), $this->contentSecurityPolicy());
        }

        return $response;
    }

    private function shouldSendHsts(Request $request): bool
    {
        return (app()->environment('production') || config('app.env') === 'production')
            && config('security.headers.hsts_enabled', true)
            && $request->isSecure();
    }

    private function cspHeaderName(): string
    {
        return (app()->environment('production') || config('app.env') === 'production') && config('security.headers.csp_enforce', false)
            ? 'Content-Security-Policy'
            : 'Content-Security-Policy-Report-Only';
    }

    private function shouldSendCsp(): bool
    {
        if (! config('security.headers.csp_enabled', true)) {
            return false;
        }

        if (app()->environment('production') || config('app.env') === 'production') {
            return true;
        }

        return (bool) config('security.headers.csp_report_in_local', false);
    }

    private function contentSecurityPolicy(): string
    {
        $isProduction = app()->environment('production') || config('app.env') === 'production';
        $devServer = implode(' ', [
            'http://localhost:*',
            'http://127.0.0.1:*',
            'http://[::1]:*',
            'ws://localhost:*',
            'ws://127.0.0.1:*',
            'ws://[::1]:*',
        ]);

        $scriptSrc = "'self' 'unsafe-inline' https://js.pusher.com https://checkout.paymongo.com";
        $styleSrc = "'self' 'unsafe-inline' https://fonts.googleapis.com";
        $imgSrc = "'self' data: blob: https:";
        $connectSrc = "'self' ws: wss: https://api.paymongo.com https://checkout.paymongo.com";

        if (! $isProduction) {
            $scriptSrc .= ' '.$devServer;
            $styleSrc .= ' '.$devServer;
            $imgSrc .= ' http:';
            $connectSrc .= ' '.$devServer.' http://localhost:* http://127.0.0.1:* http://[::1]:*';
        }

        $directives = [
            "default-src 'self'",
            "base-uri 'self'",
            "object-src 'none'",
            "frame-ancestors 'self'",
            "form-action 'self' https://checkout.paymongo.com https://api.paymongo.com",
            "script-src {$scriptSrc}",
            "script-src-elem {$scriptSrc}",
            "style-src {$styleSrc}",
            "style-src-elem {$styleSrc}",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src {$imgSrc}",
            "connect-src {$connectSrc}",
            "frame-src 'self' https://checkout.paymongo.com",
        ];

        if ($isProduction) {
            $directives[] = 'upgrade-insecure-requests';
        }

        return implode('; ', $directives);
    }
}
