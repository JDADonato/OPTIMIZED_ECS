# Staff Interface Enhancement Plan

Created: 2026-05-25

## Purpose

This plan addresses the current weakness of the staff-side interfaces: Admin, Marketing, Accounting, reports, analytics, content management, chat, and configuration. The goal is to make the staff experience feel like a real business operations system instead of a collection of crowded screens.

The plan follows the visual direction in `cleanstyle.md`, but adapts it for staff work: clearer navigation, fewer cards, better information hierarchy, calmer tables, and more intuitive workflows.

## Verdict

The staff side is functional, but it is not yet business-ready from a UX standpoint.

The main issue is no longer just styling. The deeper issue is product structure:

- Staff screens show too many things at once.
- Admin, Marketing, and Accounting feel like separate products.
- There are too many cards, headers, icons, badges, filters, and controls fighting for attention.
- Navigation is broad instead of task-based.
- Reports and analytics are powerful but still feel complex.
- Some labels are system-oriented instead of staff-oriented.
- The UI does not yet communicate "this is a professional tool for operating a catering business."

## Target Experience

The staff interface should feel:

- professional
- calm
- business-grade
- easy to scan
- reliable
- task-focused
- consistent across roles
- simple enough for daily staff use
- powerful enough for owners and managers

It should not feel:

- decorative
- childish
- overloaded
- experimental
- inconsistent
- like a demo dashboard
- like every feature is competing for equal importance

## Core Design Direction

Use the booking wizard style as the brand foundation, but make staff pages more operational.

Use:

- warm ivory background
- white primary work surfaces
- deep red for main actions and active navigation
- muted gold for section labels and small highlights
- slate text for secondary information
- thin borders
- compact spacing
- clear typography
- flat surfaces
- simple hover states
- restrained status colors

Avoid:

- gradients
- glows
- too many icons
- oversized cards
- repeated card headers
- heavy shadows
- badges for every small value
- excessive rounded pills
- dashboard charts that do not lead to action
- decorative UI that slows staff down

## Main UX Problems

## 1. Navigation Is Too Broad

Current issue:

- Admin has many tabs that all feel equally important.
- Marketing and Accounting use different mental models.
- Profile, configuration, content, reports, analytics, audits, users, bookings, and refunds are all competing in the same level.

Fix:

- Group pages by staff intent.
- Separate daily work from management/setup.
- Use role-specific navigation labels.

Recommended Admin navigation:

Daily work:

- Overview
- Bookings
- Finance
- Messages

Business insight:

- Analytics
- Reports

Management:

- Content
- Users
- Configuration
- Audits
- Profile

Recommended Marketing navigation:

- Today
- Calendar
- Booking Review
- Messages
- Event Documents
- Content
- Menu And Packages
- Profile

Recommended Accounting navigation:

- Today
- Payment Verification
- Ledger
- Refunds
- Payment Reminders
- Reports
- Profile

## 2. There Are Too Many Cards

Current issue:

- Many staff pages use cards for almost everything.
- Cards are nested or repeated.
- Headers repeat the same information above and inside cards.
- The layout feels visually busy.

Fix:

- Use cards only for:
  - repeated records
  - compact metric groups
  - modal content
  - focused decision panels
- Use tables for operational lists.
- Use section bands for page areas.
- Use simple dividers instead of card borders everywhere.

Better pattern:

- Page header explains the screen once.
- Toolbar controls filtering and search.
- Main content uses a table, split view, or work queue.
- Details open in a side panel or modal.

## 3. Staff Pages Need A Shared Shell

Current issue:

- Admin, Marketing, and Accounting do not feel like one unified system.
- Each dashboard recreates navigation, page structure, filters, buttons, and content patterns.

Fix:

Create a shared staff shell.

Recommended files:

- `resources/js/Layouts/StaffLayout.jsx`
- `resources/js/Components/staff/StaffSidebar.jsx`
- `resources/js/Components/staff/StaffTopbar.jsx`
- `resources/js/Components/staff/StaffPageHeader.jsx`
- `resources/js/Components/staff/StaffSection.jsx`
- `resources/js/Components/staff/StaffToolbar.jsx`

Shared shell behavior:

- persistent sidebar
- clear role label
- top search
- notification access
- profile menu
- one clear page title
- optional page action area
- same spacing on every staff page

## 4. Staff Components Need To Be Reusable

Current issue:

- Tables, filters, modals, status badges, buttons, and empty states are inconsistent.
- Fixing one page does not improve the others.

Fix:

Create reusable staff components:

- `StaffTable`
- `StaffFilterBar`
- `StaffSearchSelect`
- `StaffMetricStrip`
- `StaffStatusText`
- `StaffActionMenu`
- `StaffModal`
- `StaffDrawer`
- `StaffEmptyState`
- `StaffLoadingState`
- `StaffConfirmDialog`
- `StaffPagination`
- `StaffToast`

Rules:

- All primary actions use the same red button style.
- All secondary actions use the same bordered button style.
- All destructive actions use red text or muted red border, not giant warning blocks.
- Status labels should be text-first and compact.
- Filters should be searchable dropdowns when values are known.

## Phase 1: Build The Staff Design System

Goal: establish consistency before redesigning every screen.

Implement:

1. Create shared staff layout and components.
2. Move repeated button, table, modal, filter, and empty-state styles into reusable components.
3. Apply `cleanstyle.md` tokens:
   - warm page background
   - deep red active states
   - gold section labels
   - slate secondary text
   - flat bordered surfaces
4. Define staff spacing rules:
   - one page header
   - one toolbar per list
   - no duplicate section header directly above a card header
   - no nested cards
5. Replace excessive pills and badges with plain metadata rows unless status needs emphasis.

Acceptance criteria:

- Admin, Marketing, and Accounting share the same shell.
- Buttons, filters, modals, and tables look consistent.
- No staff page needs custom one-off visual patterns for basic UI.

## Phase 2: Redesign Staff Navigation

Goal: make navigation match real staff jobs.

Implement:

1. Rename generic dashboard labels:
   - "Dashboard" becomes "Overview" or "Today".
   - "Configuration" becomes "Business Setup" if it is owner-facing.
   - "Content" becomes "Announcements" or "Site Content" depending on scope.
2. Group navigation into:
   - Daily Work
   - Business Insight
   - Management
3. Move profile to the bottom or topbar menu.
4. Make the role clear:
   - Admin Console
   - Marketing Workspace
   - Accounting Workspace
5. Remove unnecessary icons if they make the sidebar look cluttered.

Acceptance criteria:

- Staff can tell where to go for daily work within 5 seconds.
- Admin users can tell which screens are setup screens versus operations screens.
- The sidebar no longer feels cramped or uneven.

## Phase 3: Redesign Admin Overview

Goal: make Admin feel like a business command center.

Current problem:

- Admin overview mixes many dashboard ideas and does not clearly prioritize what needs action.

New layout:

1. Top metric strip:
   - bookings awaiting review
   - payments needing verification
   - upcoming events
   - overdue collections
2. Main action queues:
   - bookings needing attention
   - payments needing attention
   - refund cases
3. Today and this week:
   - upcoming events
   - staffing or preparation alerts
4. Recent activity:
   - recent booking changes
   - recent payment updates
   - admin actions

Rules:

- No decorative charts on the overview.
- Only show charts in analytics.
- Every item should answer "what should staff do next?"

Acceptance criteria:

- Admin overview shows priority work first.
- Owners can quickly understand the business state.
- The page uses fewer cards and more structured lists.

## Phase 4: Redesign Analytics

Goal: make analytics actionable instead of visually heavy.

New structure:

1. Snapshot
   - revenue collected
   - pending collection
   - overdue amount
   - active bookings
2. Revenue
   - collection trend
   - overdue breakdown
   - payment status
3. Bookings
   - pipeline
   - event type demand
   - date demand
4. Menu and packages
   - top packages
   - top dishes
   - low-performing items
5. Operations
   - upcoming workload
   - capacity risks
   - alerts

UX rules:

- Filters stay at the top in a compact toolbar.
- Use plain language for every metric.
- Each chart needs a short "what this means" line.
- Avoid forecast visuals unless clearly labeled as estimates.
- Do not show fake or future-looking data as if it already happened.

Acceptance criteria:

- Business owners can understand each chart without technical help.
- Analytics loads progressively.
- Filters are cleaner and easier to use.

## Phase 5: Redesign Reports

Goal: make reports useful without overwhelming staff.

Current problem:

- Reports are more powerful now, but the builder still has too many concepts visible at once.

Recommended structure:

1. Setup bar
   - saved report
   - report name
   - date range
   - status filters
   - city filter
2. Build area
   - collapsible report library on the left
   - report canvas on the right
3. Preview area
   - report output only
   - download PDF
   - download spreadsheet

Improvements:

- Replace raw text inputs with searchable dropdowns.
- Make selected blocks visually obvious.
- Keep library collapse useful by expanding canvas width.
- Remove redundant helper text.
- Use "Save Report" consistently, not "Save Template" in one place and "Saved Report" elsewhere.
- Let users edit and delete saved reports.

Acceptance criteria:

- Staff can build a report without reading instructions.
- Canvas uses available space properly.
- Preview is readable.
- Saved report actions are obvious.

## Phase 6: Redesign Marketing Workspace

Goal: make Marketing a booking and communication workspace.

Recommended pages:

## Today

Show:

- new inquiries
- bookings awaiting follow-up
- messages needing reply
- upcoming tastings
- event documents due

## Calendar

Show:

- event calendar
- date capacity
- booking status by color
- side panel for selected date or booking

## Booking Review

Show:

- queue of submitted bookings
- filters by status, date, event type
- booking detail drawer
- approve, request changes, assign follow-up

## Messages

Show:

- shared inbox
- unassigned queue
- claimed conversations
- customer context panel
- booking links

## Content

Show:

- announcements
- email sending status
- customer homepage visibility
- scheduling controls

Acceptance criteria:

- Marketing staff sees daily work first.
- Customer communication and booking review are easy to access.
- Calendar is not overloaded with unrelated settings.

## Phase 7: Redesign Accounting Workspace

Goal: make Accounting feel like a finance tool.

Recommended pages:

## Today

Show:

- payments awaiting verification
- overdue balances
- refunds needing review
- recent PayMongo activity

## Payment Verification

Layout:

- left: verification queue
- right: selected payment details
- actions: verify, reject, request proof, open PayMongo reference

## Ledger

Layout:

- searchable paginated table
- booking, customer, due date, paid, remaining, status
- export option

## Refunds

Layout:

- refund case pipeline
- PayMongo status
- approval trail
- customer/payment context

UX rules:

- Money columns must align right.
- Status should be clear but not oversized.
- Refund actions must require confirmation.
- PayMongo connection state should be visible when relevant.

Acceptance criteria:

- Accounting can process payments without hunting through bookings.
- Ledger is readable and scalable.
- Refund flow is clear and auditable.

## Phase 8: Redesign Staff Chat

Goal: make chat feel like a support inbox, not a floating widget stretched into staff work.

Recommended structure:

- Left: conversation queue
- Center: active conversation
- Right: customer and booking context

Features:

- unassigned conversations
- my conversations
- resolved conversations
- quick status filter
- search by customer or booking
- claim conversation
- transfer conversation
- mark resolved
- customer details
- related bookings

UX rules:

- Customer-facing chat bubble can stay lightweight.
- Staff chat should be a full inbox.
- Do not make staff manage support from a tiny modal.
- Long conversation history should paginate.

Acceptance criteria:

- Staff can triage and respond quickly.
- Messages, booking context, and customer info are visible together.
- Chat does not feel like an afterthought.

## Phase 9: Content Management Cleanup

Goal: make CMS understandable for non-technical staff.

Recommended CMS pages:

- Announcements
- Customer Homepage Posts
- Email Campaigns
- Drafts
- Sent History

Announcement workflow:

1. Create announcement.
2. Choose audience.
3. Choose where it appears.
4. Choose whether to send email.
5. Preview.
6. Publish or schedule.

UX rules:

- Use customer-facing language.
- Avoid technical labels like "payload", "visibility flag", or "target channel".
- Show exactly where the announcement will appear.
- Show email status after sending.

Acceptance criteria:

- Marketing/Admin can create announcements without developer help.
- Preview makes the customer result clear.
- Published and scheduled states are easy to understand.

## Phase 10: Remove Or Hide Unnecessary Complexity

Remove or hide:

- inactive legacy report UI
- unused old direct-message UI
- duplicate headers above cards
- excessive badges and pills
- decorative icons that do not help navigation
- repeated helper text
- technical wording in staff/customer-facing screens
- full raw records in places where a summary is enough

Keep, but move to better places:

- audit logs
- system configuration
- export tools
- advanced report filters
- detailed analytics filters

Acceptance criteria:

- Daily users see daily tools first.
- Advanced/admin tools remain available but do not clutter normal work.

## Suggested File Structure

Create a clearer staff structure:

```text
resources/js/Layouts/StaffLayout.jsx
resources/js/Components/staff/
  StaffSidebar.jsx
  StaffTopbar.jsx
  StaffPageHeader.jsx
  StaffSection.jsx
  StaffTable.jsx
  StaffFilterBar.jsx
  StaffMetricStrip.jsx
  StaffModal.jsx
  StaffDrawer.jsx
  StaffEmptyState.jsx
  StaffPagination.jsx
resources/js/Pages/staff/admin/
  AdminOverview.jsx
  AdminAnalytics.jsx
  AdminReports.jsx
  AdminBookings.jsx
  AdminFinance.jsx
  AdminContent.jsx
  AdminUsers.jsx
  AdminConfiguration.jsx
  AdminAudits.jsx
  AdminProfile.jsx
resources/js/Pages/staff/marketing/
  MarketingToday.jsx
  MarketingCalendar.jsx
  MarketingBookingReview.jsx
  MarketingMessages.jsx
  MarketingDocuments.jsx
  MarketingContent.jsx
resources/js/Pages/staff/accounting/
  AccountingToday.jsx
  AccountingPayments.jsx
  AccountingLedger.jsx
  AccountingRefunds.jsx
  AccountingReports.jsx
```

## Implementation Order

1. Build shared staff layout and component primitives.
2. Apply the shell to Admin first.
3. Split Admin tabs into smaller components.
4. Redesign Admin Overview.
5. Redesign Reports.
6. Redesign Analytics.
7. Apply shell and reusable components to Accounting.
8. Redesign payment verification, ledger, and refunds.
9. Apply shell and reusable components to Marketing.
10. Redesign calendar, booking review, messages, and CMS.
11. Remove legacy and duplicate UI blocks.
12. Run role-based browser testing.

## Production Readiness Checklist For Staff UX

- Staff side has one shared layout.
- Sidebar is visually balanced and role-specific.
- Page headers are not duplicated inside cards.
- Daily work is separated from configuration.
- Tables are paginated, searchable, and readable.
- Modals follow one consistent style.
- Reports are understandable and exportable.
- Analytics answers business questions.
- Marketing has a clear booking review workflow.
- Accounting has a clear payment and refund workflow.
- Staff chat works like an inbox.
- Profile/settings are easy to find.
- No important staff page feels like a demo.
- No staff page relies on hidden technical wording.

