<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     */
    public function share(Request $request): array
    {
        return array_merge(parent::share($request), [
            'auth' => [
                'user' => $request->user() ? [
                    'id' => $request->user()->id,
                    'full_name' => $request->user()->full_name,
                    'username' => $request->user()->username,
                     'email' => $request->user()->email,
                     'phone' => $request->user()->phone,
                     'avatar_path' => $request->user()->avatar_path,
                    'avatar_url' => $request->user()->avatar_path ? route('profile.avatar', [], false) . '?v=' . optional($request->user()->updated_at)->timestamp : null,
                     'preferred_contact_method' => $request->user()->preferred_contact_method,
                    'notification_preferences' => $request->user()->notification_preferences,
                    'profile_preferences' => $request->user()->profile_preferences,
                    'role' => $request->user()->role,
                    'email_verified_at' => $request->user()->email_verified_at,
                    'otp_expires_at' => optional($request->user()->otp_expires_at)->toIso8601String(),
                    'otp_resend_available_at' => optional($request->user()->otp_resend_available_at)->toIso8601String(),
                    'otp_resend_attempts' => (int) ($request->user()->otp_resend_attempts ?? 0),
                    'account_status' => $request->user()->account_status ?? 'active',
                    'must_change_password' => $request->user()->requiresPasswordChange(),
                ] : null,
            ],
            'flash' => [
                'message' => fn () => $request->session()->get('message'),
                'error' => fn () => $request->session()->get('error'),
            ],
        ]);
    }
}
