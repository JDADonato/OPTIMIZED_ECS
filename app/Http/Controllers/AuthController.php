<?php

namespace App\Http\Controllers;

use App\Mail\VerifyEmailOTP;
use App\Models\User;
use App\Notifications\PasswordResetLinkNotification;
use App\Rules\BalancedPassword;
use App\Support\PasswordPolicy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * Ported from: server/controllers/authController.js
 * Handles registration, login, and logout.
 * Replaces JWT-based auth with Laravel session-based auth.
 */
class AuthController extends Controller
{
    /**
     * Show login page.
     */
    public function showLogin()
    {
        return Inertia::render('Auth/Login');
    }

    /**
     * Show registration page.
     */
    public function showRegister()
    {
        return Inertia::render('Auth/Register');
    }

    /**
     * Handle login request.
     * Ported from: authController.login()
     */
    public function login(Request $request)
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
            'remember' => 'nullable|boolean',
        ]);

        $user = User::where('username', $request->username)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'username' => ['The username or password is incorrect.'],
            ]);
        }

        if (($user->account_status ?? 'active') !== 'active') {
            throw ValidationException::withMessages([
                'username' => ['This account is deactivated. Please contact Eloquente support.'],
            ]);
        }

        if ($user->temporary_password_expires_at && now()->isAfter($user->temporary_password_expires_at)) {
            $user->forceFill([
                'temporary_password_secret' => null,
            ])->save();

            throw ValidationException::withMessages([
                'password' => ['This temporary password has expired. Please ask an administrator for a reset.'],
            ]);
        }

        $remember = $request->boolean('remember', false);
        Auth::login($user, $remember);
        $request->session()->regenerate();
        $user->forceFill(['last_login_at' => now()])->save();

        if ($user->requiresPasswordChange()) {
            return redirect()->route('password.change-required')
                ->with('message', 'Please set your own password before continuing.');
        }

        // Redirect based on role. Avoid redirect()->intended() here because
        // unauthenticated API fetches can store /api/* as the intended URL,
        // which makes Inertia receive plain JSON instead of a page response.
        return redirect($this->getDashboardRoute($user->role))
            ->with('message', 'Welcome back, '.$user->username.'! We\'re glad to see you again.');
    }

    public function register(Request $request)
    {
        $request->validate([
            'username' => 'required|string|unique:users,username',
            'password' => ['required', 'string', new BalancedPassword($request->input('username'), $request->input('email'))],
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string',
        ]);

        $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $user = User::create([
            'username' => $request->username,
            'password' => $request->password, // Auto-hashed by User model cast
            'role' => 'Client', // Public registration is always Client
            'email' => $request->email,
            'phone' => $request->phone,
            'otp_code' => Hash::make($otp),
            'otp_expires_at' => now()->addMinutes(15),
            'otp_resend_available_at' => now()->addSeconds(60),
            'otp_resend_attempts' => 0,
            'password_changed_at' => now(),
            'password_policy_version' => PasswordPolicy::CURRENT_VERSION,
        ]);

        $otpEmailSent = true;

        try {
            Mail::to($user->email)->send(new VerifyEmailOTP($otp));
            Log::info('OTP verification email sent.', ['user_id' => $user->id]);
        } catch (\Throwable $e) {
            $otpEmailSent = false;
            Log::error('Failed to send OTP email.', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }

        Auth::login($user);
        $request->session()->regenerate();

        $redirect = redirect('/')->with('requires_otp', true);

        if (! $otpEmailSent) {
            return $redirect->with('error', 'We could not send the first verification code. Please use Resend Code to try again.');
        }

        return $redirect->with('message', 'Please check your email for the verification code.');
    }

    public function verifyOtp(Request $request)
    {
        $request->validate([
            'otp' => 'required|string',
        ]);

        $user = Auth::user();

        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        if ($user->email_verified_at) {
            return response()->json(['message' => 'Already verified']);
        }

        if (! $this->otpMatches($user->otp_code, $request->otp)) {
            throw ValidationException::withMessages([
                'otp' => ['Invalid verification code.'],
            ]);
        }

        if (now()->isAfter($user->otp_expires_at)) {
            throw ValidationException::withMessages([
                'otp' => ['Verification code has expired. Please request a new one.'],
            ]);
        }

        $user->update([
            'email_verified_at' => now(),
            'otp_code' => null,
            'otp_expires_at' => null,
            'otp_resend_available_at' => null,
            'otp_resend_attempts' => 0,
        ]);

        return redirect('/')
            ->with('message', 'Email verified successfully! Welcome to Eloquente Catering.');
    }

    public function resendOtp(Request $request)
    {
        $user = Auth::user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        if ($user->email_verified_at) {
            return response()->json(['message' => 'Already verified']);
        }

        if ($user->otp_resend_available_at && now()->isBefore($user->otp_resend_available_at)) {
            $seconds = now()->diffInSeconds($user->otp_resend_available_at);

            return response()->json([
                'error' => 'Please wait before requesting another code.',
                'retry_after_seconds' => $seconds,
                'expires_at' => $user->otp_expires_at?->toIso8601String(),
                'expires_in_seconds' => $user->otp_expires_at ? now()->diffInSeconds($user->otp_expires_at, false) : 0,
            ], 429);
        }

        if ((int) ($user->otp_resend_attempts ?? 0) >= 5) {
            return response()->json([
                'error' => 'Too many resend attempts. Please try again later.',
                'retry_after_seconds' => 3600,
            ], 429);
        }

        $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $user->update([
            'otp_code' => Hash::make($otp),
            'otp_expires_at' => now()->addMinutes(15),
            'otp_resend_available_at' => now()->addSeconds(60),
            'otp_resend_attempts' => (int) ($user->otp_resend_attempts ?? 0) + 1,
        ]);

        $otpEmailSent = true;

        try {
            Mail::to($user->email)->send(new VerifyEmailOTP($otp));
            Log::info('OTP verification email resent.', ['user_id' => $user->id]);
        } catch (\Throwable $e) {
            $otpEmailSent = false;
            Log::error('Failed to resend OTP email.', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }

        if (! $otpEmailSent) {
            $payload = [
                'error' => 'We could not send a verification code right now. Please try again.',
                'expires_at' => $user->otp_expires_at?->toIso8601String(),
                'expires_in_seconds' => $user->otp_expires_at ? now()->diffInSeconds($user->otp_expires_at, false) : 0,
                'retry_after_seconds' => now()->diffInSeconds($user->otp_resend_available_at),
            ];

            if ($request->expectsJson()) {
                return response()->json($payload, 500);
            }

            return back()->with('error', $payload['error']);
        }

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'A new verification code has been sent to your email.',
                'expires_at' => $user->otp_expires_at?->toIso8601String(),
                'expires_in_seconds' => now()->diffInSeconds($user->otp_expires_at),
                'retry_after_seconds' => now()->diffInSeconds($user->otp_resend_available_at),
                'resend_attempts_remaining' => max(0, 5 - (int) $user->otp_resend_attempts),
            ]);
        }

        return back()->with('message', 'A new verification code has been sent to your email.');
    }

    public function showChangeRequired()
    {
        return Inertia::render('Auth/ChangeRequiredPassword');
    }

    public function changeRequiredPassword(Request $request)
    {
        if (app()->isLocal() || config('app.debug')) {
            $user = $request->user();
            Log::info('[auth-flow-debug] Required password change request entered.', [
                'user_id' => $user?->id,
                'role' => $user?->role,
                'expects_json' => $request->expectsJson(),
                'is_inertia' => (bool) $request->header('X-Inertia'),
                'host' => $request->getHost(),
                'session_id_hash' => substr(hash('sha256', $request->session()->getId()), 0, 12),
            ]);
        }

        $request->validate([
            'password' => ['required', 'string', 'confirmed', new BalancedPassword($request->user()?->username, $request->user()?->email)],
        ]);

        $user = $request->user();
        if (! $user) {
            abort(401);
        }

        $dashboardRoute = $this->getDashboardRoute($user->role);
        $user->forceFill([
            'password' => Hash::make($request->password),
            'temporary_password_expires_at' => null,
            'temporary_password_secret' => null,
            'password_changed_at' => now(),
            'password_policy_version' => PasswordPolicy::CURRENT_VERSION,
        ])->save();

        DB::table('users')
            ->where('id', $user->id)
            ->update([
                'must_change_password' => DB::connection()->getDriverName() === 'pgsql' ? DB::raw('false') : false,
                'updated_at' => now(),
            ]);

        $user->refresh();
        Auth::setUser($user);

        Log::info('[auth-flow-debug] Required password changed.', [
            'user_id' => $user->id,
            'role' => $user->role,
            'redirect' => $dashboardRoute,
            'must_change_password' => $user->requiresPasswordChange(),
            'raw_must_change_password' => $user->getRawOriginal('must_change_password'),
        ]);

        if ($request->header('X-Inertia')) {
            $response = Inertia::location($dashboardRoute);
            $response->headers->set('X-ECS-Debug-Request', 'password-change');

            return $response;
        }

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Password updated. Welcome to your workspace.',
                'redirect' => $dashboardRoute,
                'role' => $user->role,
                'must_change_password' => $user->requiresPasswordChange(),
            ])->header('X-ECS-Debug-Request', 'password-change');
        }

        return redirect($dashboardRoute)
            ->header('X-ECS-Debug-Request', 'password-change')
            ->with('message', 'Password updated. Welcome to your workspace.');
    }

    public function showForgotPassword()
    {
        return Inertia::render('Auth/ForgotPassword');
    }

    public function sendPasswordReset(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $user = User::query()
            ->reachableForNotifications()
            ->where('email', $data['email'])
            ->first();
        if ($user) {
            $token = Str::random(64);
            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $user->email],
                ['token' => Hash::make($token), 'created_at' => now()]
            );

            try {
                $user->notify(new PasswordResetLinkNotification(url('/reset-password/'.$token.'?email='.urlencode($user->email))));
            } catch (\Throwable $e) {
                Log::warning('Password reset email failed.', ['user_id' => $user->id, 'message' => $e->getMessage()]);
            }
        }

        return back()->with('message', 'If that email belongs to an active account, a reset link has been sent.');
    }

    public function showResetPassword(Request $request, string $token)
    {
        return Inertia::render('Auth/ResetPassword', [
            'token' => $token,
            'email' => $request->query('email', ''),
        ]);
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'confirmed', new BalancedPassword(null, $request->input('email'))],
        ]);

        $record = DB::table('password_reset_tokens')->where('email', $data['email'])->first();
        $user = User::where('email', $data['email'])->first();

        if (
            ! $record ||
            ! $user ||
            ($user->account_status ?? 'active') !== 'active' ||
            now()->subMinutes(60)->greaterThan($record->created_at) ||
            ! Hash::check($data['token'], $record->token)
        ) {
            throw ValidationException::withMessages([
                'email' => ['This reset link is invalid or expired. Please request a new one.'],
            ]);
        }

        $user->forceFill([
            'password' => $data['password'],
            'must_change_password' => false,
            'temporary_password_expires_at' => null,
            'password_changed_at' => now(),
            'password_policy_version' => PasswordPolicy::CURRENT_VERSION,
            'remember_token' => Str::random(60),
        ])->save();

        DB::table('password_reset_tokens')->where('email', $data['email'])->delete();

        return redirect('/login')->with('message', 'Password reset. Please sign in with your new password.');
    }

    /**
     * Handle logout request.
     */
    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }

    /**
     * Get dashboard route based on user role.
     */
    private function getDashboardRoute(string $role): string
    {
        return match ($role) {
            'Client' => '/',
            'Marketing' => '/dashboard/marketing',
            'Accounting' => '/dashboard/accounting',
            'Admin' => '/dashboard/admin',
            default => '/',
        };
    }

    private function otpMatches(?string $storedOtp, string $submittedOtp): bool
    {
        if (! $storedOtp) {
            return false;
        }

        if (preg_match('/^\d{6}$/', $storedOtp)) {
            return hash_equals($storedOtp, $submittedOtp);
        }

        return Hash::isHashed($storedOtp) && Hash::check($submittedOtp, $storedOtp);
    }
}
