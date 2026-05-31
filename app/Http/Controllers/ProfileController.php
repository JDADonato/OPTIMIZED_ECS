<?php

namespace App\Http\Controllers;

use App\Mail\VerifyEmailOTP;
use App\Models\AuditLog;
use App\Rules\BalancedPassword;
use App\Services\AccountLifecycleService;
use App\Support\AuditContext;
use App\Support\PasswordPolicy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    public function deleteAccount(Request $request)
    {
        $user = $request->user();

        abort_unless($user && $user->role === 'Client', 403);

        $request->validate([
            'password' => ['required', 'string'],
            'confirmation' => ['required', 'in:DEACTIVATE,DELETE'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        if (! $user->email_verified_at) {
            return back()->withErrors(['confirmation' => 'Please verify your email before deleting your account.']);
        }

        if (! Hash::check($request->password, $user->password)) {
            return back()->withErrors(['password' => 'The provided password does not match your current password.']);
        }

        app(AccountLifecycleService::class)->archiveCustomerConversations($user, $user->id);

        $user->forceFill([
            'account_status' => 'deactivated',
            'deactivated_at' => now(),
            'deactivated_by' => $user->id,
            'deactivation_reason' => $request->input('reason') ?: 'Client requested account closure.',
            'remember_token' => null,
        ])->save();

        $this->recordProfileAudit($request, ['account_deactivation']);

        auth()->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/')->with('message', 'Your account has been deactivated. Eloquente will retain booking and payment records for business records.');
    }

    public function update(Request $request)
    {
        $user = $request->user();
        $profilePreferences = $request->input('profile_preferences', []);
        if (is_array($profilePreferences) && ($profilePreferences['default_guest_count'] ?? null) === '') {
            $profilePreferences['default_guest_count'] = null;
            $request->merge(['profile_preferences' => $profilePreferences]);
        }

        $request->validate([
            'full_name' => ['nullable', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:255', Rule::unique('users')->ignore($user->id)],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:255'],
            'preferred_contact_method' => ['nullable', Rule::in(['email', 'phone', 'dashboard'])],
            'notification_preferences' => ['nullable', 'array'],
            'notification_preferences.*' => ['boolean'],
            'profile_preferences' => ['nullable', 'array'],
            'profile_preferences.default_event_city' => ['nullable', 'string', 'max:120'],
            'profile_preferences.default_guest_count' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'profile_preferences.planning_notes' => ['nullable', 'string', 'max:1000'],
            'current_password' => ['nullable', 'required_with:new_password', 'string'],
            'new_password' => [
                'nullable',
                'string',
                'confirmed',
                new BalancedPassword($request->input('username', $user->username), $request->input('email', $user->email)),
            ],
            'password_verification_code' => ['nullable', 'string', 'size:6'],
            'avatar' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'remove_avatar' => ['nullable', 'boolean'],
        ]);

        $changedFields = [];

        if ($request->filled('new_password')) {
            if (! Hash::check($request->current_password, $user->password)) {
                return back()->withErrors(['current_password' => 'The provided password does not match your current password.']);
            }

            $sessionCodeHash = $request->session()->get('password_change_code_hash');
            $sessionCodeEmail = $request->session()->get('password_change_code_email');
            $sessionCodeExpiresAt = $request->session()->get('password_change_code_expires_at');

            if (
                ! $sessionCodeHash ||
                ! $sessionCodeEmail ||
                ! $sessionCodeExpiresAt ||
                $sessionCodeEmail !== $user->email ||
                now()->greaterThan($sessionCodeExpiresAt) ||
                ! Hash::check($request->input('password_verification_code'), $sessionCodeHash)
            ) {
                return back()->withErrors(['password_verification_code' => 'Enter the valid verification code sent to your email.']);
            }

            $user->password = $request->new_password;
            $user->password_changed_at = now();
            $user->password_policy_version = PasswordPolicy::CURRENT_VERSION;
            $changedFields[] = 'password';
            $request->session()->forget([
                'password_change_code_hash',
                'password_change_code_email',
                'password_change_code_expires_at',
            ]);
        }

        if ($request->boolean('remove_avatar') && $user->avatar_path) {
            Storage::disk('public')->delete($user->avatar_path);
            $user->avatar_path = null;
            $changedFields[] = 'avatar';
        }

        if ($request->hasFile('avatar')) {
            if ($user->avatar_path) {
                Storage::disk('public')->delete($user->avatar_path);
            }
            $user->avatar_path = $request->file('avatar')->store('profile-avatars', 'public');
            $changedFields[] = 'avatar';
        }

        if ($user->full_name !== $request->input('full_name')) {
            $changedFields[] = 'full_name';
        }
        $user->full_name = $request->input('full_name');

        if ($user->username !== $request->username) {
            $changedFields[] = 'username';
        }
        $user->username = $request->username;

        if ($user->email !== $request->email) {
            if (! $user->email_verified_at) {
                return back()->withErrors(['email' => 'Please verify your current email before changing it.']);
            }

            $user->email = $request->email;
            $user->email_verified_at = null; // Unverify so they have to get a new OTP
            $changedFields[] = 'email';

            $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $user->otp_code = Hash::make($otp);
            $user->otp_expires_at = now()->addMinutes(15);
            try {
                Mail::to($user->email)->send(new VerifyEmailOTP($otp));
            } catch (\Exception $e) {
                report($e);
            }

            $message = 'Profile updated! Please verify your new email address.';
        } else {
            $message = 'Profile updated successfully!';
        }

        if ($user->phone !== $request->phone) {
            $changedFields[] = 'phone';
        }
        $user->phone = $request->phone;
        $user->preferred_contact_method = $request->input('preferred_contact_method') ?: ($user->preferred_contact_method ?: 'email');
        if ($request->has('notification_preferences')) {
            $user->notification_preferences = $request->input('notification_preferences', []);
        }
        if ($request->has('profile_preferences')) {
            $user->profile_preferences = $request->input('profile_preferences', []);
        }
        $user->save();

        $this->recordProfileAudit($request, array_values(array_unique($changedFields)));

        if ($request->expectsJson()) {
            return response()->json([
                'message' => $message,
                'user' => $user->fresh(),
            ]);
        }

        return back()->with('message', $message);
    }

    public function sendPasswordCode(Request $request)
    {
        $user = $request->user();
        $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $expiresAt = now()->addMinutes(10);

        $request->session()->put([
            'password_change_code_hash' => Hash::make($otp),
            'password_change_code_email' => $user->email,
            'password_change_code_expires_at' => $expiresAt,
        ]);

        try {
            Mail::to($user->email)->sendNow(new VerifyEmailOTP($otp, 'password change', 10));
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'We could not send the verification code right now. Please try again.',
            ], 500);
        }

        return response()->json([
            'message' => 'Verification code sent to your email.',
            'expires_at' => $expiresAt->toIso8601String(),
            'expires_in_seconds' => now()->diffInSeconds($expiresAt),
        ]);
    }

    public function avatar(Request $request)
    {
        $path = $request->user()?->avatar_path;

        abort_unless($path && Storage::disk('public')->exists($path), 404);

        $absolutePath = Storage::disk('public')->path($path);

        return response()->file($absolutePath, [
            'Cache-Control' => 'private, max-age=300',
        ]);
    }

    public function activity(Request $request)
    {
        if (! Schema::hasTable('audit_logs')) {
            return response()->json(['data' => []]);
        }

        $items = AuditLog::query()
            ->where('user_id', $request->user()->id)
            ->where('action', 'profile_update')
            ->latest()
            ->limit(8)
            ->get(['id', 'action', 'metadata', 'created_at']);

        return response()->json(['data' => $items]);
    }

    private function recordProfileAudit(Request $request, array $changedFields): void
    {
        if (empty($changedFields) || ! Schema::hasTable('audit_logs')) {
            return;
        }

        $user = $request->user();
        AuditLog::create([
            'user_id' => $user->id,
            'username' => $user->username,
            'role' => $user->role,
            'action' => 'profile_update',
            'method' => $request->method(),
            'path' => $request->path(),
            'status_code' => 200,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 1000),
            'metadata' => AuditContext::forAccount($request, $user, 'Completed', [
                'changed_fields' => $changedFields,
            ]),
        ]);
    }
}
