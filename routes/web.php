<?php

use App\Http\Controllers\AccountingController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\AnnouncementController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\CalendarAvailabilityController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\ClientDashboardController;
use App\Http\Controllers\ClientErrorController;
use App\Http\Controllers\ContactInquiryController;
use App\Http\Controllers\ConversionEventController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\EventTypeController;
use App\Http\Controllers\FeedbackController;
use App\Http\Controllers\FileUploadController;
use App\Http\Controllers\FoodTastingController;
use App\Http\Controllers\MarketingController;
use App\Http\Controllers\MenuController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\OperationsController;
use App\Http\Controllers\PackageController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\PayMongoWebhookController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\StaffEventHistoryController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', fn () => Inertia::render('LandingPage'))->name('home');
Route::get('/about', fn () => Inertia::render('About'))->name('about');
Route::get('/amenities', fn () => Inertia::render('Amenities'))->name('amenities');
Route::get('/contact', fn () => Inertia::render('Contact'))->name('contact');
Route::get('/robots.txt', function () {
    return response(File::get(public_path('robots.txt')), 200)
        ->header('Content-Type', 'text/plain');
})->name('robots');
Route::get('/sitemap.xml', function () {
    $url = rtrim((string) config('app.url'), '/');
    $routes = collect(config('security.public_routes', []));

    $xml = view('sitemap', [
        'routes' => $routes,
        'baseUrl' => $url,
        'lastmod' => now()->toDateString(),
    ])->render();

    return response($xml, 200)->header('Content-Type', 'application/xml');
})->name('sitemap');
Route::get('/api/announcements', [AnnouncementController::class, 'publicIndex'])->middleware('cache.headers:public;max_age=60;etag');
Route::post('/api/contact-inquiries', [ContactInquiryController::class, 'store'])->middleware('throttle:10,1');
Route::post('/webhook/paymongo', PayMongoWebhookController::class)->name('webhook.paymongo');
Route::post('/api/client-errors', [ClientErrorController::class, 'store'])->middleware('throttle:client-errors');

Route::middleware('guest')->group(function () {
    Route::get('/login', fn () => Inertia::render('Login'))->name('login');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
    Route::get('/forgot-password', [AuthController::class, 'showForgotPassword'])->name('password.request');
    Route::post('/forgot-password', [AuthController::class, 'sendPasswordReset'])->middleware('throttle:5,1')->name('password.email');
    Route::get('/reset-password/{token}', [AuthController::class, 'showResetPassword'])->name('password.reset');
    Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1')->name('password.update');
    Route::get('/register', fn () => Inertia::render('Register'))->name('register');
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
});

Route::middleware('auth')->group(function () {
    Route::get('/api/session/csrf-token', function (Request $request) {
        if (app()->isLocal() || config('app.debug')) {
            $user = $request->user();
            Log::info('[auth-flow-debug] CSRF token refresh requested.', [
                'user_id' => $user?->id,
                'role' => $user?->role,
                'authenticated' => (bool) $user,
                'host' => $request->getHost(),
                'session_id_hash' => substr(hash('sha256', $request->session()->getId()), 0, 12),
            ]);
        }

        return response()
            ->json(['token' => csrf_token()])
            ->header('X-ECS-Debug-Request', 'csrf-refresh');
    })->name('session.csrf-token');
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
    Route::get('/password/change-required', [AuthController::class, 'showChangeRequired'])->name('password.change-required');
    Route::post('/password/change-required', [AuthController::class, 'changeRequiredPassword'])->middleware('throttle:5,1')->name('password.change-required.update');
    Route::post('/verify-otp', [AuthController::class, 'verifyOtp'])->middleware('throttle:6,1')->name('verify.otp');
    Route::post('/resend-otp', [AuthController::class, 'resendOtp'])->middleware('throttle:3,1')->name('resend.otp');

    // Profile Routes
    Route::get('/profile', fn () => Inertia::render('Profile/Edit'))->name('profile.edit');
    Route::put('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile/account', [ProfileController::class, 'deleteAccount'])->middleware('throttle:3,1')->name('profile.account.delete');
    Route::get('/profile/avatar', [ProfileController::class, 'avatar'])->name('profile.avatar');
    Route::post('/profile/password-code', [ProfileController::class, 'sendPasswordCode'])->middleware('throttle:5,1')->name('profile.password-code');
    Route::get('/api/profile/activity', [ProfileController::class, 'activity'])->name('profile.activity');
    Route::get('/api/staff/event-history', [StaffEventHistoryController::class, 'index']);
    Route::post('/api/staff/event-history/{booking}/notes', [StaffEventHistoryController::class, 'storeNote']);
    Route::get('/documents/payments/{payment}/receipt.pdf', [DocumentController::class, 'receipt'])->name('documents.receipt');
    Route::get('/documents/bookings/{booking}/preparation.pdf', [DocumentController::class, 'preparationList'])->name('documents.preparation');
    Route::get('/documents/calendar.pdf', [DocumentController::class, 'calendar'])->name('documents.calendar');
    // Notification routes
    Route::get('/api/notifications', [NotificationController::class, 'index']);
    Route::get('/api/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::put('/api/notifications/{id}/read', [NotificationController::class, 'markAsRead'])->middleware('throttle:notification-mutation');
    Route::put('/api/notifications/read-all', [NotificationController::class, 'markAllAsRead'])->middleware('throttle:notification-mutation');
    Route::delete('/api/notifications/read', [NotificationController::class, 'destroyRead'])->middleware('throttle:notification-mutation');
    Route::delete('/api/notifications/{id}', [NotificationController::class, 'destroy'])->middleware('throttle:notification-mutation');
    Route::post('/api/conversion-events', [ConversionEventController::class, 'store'])->middleware('throttle:60,1');
    // Legacy messaging routes (kept for backward compatibility)
    $legacyMessagesGone = fn () => response()->json([
        'error' => 'Legacy messaging endpoints are retired. Use /api/chat instead.',
    ], 410);
    Route::get('/api/messages/conversations', $legacyMessagesGone);
    Route::get('/api/messages/staff/available', $legacyMessagesGone);
    Route::get('/api/messages/unread-count', $legacyMessagesGone);
    Route::get('/api/messages/my-bookings', $legacyMessagesGone);
    Route::get('/api/messages/{userId}', $legacyMessagesGone);
    Route::post('/api/messages', $legacyMessagesGone);
    // Chat routes (WebSocket/Ticket System)
    Route::get('/api/chat/conversations', [ChatController::class, 'conversations']);
    Route::post('/api/chat/conversations', [ChatController::class, 'startConversation'])->middleware('throttle:chat-mutation');
    Route::get('/api/chat/unassigned', [ChatController::class, 'unassigned']);
    Route::get('/api/chat/my-chats', [ChatController::class, 'myChats']);
    Route::get('/api/chat/unread-count', [ChatController::class, 'unreadCount']);
    Route::get('/api/chat/my-bookings', [ChatController::class, 'myBookings']);
    Route::get('/api/chat/conversations/{conversation}/messages', [ChatController::class, 'messages']);
    Route::post('/api/chat/conversations/{conversation}/messages', [ChatController::class, 'sendMessage'])->middleware('throttle:chat-mutation');
    Route::patch('/api/chat/messages/{message}', [ChatController::class, 'updateMessage'])->middleware('throttle:chat-mutation');
    Route::delete('/api/chat/messages/{message}', [ChatController::class, 'deleteMessage'])->middleware('throttle:chat-mutation');
    Route::post('/api/chat/conversations/{conversation}/claim', [ChatController::class, 'claim'])->middleware('throttle:chat-mutation');
    Route::post('/api/chat/conversations/{conversation}/resolve', [ChatController::class, 'resolve'])->middleware('throttle:chat-mutation');
    Route::post('/api/chat/conversations/{conversation}/reopen', [ChatController::class, 'reopen'])->middleware('throttle:chat-mutation');
    Route::post('/api/chat/conversations/{conversation}/join', [ChatController::class, 'adminJoin'])->middleware('throttle:chat-mutation');
    Route::post('/api/chat/conversations/{conversation}/internal-notes', [ChatController::class, 'internalNotes'])->middleware('throttle:chat-mutation');
    Route::post('/api/chat/conversations/{conversation}/collaborators', [ChatController::class, 'addCollaborator'])->middleware('throttle:chat-mutation');
    Route::delete('/api/chat/conversations/{conversation}/collaborators/{user}', [ChatController::class, 'removeCollaborator'])->middleware('throttle:chat-mutation');
    Route::post('/api/chat/conversations/{conversation}/transfer-owner', [ChatController::class, 'transferOwner'])->middleware('throttle:chat-mutation');
    Route::post('/api/chat/conversations/{conversation}/transfer', [ChatController::class, 'transfer'])->middleware('throttle:chat-mutation');
    Route::get('/api/chat/staff/available', [ChatController::class, 'availableStaff']);
});

// Public pricing endpoint (used by menu components)
Route::get('/api/pricing', [AdminController::class, 'getPricingOverrides'])->middleware('cache.headers:public;max_age=120;etag');

// Public custom menu items endpoint (used by menu components to merge with static catalog)
Route::get('/api/menu-items', [AdminController::class, 'getMenuItems'])->middleware('cache.headers:public;max_age=120;etag');

// Public food tasting (guests can submit without auth)
Route::post('/api/food-tasting', [FoodTastingController::class, 'store'])->middleware('throttle:5,1');

// Booking availability is public (calendar needs it without auth sometimes)
Route::get('/api/bookings/availability/{date}', [BookingController::class, 'checkAvailability'])->middleware('cache.headers:public;max_age=60;etag');
Route::get('/api/bookings/disabled-dates', [BookingController::class, 'getDisabledDates'])->middleware('cache.headers:public;max_age=60;etag');

// Menu API endpoints (database-backed)
Route::middleware('cache.headers:public;max_age=300;etag')->group(function () {
    Route::get('/api/menu', [MenuController::class, 'index']);
    Route::get('/api/menu/categories', [MenuController::class, 'categories']);
    Route::get('/api/menu/bestsellers', [MenuController::class, 'bestsellers']);
    Route::get('/api/menu/{id}', [MenuController::class, 'show']);
});

// Event types API
Route::middleware('cache.headers:public;max_age=300;etag')->group(function () {
    Route::get('/api/event-types', [EventTypeController::class, 'index']);
    Route::get('/api/event-types/slug/{slug}', [EventTypeController::class, 'bySlug']);
    Route::get('/api/event-types/{id}', [EventTypeController::class, 'show']);
});

// Packages API
Route::middleware('cache.headers:public;max_age=300;etag')->group(function () {
    Route::get('/api/packages', [PackageController::class, 'index']);
    Route::get('/api/packages/type/{type}', [PackageController::class, 'byType']);
    Route::get('/api/packages/{id}', [PackageController::class, 'show']);
});

// Client routes

// Public Views (Client Side)
Route::get('/book', function () {
    $version = (int) cache()->get('catalog.version', 1);
    $eventTypes = cache()->remember("catalog.public.event_types.v{$version}.booking", now()->addMinutes(10), fn () => (
        \App\Models\EventType::query()
            ->whereRaw('is_active is true')
            ->orderBy('label')
            ->limit(50)
            ->get()
    ));

    return Inertia::render('client/BookingWizard', [
        'initialEventTypes' => $eventTypes,
    ]);
})->name('booking.wizard');
Route::get('/menu', fn () => Inertia::render('client/MenuGallery'))->name('menu.gallery');
Route::get('/food-tasting', fn () => Inertia::render('client/FoodTasting'))->name('food-tasting');

Route::middleware(['auth', 'role:Client'])->group(function () {
    // Dashboard renders ClientDashboard.jsx, which fetches via API.
    Route::get('/dashboard/client', fn () => Inertia::render('client/ClientDashboard'))->name('dashboard.client');
    Route::get('/pay', function () {
        return redirect()
            ->route('dashboard.client')
            ->with('error', 'The manual payment page has been retired. Please use Secure Checkout from your dashboard so PayMongo or Accounting can confirm the payment safely.');
    })->name('payment.page');
    Route::post('/checkout/initialize', [PaymentController::class, 'initializeCheckout'])->middleware('throttle:payment-checkout')->name('checkout.initialize');
    Route::get('/checkout/secure', [PaymentController::class, 'showSecureCheckout'])->middleware('signed')->name('checkout.secure');
    Route::post('/checkout/process', [PaymentController::class, 'processPayment'])->name('checkout.process');
    Route::get('/checkout/success', [PaymentController::class, 'success'])->name('checkout.success');
    Route::get('/checkout/cancelled', fn () => Inertia::render('client/PaymentCancelled'))->name('checkout.cancelled');

    Route::get('/api/dashboard/client', [ClientDashboardController::class, 'apiData']);
    Route::get('/api/customer/journey-tracker', [ClientDashboardController::class, 'journeyTracker']);

    // Booking API endpoints (JSON responses for React AJAX calls)
    Route::post('/api/bookings', [BookingController::class, 'store'])->middleware('throttle:10,1');
    Route::post('/api/bookings/abandoned-reminder', [BookingController::class, 'sendAbandonedReminder'])->middleware('throttle:3,1');
    Route::put('/api/bookings/{id}/event-details', [BookingController::class, 'updateEventDetails']);
    Route::put('/api/bookings/{id}/menu', [BookingController::class, 'updateMenu']);
    Route::put('/api/bookings/{id}/cancel', [BookingController::class, 'cancel']);
    Route::put('/api/bookings/{id}/update', [BookingController::class, 'update']);
    Route::post('/api/bookings/pay', [BookingController::class, 'recordPayment'])->middleware('throttle:3,1');
    Route::post('/api/bookings/{id}/clarification-response', [BookingController::class, 'respondToClarification']);
    Route::patch('/api/bookings/{id}/hide-from-history', [BookingController::class, 'hideFromHistory']);
    Route::delete('/api/bookings/{id}/remove-history', [BookingController::class, 'removeHistory']);

    // Food tasting (authenticated)
    Route::get('/api/food-tasting', [FoodTastingController::class, 'index']);
    Route::put('/api/food-tasting/{id}', [FoodTastingController::class, 'update']);
    Route::patch('/api/food-tasting/{id}/cancel', [FoodTastingController::class, 'cancel']);
    Route::delete('/api/food-tasting/{id}', [FoodTastingController::class, 'destroy']);

    // File upload
    Route::post('/api/upload', [FileUploadController::class, 'store'])->middleware('throttle:10,1');

    Route::get('/api/customer/announcements', [AnnouncementController::class, 'customerIndex']);
    Route::post('/api/customer/announcements/{announcement}/read', [AnnouncementController::class, 'markRead']);
    Route::get('/api/customer/feedback-requests', [FeedbackController::class, 'index']);
    Route::post('/api/customer/feedback-requests/{token}/responses', [FeedbackController::class, 'store']);
});

// Marketing routes (Marketing + Admin)

Route::middleware(['auth', 'role:Marketing,Admin'])->group(function () {
    Route::get('/preview/menu', fn () => Inertia::render('client/MenuGallery', ['previewMode' => true]))->name('preview.menu');
    Route::get('/preview/packages', fn () => Inertia::render('client/MenuGallery', ['previewMode' => true, 'previewPanel' => 'packages']))->name('preview.packages');
    Route::get('/preview/book', function () {
        $version = (int) cache()->get('catalog.version', 1);
        $eventTypes = cache()->remember("catalog.public.event_types.v{$version}.booking", now()->addMinutes(10), fn () => (
            \App\Models\EventType::query()
                ->whereRaw('is_active is true')
                ->orderBy('label')
                ->limit(50)
                ->get()
        ));

        return Inertia::render('client/BookingWizard', [
            'previewMode' => true,
            'initialEventTypes' => $eventTypes,
        ]);
    })->name('preview.booking');
    Route::get('/preview/customer-booking/{booking}', [BookingController::class, 'preview'])->name('preview.customer-booking');
    Route::get('/preview/announcements/{announcement}', [AnnouncementController::class, 'preview'])->name('preview.announcement');
    Route::get('/dashboard/marketing', fn () => Inertia::render('DashboardMarketing'))->name('dashboard.marketing');
    Route::get('/api/marketing/summary', [MarketingController::class, 'summary']);
    Route::get('/api/settings/menu-items', [SettingsController::class, 'menuItems']);
    Route::get('/api/settings/event-types', [SettingsController::class, 'eventTypes']);
    Route::get('/api/marketing/bookings', [MarketingController::class, 'getAllBookings']);
    Route::get('/api/marketing/customers', [MarketingController::class, 'searchCustomers']);
    Route::post('/api/marketing/bookings/assisted', [MarketingController::class, 'createAssistedBooking']);
    Route::get('/api/marketing/contact-inquiries', [ContactInquiryController::class, 'index']);
    Route::patch('/api/marketing/contact-inquiries/{inquiry}', [ContactInquiryController::class, 'update']);
    Route::put('/api/marketing/bookings/{id}/status', [MarketingController::class, 'updateStatus']);
    Route::put('/api/marketing/bookings/{id}/assign', [MarketingController::class, 'assign']);
    Route::post('/api/marketing/bookings/{id}/claim', [MarketingController::class, 'claim']);
    Route::post('/api/marketing/bookings/{id}/transfer', [MarketingController::class, 'transfer']);
    Route::post('/api/marketing/bookings/{id}/transfer/accept', [MarketingController::class, 'acceptTransfer']);
    Route::post('/api/marketing/bookings/{id}/transfer/decline', [MarketingController::class, 'declineTransfer']);
    Route::post('/api/marketing/bookings/{id}/release', [MarketingController::class, 'release']);
    Route::put('/api/marketing/bookings/{id}/review-status', [MarketingController::class, 'updateReviewStatus']);
    Route::post('/api/marketing/bookings/{id}/clarification', [MarketingController::class, 'requestClarification']);
    Route::patch('/api/marketing/bookings/{bookingId}/review-tasks/{taskId}', [MarketingController::class, 'updateReviewTask']);
    Route::put('/api/marketing/bookings/{id}/livestatus', [MarketingController::class, 'updateLiveStatus']);
    Route::get('/api/marketing/bookings/{id}', [MarketingController::class, 'show']);
    Route::get('/api/marketing/food-tastings', [FoodTastingController::class, 'staffIndex']);
    Route::patch('/api/marketing/food-tastings/{tasting}', [FoodTastingController::class, 'staffUpdate']);
    Route::get('/api/marketing/feedback-responses', [FeedbackController::class, 'staffIndex']);
    Route::patch('/api/marketing/feedback-responses/{response}', [FeedbackController::class, 'staffUpdate']);
    Route::get('/api/operations/preparation-board', [OperationsController::class, 'preparationBoard']);
    Route::get('/api/operations/preparation-board/summary', [OperationsController::class, 'preparationBoardSummary']);
    Route::get('/api/operations/preparation-board/{booking}', [OperationsController::class, 'preparationBoardDetail']);
    Route::patch('/api/operations/preparation-tasks/{task}', [OperationsController::class, 'updatePreparationTask']);
    Route::get('/api/calendar-availability', [CalendarAvailabilityController::class, 'index']);
    Route::put('/api/calendar-availability/{date}', [CalendarAvailabilityController::class, 'upsert']);
    Route::delete('/api/calendar-availability/{date}', [CalendarAvailabilityController::class, 'destroy']);
    Route::post('/api/settings/packages', [SettingsController::class, 'createPackage']);
    Route::put('/api/settings/packages/{id}', [SettingsController::class, 'updatePackage']);
    Route::post('/api/settings/event-types', [SettingsController::class, 'createEventType']);
    Route::put('/api/settings/event-types/{id}', [SettingsController::class, 'updateEventType']);
    Route::delete('/api/settings/event-types/{id}', [SettingsController::class, 'deleteEventType']);
    Route::post('/api/settings/menu-items', [SettingsController::class, 'createMenuItem']);
    Route::put('/api/settings/menu-items/{id}', [SettingsController::class, 'updateMenuItem']);
    Route::patch('/api/settings/menu-items/{id}/archive', [SettingsController::class, 'archiveMenuItem']);
    Route::put('/api/settings/menu-items/{id}/pricing', [SettingsController::class, 'updateDishPricing']);
    Route::get('/api/admin/announcements', [AnnouncementController::class, 'index']);
    Route::post('/api/admin/announcements', [AnnouncementController::class, 'store'])->middleware('throttle:announcement-action');
    Route::get('/api/admin/announcement-audience-users', [AnnouncementController::class, 'audienceUsers']);
    Route::patch('/api/admin/announcements/{announcement}', [AnnouncementController::class, 'update'])->middleware('throttle:announcement-action');
    Route::post('/api/admin/announcements/{announcement}/publish', [AnnouncementController::class, 'publish'])->middleware('throttle:announcement-action');
    Route::post('/api/admin/announcements/{announcement}/archive', [AnnouncementController::class, 'archive'])->middleware('throttle:announcement-action');
    Route::post('/api/admin/announcements/{announcement}/send-test', [AnnouncementController::class, 'sendTest'])->middleware('throttle:announcement-action');
    Route::delete('/api/admin/announcements/{announcement}', [AnnouncementController::class, 'destroy'])->middleware('throttle:announcement-action');
});

// Accounting routes

Route::middleware(['auth', 'role:Accounting,Admin'])->group(function () {
    Route::get('/dashboard/accounting', fn () => Inertia::render('DashboardAccounting'))->name('dashboard.accounting');
    Route::get('/api/accounting/summary', [AccountingController::class, 'summary']);
    Route::get('/api/accounting/bookings', [AccountingController::class, 'getBookingsWithPayments']);
    Route::get('/api/accounting/payments/pending', [AccountingController::class, 'getPendingPayments']);
    Route::put('/api/accounting/payments/{id}/verify', [AccountingController::class, 'verifyPayment']);
    Route::put('/api/accounting/payments/{id}', [AccountingController::class, 'updatePayment']);
    Route::put('/api/accounting/bookings/{id}/payment-terms', [AccountingController::class, 'updateBookingPaymentTerms']);
    Route::get('/api/accounting/ledger', [AccountingController::class, 'getLedger']);
    Route::get('/api/accounting/reconciliation', [AccountingController::class, 'getReconciliation']);
    Route::post('/api/accounting/remind/{paymentId}', [AccountingController::class, 'remindClient']);
    Route::get('/api/accounting/refunds/queue', [AccountingController::class, 'getRefundQueue']);
    Route::post('/api/accounting/refund/{bookingId}', [AccountingController::class, 'processRefund'])->middleware('throttle:refund-action');
    Route::post('/api/accounting/refund/{bookingId}/{action}', [AccountingController::class, 'refundAction'])->middleware('throttle:refund-action');
});

// Admin routes

Route::middleware(['auth', 'role:Admin'])->group(function () {
    Route::get('/dashboard/admin', fn () => Inertia::render('DashboardAdmin'))->name('dashboard.admin');
    Route::get('/api/admin/employees', [AdminController::class, 'getEmployees']);
    Route::post('/api/admin/employees', [AdminController::class, 'createEmployee'])->middleware('throttle:admin-sensitive');
    Route::put('/api/admin/employees/{id}', [AdminController::class, 'updateEmployee']);
    Route::delete('/api/admin/employees/{id}', [AdminController::class, 'deleteEmployee']);
    Route::post('/api/admin/employees/{id}/reset-password', [AdminController::class, 'resetEmployeePassword'])->middleware('throttle:admin-sensitive');
    Route::post('/api/admin/employees/{id}/temporary-password/reveal', [AdminController::class, 'revealTemporaryPassword'])->middleware('throttle:admin-sensitive');
    Route::post('/api/admin/employees/{id}/force-password-change', [AdminController::class, 'forceEmployeePasswordChange'])->middleware('throttle:admin-sensitive');
    Route::post('/api/admin/employees/{id}/reactivate', [AdminController::class, 'reactivateEmployee'])->middleware('throttle:admin-sensitive');
    Route::get('/api/admin/system-delivery', [AdminController::class, 'deliveryDiagnostics']);
    Route::post('/api/admin/system-delivery/test-email', [AdminController::class, 'sendDiagnosticEmail']);
    Route::get('/api/admin/customers', [AdminController::class, 'getCustomers']);
    Route::put('/api/admin/customers/{id}', [AdminController::class, 'updateCustomer']);
    Route::delete('/api/admin/customers/{id}', [AdminController::class, 'deleteCustomer']);
    Route::post('/api/admin/customers/{id}/reactivate', [AdminController::class, 'reactivateCustomer']);
    Route::post('/api/admin/pricing', [AdminController::class, 'updatePricingOverride']);
    Route::get('/api/admin/settings', [SettingsController::class, 'businessSettings']);
    Route::get('/api/admin/menu-items', [AdminController::class, 'getMenuItems']);
    Route::get('/api/admin/event-types', [SettingsController::class, 'eventTypes']);
    Route::put('/api/admin/settings', [SettingsController::class, 'updateBusinessSettings']);
    Route::get('/api/admin/payment-rules', [SettingsController::class, 'paymentRules']);
    Route::put('/api/admin/payment-rules', [SettingsController::class, 'updatePaymentRules']);
    Route::get('/api/admin/bookings', [AdminController::class, 'getBookings']);
    Route::put('/api/admin/bookings/{id}/status', [AdminController::class, 'updateBookingStatus']);
    Route::post('/api/admin/bookings/{id}/discount', [AdminController::class, 'applyDiscount']);
    Route::get('/api/admin/analytics', [AdminController::class, 'getAnalytics']);
    Route::get('/api/admin/analytics/summary', [AdminController::class, 'getAnalyticsSummary']);
    Route::get('/api/admin/analytics/revenue', [AdminController::class, 'getAnalyticsRevenue']);
    Route::get('/api/admin/analytics/pipeline', [AdminController::class, 'getAnalyticsPipeline']);
    Route::get('/api/admin/analytics/menu-performance', [AdminController::class, 'getAnalyticsMenuPerformance']);
    Route::get('/api/admin/analytics/customer-experience', [AdminController::class, 'getAnalyticsCustomerExperience']);
    Route::get('/api/admin/analytics/operations', [AdminController::class, 'getAnalyticsOperations']);
    Route::get('/api/admin/analytics/forecasts', [AdminController::class, 'getAnalyticsForecasts']);
    Route::get('/api/admin/analytics/advanced', [AdminController::class, 'getAnalyticsAdvanced']);
    Route::get('/api/admin/report-widgets', [ReportController::class, 'widgets']);
    Route::post('/api/admin/report-preview', [ReportController::class, 'preview'])->middleware('throttle:report-heavy');
    Route::get('/api/admin/report-templates', [ReportController::class, 'templates']);
    Route::post('/api/admin/report-templates', [ReportController::class, 'storeTemplate']);
    Route::patch('/api/admin/report-templates/{template}', [ReportController::class, 'updateTemplate']);
    Route::patch('/api/admin/report-templates/{template}/archive', [ReportController::class, 'archiveTemplate']);
    Route::delete('/api/admin/report-templates/{template}', [ReportController::class, 'destroyTemplate']);
    Route::post('/api/admin/report-templates/{template}/run', [ReportController::class, 'run'])->middleware('throttle:report-heavy');
    Route::get('/api/admin/report-runs/{run}/export', [ReportController::class, 'export'])->middleware('throttle:report-heavy');
    Route::get('/api/admin/audits', [AdminController::class, 'getAudits']);
    Route::get('/api/admin/refunds/queue', [AccountingController::class, 'getRefundQueue']);
    Route::post('/api/admin/refund/{bookingId}', [AccountingController::class, 'processRefund'])->middleware('throttle:refund-action');
    Route::post('/api/admin/refund/{bookingId}/{action}', [AccountingController::class, 'refundAction'])->middleware('throttle:refund-action');

    // Menu items CRUD
    Route::post('/api/admin/menu-items', [AdminController::class, 'createMenuItem']);
    Route::put('/api/admin/menu-items/{id}', [AdminController::class, 'updateMenuItem']);
    Route::patch('/api/admin/menu-items/{id}/archive', [AdminController::class, 'archiveMenuItem']);
    Route::delete('/api/admin/menu-items/{id}', [AdminController::class, 'deleteMenuItem']);
    Route::post('/api/admin/packages', [SettingsController::class, 'createPackage']);
    Route::put('/api/admin/packages/{id}', [SettingsController::class, 'updatePackage']);
    Route::post('/api/admin/event-types', [SettingsController::class, 'createEventType']);
    Route::put('/api/admin/event-types/{id}', [SettingsController::class, 'updateEventType']);
    Route::patch('/api/admin/event-types/{id}/archive', [SettingsController::class, 'archiveEventType']);
    Route::delete('/api/admin/event-types/{id}', [SettingsController::class, 'deleteEventType']);
    Route::put('/api/admin/menu-items/{id}/pricing', [SettingsController::class, 'updateDishPricing']);
});

Route::fallback(function (Request $request) {
    if ($request->is('api/*')) {
        return response()->json(['error' => 'API endpoint not found.'], 404);
    }

    abort(404);
});
