<?php

namespace App\Http\Controllers;

use App\Models\FoodTasting;
use App\Models\User;
use App\Services\OperationalBroadcastService;
use App\Support\ResourceVersion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Ported from: server/controllers/foodTastingController.js
 * Handles food tasting scheduling for both guests and authenticated users.
 */
class FoodTastingController extends Controller
{
    /**
     * Create a food tasting request.
     * Ported from: foodTastingController.createTasting()
     * Supports both guest (unauthenticated) and logged-in users.
     */
    public function store(Request $request)
    {
        $request->validate([
            'guest_name' => 'required|string',
            'guest_email' => 'required|email',
            'guest_phone' => 'nullable|string',
            'preferred_date' => 'required|date',
            'preferred_time' => 'required|string',
            'notes' => 'nullable|string',
            'website' => 'nullable|prohibited',
        ]);

        $userId = Auth::check() ? Auth::id() : null;
        $duplicateUser = $this->findDuplicateUser($request->guest_email, $request->guest_phone);

        $tasting = FoodTasting::create([
            'user_id' => $userId,
            'guest_name' => $request->guest_name,
            'guest_email' => $request->guest_email,
            'guest_phone' => $request->guest_phone,
            'preferred_date' => $request->preferred_date,
            'preferred_time' => $request->preferred_time,
            'notes' => $request->notes,
            'duplicate_user_id' => $duplicateUser?->id,
        ]);
        app(OperationalBroadcastService::class)
            ->staffQueueChanged('food_tastings', 'food_tasting', $tasting->id, 'created', 'New food tasting request.');

        return response()->json([
            'success' => true,
            'message' => 'Food tasting scheduled successfully!',
            'tastingId' => $tasting->id,
        ], 201);
    }

    /**
     * Get tastings for the authenticated user.
     * Ported from: foodTastingController.getMyTastings()
     */
    public function index()
    {
        $tastings = FoodTasting::where('user_id', Auth::id())
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($tastings);
    }

    public function update(Request $request, $id)
    {
        $tasting = FoodTasting::where('id', $id)->where('user_id', Auth::id())->firstOrFail();

        $request->validate([
            'guest_name' => 'required|string',
            'guest_email' => 'required|email',
            'guest_phone' => 'nullable|string',
            'preferred_date' => 'required|date',
            'preferred_time' => 'required|string',
            'notes' => 'nullable|string',
        ]);

        $tasting->update($request->only([
            'guest_name', 'guest_email', 'guest_phone', 'preferred_date', 'preferred_time', 'notes',
        ]));
        app(OperationalBroadcastService::class)
            ->staffQueueChanged('food_tastings', 'food_tasting', $tasting->id, 'updated', 'Food tasting request updated.');

        return response()->json(['message' => 'Food tasting updated.']);
    }

    public function destroy($id)
    {
        return $this->cancel($id);
    }

    public function cancel($id)
    {
        $tasting = FoodTasting::where('id', $id)->where('user_id', Auth::id())->firstOrFail();

        $tasting->update(['status' => 'Cancelled']);
        app(OperationalBroadcastService::class)
            ->staffQueueChanged('food_tastings', 'food_tasting', $tasting->id, 'cancelled', 'Food tasting request cancelled.');

        return response()->json(['message' => 'Food tasting cancelled.']);
    }

    public function staffIndex(Request $request)
    {
        $query = FoodTasting::query()
            ->with(['user:id,full_name,username,email,phone,account_status', 'duplicateUser:id,full_name,username,email,phone,account_status'])
            ->latest('preferred_date')
            ->latest('created_at');

        if ($request->filled('status') && $request->query('status') !== 'All') {
            $query->where('status', $request->query('status'));
        } else {
            $query->whereNotIn('status', ['Archived', 'Spam']);
        }

        if ($request->filled('from')) {
            $query->whereDate('preferred_date', '>=', $request->query('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('preferred_date', '<=', $request->query('to'));
        }

        $versionMeta = ResourceVersion::fromQuery($query);
        if (ResourceVersion::matches($request, $versionMeta)) {
            return ResourceVersion::unchanged($versionMeta);
        }

        $format = fn (FoodTasting $tasting) => [
            'id' => $tasting->id,
            'client_name' => $tasting->guest_name ?: $tasting->user?->full_name ?: $tasting->user?->username,
            'client_email' => $tasting->guest_email ?: $tasting->user?->email,
            'client_phone' => $tasting->guest_phone ?: $tasting->user?->phone,
            'preferred_date' => $tasting->preferred_date,
            'preferred_time' => $tasting->preferred_time,
            'status' => $tasting->status,
            'notes' => $tasting->notes,
            'outcome_notes' => $tasting->outcome_notes,
            'confirmed_at' => $tasting->confirmed_at,
            'completed_at' => $tasting->completed_at,
            'handled_by' => $tasting->handled_by,
            'archived_at' => $tasting->archived_at,
            'duplicate_customer' => $tasting->duplicateUser ? [
                'id' => $tasting->duplicateUser->id,
                'name' => $tasting->duplicateUser->full_name ?: $tasting->duplicateUser->username,
                'email' => $this->safeDuplicateEmail($tasting->duplicateUser),
                'account_status' => $tasting->duplicateUser->account_status ?? 'active',
                'is_deactivated' => ! $tasting->duplicateUser->isActive(),
            ] : null,
        ];

        if ($request->boolean('paginated') || $request->has('page') || $request->has('per_page')) {
            $perPage = min(max((int) $request->query('per_page', 25), 1), 75);
            $paginator = $query->paginate($perPage);

            return response()->json([
                'data' => collect($paginator->items())->map($format)->values(),
                'meta' => [
                    'current_page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                    'last_page' => $paginator->lastPage(),
                    ...$versionMeta,
                    'changed' => true,
                ],
            ]);
        }

        return response()->json($query->limit(200)->get()->map($format));
    }

    public function staffUpdate(Request $request, FoodTasting $tasting)
    {
        $data = $request->validate([
            'status' => ['required', 'in:Pending,Contacted,Approved,Confirmed,Completed,Cancelled,Rescheduled,Archived,Spam'],
            'preferred_date' => ['nullable', 'date'],
            'preferred_time' => ['nullable', 'string', 'max:120'],
            'outcome_notes' => ['nullable', 'string', 'max:2000'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $status = $data['status'];
        $tasting->fill([
            'status' => $status,
            'preferred_date' => $data['preferred_date'] ?? $tasting->preferred_date,
            'preferred_time' => $data['preferred_time'] ?? $tasting->preferred_time,
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $tasting->notes,
            'outcome_notes' => array_key_exists('outcome_notes', $data) ? $data['outcome_notes'] : $tasting->outcome_notes,
            'handled_by' => Auth::id(),
        ]);

        if (in_array($status, ['Approved', 'Confirmed'], true) && ! $tasting->confirmed_at) {
            $tasting->confirmed_at = now();
        }

        if ($status === 'Completed' && ! $tasting->completed_at) {
            $tasting->completed_at = now();
        }

        if (in_array($status, ['Archived', 'Spam'], true) && ! $tasting->archived_at) {
            $tasting->archived_at = now();
        } elseif (! in_array($status, ['Archived', 'Spam'], true)) {
            $tasting->archived_at = null;
        }

        $tasting->save();
        app(OperationalBroadcastService::class)
            ->staffQueueChanged('food_tastings', 'food_tasting', $tasting->id, 'updated', 'Food tasting status changed.');

        return response()->json([
            'message' => 'Food tasting updated.',
            'tasting' => $tasting->fresh(),
        ]);
    }

    private function findDuplicateUser(?string $email, ?string $phone): ?User
    {
        $email = filled($email) ? strtolower(trim($email)) : null;
        $phone = filled($phone) ? preg_replace('/\D+/', '', $phone) : null;

        if (! $email && ! $phone) {
            return null;
        }

        return User::query()
            ->where('role', 'Client')
            ->where(function ($query) use ($email, $phone) {
                if ($email) {
                    $query->orWhereRaw('LOWER(email) = ?', [$email]);
                }
                if ($phone) {
                    $query->orWhere('phone', $phone);
                }
            })
            ->orderByRaw("CASE WHEN account_status IS NULL OR account_status = 'active' THEN 0 ELSE 1 END")
            ->first();
    }

    private function safeDuplicateEmail(User $user): ?string
    {
        return $user->hasPlaceholderEmail() ? null : $user->email;
    }
}
