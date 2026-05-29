# New Optimization Plan

Created: 2026-05-25

## Purpose

This document reviews the current state of loading speed, rendering speed, database fetching, analytics, reports, and chat after the previous optimization work. It also lays out the next implementation plan needed to make the system feel production-ready for real users and real business data.

## Verdict

No, the system is not yet fully optimized for production speed.

Several important optimizations have already been implemented, but the remaining bottlenecks are now deeper architectural issues: large staff page bundles, broad analytics payloads, repeated aggregate queries, unpaginated chat histories, legacy message endpoints, and dashboard screens that still fetch more data than they need.

The site can be made much faster, but the next work should be done in a measured way instead of making more isolated UI-only edits.

## What Is Already Improved

- Inertia/Vite page loading is more stable.
- A cached JSON helper exists for repeated frontend requests.
- Smart refresh intervals are slower and idle-aware.
- Accounting payment verification uses server-side filtering and pagination.
- Several dashboard APIs now have slimmer response options.
- Some performance indexes already exist for bookings, payments, messages, and PayMongo references.
- Dashboard payment lookups and marketing calendar lookups were optimized with maps instead of repeated array scans.
- Announcement CMS database structure and indexes have been added.
- PayMongo reconciliation is no longer tied directly to dashboard loading.
- Some image and asset cleanup has already happened.

These changes were useful, but they mostly improved the first layer of slowness. The next layer is about making the data model, API contracts, and staff frontend structure scale properly.

## Current Bottlenecks Found

## 1. Admin Analytics Is Still Too Heavy

Relevant files:

- `app/Http/Controllers/AdminController.php`
- `app/Services/AdminReportService.php`
- `resources/js/Pages/DashboardAdmin.jsx`

Current problem:

- The frontend still primarily calls the broad `/api/admin/analytics` endpoint.
- `AdminReportService::analytics()` computes many sections at once.
- Some calculations are repeated in the same request:
  - revenue summary
  - revenue trend
  - payment aging
  - package performance
  - operational alerts
  - pax demand projection
- Focused endpoints already exist, but the UI does not fully use them as the default loading strategy.
- Analytics filters can trigger a full expensive reload.

Production effect:

- Analytics becomes slower as bookings, payments, menu items, and customers grow.
- A single tab can block the perception of the whole admin dashboard.
- Filter changes may feel laggy even when only one chart or panel needs to update.

## 2. Reports Share The Same Expensive Data Path

Relevant files:

- `app/Http/Controllers/ReportController.php`
- `app/Services/AdminReportService.php`
- `resources/js/Pages/DashboardAdmin.jsx`

Current problem:

- Report preview calls can recompute analytics-style blocks repeatedly.
- Dragging, editing filters, or previewing can trigger work that should be cached or debounced.
- Report exports are synchronous.

Production effect:

- Report building may feel slow once the database has real history.
- PDF and spreadsheet export can compete with normal dashboard requests.

## 3. Chat Loads Too Much At Once

Relevant files:

- `app/Http/Controllers/ChatController.php`
- `app/Http/Controllers/MessageController.php`
- `resources/js/Components/common/ChatBubble.jsx`
- `resources/js/Components/common/StaffMessaging.jsx`

Current problem:

- `ChatController::messages()` loads all messages for a conversation.
- Staff conversation queues are returned as full lists.
- The old `/api/messages/*` direct-message endpoints still exist beside the newer `/api/chat/*` endpoints.
- Chat polling still exists even though Echo/WebSocket support exists.
- Conversation unread counts and latest-message queries will get more expensive over time.

Production effect:

- Long support conversations can become slow to open.
- Staff inboxes can become slow when many customers message at once.
- The app may duplicate work through polling plus realtime updates.

## 4. Staff Dashboards Are Still Too Large

Relevant files:

- `resources/js/Pages/DashboardAdmin.jsx`
- `resources/js/Pages/DashboardMarketing.jsx`
- `resources/js/Pages/DashboardAccounting.jsx`

Current problem:

- Admin is still a very large page containing analytics, reports, users, bookings, refunds, audits, content, configuration, and profile logic.
- Marketing and Accounting also mix fetching, filtering, layout, tables, modals, and business actions in one page.
- Tabs are conditionally shown, but their code is still bundled into the staff route.

Production effect:

- Staff pages parse and hydrate more JavaScript than needed.
- Small UI interactions can re-render large component trees.
- It is harder to optimize individual tabs because concerns are mixed together.

## 5. Some APIs Still Return Broad Data

Current problem:

- Several screens still depend on large arrays and client-side filtering.
- Some option lists are derived from full data instead of small lookup endpoints.
- Some list endpoints support pagination, but not every staff tab uses pagination consistently.

Production effect:

- Initial loads become slower as data grows.
- React spends unnecessary time storing, filtering, and rendering data that is not visible.

## 6. Database Indexes Are Better But Not Complete

Already improved:

- Bookings, payments, messages, and PayMongo references have useful indexes.

Still recommended:

- `bookings (event_date, status)`
- `bookings (package_id, event_date)`
- `bookings (event_type, event_date)`
- `bookings (venue_city, event_date)`
- `payments (status, due_date, booking_id)`
- `payments (verified_at, status)`
- `booking_items (menu_item_id, booking_id)`
- `messages (conversation_id, id)`
- `messages (conversation_id, read_at, sender_id)`
- `conversations (status, staff_id, updated_at)`
- `conversations (client_id, status, updated_at)`

## Performance Targets

Use these as production acceptance targets:

- Public page first meaningful render: under 1.8 seconds on a normal connection.
- Booking wizard step change: under 150 ms after data is loaded.
- Customer dashboard first useful render: under 2 seconds.
- Admin overview first useful render: under 2.5 seconds.
- Analytics first visible summary: under 1 second.
- Analytics full tab usable: under 2 seconds.
- Analytics filter change after warm cache: under 800 ms.
- Chat open for normal conversation: under 500 ms.
- Chat send optimistic response: under 100 ms.
- Staff list views: first page under 700 ms.
- No normal API response over 500 KB.
- No staff page should require fetching hidden tabs before the user opens them.

## Phase 1: Add Measurement Before More Tuning

Goal: know exactly where time is being spent.

Implement:

1. Add local and staging-only request timing middleware.
2. Log route name, role, duration, query count, response size, and peak memory.
3. Add slow-query logging in local and staging.
4. Add frontend performance markers for:
   - admin overview load
   - analytics summary load
   - analytics filter change
   - report preview refresh
   - chat open
   - chat send
   - booking wizard step transition
5. Create a small `docs/performance-baseline.md` with before-and-after numbers.

Implementation notes:

- Use Laravel middleware for API timing.
- Use browser `performance.mark()` and `performance.measure()` around major frontend fetches.
- Do not enable detailed timing logs in production unless behind a secure debug flag.

Acceptance criteria:

- Every slow staff API call can be traced to query count, response size, and route.
- Analytics and chat have measured baselines before code changes.

## Phase 2: Optimize Analytics Loading

Goal: stop making analytics behave like one large report.

Implement:

1. Make focused analytics endpoints the default UI path.
   - Admin overview loads `/api/admin/analytics/summary`.
   - Revenue panel loads `/api/admin/analytics/revenue`.
   - Pipeline panel loads `/api/admin/analytics/pipeline`.
   - Menu panel loads `/api/admin/analytics/menu-performance`.
   - Operations panel loads `/api/admin/analytics/operations`.
   - Keep `/api/admin/analytics` only as a compatibility endpoint.

2. Add request-level memoization in `AdminReportService`.
   - Store computed method results inside the service for the current request.
   - Reuse results for repeated calls to the same method and same normalized filters.

3. Add cache by normalized filter hash.
   - Summary: 60 seconds.
   - Revenue trends: 2 to 5 minutes.
   - Menu performance: 5 minutes.
   - Customer growth: 5 minutes.
   - Operations alerts: 30 to 60 seconds.

4. Bust analytics cache only when needed.
   - Booking created, updated, cancelled, or completed.
   - Payment verified, refunded, or changed.
   - Menu item or package changed.
   - Feedback submitted.

5. Remove duplicate analytics calculations.
   - Do not compute the same trend twice for legacy aliases.
   - Do not compute operational alerts twice.
   - Do not compute package performance separately for `topSellers`.
   - Keep legacy keys as aliases of already-computed values only.

6. Use progressive analytics rendering.
   - Show summary first.
   - Load deeper panels only when the user opens or scrolls near them.
   - Cancel stale requests when filters change quickly.

7. Debounce analytics filter changes.
   - 300 to 500 ms debounce for text/search filters.
   - Immediate fetch for simple dropdown changes only if not already loading.

Acceptance criteria:

- Analytics tab no longer depends on one large default payload.
- Same filter reloads hit cache.
- Repeated service calculations happen once per request.
- Filter changes do not stack multiple stale requests.

## Phase 3: Add Analytics Rollups

Goal: keep analytics fast even with years of data.

Implement:

1. Add rollup tables:
   - `analytics_daily_revenue`
   - `analytics_monthly_bookings`
   - `analytics_menu_item_totals`
   - or a generic `analytics_snapshots` table with type, period, filters, and JSON payload.

2. Add scheduled commands:
   - nightly rebuild for historical periods.
   - incremental refresh after payment verification.
   - incremental refresh after booking status changes.

3. Use raw queries only for recent or drilldown data.

4. Keep raw table fallback for accuracy checks.

Acceptance criteria:

- Historical analytics no longer scans all payments and bookings every time.
- Menu performance reads from rollups for older periods.
- Dashboard summary remains accurate after payment and booking changes.

## Phase 4: Optimize Chat

Goal: make chat feel instant and scale with support history.

Implement:

1. Paginate conversation messages.
   - Initial load should return the latest 30 messages.
   - Add `before_id` or cursor support for older messages.
   - Add "Load earlier messages" at the top of the conversation.

2. Paginate staff inbox queues.
   - `GET /api/chat/unassigned?limit=25&cursor=...`
   - `GET /api/chat/my-chats?limit=25&cursor=...`
   - Return pagination metadata.

3. Add conversation denormalization.
   - Add `last_message_id`.
   - Add `last_message_at`.
   - Add `client_unread_count`.
   - Add `staff_unread_count`.
   - Update these when a message is created or read.

4. Reduce polling when realtime is active.
   - If Echo connects successfully, unread polling backs off to 60 to 120 seconds.
   - If Echo fails, polling remains as fallback.

5. Add optimistic send.
   - Show a local pending message immediately.
   - Replace it when the server confirms.
   - Show retry if it fails.

6. Retire old direct-message endpoints.
   - Audit all `/api/messages/*` usage.
   - Move any remaining UI to `/api/chat/*`.
   - Remove or isolate `MessageController` once unused.

Acceptance criteria:

- Chat opening does not load entire conversation history.
- Staff inboxes do not load every conversation at once.
- WebSocket-enabled sessions do not rely on frequent polling.
- Old and new message systems do not compete.

## Phase 5: Split Staff Frontend Bundles

Goal: stop loading every staff feature at once.

Implement:

1. Split Admin tabs into dedicated components:
   - `AdminOverview`
   - `AdminAnalytics`
   - `AdminReports`
   - `AdminBookings`
   - `AdminRefunds`
   - `AdminContent`
   - `AdminConfiguration`
   - `AdminUsers`
   - `AdminAudits`
   - `AdminProfile`

2. Lazy-load heavy tabs.
   - Analytics
   - Reports
   - Charts
   - Export tools
   - Configuration forms

3. Split Marketing and Accounting the same way.

4. Move shared UI to reusable components:
   - staff table
   - filter bar
   - modal
   - status label
   - metric strip
   - empty state

5. Memoize expensive table rows and chart data transforms.

Acceptance criteria:

- Opening Admin overview does not evaluate reports and analytics code.
- Staff dashboards have smaller route chunks.
- Tab changes feel instant after first load.

## Phase 6: Standardize Pagination And Search

Goal: every list should scale.

Implement:

1. Convert staff list endpoints to server pagination.
2. Use consistent query params:
   - `page`
   - `per_page`
   - `search`
   - `status`
   - `date_from`
   - `date_to`
   - `sort`
3. Add small lookup endpoints for dropdowns.
4. Avoid fetching full records for filters.
5. Add server-side search for:
   - bookings
   - users/customers
   - payments
   - refunds
   - conversations
   - report options

Acceptance criteria:

- No staff table depends on loading all rows.
- Filters use option endpoints or server queries.
- Large data sets remain fast.

## Phase 7: Optimize Reports

Goal: make report building feel responsive.

Implement:

1. Debounce preview refresh after block changes.
2. Cache report widget outputs by widget id plus filter hash.
3. Run PDF and spreadsheet exports as queued jobs for large reports.
4. Return a download-ready status when export is finished.
5. Keep preview compact and lazy-load detailed rows.
6. Remove the inactive legacy report UI block from `DashboardAdmin.jsx`.

Acceptance criteria:

- Dragging report blocks does not trigger repeated expensive requests.
- Export does not block normal staff dashboard use.
- Report preview remains responsive.

## Phase 8: Asset And Rendering Optimization

Goal: reduce render cost and visual jank.

Implement:

1. Add a reusable optimized image component.
2. Use fixed dimensions for images to avoid layout shift.
3. Lazy-load below-the-fold images.
4. Convert large static images to WebP where possible.
5. Defer chart libraries until charts are visible.
6. Avoid loading unused icon sets in staff dashboards.
7. Keep toast, modal, and chat components mounted only when needed.

Acceptance criteria:

- Images do not shift layout.
- Staff dashboards do not load chart code before analytics/report screens need it.
- Visual interactions remain smooth.

## Phase 9: Production Infrastructure

Goal: make Laravel and frontend deployment ready for speed.

Implement:

1. Use Redis for cache, queues, and sessions if available.
2. Enable OPcache in production PHP.
3. Run:
   - `php artisan config:cache`
   - `php artisan route:cache`
   - `php artisan view:cache`
   - `php artisan optimize`
4. Run queue workers for:
   - email notifications
   - report exports
   - analytics rollups
   - PayMongo webhook processing
5. Enable gzip or Brotli compression.
6. Serve built assets through a CDN or caching reverse proxy.
7. Add production log rotation.
8. Add database backup and monitoring.

Acceptance criteria:

- Production uses cached config and routes.
- Slow export/email tasks do not run inside normal web requests.
- Static assets are compressed and cacheable.

## Recommended Implementation Order

1. Add performance measurement.
2. Make analytics frontend use focused endpoints.
3. Add request memoization and cache to `AdminReportService`.
4. Add chat message pagination.
5. Add staff inbox pagination and chat indexes.
6. Split `DashboardAdmin.jsx` into lazy-loaded tab components.
7. Standardize staff list pagination.
8. Add analytics rollup tables.
9. Queue report exports.
10. Apply production infrastructure caching.

## Final Acceptance Checklist

- Analytics summary loads quickly before charts.
- Analytics filters are debounced and cancel stale requests.
- Analytics service does not recompute the same aggregate repeatedly.
- Chat does not fetch full message history.
- Staff inboxes are paginated.
- Old message endpoints are no longer used by active UI.
- Staff pages are split into smaller lazy-loaded chunks.
- All large staff tables are server-paginated.
- Report preview and exports are cached or queued.
- Production uses OPcache, Laravel caches, queues, compression, and optimized assets.

