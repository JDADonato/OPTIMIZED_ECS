<?php

namespace Tests\Feature;

use App\Mail\VerifyEmailOTP;
use App\Models\Booking;
use App\Models\FoodTasting;
use App\Models\UploadedFile as UploadedFileRecord;
use App\Models\User;
use App\Support\PasswordPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\Finder\Finder;
use Tests\TestCase;

class SecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_sends_otp_without_logging_the_secret_code(): void
    {
        Mail::fake();
        Log::spy();

        $this->post('/register', [
            'username' => 'secure_client',
            'email' => 'secure-client@example.test',
            'phone' => '09170000000',
            'password' => 'StrongPass123!',
        ])->assertRedirect('/');

        $user = User::where('username', 'secure_client')->firstOrFail();

        Mail::assertQueued(VerifyEmailOTP::class);
        $this->assertNotNull($user->otp_code);
        $this->assertFalse(preg_match('/^\d{6}$/', $user->otp_code) === 1);

        Log::shouldHaveReceived('info')
            ->withArgs(fn ($message, $context = []) => $message === 'OTP verification email sent.'
                && ($context['user_id'] ?? null) === $user->id);

        $this->assertOtpLoggingStringsWereRemoved();
    }

    public function test_registration_keeps_account_when_initial_otp_email_fails(): void
    {
        Log::spy();
        Mail::shouldReceive('to')
            ->once()
            ->with('mail-failure@example.test')
            ->andThrow(new \RuntimeException('SMTP unavailable'));

        $this->post('/register', [
            'username' => 'mail_failure_client',
            'email' => 'mail-failure@example.test',
            'phone' => '09170000010',
            'password' => 'StrongPass123!',
        ])
            ->assertRedirect('/')
            ->assertSessionHas('error', 'We could not send the first verification code. Please use Resend Code to try again.');

        $user = User::where('username', 'mail_failure_client')->firstOrFail();

        $this->assertAuthenticatedAs($user);
        $this->assertNotNull($user->otp_code);
        $this->assertNotNull($user->otp_expires_at);
        $this->assertNull($user->email_verified_at);

        Log::shouldHaveReceived('error')
            ->withArgs(fn ($message, $context = []) => $message === 'Failed to send OTP email.'
                && ($context['user_id'] ?? null) === $user->id);
    }

    public function test_registration_rejects_weak_passwords_and_marks_current_policy_for_strong_passwords(): void
    {
        $this->post('/register', [
            'username' => 'weak_client',
            'email' => 'weak-client@example.test',
            'phone' => '09170000001',
            'password' => 'password123',
        ])->assertSessionHasErrors('password');

        $this->post('/register', [
            'username' => 'strong_client',
            'email' => 'strong-client@example.test',
            'phone' => '09170000002',
            'password' => 'StrongPass123!',
        ])->assertRedirect('/');

        $this->assertDatabaseHas('users', [
            'username' => 'strong_client',
            'password_policy_version' => PasswordPolicy::CURRENT_VERSION,
        ]);
    }

    public function test_resend_otp_does_not_log_the_new_secret_code(): void
    {
        Mail::fake();
        Log::spy();

        $user = User::create([
            'username' => 'unverified_client',
            'email' => 'unverified@example.test',
            'password' => 'password123',
            'role' => 'Client',
            'otp_code' => '111111',
            'otp_expires_at' => now()->addMinutes(15),
        ]);

        $this->actingAs($user)
            ->post('/resend-otp')
            ->assertRedirect();

        $user->refresh();

        Mail::assertQueued(VerifyEmailOTP::class);
        $this->assertNotSame('111111', $user->otp_code);
        $this->assertFalse(preg_match('/^\d{6}$/', $user->otp_code) === 1);

        Log::shouldHaveReceived('info')
            ->withArgs(fn ($message, $context = []) => $message === 'OTP verification email resent.'
                && ($context['user_id'] ?? null) === $user->id);

        $this->assertOtpLoggingStringsWereRemoved();
    }

    public function test_resend_otp_reports_delivery_failure_without_claiming_success(): void
    {
        Log::spy();

        $user = User::create([
            'username' => 'resend_failure_client',
            'email' => 'resend-failure@example.test',
            'password' => 'password123',
            'role' => 'Client',
            'otp_code' => Hash::make('111111'),
            'otp_expires_at' => now()->addMinutes(15),
            'otp_resend_available_at' => now()->subSecond(),
            'otp_resend_attempts' => 0,
        ]);

        Mail::shouldReceive('to')
            ->once()
            ->with('resend-failure@example.test')
            ->andThrow(new \RuntimeException('SMTP unavailable'));

        $this->actingAs($user)
            ->postJson('/resend-otp')
            ->assertStatus(500)
            ->assertJson([
                'error' => 'We could not send a verification code right now. Please try again.',
            ])
            ->assertJsonStructure(['expires_at', 'expires_in_seconds', 'retry_after_seconds']);

        $user->refresh();

        $this->assertSame(1, $user->otp_resend_attempts);
        $this->assertNotNull($user->otp_code);
        $this->assertNotNull($user->otp_expires_at);
        $this->assertNull($user->email_verified_at);

        Log::shouldHaveReceived('error')
            ->withArgs(fn ($message, $context = []) => $message === 'Failed to resend OTP email.'
                && ($context['user_id'] ?? null) === $user->id);
    }

    public function test_resend_otp_enforces_cooldown_and_exposes_retry_seconds(): void
    {
        Mail::fake();

        $user = User::create([
            'username' => 'cooldown_client',
            'email' => 'cooldown@example.test',
            'password' => 'password123',
            'role' => 'Client',
            'otp_code' => '111111',
            'otp_expires_at' => now()->addMinutes(15),
            'otp_resend_available_at' => now()->addSeconds(45),
        ]);

        $this->actingAs($user)
            ->postJson('/resend-otp')
            ->assertStatus(429)
            ->assertJsonStructure(['error', 'retry_after_seconds']);
    }

    public function test_forgot_password_reset_is_single_use_for_active_accounts(): void
    {
        Mail::fake();

        $user = User::create([
            'username' => 'reset_client',
            'email' => 'reset-client@example.test',
            'password' => 'old-password',
            'role' => 'Client',
            'account_status' => 'active',
        ]);

        $this->post('/forgot-password', ['email' => $user->email])
            ->assertSessionHas('message');

        $record = DB::table('password_reset_tokens')->where('email', $user->email)->first();
        $this->assertNotNull($record);

        $token = 'known-reset-token';
        DB::table('password_reset_tokens')->where('email', $user->email)->update([
            'token' => Hash::make($token),
            'created_at' => now(),
        ]);

        $this->post('/reset-password', [
            'email' => $user->email,
            'token' => $token,
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertSessionHasErrors('password');

        $this->post('/reset-password', [
            'email' => $user->email,
            'token' => $token,
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertRedirect('/login');

        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
        $this->assertTrue(Hash::check('new-password-123', $user->fresh()->password));
        $this->assertSame(PasswordPolicy::CURRENT_VERSION, $user->fresh()->password_policy_version);

        $this->post('/reset-password', [
            'email' => $user->email,
            'token' => $token,
            'password' => 'another-password-123',
            'password_confirmation' => 'another-password-123',
        ])->assertSessionHasErrors('email');
    }

    public function test_existing_weak_password_accounts_can_still_log_in(): void
    {
        $user = User::create([
            'username' => 'legacy_password_client',
            'email' => 'legacy-password@example.test',
            'password' => 'password',
            'role' => 'Client',
            'account_status' => 'active',
            'password_policy_version' => 1,
        ]);

        $this->post('/login', [
            'username' => $user->username,
            'password' => 'password',
        ])->assertRedirect('/');

        $this->assertAuthenticatedAs($user);
    }

    public function test_deactivated_account_does_not_receive_reset_token(): void
    {
        $user = User::create([
            'username' => 'inactive_client',
            'email' => 'inactive-client@example.test',
            'password' => 'password123',
            'role' => 'Client',
            'account_status' => 'deactivated',
        ]);

        $this->post('/forgot-password', ['email' => $user->email])
            ->assertSessionHas('message');

        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
    }

    public function test_upload_endpoint_accepts_images_and_rejects_non_images(): void
    {
        Storage::fake('public');

        $client = $this->user('Client');

        $this->actingAs($client)
            ->post('/api/upload', [
                'image' => UploadedFile::fake()->create('payment-proof.pdf', 100, 'application/pdf'),
            ])
            ->assertSessionHasErrors('image');

        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=');

        $response = $this->actingAs($client)
            ->post('/api/upload', [
                'image' => UploadedFile::fake()->createWithContent('payment-proof.png', $png),
            ])
            ->assertOk()
            ->assertJsonStructure(['url', 'upload_id']);

        $this->assertStringStartsWith('/storage/uploads/', $response->json('url'));
        $this->assertDatabaseHas('uploaded_files', [
            'id' => $response->json('upload_id'),
            'user_id' => $client->id,
            'purpose' => 'theme_upload',
            'status' => 'temporary',
        ]);
    }

    public function test_uploaded_theme_image_attaches_to_booking_and_blocks_cross_user_attachment(): void
    {
        Storage::fake('public');

        $client = $this->user('Client');
        $otherClient = $this->user('Client');
        $booking = $this->booking($client);

        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=');

        $upload = $this->actingAs($client)
            ->post('/api/upload', [
                'image' => UploadedFile::fake()->createWithContent('theme.png', $png),
                'purpose' => 'theme_upload',
            ])
            ->assertOk();

        $this->actingAs($client)
            ->putJson("/api/bookings/{$booking->id}/event-details", [
                'theme_uploads' => $upload->json('url'),
            ])
            ->assertOk();

        $this->assertDatabaseHas('uploaded_files', [
            'id' => $upload->json('upload_id'),
            'status' => 'attached',
            'attachable_type' => Booking::class,
            'attachable_id' => $booking->id,
        ]);

        $otherBooking = $this->booking($otherClient);
        $this->actingAs($otherClient)
            ->putJson("/api/bookings/{$otherBooking->id}/event-details", [
                'theme_uploads' => $upload->json('url'),
            ])
            ->assertForbidden();
    }

    public function test_orphan_upload_cleanup_discards_expired_temporary_files(): void
    {
        Storage::fake('public');

        $client = $this->user('Client');
        Storage::disk('public')->put('uploads/orphan.png', 'orphan');
        $file = UploadedFileRecord::create([
            'user_id' => $client->id,
            'disk' => 'public',
            'path' => 'uploads/orphan.png',
            'url' => '/storage/uploads/orphan.png',
            'mime_type' => 'image/png',
            'size' => 6,
            'original_name' => 'orphan.png',
            'purpose' => 'theme_upload',
            'status' => 'temporary',
            'expires_at' => now()->subMinute(),
        ]);

        $this->artisan('uploads:purge-orphans')->assertSuccessful();

        Storage::disk('public')->assertMissing('uploads/orphan.png');
        $this->assertSame('discarded', $file->fresh()->status);
    }

    public function test_booking_theme_upload_backfill_registers_existing_local_files_idempotently(): void
    {
        Storage::fake('public');

        $client = $this->user('Client');
        $booking = $this->booking($client);
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=');
        Storage::disk('public')->put('uploads/legacy-theme.png', $png);

        $booking->update([
            'theme_uploads' => json_encode([
                '/storage/uploads/legacy-theme.png',
                'https://example.test/external-theme.png',
                '/storage/uploads/missing-theme.png',
            ]),
        ]);

        $this->artisan('uploads:backfill-booking-theme-uploads --dry-run')->assertSuccessful();
        $this->assertDatabaseMissing('uploaded_files', ['path' => 'uploads/legacy-theme.png']);

        $this->artisan('uploads:backfill-booking-theme-uploads')->assertSuccessful();
        $this->assertDatabaseHas('uploaded_files', [
            'user_id' => $client->id,
            'path' => 'uploads/legacy-theme.png',
            'url' => '/storage/uploads/legacy-theme.png',
            'status' => 'attached',
            'attachable_type' => Booking::class,
            'attachable_id' => $booking->id,
        ]);

        $this->artisan('uploads:backfill-booking-theme-uploads')->assertSuccessful();
        $this->assertSame(1, UploadedFileRecord::where('path', 'uploads/legacy-theme.png')->count());
        $this->assertDatabaseMissing('uploaded_files', ['path' => 'uploads/missing-theme.png']);
    }

    public function test_legacy_plaintext_otp_verifies_once_while_new_codes_are_hashed(): void
    {
        $user = User::create([
            'username' => 'legacy_otp_client',
            'email' => 'legacy-otp@example.test',
            'password' => 'password123',
            'role' => 'Client',
            'otp_code' => '123456',
            'otp_expires_at' => now()->addMinutes(15),
        ]);

        $this->actingAs($user)
            ->post('/verify-otp', ['otp' => '123456'])
            ->assertRedirect('/');

        $this->assertNull($user->fresh()->otp_code);
    }

    public function test_preservation_guardrail_migration_uses_restrictive_foreign_keys(): void
    {
        $migration = file_get_contents(database_path('migrations/2026_05_29_000006_create_uploaded_files_and_preservation_guardrails.php'));

        $this->assertStringContainsString('bookings_user_id_foreign', $migration);
        $this->assertStringContainsString('payments_booking_id_foreign', $migration);
        $this->assertStringContainsString('conversation_participants_user_id_foreign', $migration);
        $this->assertStringContainsString('ON DELETE %s', $migration);
    }

    public function test_login_route_is_rate_limited(): void
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->from('/login')->post('/login', [
                'username' => 'missing-user',
                'password' => 'wrong-password',
            ]);
        }

        $this->from('/login')->post('/login', [
            'username' => 'missing-user',
            'password' => 'wrong-password',
        ])->assertTooManyRequests();
    }

    public function test_staff_role_blocked_from_client_dashboard_gets_request_reference(): void
    {
        $staff = $this->user('Marketing');

        $response = $this->actingAs($staff)->get('/dashboard/client');

        $response->assertForbidden();
        $this->assertNotEmpty($response->headers->get('X-Request-ID'));
    }

    public function test_client_error_endpoint_redacts_sensitive_payloads(): void
    {
        Log::spy();

        $requestId = (string) Str::uuid();

        $this->withHeader('X-Request-ID', $requestId)
            ->postJson('/api/client-errors', [
                'message' => 'Failed with sk_test_secretvalue and pay_providerid',
                'stack' => 'Authorization: Bearer secret-token',
                'url' => 'https://example.test/login',
                'context' => [
                    'password' => 'PlaintextPass123!',
                    'paymongo_payment_id' => 'pay_abc123',
                    'safe' => 'visible',
                ],
            ])
            ->assertAccepted()
            ->assertHeader('X-Request-ID', $requestId);

        Log::shouldHaveReceived('warning')
            ->withArgs(function ($message, $context = []) use ($requestId) {
                return $message === 'Client runtime error reported.'
                    && ($context['request_id'] ?? null) === $requestId
                    && ($context['context']['password'] ?? null) === '[redacted]'
                    && ($context['context']['paymongo_payment_id'] ?? null) === '[redacted]'
                    && ($context['context']['safe'] ?? null) === 'visible'
                    && ! str_contains((string) ($context['message'] ?? ''), 'sk_test_secretvalue')
                    && ! str_contains((string) ($context['stack'] ?? ''), 'secret-token');
            });
    }

    public function test_api_routes_are_not_globally_exempted_from_csrf(): void
    {
        $bootstrap = file_get_contents(base_path('bootstrap/app.php'));

        $this->assertStringNotContainsString("'api/*'", $bootstrap);
        $this->assertStringContainsString("'webhook/paymongo'", $bootstrap);
        $this->assertStringContainsString("'api/client-errors'", $bootstrap);
    }

    public function test_public_honeypots_block_contact_and_food_tasting_submissions(): void
    {
        $this->postJson('/api/contact-inquiries', [
            'full_name' => 'Bot Contact',
            'email' => 'bot@example.test',
            'subject' => 'Planning',
            'message' => 'A normal looking message',
            'website' => 'https://spam.example',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('website');

        $this->postJson('/api/food-tasting', [
            'guest_name' => 'Bot Tasting',
            'guest_email' => 'bot-tasting@example.test',
            'preferred_date' => now()->addWeek()->toDateString(),
            'preferred_time' => '10:00',
            'website' => 'https://spam.example',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('website');
    }

    public function test_staff_queue_and_notification_endpoints_support_pagination(): void
    {
        $marketing = $this->user('Marketing');
        $client = $this->user('Client');

        FoodTasting::create([
            'user_id' => $client->id,
            'guest_name' => 'Paginated Tasting',
            'guest_email' => 'paginated@example.test',
            'preferred_date' => now()->addWeek()->toDateString(),
            'preferred_time' => '10:00',
            'status' => 'Pending',
        ]);

        $client->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => 'test',
            'data' => ['message' => 'Paginated notification'],
            'read_at' => null,
        ]);

        $this->actingAs($marketing)
            ->getJson('/api/marketing/food-tastings?paginated=1&per_page=1')
            ->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['current_page', 'per_page', 'total', 'last_page']]);

        $this->actingAs($client)
            ->getJson('/api/notifications?paginated=1&per_page=1')
            ->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['current_page', 'per_page', 'total', 'last_page']]);
    }

    public function test_scalability_throttles_and_static_frontend_guards_are_in_place(): void
    {
        $routes = file_get_contents(base_path('routes/web.php'));
        $this->assertStringContainsString("sendAbandonedReminder'])->middleware('throttle:3,1')", $routes);
        $this->assertStringContainsString("recordPayment'])->middleware('throttle:3,1')", $routes);
        $this->assertStringContainsString('throttle:chat-mutation', $routes);
        $this->assertStringContainsString('throttle:notification-mutation', $routes);
        $this->assertStringContainsString('throttle:report-heavy', $routes);
        $this->assertStringContainsString('throttle:refund-action', $routes);
        $this->assertStringContainsString('throttle:admin-sensitive', $routes);
        $this->assertStringContainsString('throttle:announcement-action', $routes);

        $jsFiles = collect(Finder::create()->files()->in(resource_path('js'))->name('*.jsx')->name('*.js'))
            ->map(fn ($file) => $file->getRealPath());

        foreach ($jsFiles as $path) {
            $contents = file_get_contents($path);
            $label = str_replace(base_path().DIRECTORY_SEPARATOR, '', $path);

            $this->assertFalse((bool) preg_match('/\\b(window\\.)?(alert|prompt|confirm)\\s*\\(/', $contents), "{$label} uses a native browser dialog.");
            $this->assertFalse((bool) preg_match('/(import\\s+PaymentPage|<PaymentPage\\b|PaymentPage\\.jsx|\\/PaymentPage)/', $contents), "{$label} references the retired PaymentPage component.");
            $this->assertFalse(str_contains($contents, 'bg-indigo'), "{$label} contains bg-indigo.");
            $this->assertFalse(str_contains($contents, 'text-indigo'), "{$label} contains text-indigo.");
            $this->assertFalse(str_contains($contents, 'border-indigo'), "{$label} contains border-indigo.");
        }
    }

    public function test_frontend_fetch_wrapper_adds_csrf_header_for_same_origin_mutations(): void
    {
        $bootstrapJs = file_get_contents(resource_path('js/bootstrap.js'));

        $this->assertStringContainsString('window.fetch = async (input, init = {}) =>', $bootstrapJs);
        $this->assertStringContainsString('window.axios.interceptors.request.use', $bootstrapJs);
        $this->assertStringContainsString('window.axios.interceptors.response.use', $bootstrapJs);
        $this->assertStringContainsString("headers.set('X-CSRF-TOKEN', token);", $bootstrapJs);
        $this->assertStringContainsString("headers.set('X-Requested-With', 'XMLHttpRequest');", $bootstrapJs);
        $this->assertStringContainsString('/api/session/csrf-token', $bootstrapJs);
        $this->assertStringContainsString('__csrfRetry: true', $bootstrapJs);
        $this->assertStringContainsString('config.__csrfRetry = true', $bootstrapJs);
    }

    private function user(string $role): User
    {
        return User::create([
            'full_name' => "{$role} Tester",
            'username' => strtolower($role).'_'.uniqid(),
            'email' => uniqid(strtolower($role).'_').'@example.test',
            'password' => 'password',
            'phone' => '09170000000',
            'role' => $role,
            'email_verified_at' => now(),
        ]);
    }

    private function booking(User $client): Booking
    {
        return Booking::create([
            'user_id' => $client->id,
            'event_date' => now()->addWeeks(3)->toDateString(),
            'event_time' => '10:00 AM - 2:00 PM',
            'event_name' => 'Security Upload Event',
            'event_type' => 'Wedding',
            'pax' => 50,
            'budget' => 30000,
            'package_id' => 'custom',
            'client_full_name' => $client->full_name,
            'client_email' => $client->email,
            'client_phone' => $client->phone,
            'venue_city' => 'Quezon City',
            'venue_address_line' => 'Security venue',
            'total_cost' => 30000,
            'status' => 'Confirmed',
            'review_status' => 'Approved For Reservation',
        ]);
    }

    private function assertOtpLoggingStringsWereRemoved(): void
    {
        $controller = file_get_contents(app_path('Http/Controllers/AuthController.php'));

        $this->assertStringNotContainsString('OTP Verification code', $controller);
        $this->assertStringNotContainsString('Resent OTP Verification code', $controller);
        $this->assertStringNotContainsString('OTP FOR', $controller);
        $this->assertStringNotContainsString('RESENT OTP FOR', $controller);
        $this->assertStringNotContainsString('FAILED TO SEND OTP TO', $controller);
    }
}
