<?php

namespace App\Http\Controllers;

use App\Mail\AnnouncementEmail;
use App\Models\Announcement;
use App\Models\AnnouncementRead;
use App\Models\User;
use App\Services\AnnouncementService;
use App\Services\OperationalBroadcastService;
use App\Support\ResourceVersion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class AnnouncementController extends Controller
{
    public function __construct(private AnnouncementService $service) {}

    public function index(Request $request)
    {
        $this->service->publishDueScheduled();

        $query = Announcement::with(['creator:id,username', 'recipients', 'reads'])
            ->withCount([
                'recipients as sent_count' => fn ($q) => $q->where('status', 'sent'),
                'recipients as failed_count' => fn ($q) => $q->where('status', 'failed'),
                'recipients as pending_count' => fn ($q) => $q->where('status', 'pending'),
                'recipients as opened_count' => fn ($q) => $q->whereNotNull('opened_at'),
                'recipients as clicked_count' => fn ($q) => $q->whereNotNull('clicked_at'),
                'reads as read_count',
            ])
            ->latest();

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        $versionMeta = ResourceVersion::fromQuery($query);
        if (ResourceVersion::matches($request, $versionMeta)) {
            return ResourceVersion::unchanged($versionMeta);
        }

        if ($request->boolean('paginated') || $request->has('page') || $request->has('per_page')) {
            $perPage = min(max((int) $request->query('per_page', 25), 1), 75);
            $paginator = $query->paginate($perPage);

            return response()->json([
                'data' => $paginator->items(),
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

        return response()->json($query->limit(200)->get());
    }

    public function publicIndex(Request $request)
    {
        $this->service->publishDueScheduled();

        $limit = min(max((int) $request->query('limit', 4), 1), 8);

        $announcements = Announcement::visibleNow()
            ->where('visibility', 'all_customers')
            ->orderByRaw("CASE WHEN type = 'urgent' THEN 0 WHEN type = 'promo' THEN 1 ELSE 2 END")
            ->latest('published_at')
            ->limit($limit)
            ->get()
            ->map(fn (Announcement $announcement) => $this->publicPayload($announcement));

        return response()->json($announcements);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data['slug'] = $this->service->uniqueSlug($data['title']);
        $data['created_by'] = $request->user()->id;
        $data['updated_by'] = $request->user()->id;

        $announcement = Announcement::create($data);
        app(OperationalBroadcastService::class)
            ->adminChanged('announcements', 'announcement', $announcement->id, 'created', 'Announcement created.');

        return response()->json($announcement->fresh(['creator:id,username']), 201);
    }

    public function update(Request $request, Announcement $announcement)
    {
        $data = $this->validated($request, $announcement->id);
        $data['slug'] = $this->service->uniqueSlug($data['title'], $announcement->id);
        $data['updated_by'] = $request->user()->id;

        $announcement->update($data);
        app(OperationalBroadcastService::class)
            ->adminChanged('announcements', 'announcement', $announcement->id, 'updated', 'Announcement updated.');

        return response()->json($announcement->fresh(['creator:id,username']));
    }

    public function publish(Request $request, Announcement $announcement)
    {
        $this->validatePublishability($announcement);

        $payload = $this->service->publish($announcement, $request->user());
        app(OperationalBroadcastService::class)
            ->adminChanged('announcements', 'announcement', $announcement->id, 'published', 'Announcement published.');

        return response()->json($payload);
    }

    public function archive(Request $request, Announcement $announcement)
    {
        $payload = $this->service->archive($announcement, $request->user());
        app(OperationalBroadcastService::class)
            ->adminChanged('announcements', 'announcement', $announcement->id, 'archived', 'Announcement archived.');

        return response()->json($payload);
    }

    public function destroy(Announcement $announcement)
    {
        $this->service->deleteDraft($announcement);
        app(OperationalBroadcastService::class)
            ->adminChanged('announcements', 'announcement', $announcement->id, 'discarded', 'Announcement discarded.');

        return response()->json(['message' => 'Announcement discarded.']);
    }

    public function audienceUsers(Request $request)
    {
        $search = trim((string) $request->query('q', ''));

        $users = User::query()
            ->select('id', 'username', 'email', 'role')
            ->reachableForNotifications()
            ->when($search !== '', function ($query) use ($search) {
                $term = '%'.mb_strtolower($search).'%';
                $query->where(function ($q) use ($term) {
                    $q->whereRaw('LOWER(username) LIKE ?', [$term])
                        ->orWhereRaw('LOWER(email) LIKE ?', [$term])
                        ->orWhereRaw('LOWER(role) LIKE ?', [$term]);
                });
            })
            ->orderByRaw("CASE WHEN role = 'Client' THEN 0 ELSE 1 END")
            ->orderBy('username')
            ->limit(20)
            ->get();

        return response()->json($users);
    }

    public function sendTest(Request $request, Announcement $announcement)
    {
        $data = $request->validate(['email' => 'required|email']);
        Mail::to($data['email'])->queue(new AnnouncementEmail($announcement));

        return response()->json(['message' => 'Test email queued.']);
    }

    public function preview(Announcement $announcement)
    {
        return Inertia::render('preview/AnnouncementPreview', [
            'announcement' => array_merge($this->publicPayload($announcement), [
                'status' => $announcement->status,
                'visibility' => $announcement->visibility,
                'visibility_roles' => $announcement->visibility_roles,
                'send_email' => $announcement->send_email,
            ]),
        ]);
    }

    public function customerIndex(Request $request)
    {
        $this->service->publishDueScheduled();

        $user = $request->user();
        $hasBookings = $user->bookings()->exists();

        $announcements = Announcement::visibleNow()
            ->where(function ($query) use ($user, $hasBookings) {
                $query->where('visibility', 'all_customers')
                    ->orWhere(fn ($q) => $q->where('visibility', 'active_clients')->whereRaw($hasBookings ? '1=1' : '1=0'))
                    ->orWhere(fn ($q) => $q->where('visibility', 'specific_roles')->whereJsonContains('visibility_roles', $user->role))
                    ->orWhere(fn ($q) => $q->where('visibility', 'specific_users')->whereJsonContains('specific_user_ids', $user->id));
            })
            ->with(['reads' => fn ($q) => $q->where('user_id', $user->id)])
            ->orderByRaw("CASE WHEN type = 'urgent' THEN 0 ELSE 1 END")
            ->latest('published_at')
            ->get()
            ->map(fn ($announcement) => array_merge($announcement->toArray(), [
                'is_read' => $announcement->reads->isNotEmpty(),
            ]));

        return response()->json($announcements);
    }

    public function markRead(Request $request, Announcement $announcement)
    {
        AnnouncementRead::updateOrCreate(
            ['announcement_id' => $announcement->id, 'user_id' => $request->user()->id],
            ['read_at' => now()]
        );

        return response()->json(['message' => 'Announcement marked as read.']);
    }

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'summary' => 'nullable|string|max:500',
            'body' => 'nullable|string',
            'type' => ['required', Rule::in(['general', 'promo', 'event_reminder', 'holiday_advisory', 'menu_update', 'service_notice', 'urgent'])],
            'status' => ['nullable', Rule::in(['draft', 'scheduled', 'published', 'archived'])],
            'visibility' => ['required', Rule::in(['all_customers', 'active_clients', 'specific_roles', 'specific_users'])],
            'visibility_roles' => 'nullable|array',
            'visibility_roles.*' => 'string',
            'specific_user_ids' => 'nullable|array',
            'specific_user_ids.*' => 'integer|exists:users,id',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date|after_or_equal:starts_at',
            'send_email' => 'boolean',
            'email_subject' => 'nullable|string|max:255',
            'email_body' => 'nullable|string',
            'cta_label' => 'nullable|string|max:80',
            'cta_url' => 'nullable|string|max:255',
            'image_path' => 'nullable|string|max:255',
        ]);

        $data['send_email'] = $request->boolean('send_email');

        return $data;
    }

    private function publicPayload(Announcement $announcement): array
    {
        return [
            'id' => $announcement->id,
            'title' => $announcement->title,
            'slug' => $announcement->slug,
            'summary' => $announcement->summary,
            'body' => $announcement->body,
            'type' => $announcement->type,
            'cta_label' => $announcement->cta_label,
            'cta_url' => $announcement->cta_url,
            'image_path' => $announcement->image_path,
            'image_url' => $this->imageUrl($announcement->image_path),
            'published_at' => optional($announcement->published_at)->toDateTimeString(),
            'starts_at' => optional($announcement->starts_at)->toDateTimeString(),
            'ends_at' => optional($announcement->ends_at)->toDateTimeString(),
        ];
    }

    private function validatePublishability(Announcement $announcement): void
    {
        if (blank($announcement->title)) {
            abort(422, 'Add an announcement title before publishing.');
        }

        if (blank($announcement->summary) && blank($announcement->body)) {
            abort(422, 'Add a customer-friendly summary or message before publishing.');
        }

        if ($announcement->visibility === 'all_customers' && blank($announcement->summary)) {
            abort(422, 'Homepage announcements need a short summary customers can scan.');
        }

        if ($announcement->starts_at && $announcement->ends_at && $announcement->ends_at->lt($announcement->starts_at)) {
            abort(422, 'The announcement end date must be after the start date.');
        }
    }

    private function imageUrl(?string $path): ?string
    {
        if (blank($path)) {
            return null;
        }

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://') || str_starts_with($path, '/')) {
            return $path;
        }

        return '/storage/'.ltrim($path, '/');
    }
}
