# Completed Work

This file consolidates the useful completed items from the old documentation set. Older handoffs, quick references, and testing notes were removed after their lasting details were folded into this file or `todo.md`.

## Core Platform And Database

- Laravel/Inertia/React app is connected to Supabase PostgreSQL.
- PostgreSQL PHP support was enabled for the intended local PHP setup:
  - `pdo_pgsql`
  - `pgsql`
- Supabase pooler compatibility was handled by disabling server-side prepared statements in the PostgreSQL connection options.
- Migrations and seeders have run against Supabase.
- Row Level Security foundations were added:
  - Laravel session context middleware sets the current user id and role for PostgreSQL.
  - RLS helper functions and policies were added for client own-row access and staff operational access.
  - Public registration policies were hardened.
- Booking capacity default was updated from `3` events per day to `7` where the current business rules expect that behavior.
- PostgreSQL boolean query compatibility fixes were made for menu, package, and business rule queries.
- Booking JSON payload storage was improved:
  - `bookings.outsourced_services` was converted to Postgres `jsonb`.
  - `bookings.selected_menu` was converted to Postgres `jsonb`.
  - The `Booking` model now casts those fields as arrays.
  - Booking controllers now pass JSON payloads directly instead of repeatedly stringifying them.

## Authentication And Role Access

- Database-backed users are in place.
- Default seeded roles exist for:
  - Admin
  - Marketing
  - Accounting
  - Client
- Passwords are stored through Laravel hashing.
- Role-based dashboard redirects were implemented so users are sent to the correct dashboard after login.
- The Inertia login redirect issue caused by redirecting to remembered API endpoints was fixed by redirecting directly to the role dashboard.
- The auth UI was redesigned for better contrast and form fit.
- Remember-me behavior was added for longer sessions.

## Menu, Packages, Event Types, And Business Rules

- Menu, event type, package, and business rule data were moved into database-backed models and APIs.
- Core catalog models exist:
  - `MenuItem`
  - `EventType`
  - `Package`
  - `BusinessRule`
  - `BookingItem`
- Public catalog endpoints exist for menus, event types, and packages.
- Frontend booking/menu components were moved away from static mock data and now load from APIs.
- Admin/Marketing configuration screens can manage packages, event types, menu items, and pricing.
- Server-side booking validation is implemented:
  - minimum lead time
  - daily capacity
  - minimum and maximum pax
  - server-side price verification

## Booking Flow And Customer Experience

- Booking flow was overhauled into a cleaner step-by-step experience.
- Event type imagery was replaced with local optimized WebP assets.
- Booking draft/progress behavior was improved.
- Date and time selection UI was cleaned up and made easier to use.
- Customer dashboard remembers the last selected event and tab across reloads.
- Customer dashboard data updates without requiring a manual site reload in the main updated areas.
- Home page section order was reviewed and improved.
- Amenities content was added to the home page with a path to the amenities page.
- Journey tracker presentation was improved and adjusted to behave as an inline section near the hero before becoming a floating action.
- Chat modal and booking success modal contrast issues were fixed.

## Payments, PayMongo, And Refunds

- PayMongo Checkout Session creation was implemented.
- Client checkout uses Inertia navigation so external PayMongo redirects work.
- PayMongo webhook endpoint exists at `/webhook/paymongo`.
- Webhook requests are signature-verified.
- Paid webhook events update matching local payment milestones to `Paid`.
- Payment matching supports provider metadata, local reference numbers, checkout session ids, payment ids, and payment intent ids.
- PayMongo provider reference fields were added to payments.
- A PayMongo webhook sync command exists to help set up local ngrok webhook testing.
- CA bundle support was added for local Windows PHP/cURL TLS verification.
- Accounting and admin refund processing are connected to PayMongo where provider payment ids exist.
- Rush booking payment tranche issues were addressed so rush schedules can follow the expected immediate-payment structures.
- Accounting payment verification was improved with pending/complete filtering and clearer paid/remaining values.

## Staff Dashboards

- Admin analytics were replaced with real operational analytics instead of placeholder/forecast-style views.
- Analytics now includes:
  - actual collected revenue
  - pending and overdue balances
  - collection rate
  - payment status breakdown
  - payment aging
  - booking pipeline
  - upcoming workload
  - package performance
  - menu performance
  - operational alerts
- Focused analytics endpoints were added for summary, revenue, pipeline, menu performance, customer experience, and operations.
- Reports tab was replaced with a usable report builder.
- Report builder supports:
  - widget library
  - report layout ordering
  - filters
  - live preview
  - saved templates
  - report runs
  - CSV export
- Report template and report run tables were added.
- Admin, Marketing, and Accounting dashboard styling was improved to be more consistent with the marketing/customer visual direction.

## Content Management

- Announcement CMS was implemented for staff/admin use.
- Announcement data model and tables were added.
- Announcement management UI was added.
- Customer-facing announcements were added.
- Announcement email/test-send support was added.

## Performance And Maintainability

- Frontend route/page loading was optimized through more stable page glob usage.
- Cached JSON helper gained in-flight request deduplication.
- Marketing calendar availability/data lookups were optimized.
- Client dashboard payment lookups were optimized with payment maps.
- API response foundations were added:
  - `ApiResponse`
  - booking, payment, user, report template, and report run resources
  - frontend response normalization helper
- Several growing endpoints now support opt-in pagination and search while preserving legacy array responses.
- API response contracts were documented and consolidated into this completed list.

## Documentation And Planning Artifacts Completed

- Old handoff, planning, and rating notes were consolidated into this file, `docs/todo.md`, and the README documentation map.
- `FRD.md` remains the functional requirements baseline.
- `latestratedFRD.md` remains the latest requirement completion rating.
- `testcase.md` remains the end-to-end and role-based test case reference.
- `instructions.md` remains the manual workflow walkthrough.
- `QA.md` remains the consolidated QA report.
- `docs/rulesforstaffui.md` and `docs/overhaulstaffui.md` remain the staff/Admin UI references.
- `docs/document-inventory.md` remains the generated document route and ownership inventory.
- `tablerules.md` was added as the shared table layout and alignment rule set.

## Verification Already Run

Recent successful checks include:

- `npm.cmd run build`
- `.\php\php.exe artisan test`
- `.\php\php.exe artisan migrate --force`
- `.\php\php.exe artisan migrate:status`
- PHP syntax checks on the main edited controllers, services, resources, and migrations
