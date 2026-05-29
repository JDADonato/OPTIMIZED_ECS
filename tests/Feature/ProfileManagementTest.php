<?php

namespace Tests\Feature;

use App\Mail\VerifyEmailOTP;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProfileManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_update_profile_preferences_and_contact_details(): void
    {
        $user = User::create([
            'full_name' => 'Original Name',
            'username' => 'client_' . uniqid(),
            'email' => 'client@example.test',
            'password' => 'password',
            'role' => 'Client',
        ]);

        $this->actingAs($user)
            ->put('/profile', [
                'full_name' => 'Updated Client',
                'username' => $user->username,
                'email' => $user->email,
                'phone' => '09170000000',
                'preferred_contact_method' => 'dashboard',
                'notification_preferences' => [
                    'booking_updates' => true,
                    'payment_reminders' => false,
                    'message_alerts' => true,
                    'announcements' => true,
                ],
                'profile_preferences' => [
                    'default_event_city' => 'Metro Manila',
                    'default_guest_count' => 120,
                    'planning_notes' => 'Prefers plated service.',
                ],
            ])
            ->assertSessionHasNoErrors();

        $user->refresh();
        $this->assertSame('Updated Client', $user->full_name);
        $this->assertSame('dashboard', $user->preferred_contact_method);
        $this->assertFalse($user->notification_preferences['payment_reminders']);
        $this->assertSame('Metro Manila', $user->profile_preferences['default_event_city']);
    }

    public function test_email_change_clears_verification_and_password_change_requires_current_password(): void
    {
        Mail::fake();

        $user = User::create([
            'username' => 'client_' . uniqid(),
            'email' => 'old@example.test',
            'email_verified_at' => now(),
            'password' => 'password123',
            'role' => 'Client',
        ]);

        $this->actingAs($user)
            ->put('/profile', [
                'username' => $user->username,
                'email' => 'new@example.test',
                'current_password' => 'wrong-password',
                'new_password' => 'newpassword123',
                'new_password_confirmation' => 'newpassword123',
            ])
            ->assertSessionHasErrors('current_password');

        $this->actingAs($user)
            ->put('/profile', [
                'username' => $user->username,
                'email' => 'new@example.test',
                'current_password' => 'password123',
                'new_password' => 'newpassword123',
                'new_password_confirmation' => 'newpassword123',
            ])
            ->assertSessionHasErrors('password_verification_code');

        $this->withSession([
            'password_change_code_hash' => Hash::make('123456'),
            'password_change_code_email' => $user->email,
            'password_change_code_expires_at' => now()->addMinutes(10),
        ]);

        $this->actingAs($user)
            ->put('/profile', [
                'username' => $user->username,
                'email' => 'new@example.test',
                'current_password' => 'password123',
                'new_password' => 'newpassword123',
                'new_password_confirmation' => 'newpassword123',
                'password_verification_code' => '123456',
            ])
            ->assertSessionHasNoErrors();

        $this->assertNull($user->fresh()->email_verified_at);
        $this->assertTrue(password_verify('newpassword123', $user->fresh()->password));
    }

    public function test_avatar_upload_accepts_images_and_rejects_invalid_files(): void
    {
        Storage::fake('public');

        $user = User::create([
            'username' => 'client_' . uniqid(),
            'email' => 'client@example.test',
            'password' => 'password',
            'role' => 'Client',
        ]);

        $this->actingAs($user)
            ->put('/profile', [
                'username' => $user->username,
                'email' => $user->email,
                'avatar' => UploadedFile::fake()->create('not-image.pdf', 20, 'application/pdf'),
            ])
            ->assertSessionHasErrors('avatar');

        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=');

        $this->actingAs($user)
            ->put('/profile', [
                'username' => $user->username,
                'email' => $user->email,
                'avatar' => UploadedFile::fake()->createWithContent('avatar.png', $png),
            ])
            ->assertSessionHasNoErrors();

        Storage::disk('public')->assertExists($user->fresh()->avatar_path);
    }

    public function test_password_verification_code_can_be_sent_to_user_email(): void
    {
        Mail::fake();

        $user = User::create([
            'username' => 'client_' . uniqid(),
            'email' => 'client@example.test',
            'password' => 'password',
            'role' => 'Client',
        ]);

        $this->actingAs($user)
            ->postJson('/profile/password-code')
            ->assertOk()
            ->assertJson(['message' => 'Verification code sent to your email.'])
            ->assertJsonStructure(['message', 'expires_at', 'expires_in_seconds']);

        Mail::assertSent(VerifyEmailOTP::class);
        $this->assertSame($user->email, session('password_change_code_email'));
        $this->assertNotEmpty(session('password_change_code_hash'));
    }

    public function test_password_verification_code_expires_before_password_change(): void
    {
        $user = User::create([
            'username' => 'client_' . uniqid(),
            'email' => 'client@example.test',
            'password' => 'password123',
            'role' => 'Client',
        ]);

        $this->withSession([
            'password_change_code_hash' => Hash::make('123456'),
            'password_change_code_email' => $user->email,
            'password_change_code_expires_at' => now()->subMinute(),
        ]);

        $this->actingAs($user)
            ->put('/profile', [
                'username' => $user->username,
                'email' => $user->email,
                'current_password' => 'password123',
                'new_password' => 'newpassword123',
                'new_password_confirmation' => 'newpassword123',
                'password_verification_code' => '123456',
            ])
            ->assertSessionHasErrors('password_verification_code');
    }
}
