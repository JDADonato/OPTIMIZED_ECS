<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePasswordChanged
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user || !$user->requiresPasswordChange()) {
            return $next($request);
        }

        if ($request->is(
            'password/change-required',
            'logout',
            'forgot-password',
            'reset-password/*',
            'api/session/csrf-token',
            'verify-otp',
            'resend-otp',
            'api/notifications/unread-count'
        )) {
            return $next($request);
        }

        if ($request->expectsJson() || $request->is('api/*')) {
            return response()->json([
                'error' => 'Password change required before continuing.',
                'redirect' => route('password.change-required', absolute: false),
            ], 423);
        }

        return redirect()->route('password.change-required');
    }
}
