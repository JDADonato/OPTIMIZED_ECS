<?php

namespace App\Support;

use App\Models\Announcement;
use App\Models\AuditLog;
use App\Models\Booking;
use App\Models\ContactInquiry;
use App\Models\Conversation;
use App\Models\EventPreparationTask;
use App\Models\EventType;
use App\Models\FeedbackResponse;
use App\Models\FoodTasting;
use App\Models\MenuItem;
use App\Models\Message;
use App\Models\Package;
use App\Models\Payment;
use App\Models\RefundCase;
use App\Models\ReportRun;
use App\Models\ReportTemplate;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class AuditContext
{
    private const SENSITIVE_FIELD_MARKERS = [
        'authorization',
        'auth',
        'cookie',
        'csrf',
        'token',
        'password',
        'otp',
        'secret',
        'api_key',
        'card',
        'provider',
        'paymongo',
        'proof_image',
        'image',
        'body',
        'email_body',
        'message_body',
    ];

    public static function forRequest(Request $request, ?Response $response = null, array $extra = []): array
    {
        $statusCode = $response?->getStatusCode();
        $path = '/'.ltrim($request->path(), '/');
        $base = [
            'route' => optional($request->route())->getName(),
            'method' => $request->method(),
            'path' => $path,
            'status_code' => $statusCode,
            'result' => self::resultLabel($statusCode),
            'workspace' => self::workspaceForPath($path),
            'changed_fields' => self::changedFields($request),
        ];

        $targetContext = self::targetContext($request, $extra);
        if (empty($targetContext['target_label'])) {
            $targetContext = array_merge($targetContext, self::responseTargetContext($path, $response));
        }

        $metadata = array_merge(
            $base,
            $targetContext,
            SensitiveDataRedactor::redact($extra),
        );
        $metadata['changed_fields'] = self::sanitizeChangedFields($metadata['changed_fields'] ?? []);

        return self::compact($metadata);
    }

    public static function forAccount(Request $request, ?User $target, string $result, array $extra = []): array
    {
        $metadata = self::forRequest($request, null, $extra);
        $metadata['result'] = $result ?: ($metadata['result'] ?? 'Completed');

        if ($target) {
            $metadata = array_merge($metadata, self::userContext($target));
        }

        return self::compact($metadata);
    }

    public static function normalize(AuditLog $audit): array
    {
        $metadata = is_array($audit->metadata) ? $audit->metadata : [];
        $path = $audit->path ?: ($metadata['path'] ?? '');
        $statusCode = (int) ($audit->status_code ?: ($metadata['status_code'] ?? 0));

        $metadata['workspace'] ??= self::workspaceForPath($path);
        $metadata['result'] ??= self::resultLabel($statusCode ?: null);
        $metadata['method'] ??= $audit->method;
        $metadata['path'] ??= $audit->path;
        $metadata['status_code'] ??= $audit->status_code;

        if (! empty($metadata['target_user_id']) && empty($metadata['target_label'])) {
            $user = User::find($metadata['target_user_id']);
            if ($user) {
                $metadata = array_merge($metadata, self::userContext($user));
            }
        }

        if (! empty($metadata['booking_id']) && empty($metadata['booking_ref'])) {
            $booking = Booking::with('user')->find($metadata['booking_id']);
            if ($booking) {
                $metadata = array_merge($metadata, self::bookingContext($booking, false));
            }
        }

        if (! empty($metadata['target_id']) && empty($metadata['target_label'])) {
            $metadata = array_merge($metadata, self::fallbackTargetFromMetadata($metadata));
        }

        $array = $audit->toArray();
        $array['metadata'] = self::compact(SensitiveDataRedactor::redact($metadata));
        $array['metadata']['changed_fields'] = self::sanitizeChangedFields($array['metadata']['changed_fields'] ?? []);
        $array['workspace'] = $array['metadata']['workspace'] ?? self::workspaceForPath($path);
        $array['result_label'] = $array['metadata']['result'] ?? self::resultLabel($statusCode ?: null);
        $array['target_type'] = $array['metadata']['target_type'] ?? null;
        $array['target_label'] = $array['metadata']['target_label'] ?? null;
        $array['changed_fields'] = $array['metadata']['changed_fields'] ?? [];

        return $array;
    }

    private static function targetContext(Request $request, array $extra): array
    {
        $path = '/'.ltrim($request->path(), '/');
        $route = $request->route();

        if ($user = self::routeModel($request, ['user', 'customer', 'employee'], User::class)) {
            return self::userContext($user);
        }

        if ($booking = self::routeModel($request, ['booking'], Booking::class)) {
            return self::bookingContext($booking);
        }

        if ($payment = self::routeModel($request, ['payment'], Payment::class)) {
            return self::paymentContext($payment);
        }

        if ($conversation = self::routeModel($request, ['conversation'], Conversation::class)) {
            return self::conversationContext($conversation);
        }

        if ($message = self::routeModel($request, ['message'], Message::class)) {
            return self::messageContext($message);
        }

        if ($task = self::routeModel($request, ['task'], EventPreparationTask::class)) {
            return self::taskContext($task);
        }

        if ($tasting = self::routeModel($request, ['tasting'], FoodTasting::class)) {
            return self::tastingContext($tasting);
        }

        if ($response = self::routeModel($request, ['response'], FeedbackResponse::class)) {
            return self::feedbackContext($response);
        }

        if ($announcement = self::routeModel($request, ['announcement'], Announcement::class)) {
            return self::simpleModelContext('announcement', $announcement, $announcement->title ?: "Announcement #{$announcement->id}");
        }

        if ($template = self::routeModel($request, ['template'], ReportTemplate::class)) {
            return self::simpleModelContext('report template', $template, $template->name ?: "Report template #{$template->id}");
        }

        if ($run = self::routeModel($request, ['run'], ReportRun::class)) {
            return self::simpleModelContext('report run', $run, "Report run #{$run->id}");
        }

        $id = $route?->parameter('id')
            ?? $route?->parameter('bookingId')
            ?? $route?->parameter('paymentId')
            ?? $route?->parameter('date')
            ?? ($extra['target_id'] ?? null)
            ?? ($extra['booking_id'] ?? null)
            ?? ($extra['payment_id'] ?? null)
            ?? ($extra['customer_id'] ?? null);

        if ($bookingId = self::bookingIdFrom($request, $extra)) {
            if ($booking = Booking::with('user')->find($bookingId)) {
                return self::bookingContext($booking, self::targetTypeForPath($path) !== 'refund');
            }
        }

        if ($paymentId = self::integerFrom($route?->parameter('paymentId') ?? ($extra['payment_id'] ?? null))) {
            if ($payment = Payment::with(['booking.user'])->find($paymentId)) {
                return self::paymentContext($payment);
            }
        }

        if ($target = self::resourceContextByPath($path, $id)) {
            return $target;
        }

        if (str_contains($path, '/api/admin/settings') || str_contains($path, '/api/admin/payment-rules')) {
            return [
                'target_type' => 'settings',
                'target_label' => str_contains($path, 'payment-rules') ? 'Payment rules' : 'Business profile settings',
            ];
        }

        if (str_contains($path, '/api/calendar-availability')) {
            return [
                'target_type' => 'date availability',
                'target_id' => $route?->parameter('date') ?: $id,
                'target_label' => 'Date availability: '.($route?->parameter('date') ?: $id ?: 'selected date'),
            ];
        }

        return self::compact([
            'target_type' => self::targetTypeForPath($path),
            'target_id' => self::scalarId($id),
        ]);
    }

    private static function resourceContextByPath(string $path, mixed $id): ?array
    {
        $id = self::integerFrom($id);

        if (! $id) {
            return null;
        }

        if (str_contains($path, '/api/admin/employees')) {
            return ($user = User::find($id)) ? self::userContext($user) : self::idOnlyContext('staff account', $id);
        }

        if (str_contains($path, '/api/admin/customers')) {
            return ($user = User::find($id)) ? self::userContext($user) : self::idOnlyContext('customer account', $id);
        }

        if (str_contains($path, '/api/admin/bookings') || str_contains($path, '/api/marketing/bookings')) {
            return ($booking = Booking::with('user')->find($id)) ? self::bookingContext($booking) : self::idOnlyContext('booking', $id, "#BK-{$id}");
        }

        if (str_contains($path, '/api/accounting/payments')) {
            return ($payment = Payment::with(['booking.user'])->find($id)) ? self::paymentContext($payment) : self::idOnlyContext('payment', $id);
        }

        if (str_contains($path, '/api/admin/refund') || str_contains($path, '/api/accounting/refund')) {
            return ($booking = Booking::with('user')->find($id)) ? self::refundContextForBooking($booking) : self::idOnlyContext('refund', $id, "Refund for #BK-{$id}");
        }

        if (str_contains($path, '/api/admin/menu-items')) {
            return ($item = MenuItem::find($id)) ? self::simpleModelContext('menu item', $item, $item->name ?: "Menu item #{$id}") : self::idOnlyContext('menu item', $id);
        }

        if (str_contains($path, '/api/admin/packages')) {
            return ($package = Package::find($id)) ? self::simpleModelContext('package', $package, $package->name ?: "Package #{$id}") : self::idOnlyContext('package', $id);
        }

        if (str_contains($path, '/api/admin/event-types')) {
            return ($eventType = EventType::find($id)) ? self::simpleModelContext('event type', $eventType, $eventType->name ?: "Event type #{$id}") : self::idOnlyContext('event type', $id);
        }

        if (str_contains($path, '/api/operations/preparation-tasks')) {
            return ($task = EventPreparationTask::with('booking.user')->find($id)) ? self::taskContext($task) : self::idOnlyContext('task', $id);
        }

        if (str_contains($path, '/api/marketing/food-tastings')) {
            return ($tasting = FoodTasting::with('user')->find($id)) ? self::tastingContext($tasting) : self::idOnlyContext('food tasting', $id);
        }

        if (str_contains($path, '/api/marketing/contact-inquiries')) {
            return ($inquiry = ContactInquiry::find($id)) ? self::simpleModelContext('guest inquiry', $inquiry, $inquiry->full_name ?: "Guest inquiry #{$id}") : self::idOnlyContext('guest inquiry', $id);
        }

        return null;
    }

    private static function responseTargetContext(string $path, ?Response $response): array
    {
        if (! $response || $response->getStatusCode() >= 400 || ! method_exists($response, 'getContent')) {
            return [];
        }

        $data = json_decode((string) $response->getContent(), true);
        if (! is_array($data)) {
            return [];
        }

        $id = data_get($data, 'id')
            ?? data_get($data, 'item.id')
            ?? data_get($data, 'package.id')
            ?? data_get($data, 'event_type.id')
            ?? data_get($data, 'template.id')
            ?? data_get($data, 'announcement.id');

        if (! $id && data_get($data, 'booking.id')) {
            $id = data_get($data, 'booking.id');
        }

        return self::resourceContextByPath($path, $id) ?? [];
    }

    private static function userContext(User $user): array
    {
        $targetType = $user->role === 'Client' ? 'customer account' : 'staff account';
        $label = self::userLabel($user);

        return self::compact([
            'target_type' => $targetType,
            'target_id' => $user->id,
            'target_label' => Str::headline($targetType).": {$label}",
            'affected_user_id' => $user->id,
            'affected_user_label' => $label,
            'target_role' => $user->role,
        ]);
    }

    private static function bookingContext(Booking $booking, bool $primaryTarget = true): array
    {
        $booking->loadMissing('user');
        $identity = CustomerIdentity::forBooking($booking);
        $account = $identity['customer_account'] ?? [];
        $contact = $identity['booking_contact'] ?? [];
        $label = self::bookingRef($booking->id);

        return self::compact([
            'target_type' => $primaryTarget ? 'booking' : 'refund',
            'target_id' => $booking->id,
            'target_label' => $primaryTarget ? $label : "Refund for {$label}",
            'booking_id' => $booking->id,
            'booking_ref' => $label,
            'booking_contact_name' => $contact['name'] ?? null,
            'customer_account_name' => $account['name'] ?? null,
            'affected_user_id' => $account['id'] ?? $booking->user_id,
            'affected_user_label' => $account['name'] ?? null,
            'has_different_booking_contact' => $identity['has_different_booking_contact'] ?? false,
        ]);
    }

    private static function paymentContext(Payment $payment): array
    {
        $payment->loadMissing(['booking.user']);
        $booking = $payment->booking;
        $bookingContext = $booking ? self::bookingContext($booking, false) : [];
        $bookingRef = $bookingContext['booking_ref'] ?? null;

        return self::compact(array_merge($bookingContext, [
            'target_type' => 'payment',
            'target_id' => $payment->id,
            'target_label' => 'Payment #'.$payment->id.($bookingRef ? " for {$bookingRef}" : ''),
            'payment_id' => $payment->id,
        ]));
    }

    private static function refundContextForBooking(Booking $booking): array
    {
        return self::bookingContext($booking, false);
    }

    private static function conversationContext(Conversation $conversation): array
    {
        $conversation->loadMissing(['client', 'booking.user']);
        $client = $conversation->client;
        $bookingContext = $conversation->booking ? self::bookingContext($conversation->booking, false) : [];
        $label = 'Conversation #'.$conversation->id;

        if ($client) {
            $label .= ' with '.self::userLabel($client);
        }

        return self::compact(array_merge($bookingContext, [
            'target_type' => 'conversation',
            'target_id' => $conversation->id,
            'target_label' => $label,
            'conversation_id' => $conversation->id,
            'affected_user_id' => $client?->id,
            'affected_user_label' => $client ? self::userLabel($client) : ($bookingContext['affected_user_label'] ?? null),
        ]));
    }

    private static function messageContext(Message $message): array
    {
        $message->loadMissing('conversation.client', 'conversation.booking.user');
        $conversationContext = $message->conversation ? self::conversationContext($message->conversation) : [];

        return self::compact(array_merge($conversationContext, [
            'target_type' => 'message',
            'target_id' => $message->id,
            'target_label' => 'Message #'.$message->id.($message->conversation_id ? " in conversation #{$message->conversation_id}" : ''),
            'message_id' => $message->id,
            'conversation_id' => $message->conversation_id,
        ]));
    }

    private static function taskContext(EventPreparationTask $task): array
    {
        $task->loadMissing('booking.user');
        $bookingContext = $task->booking ? self::bookingContext($task->booking, false) : [];

        return self::compact(array_merge($bookingContext, [
            'target_type' => 'task',
            'target_id' => $task->id,
            'target_label' => ($task->label ?: "Preparation task #{$task->id}").($task->booking_id ? ' for '.self::bookingRef($task->booking_id) : ''),
            'task_id' => $task->id,
            'department' => $task->department,
        ]));
    }

    private static function tastingContext(FoodTasting $tasting): array
    {
        $tasting->loadMissing('user');
        $label = $tasting->guest_name ?: ($tasting->user ? self::userLabel($tasting->user) : "Food tasting #{$tasting->id}");

        return self::compact([
            'target_type' => 'food tasting',
            'target_id' => $tasting->id,
            'target_label' => "Food tasting: {$label}",
            'affected_user_id' => $tasting->user_id,
            'affected_user_label' => $tasting->user ? self::userLabel($tasting->user) : $tasting->guest_name,
        ]);
    }

    private static function feedbackContext(FeedbackResponse $response): array
    {
        $response->loadMissing('booking.user');
        $bookingContext = $response->booking ? self::bookingContext($response->booking, false) : [];

        return self::compact(array_merge($bookingContext, [
            'target_type' => 'feedback response',
            'target_id' => $response->id,
            'target_label' => 'Feedback response #'.$response->id,
        ]));
    }

    private static function simpleModelContext(string $type, Model $model, string $label): array
    {
        return self::compact([
            'target_type' => $type,
            'target_id' => $model->getKey(),
            'target_label' => $label,
        ]);
    }

    private static function idOnlyContext(string $type, int|string $id, ?string $label = null): array
    {
        return [
            'target_type' => $type,
            'target_id' => $id,
            'target_label' => $label ?: Str::headline($type)." #{$id}",
        ];
    }

    private static function fallbackTargetFromMetadata(array $metadata): array
    {
        $type = $metadata['target_type'] ?? null;
        $id = $metadata['target_id'] ?? null;

        if (! $type || ! $id) {
            return [];
        }

        return self::idOnlyContext((string) $type, $id, $type === 'booking' ? self::bookingRef((int) $id) : null);
    }

    private static function changedFields(Request $request): array
    {
        if ($request->isMethod('GET') || $request->isMethod('HEAD') || $request->isMethod('DELETE')) {
            return [];
        }

        return collect(array_keys($request->except(['_token', '_method'])))
            ->filter(fn (string $field) => ! self::isSensitiveField($field))
            ->map(fn (string $field) => Str::of($field)->replace('.', '_')->snake()->toString())
            ->unique()
            ->values()
            ->all();
    }

    private static function sanitizeChangedFields(mixed $fields): array
    {
        if (! is_array($fields)) {
            return [];
        }

        return collect($fields)
            ->map(fn ($field) => is_string($field) ? $field : null)
            ->filter(fn (?string $field) => $field && ! self::isSensitiveField($field))
            ->map(fn (string $field) => Str::of($field)->replace('.', '_')->snake()->toString())
            ->unique()
            ->values()
            ->all();
    }

    private static function isSensitiveField(string $field): bool
    {
        $field = strtolower(str_replace(['-', ' '], '_', $field));

        return collect(self::SENSITIVE_FIELD_MARKERS)
            ->contains(fn (string $marker) => str_contains($field, $marker));
    }

    private static function routeModel(Request $request, array $keys, string $class): ?Model
    {
        foreach ($keys as $key) {
            $value = $request->route()?->parameter($key);
            if ($value instanceof $class) {
                return $value;
            }
        }

        return null;
    }

    private static function bookingIdFrom(Request $request, array $extra): ?int
    {
        $route = $request->route();

        return self::integerFrom(
            $route?->parameter('bookingId')
            ?? $route?->parameter('booking')
            ?? $extra['booking_id']
            ?? $extra['target_id']
            ?? null
        );
    }

    private static function integerFrom(mixed $value): ?int
    {
        if ($value instanceof Model) {
            return (int) $value->getKey();
        }

        if (is_numeric($value)) {
            return (int) $value;
        }

        return null;
    }

    private static function scalarId(mixed $value): mixed
    {
        if ($value instanceof Model) {
            return $value->getKey();
        }

        return is_scalar($value) ? $value : null;
    }

    private static function workspaceForPath(?string $path): string
    {
        $path = strtolower((string) $path);

        return match (true) {
            str_contains($path, '/dashboard/admin') || str_contains($path, '/api/admin/audits') => 'System access',
            str_contains($path, '/api/admin/employees') || str_contains($path, '/api/admin/customers') => 'Admin',
            str_contains($path, '/api/admin/settings') || str_contains($path, '/api/admin/payment-rules') => 'Settings',
            str_contains($path, '/api/admin/menu-items') || str_contains($path, '/api/admin/packages') || str_contains($path, '/api/admin/event-types') => 'Public content',
            str_contains($path, '/api/admin/report') => 'Reports',
            str_contains($path, '/api/admin/refund') || str_contains($path, '/api/accounting') => 'Finance',
            str_contains($path, '/dashboard/marketing') || str_contains($path, '/api/marketing') => 'Marketing',
            str_contains($path, '/dashboard/accounting') => 'Accounting',
            str_contains($path, '/api/operations') => 'Event preparation',
            str_contains($path, '/api/calendar-availability') => 'Date availability',
            str_contains($path, '/api/chat') => 'Customer support',
            str_contains($path, '/profile') => 'Customer',
            str_contains($path, '/logout') => 'System access',
            default => 'System activity',
        };
    }

    private static function targetTypeForPath(string $path): ?string
    {
        $path = strtolower($path);

        return match (true) {
            str_contains($path, '/employees') => 'staff account',
            str_contains($path, '/customers') => 'customer account',
            str_contains($path, '/bookings') => 'booking',
            str_contains($path, '/payments') => 'payment',
            str_contains($path, '/refund') => 'refund',
            str_contains($path, '/conversations') => 'conversation',
            str_contains($path, '/messages') => 'message',
            str_contains($path, '/preparation-tasks') => 'task',
            str_contains($path, '/menu-items') => 'menu item',
            str_contains($path, '/packages') => 'package',
            str_contains($path, '/event-types') => 'event type',
            str_contains($path, '/announcements') => 'announcement',
            str_contains($path, '/report-templates') => 'report template',
            str_contains($path, '/report-runs') => 'report run',
            str_contains($path, '/calendar-availability') => 'date availability',
            str_contains($path, '/settings') || str_contains($path, '/payment-rules') => 'settings',
            default => null,
        };
    }

    private static function resultLabel(?int $statusCode): string
    {
        if (! $statusCode || $statusCode < 400) {
            return 'Completed';
        }

        if (in_array($statusCode, [401, 403], true)) {
            return 'Access blocked';
        }

        if ($statusCode === 404) {
            return 'Not found';
        }

        return 'Needs review';
    }

    private static function userLabel(User $user): string
    {
        return trim((string) ($user->full_name ?: $user->username ?: $user->email ?: "User #{$user->id}"));
    }

    private static function bookingRef(int|string $id): string
    {
        return '#BK-'.$id;
    }

    private static function compact(array $metadata): array
    {
        return collect($metadata)
            ->reject(fn ($value) => $value === null || $value === '' || $value === [])
            ->map(fn ($value) => is_string($value) ? Str::limit($value, 500, '') : $value)
            ->all();
    }
}
