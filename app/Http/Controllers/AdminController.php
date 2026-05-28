<?php

namespace App\Http\Controllers;

use App\Http\Resources\BookingSummaryResource;
use App\Http\Resources\UserSummaryResource;
use App\Models\Booking;
use App\Models\AuditLog;
use App\Models\MenuItem;
use App\Models\PricingOverride;
use App\Models\User;
use App\Notifications\CustomerAccountLifecycleNotification;
use App\Notifications\StaffAccountAccessNotification;
use App\Notifications\StaffAccountLifecycleNotification;
use App\Services\AdminReportService;
use App\Services\EmailDeliveryService;
use App\Services\EventPreparationService;
use App\Services\PostEventLifecycleService;
use App\Support\ApiResponse;
use App\Support\ResourceVersion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Ported from: server/controllers/adminController.js
 * Employee CRUD, pricing, discounts, and analytics.
 */
class AdminController extends Controller
{
    private const TEMPORARY_PASSWORD_TTL_HOURS = 24;

    /**
     * Show the Admin dashboard page.
     */
    public function index()
    {
        return Inertia::render('Admin/DashboardAdmin');
    }

    // ==========================================
    // 1. Employee Account Management (RBAC)
    // ==========================================

    public function getEmployees(Request $request)
    {
        $query = User::whereIn('role', ['Admin', 'Marketing', 'Accounting'])
            ->when($request->filled('role') && $request->query('role') !== 'all', fn ($q) => $q->where('role', $request->query('role')))
            ->when($request->filled('account_status') && $request->query('account_status') !== 'all', function ($q) use ($request) {
                if ($request->query('account_status') === 'active') {
                    $q->where(fn ($inner) => $inner->whereNull('account_status')->orWhere('account_status', 'active'));
                    return;
                }

                $q->where('account_status', $request->query('account_status'));
            })
            ->when($request->filled('must_change_password') && $request->query('must_change_password') !== 'all', function ($q) use ($request) {
                $request->boolean('must_change_password')
                    ? $q->whereRaw('must_change_password is true')
                    : $q->where(fn ($inner) => $inner->whereNull('must_change_password')->orWhereRaw('must_change_password is false'));
            })
            ->when($request->query('search'), function ($q, $search) {
                $term = '%' . mb_strtolower(trim((string) $search)) . '%';
                $q->where(fn ($inner) => $inner
                    ->whereRaw('LOWER(full_name) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(username) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(email) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(phone) LIKE ?', [$term]));
            })
            ->orderBy('created_at', 'desc');

        if ($request->boolean('paginated')) {
            $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
            $employees = $query->paginate($perPage, ['id', 'full_name', 'username', 'email', 'phone', 'role', 'account_status', 'must_change_password', 'last_login_at', 'deactivated_at', 'created_at']);

            return ApiResponse::paginated($employees, UserSummaryResource::collection($employees->getCollection())->resolve());
        }

        $employees = $query->get(['id', 'full_name', 'username', 'email', 'phone', 'role', 'account_status', 'must_change_password', 'last_login_at', 'deactivated_at', 'created_at']);

        return response()->json(UserSummaryResource::collection($employees)->resolve());
    }

    public function createEmployee(Request $request)
    {
        $request->validate([
            'full_name' => 'required|string|max:255',
            'username' => 'required|string|unique:users,username',
            'email'    => 'nullable|email|unique:users,email',
            'phone'    => 'nullable|string',
            'role'     => 'required|in:Admin,Marketing,Accounting',
        ]);

        $temporaryPassword = Str::password(14);

        $user = User::create([
            'full_name' => $request->full_name,
            'username' => $request->username,
            'password' => $temporaryPassword,
            'email'    => $request->email,
            'phone'    => $request->phone,
            'role'     => $request->role,
            'account_status' => 'active',
            'must_change_password' => true,
            'temporary_password_expires_at' => now()->addHours(self::TEMPORARY_PASSWORD_TTL_HOURS),
            'temporary_password_secret' => $temporaryPassword,
        ]);

        $emailDelivery = app(EmailDeliveryService::class)
            ->sendToNotifiable($user, new StaffAccountAccessNotification($temporaryPassword, 'created'), 'staff_account_created');

        $this->recordAccountAudit('Staff account created', $user, 'Succeeded', [
            'target_role' => $user->role,
            'email_delivery' => $emailDelivery['status'],
        ]);

        return response()->json([
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'message' => 'Account created. Share the temporary password through a private channel.',
            'temporary_password' => $temporaryPassword,
            'temporary_password_expires_at' => $user->temporary_password_expires_at,
            'email_delivery' => $emailDelivery['message'],
            'email_delivery_status' => $emailDelivery,
        ], 201);
    }

    public function updateEmployee(Request $request, int $id)
    {
        $request->validate([
            'full_name' => ['nullable', 'string', 'max:255'],
            'username' => ['nullable', 'string', Rule::unique('users', 'username')->ignore($id)],
            'email'    => ['nullable', 'email', Rule::unique('users', 'email')->ignore($id)],
            'phone'    => 'nullable|string',
            'password' => 'nullable|string|min:6',
            'role'     => 'nullable|in:Marketing,Accounting',
        ]);

        $user = User::find($id);

        if (!$user || in_array($user->role, ['Admin', 'Client'])) {
            return response()->json(['error' => 'Cannot modify this user'], 403);
        }

        $updates = [];
        if ($request->has('full_name')) $updates['full_name'] = $request->full_name;
        if ($request->has('username')) $updates['username'] = $request->username;
        if ($request->has('email'))    $updates['email'] = $request->email;
        if ($request->has('phone'))    $updates['phone'] = $request->phone;
        if ($request->has('role'))     $updates['role'] = $request->role;
        if ($request->has('password') && $request->password) {
            $updates['password'] = Hash::make($request->password);
            $updates['must_change_password'] = true;
            $updates['temporary_password_expires_at'] = now()->addHours(self::TEMPORARY_PASSWORD_TTL_HOURS);
            $updates['temporary_password_secret'] = null;
        }

        if (empty($updates)) {
            return response()->json(['error' => 'No fields to update'], 400);
        }

        $originalRole = $user->role;
        $user->update($updates);

        $emailDelivery = null;
        if (isset($updates['role']) && $updates['role'] !== $originalRole) {
            $emailDelivery = app(EmailDeliveryService::class)
                ->sendToNotifiable($user, new StaffAccountLifecycleNotification('role_changed', $user->role), 'staff_role_changed');
        }

        $this->recordAccountAudit('Staff account updated', $user, 'Succeeded', [
            'changed_fields' => array_values(array_diff(array_keys($updates), ['password', 'temporary_password_secret'])),
            'role_changed' => isset($updates['role']) && $updates['role'] !== $originalRole,
            'email_delivery' => $emailDelivery['status'] ?? null,
        ]);

        return response()->json([
            'message' => 'Employee account updated successfully',
            'email_delivery' => $emailDelivery['message'] ?? null,
            'email_delivery_status' => $emailDelivery,
        ]);
    }

    public function deleteEmployee(int $id)
    {
        $user = User::find($id);

        if (!$user || in_array($user->role, ['Admin', 'Client'])) {
            return response()->json(['error' => 'Cannot delete this user'], 403);
        }

        $user->forceFill([
            'account_status' => 'deactivated',
            'deactivated_at' => now(),
            'deactivated_by' => Auth::id(),
            'deactivation_reason' => 'Deactivated by administrator.',
            'temporary_password_expires_at' => null,
            'temporary_password_secret' => null,
        ])->save();

        $emailDelivery = app(EmailDeliveryService::class)
            ->sendToNotifiable($user, new StaffAccountLifecycleNotification('deactivated'), 'staff_deactivated');
        $this->recordAccountAudit('Staff account deactivated', $user, 'Succeeded', [
            'email_delivery' => $emailDelivery['status'],
        ]);

        return response()->json([
            'message' => 'Employee account deactivated successfully',
            'email_delivery' => $emailDelivery['message'],
            'email_delivery_status' => $emailDelivery,
        ]);
    }

    public function resetEmployeePassword(int $id)
    {
        $user = User::find($id);

        if (!$user || $user->role === 'Client' || ((int) $user->id === (int) Auth::id())) {
            return response()->json(['error' => 'Cannot modify this user'], 403);
        }

        $temporaryPassword = Str::password(14);
        $user->forceFill([
            'password' => Hash::make($temporaryPassword),
            'must_change_password' => true,
            'temporary_password_expires_at' => now()->addHours(self::TEMPORARY_PASSWORD_TTL_HOURS),
            'temporary_password_secret' => $temporaryPassword,
        ])->save();

        $emailDelivery = app(EmailDeliveryService::class)
            ->sendToNotifiable($user, new StaffAccountAccessNotification($temporaryPassword, 'reset'), 'staff_password_reset');
        $this->recordAccountAudit('Staff password reset', $user, 'Succeeded', [
            'email_delivery' => $emailDelivery['status'],
        ]);

        return response()->json([
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'message' => 'Temporary password generated. Share it through a private channel.',
            'temporary_password' => $temporaryPassword,
            'temporary_password_expires_at' => $user->temporary_password_expires_at,
            'email_delivery' => $emailDelivery['message'],
            'email_delivery_status' => $emailDelivery,
        ]);
    }

    public function revealTemporaryPassword(int $id)
    {
        $user = User::whereIn('role', ['Admin', 'Marketing', 'Accounting'])->find($id);

        if (!$user || (int) $user->id === (int) Auth::id()) {
            return response()->json(['error' => 'Temporary password is not available for this account.'], 403);
        }

        if ($user->temporary_password_expires_at && now()->isAfter($user->temporary_password_expires_at)) {
            $user->forceFill([
                'temporary_password_secret' => null,
            ])->save();

            $this->recordAccountAudit('Temporary password viewed', $user, 'Denied', [
                'reason' => 'expired',
                'expires_at' => $user->temporary_password_expires_at,
            ]);

            return response()->json([
                'message' => 'Temporary password is no longer available. Reset temporary password to generate a new one.',
            ], 410);
        }

        if (!$user->requiresPasswordChange() || empty($user->temporary_password_secret)) {
            $this->recordAccountAudit('Temporary password viewed', $user, 'Denied', [
                'reason' => $user->requiresPasswordChange() ? 'missing_secret' : 'password_already_changed',
                'expires_at' => $user->temporary_password_expires_at,
            ]);

            return response()->json([
                'message' => 'Temporary password is no longer available. Reset temporary password to generate a new one.',
            ], 410);
        }

        $this->recordAccountAudit('Temporary password viewed', $user, 'Succeeded', [
            'expires_at' => $user->temporary_password_expires_at,
        ]);

        return response()->json([
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'temporary_password' => $user->temporary_password_secret,
            'temporary_password_expires_at' => $user->temporary_password_expires_at,
            'email_delivery' => 'This password is available until it expires or the account owner changes it.',
            'email_delivery_status' => [
                'status' => 'revealed',
                'message' => 'Temporary password was shown from secure temporary storage.',
            ],
        ]);
    }

    public function forceEmployeePasswordChange(int $id)
    {
        $user = User::find($id);

        if (!$user || $user->role === 'Client' || ((int) $user->id === (int) Auth::id())) {
            return response()->json(['error' => 'Cannot modify this user'], 403);
        }

        $user->forceFill([
            'must_change_password' => true,
            'temporary_password_expires_at' => null,
            'temporary_password_secret' => null,
        ])->save();

        $emailDelivery = app(EmailDeliveryService::class)
            ->sendToNotifiable($user, new StaffAccountLifecycleNotification('force_password_change'), 'staff_force_password_change');
        $this->recordAccountAudit('Required staff password change', $user, 'Succeeded', [
            'email_delivery' => $emailDelivery['status'],
        ]);

        return response()->json([
            'message' => 'Staff will be asked to change password on next sign-in.',
            'email_delivery' => $emailDelivery['message'],
            'email_delivery_status' => $emailDelivery,
        ]);
    }

    public function reactivateEmployee(int $id)
    {
        $user = User::find($id);

        if (!$user || in_array($user->role, ['Admin', 'Client'])) {
            return response()->json(['error' => 'Cannot modify this user'], 403);
        }

        $user->forceFill([
            'account_status' => 'active',
            'deactivated_at' => null,
            'deactivated_by' => null,
            'deactivation_reason' => null,
        ])->save();

        $emailDelivery = app(EmailDeliveryService::class)
            ->sendToNotifiable($user, new StaffAccountLifecycleNotification('reactivated'), 'staff_reactivated');
        $this->recordAccountAudit('Staff account reactivated', $user, 'Succeeded', [
            'email_delivery' => $emailDelivery['status'],
        ]);

        return response()->json([
            'message' => 'Employee account reactivated successfully',
            'email_delivery' => $emailDelivery['message'],
            'email_delivery_status' => $emailDelivery,
        ]);
    }

    public function getCustomers(Request $request)
    {
        $status = (string) $request->query('status', 'active');

        $query = User::where('role', 'Client')
            ->select(['id', 'full_name', 'username', 'email', 'phone', 'role', 'account_status', 'last_login_at', 'deactivated_at', 'created_at'])
            ->withCount('bookings')
            ->withMax('bookings', 'event_date')
            ->when($status !== 'all', function ($q) use ($status) {
                if ($status === 'deactivated') {
                    $q->where('account_status', 'deactivated');
                    return;
                }

                $q->where(fn ($inner) => $inner
                    ->whereNull('account_status')
                    ->orWhere('account_status', 'active'));
            })
            ->when($request->query('search'), function ($q, $search) {
                $term = '%' . mb_strtolower(trim((string) $search)) . '%';
                $q->where(fn ($inner) => $inner
                    ->whereRaw('LOWER(full_name) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(username) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(email) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(phone) LIKE ?', [$term]));
            })
            ->when($request->filled('booking_activity') && $request->query('booking_activity') !== 'all', function ($q) use ($request) {
                match ($request->query('booking_activity')) {
                    'with_bookings' => $q->has('bookings'),
                    'without_bookings' => $q->doesntHave('bookings'),
                    default => null,
                };
            })
            ->orderBy('created_at', 'desc');

        if ($request->boolean('paginated')) {
            $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
            return ApiResponse::paginated($query->paginate($perPage));
        }

        $customers = $query->get();

        return response()->json($customers);
    }

    public function updateCustomer(Request $request, int $id)
    {
        $request->validate([
            'username' => ['nullable', 'string', Rule::unique('users', 'username')->ignore($id)],
            'email'    => ['nullable', 'email', Rule::unique('users', 'email')->ignore($id)],
            'phone'    => 'nullable|string',
            'password' => 'nullable|string|min:6',
        ]);

        $user = User::find($id);

        if (!$user || $user->role !== 'Client') {
            return response()->json(['error' => 'Cannot modify this user'], 403);
        }

        $updates = [];
        if ($request->has('username')) $updates['username'] = $request->username;
        if ($request->has('email'))    $updates['email'] = $request->email;
        if ($request->has('phone'))    $updates['phone'] = $request->phone;
        if ($request->has('password') && $request->password) {
            $updates['password'] = Hash::make($request->password);
        }

        if (empty($updates)) {
            return response()->json(['error' => 'No fields to update'], 400);
        }

        $user->update($updates);

        $this->recordAccountAudit('Customer account updated', $user, 'Succeeded', [
            'changed_fields' => array_values(array_diff(array_keys($updates), ['password'])),
        ]);

        return response()->json(['message' => 'Customer account updated successfully']);
    }

    public function deleteCustomer(Request $request, int $id)
    {
        $user = User::find($id);

        if (!$user || $user->role !== 'Client') {
            return response()->json(['error' => 'Cannot delete this user'], 403);
        }

        $originalEmail = $user->email;
        $notifyCustomer = $request->boolean('notify_customer', true);

        $user->forceFill([
            'email' => $user->email ? sprintf('deactivated+%d+%s@eloquente.invalid', $user->id, now()->format('YmdHis')) : null,
            'account_status' => 'deactivated',
            'deactivated_at' => now(),
            'deactivated_by' => Auth::id(),
            'deactivation_reason' => 'Deactivated by administrator.',
        ])->save();

        $emailDelivery = app(EmailDeliveryService::class)
            ->sendToAddress($originalEmail, new CustomerAccountLifecycleNotification('deactivated'), 'customer_deactivated', $notifyCustomer);
        $this->recordAccountAudit('Customer account deactivated', $user, 'Succeeded', [
            'notification' => $emailDelivery['status'],
        ]);

        return response()->json([
            'message' => 'Customer account deactivated. Booking and payment records were preserved.',
            'email_delivery' => $emailDelivery['message'],
            'email_delivery_status' => $emailDelivery,
        ]);
    }

    public function reactivateCustomer(Request $request, int $id)
    {
        $user = User::find($id);

        if (!$user || $user->role !== 'Client') {
            return response()->json(['error' => 'Cannot modify this user'], 403);
        }

        $user->forceFill([
            'account_status' => 'active',
            'deactivated_at' => null,
            'deactivated_by' => null,
            'deactivation_reason' => null,
        ])->save();

        $emailDelivery = app(EmailDeliveryService::class)
            ->sendToAddress($user->email, new CustomerAccountLifecycleNotification('reactivated'), 'customer_reactivated', $request->boolean('notify_customer', true));
        $this->recordAccountAudit('Customer account reactivated', $user, 'Succeeded', [
            'notification' => $emailDelivery['status'],
        ]);

        return response()->json([
            'message' => 'Customer account reactivated successfully',
            'email_delivery' => $emailDelivery['message'],
            'email_delivery_status' => $emailDelivery,
        ]);
    }

    public function deliveryDiagnostics(EmailDeliveryService $emailDelivery): \Illuminate\Http\JsonResponse
    {
        return response()->json($emailDelivery->diagnostics());
    }

    public function sendDiagnosticEmail(Request $request, EmailDeliveryService $emailDelivery): \Illuminate\Http\JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $result = $emailDelivery->sendDiagnostic($data['email']);

        return response()->json([
            'message' => $result['message'],
            'email_delivery' => $result['message'],
            'email_delivery_status' => $result,
        ], $result['status'] === 'failed' || $result['status'] === 'mail_not_configured' ? 422 : 200);
    }

    private function recordAccountAudit(string $action, ?User $target, string $result, array $metadata = []): void
    {
        try {
            $actor = Auth::user();
            if (!$actor) {
                return;
            }

            AuditLog::create([
                'user_id' => $actor->id,
                'username' => $actor->username,
                'role' => $actor->role,
                'action' => $action,
                'method' => request()->method(),
                'path' => '/' . ltrim(request()->path(), '/'),
                'status_code' => 200,
                'ip_address' => request()->ip(),
                'user_agent' => Str::limit((string) request()->userAgent(), 500, ''),
                'metadata' => array_merge([
                    'explicit_account_audit' => true,
                    'target_user_id' => $target?->id,
                    'target_role' => $target?->role,
                    'result' => $result,
                ], $metadata),
            ]);
        } catch (\Throwable $e) {
            Log::warning('Unable to record account audit log.', [
                'action' => $action,
                'target_user_id' => $target?->id,
                'message' => $e->getMessage(),
            ]);
        }
    }

    // ==========================================
    // 2. Admin Booking Management
    // ==========================================

    public function getBookings(Request $request)
    {
        $query = Booking::query()
            ->select([
                'id',
                'user_id',
                'booking_source',
                'created_by_staff_id',
                'event_date',
                'event_time',
                'pax',
                'budget',
                'package_id',
                'event_type',
                'event_name',
                'client_full_name',
                'client_email',
                'client_phone',
                'venue_address_line',
                'venue_street',
                'venue_city',
                'venue_province',
                'venue_zip_code',
                'total_cost',
                'status',
                'review_status',
                'assigned_to',
                'transfer_requested_to',
                'transfer_requested_by',
                'transfer_requested_at',
                'clarification_request',
                'clarification_response',
                'clarification_requested_at',
                'clarification_responded_at',
                'reviewed_at',
                'live_status',
                'created_at',
            ])
            ->with([
                'user:id,full_name,username,email,phone,role',
                'assignee:id,full_name,username',
                'createdByStaff:id,full_name,username',
                'transferRequestedTo:id,full_name,username',
                'transferRequestedBy:id,full_name,username',
                'reviewTasks',
                'preparationTasks',
                'payments:id,booking_id,amount,status,payment_type,due_date',
            ])
            ->when(!$request->boolean('include_history'), fn ($q) => $q->whereNotIn('status', ['Cancelled', 'cancelled', 'Completed', 'completed']))
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->query('source'), function ($q, $source) {
                if ($source === 'customer') {
                    $q->where(fn ($inner) => $inner->whereNull('booking_source')->orWhere('booking_source', 'customer'));
                    return;
                }

                $q->where('booking_source', $source);
            })
            ->when($request->query('search'), function ($q, $search) {
                $term = '%' . mb_strtolower(trim((string) $search)) . '%';
                $q->where(fn ($inner) => $inner
                    ->whereRaw('LOWER(client_full_name) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(event_name) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(client_email) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(venue_city) LIKE ?', [$term]));
            })
            ->orderBy('created_at', 'desc');

        $versionMeta = ResourceVersion::fromQuery($query);
        if (ResourceVersion::matches($request, $versionMeta)) {
            return ResourceVersion::unchanged($versionMeta);
        }

        if ($request->boolean('paginated')) {
            $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
            $bookings = $query->paginate($perPage);
            return ApiResponse::paginated($bookings, BookingSummaryResource::collection($bookings->getCollection())->resolve(), [
                ...$versionMeta,
                'changed' => true,
            ]);
        }

        $bookings = BookingSummaryResource::collection($query->get())->resolve();

        return ResourceVersion::changed($bookings, $versionMeta);
    }

    public function updateBookingStatus(Request $request, int $id)
    {
        $request->validate([
            'status' => 'required|in:Confirmed',
        ]);

        $booking = Booking::find($id);
        if (!$booking) {
            return response()->json(['error' => 'Booking not found'], 404);
        }

        if ($booking->status === $request->status) {
            return response()->json([
                'success' => true,
                'message' => 'Booking status already up to date',
                'booking' => $booking,
            ]);
        }

        if ($booking->status !== 'Pending') {
            return response()->json(['error' => 'Only pending bookings can be approved from this screen.'], 422);
        }

        $booking->update([
            'status' => $request->status,
            'review_status' => 'Approved For Reservation',
            'reviewed_at' => now(),
        ]);
        EventPreparationService::ensureDefaultTasks($booking->fresh());
        Cache::put('admin.analytics.version', (int) Cache::get('admin.analytics.version', 1) + 1);
        $booking->refresh();

        try {
            $client = User::find($booking->user_id);
            if ($client) {
                $client->notify(new \App\Notifications\BookingStatusNotification($booking, $request->status));
            }
        } catch (\Exception $e) {
            Log::error("Notification failed on admin booking approval: {$e->getMessage()}");
        }

        return response()->json([
            'success' => true,
            'message' => 'Booking approved successfully',
            'booking' => $booking,
        ]);
    }

    // ==========================================
    // 3. Global Pricing Control
    // ==========================================

    public function getPricingOverrides()
    {
        try {
            $overrides = PricingOverride::all();
            $pricingMap = [];
            foreach ($overrides as $item) {
                $pricingMap[$item->id] = $item->new_price;
            }
            return response()->json(['overrides' => $pricingMap]);
        } catch (\Exception $e) {
            return response()->json(['overrides' => []]);
        }
    }

    public function updatePricingOverride(Request $request)
    {
        $request->validate([
            'id'        => 'required|string',
            'item_type' => 'required|string',
            'item_id'   => 'required|string',
            'new_price' => 'required|numeric',
        ]);

        PricingOverride::updateOrCreate(
            ['id' => $request->id],
            [
                'item_type' => $request->item_type,
                'item_id'   => $request->item_id,
                'new_price' => $request->new_price,
            ]
        );

        return response()->json(['message' => 'Pricing updated successfully']);
    }

    // ==========================================
    // 4. Custom On-The-Fly Discounts
    // ==========================================

    public function applyDiscount(Request $request, int $id)
    {
        $request->validate([
            'discount_value' => 'nullable|numeric',
            'discount_type'  => 'nullable|in:fixed,percentage',
        ]);

        $booking = Booking::find($id);
        if (!$booking) {
            return response()->json(['error' => 'Booking not found'], 404);
        }

        $originalAmount = $booking->budget ?? $booking->total_cost ?? 0;
        $discountValue = $request->discount_value ?? 0;
        $discountType = $request->discount_type ?? 'fixed';

        if ($discountType === 'percentage') {
            $deduction = $originalAmount * ($discountValue / 100);
            $newTotalCost = $originalAmount - $deduction;
        } elseif ($discountType === 'fixed') {
            $newTotalCost = $originalAmount - $discountValue;
        } else {
            $newTotalCost = $originalAmount;
        }

        $newTotalCost = max(0, $newTotalCost);

        $booking->update([
            'discount_value' => $discountValue,
            'discount_type'  => $discountType,
            'total_cost'     => $newTotalCost,
        ]);
        Cache::put('admin.analytics.version', (int) Cache::get('admin.analytics.version', 1) + 1);

        return response()->json([
            'message'        => 'Discount applied successfully',
            'new_total_cost' => $newTotalCost,
        ]);
    }

    // ==========================================
    // 5. Decision Support System (DSS): Analytics
    // ==========================================

    public function getAnalytics(Request $request, AdminReportService $reports)
    {
        $filters = $this->analyticsFilters($request);

        return response()->json($reports->analytics($filters));
    }

    public function getAnalyticsSummary(Request $request, AdminReportService $reports)
    {
        return response()->json($reports->analyticsSummary($this->analyticsFilters($request)));
    }

    public function getAnalyticsRevenue(Request $request, AdminReportService $reports)
    {
        return response()->json($reports->analyticsRevenue($this->analyticsFilters($request)));
    }

    public function getAnalyticsPipeline(Request $request, AdminReportService $reports)
    {
        return response()->json($reports->analyticsPipeline($this->analyticsFilters($request)));
    }

    public function getAnalyticsMenuPerformance(Request $request, AdminReportService $reports)
    {
        return response()->json($reports->analyticsMenuPerformance($this->analyticsFilters($request)));
    }

    public function getAnalyticsCustomerExperience(Request $request, AdminReportService $reports)
    {
        return response()->json($reports->analyticsCustomerExperience($this->analyticsFilters($request)));
    }

    public function getAnalyticsOperations(Request $request, AdminReportService $reports)
    {
        return response()->json($reports->analyticsOperations($this->analyticsFilters($request)));
    }

    public function getAnalyticsForecasts(Request $request, AdminReportService $reports)
    {
        return response()->json($reports->analyticsForecasts($this->analyticsFilters($request)));
    }

    private function analyticsFilters(Request $request): array
    {
        return array_filter($request->only([
            'date_from',
            'date_to',
            'event_type',
            'package_id',
            'booking_status',
            'payment_status',
            'city',
            'pax_min',
            'pax_max',
            'trend_months',
            'revenue_forecast_period',
            'revenue_forecast_horizon',
            'revenue_sma_window',
            'pax_projection_period',
            'pax_projection_horizon',
            'pax_sma_window',
            'pax_projection_year',
            'pax_projection_quarter',
            'snapshot_window',
        ]), fn ($value) => $value !== null && $value !== '');
    }

    public function getAudits(Request $request)
    {
        $perPage = min((int) $request->query('per_page', 25), 100);

        $query = AuditLog::query()
            ->when($request->query('role'), fn ($q, $role) => $q->where('role', $role))
            ->when($request->query('method'), fn ($q, $method) => $q->where('method', strtoupper($method)))
            ->when($request->query('search'), function ($q, $search) {
                $term = '%' . mb_strtolower(trim((string) $search)) . '%';
                $q->where(function ($inner) use ($term) {
                    $inner->whereRaw('LOWER(username) LIKE ?', [$term])
                        ->orWhereRaw('LOWER(action) LIKE ?', [$term])
                        ->orWhereRaw('LOWER(path) LIKE ?', [$term]);
                });
            })
            ->orderByDesc('created_at');

        return response()->json($query->paginate($perPage));
    }

    // ==========================================
    // 6. Custom Menu Items CRUD
    // ==========================================

    public function getMenuItems()
    {
        $items = MenuItem::orderBy('category')->orderBy('name')->get();
        return response()->json($items);
    }

    public function createMenuItem(Request $request)
    {
        $request->validate([
            'name'          => 'required|string|max:255',
            'category'      => 'required|in:starter,main,side,dessert,drink',
            'cost_per_head' => 'required|numeric|min:0',
            'price_adj'     => 'nullable|numeric|min:0',
            'image'         => 'nullable|string',
            'description'   => 'nullable|string',
            'is_best_seller' => 'nullable|boolean',
        ]);

        $dishId = 'custom_' . strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $request->name)) . '_' . time();

        $item = MenuItem::create([
            'dish_id'        => $dishId,
            'name'           => $request->name,
            'category'       => $request->category,
            'cost_per_head'  => $request->cost_per_head,
            'price_adj'      => $request->price_adj ?? 0,
            'image'          => $request->image ?? 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400',
            'description'    => $request->description ?? '',
            'is_best_seller' => $request->is_best_seller ?? false,
        ]);
        Cache::put('admin.analytics.version', (int) Cache::get('admin.analytics.version', 1) + 1);

        return response()->json($item, 201);
    }

    public function updateMenuItem(Request $request, int $id)
    {
        $item = MenuItem::find($id);
        if (!$item) {
            return response()->json(['error' => 'Menu item not found'], 404);
        }

        $request->validate([
            'name'          => 'nullable|string|max:255',
            'category'      => 'nullable|in:starter,main,side,dessert,drink',
            'cost_per_head' => 'nullable|numeric|min:0',
            'price_adj'     => 'nullable|numeric|min:0',
            'image'         => 'nullable|string',
            'description'   => 'nullable|string',
            'is_best_seller' => 'nullable|boolean',
        ]);

        $item->update($request->only([
            'name', 'category', 'cost_per_head', 'price_adj',
            'image', 'description', 'is_best_seller',
        ]));
        Cache::put('admin.analytics.version', (int) Cache::get('admin.analytics.version', 1) + 1);

        return response()->json($item);
    }

    public function deleteMenuItem(int $id)
    {
        $item = MenuItem::find($id);
        if (!$item) {
            return response()->json(['error' => 'Menu item not found'], 404);
        }

        $item->delete();
        Cache::put('admin.analytics.version', (int) Cache::get('admin.analytics.version', 1) + 1);
        return response()->json(['message' => 'Menu item deleted successfully']);
    }
}
