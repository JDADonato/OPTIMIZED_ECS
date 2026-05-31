<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use App\Support\AuditContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class RecordStaffAuditLog
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $user = $request->user();

        if (! $user || ! in_array($user->role, ['Admin', 'Marketing', 'Accounting'], true)) {
            return $response;
        }

        if (! $this->shouldRecord($request)) {
            return $response;
        }

        try {
            if (! Schema::hasTable('audit_logs')) {
                return $response;
            }

            AuditLog::create([
                'user_id' => $user->id,
                'username' => $user->username,
                'role' => $user->role,
                'action' => $this->describeAction($request),
                'method' => $request->method(),
                'path' => '/'.ltrim($request->path(), '/'),
                'status_code' => $response->getStatusCode(),
                'ip_address' => $request->ip(),
                'user_agent' => Str::limit((string) $request->userAgent(), 500, ''),
                'metadata' => AuditContext::forRequest($request, $response),
            ]);
        } catch (\Throwable $e) {
            Log::warning('Unable to record staff audit log.', [
                'message' => $e->getMessage(),
                'path' => $request->path(),
                'user_id' => $user->id,
            ]);
        }

        return $response;
    }

    private function shouldRecord(Request $request): bool
    {
        if ($request->is('api/admin/audits')) {
            return false;
        }

        if (! $request->isMethod('GET') && $request->is('api/admin/employees*', 'api/admin/customers*')) {
            return false;
        }

        if ($request->is('dashboard/admin', 'dashboard/marketing', 'dashboard/accounting')) {
            return true;
        }

        if ($request->is('api/admin/*', 'api/marketing/*', 'api/accounting/*', 'api/chat/*', 'api/operations/*', 'api/calendar-availability*', 'logout', 'profile')) {
            return ! $request->isMethod('GET');
        }

        if ($request->is('documents/*', 'preview/customer-booking/*')) {
            return $request->isMethod('GET');
        }

        return false;
    }

    private function describeAction(Request $request): string
    {
        $method = $request->method();
        $path = '/'.ltrim($request->path(), '/');

        $phrases = [
            'POST /api/admin/employees/' => $this->employeeActionLabel($path),
            'POST /api/admin/employees' => 'Created a staff account',
            'PUT /api/admin/employees' => 'Updated a staff account',
            'DELETE /api/admin/employees' => 'Deactivated a staff account',
            'PUT /api/admin/customers' => 'Updated a customer account',
            'DELETE /api/admin/customers' => 'Deactivated a customer account',
            'POST /api/admin/customers/' => 'Reactivated a customer account',
            'POST /api/admin/pricing' => 'Changed pricing override',
            'PUT /api/admin/bookings' => 'Updated a booking',
            'POST /api/admin/bookings' => 'Changed booking financials',
            'POST /api/admin/menu-items' => 'Created a menu item',
            'PUT /api/admin/menu-items' => 'Updated a menu item',
            'DELETE /api/admin/menu-items' => 'Archived a menu item',
            'POST /api/admin/packages' => 'Created a package',
            'PUT /api/admin/packages' => 'Updated a package',
            'POST /api/admin/event-types' => 'Created an event type',
            'PUT /api/admin/event-types' => 'Updated an event type',
            'DELETE /api/admin/event-types' => 'Archived an event type',
            'PUT /api/accounting/payments' => 'Updated payment record',
            'POST /api/accounting/remind' => 'Sent payment reminder',
            'POST /api/accounting/refund' => $this->refundActionLabel($path),
            'POST /api/accounting/refunds' => 'Updated refund case',
            'POST /api/admin/refund' => $this->refundActionLabel($path),
            'PUT /api/marketing/bookings' => 'Updated marketing booking status',
            'POST /api/marketing/bookings' => $this->marketingBookingActionLabel($path),
            'PATCH /api/marketing/bookings' => 'Updated booking review task',
            'POST /api/chat/conversations' => $this->chatActionLabel($path),
            'PATCH /api/chat/messages' => 'Edited a chat message',
            'DELETE /api/chat/messages' => 'Deleted a chat message',
            'PATCH /api/operations/preparation-tasks' => 'Updated preparation task',
            'PUT /api/calendar-availability' => 'Updated date availability',
            'DELETE /api/calendar-availability' => 'Cleared date availability',
            'GET /documents/payments' => 'Downloaded a payment receipt',
            'GET /documents/bookings' => 'Downloaded an event preparation list',
            'GET /documents/calendar.pdf' => 'Downloaded calendar report',
            'GET /preview/customer-booking' => 'Previewed a customer booking',
            'POST /logout' => 'Signed out',
            'GET /dashboard/admin' => 'Opened admin dashboard',
            'GET /dashboard/marketing' => 'Opened marketing dashboard',
            'GET /dashboard/accounting' => 'Opened accounting dashboard',
        ];

        foreach ($phrases as $prefix => $label) {
            if (str_starts_with("$method $path", $prefix)) {
                return $label;
            }
        }

        return match ($method) {
            'POST' => 'Created a record',
            'PUT', 'PATCH' => 'Updated a record',
            'DELETE' => 'Deleted a record',
            default => 'Viewed a staff page',
        };
    }

    private function employeeActionLabel(string $path): string
    {
        return match (true) {
            str_contains($path, '/reset-password') => 'Reset a staff password',
            str_contains($path, '/force-password-change') => 'Required staff password change',
            str_contains($path, '/reactivate') => 'Reactivated a staff account',
            default => 'Updated a staff account',
        };
    }

    private function marketingBookingActionLabel(string $path): string
    {
        return match (true) {
            str_contains($path, '/claim') => 'Claimed a booking',
            str_contains($path, '/release') => 'Released a booking claim',
            str_contains($path, '/transfer/accept') => 'Accepted a booking transfer',
            str_contains($path, '/transfer/decline') => 'Declined a booking transfer',
            str_contains($path, '/transfer') => 'Requested booking transfer',
            str_contains($path, '/clarification') => 'Requested booking clarification',
            default => 'Updated marketing booking',
        };
    }

    private function chatActionLabel(string $path): string
    {
        return match (true) {
            str_contains($path, '/claim') => 'Claimed a conversation',
            str_contains($path, '/join') => 'Joined a conversation',
            str_contains($path, '/internal-notes') => 'Added an internal chat note',
            str_contains($path, '/collaborators') => 'Updated chat collaborators',
            str_contains($path, '/transfer') => 'Transferred a conversation',
            str_contains($path, '/resolve') => 'Resolved a conversation',
            str_contains($path, '/reopen') => 'Reopened a conversation',
            str_contains($path, '/messages') => 'Sent a chat message',
            default => 'Updated a conversation',
        };
    }

    private function refundActionLabel(string $path): string
    {
        return preg_match('#/api/(accounting|admin)/refund/\d+/[^/]+#', $path)
            ? 'Updated refund case'
            : 'Processed refund';
    }
}
