# Enhance Staff Styles: Marketing And Accounting UX Plan

Created: 2026-05-25

## Purpose

This plan focuses on improving the Marketing and Accounting staff interfaces shown in the screenshots. The goal is to make both workspaces feel like business operations tools: compact, calm, searchable, task-first, and visually consistent with the public customer pages, customer dashboard, and booking wizard.

This is a UI/UX improvement plan, not a backend rewrite plan. Existing workflows should be preserved where possible, but the interface should be reorganized so staff can finish daily work with less vertical scrolling and fewer confusing screens.

## Current Problems Seen In The Screenshots

The pages already have the right brand ingredients, but they are not yet arranged like a production staff tool.

- The top header consumes too much vertical space before staff reach real work.
- Tabs stretch across the page and become hard to scan.
- Many screens use large cards where compact work surfaces would be better.
- Tables and queues are visually oversized, causing unnecessary scrolling.
- Some empty states take too much space without giving a next action.
- Calendar and preparation views are too tall for operations work.
- Marketing pages mix content management, booking intake, calendar, and messaging without a strong daily-work hierarchy.
- Accounting lists are readable but too tall, and important money/work status is not dense enough.
- Filters exist in some places, but they are not standardized, sticky, saved, or paired with pagination.
- Modals and detail views should feel more like guided workflow steps, not just popups.
- The visual style borrows from the customer-facing pages, but the staff pages need a more compact business version of that style.

## Target Direction

Use the public customer pages for brand warmth and polish:

- warm ivory page background
- deep red active states and primary actions
- gold uppercase section labels
- strong typography
- soft bordered panels
- calm premium feeling

Use the booking wizard for workflow structure:

- step-based actions
- clear progress and readiness
- compact review summaries
- sticky summary/detail panels
- predictable primary and secondary buttons
- modals that explain the next step

Adapt both into a staff operations style:

- denser than customer pages
- less decorative than landing pages
- more table/list oriented than the booking wizard
- fewer large cards
- more split-pane workspaces
- persistent filters and pagination
- every screen answers: "What should I do next?"

## Shared Staff Layout Improvements

### 1. Reduce The Header Height

Current screenshots show a large header, then a large title band, then tabs, then content. This pushes the actual work down.

Recommended layout:

- Single sticky top bar, height around 64px to 72px.
- Left: Eloquente wordmark and role workspace name.
- Center or left after title: global search shortcut.
- Right: role label, notifications, username, profile menu, logout.
- Remove duplicated role labels from multiple places.

Page header below topbar:

- Compact, max 88px to 112px.
- Left: small gold kicker, page title, one-line purpose.
- Right: metric strip or main action.
- Do not repeat the same title inside the first panel.

### 2. Replace Long Top Tabs With A Compact Navigation Pattern

The Marketing tab row is too wide and competes with the content. Accounting tabs are simpler but still use too much vertical separation.

Recommended pattern:

- Desktop: compact horizontal segmented nav under page header.
- Mobile/tablet: dropdown or horizontal scroll chips.
- Keep tab height around 44px.
- Add small counters only when actionable.
- Use concise labels.

Marketing recommended nav:

- Today
- Intake
- Calendar
- Preparation
- Documents
- Messages
- Content
- Menu

Accounting recommended nav:

- Today
- Verification
- Ledger
- Exceptions
- Refunds

### 3. Standardize Page Frames

Every Marketing and Accounting tab should use the same frame:

1. Compact page header.
2. Sticky filter/action bar.
3. Main work surface.
4. Pagination/footer when needed.
5. Drawer or modal for details.

Avoid:

- large empty vertical gaps
- repeated section headers
- cards inside cards
- full-page forms when a drawer or modal would preserve context

## Shared Staff Component System

Build or standardize these reusable components before redesigning individual pages:

- `StaffWorkspaceShell`
- `StaffPageHeader`
- `StaffMetricStrip`
- `StaffTabNav`
- `StaffFilterBar`
- `StaffSearchInput`
- `StaffDataTable`
- `StaffQueueList`
- `StaffPagination`
- `StaffDrawer`
- `StaffWorkflowModal`
- `StaffEmptyState`
- `StaffStatusBadge`
- `StaffActionMenu`
- `StaffStepList`
- `StaffDateRangeFilter`

Design rules:

- Primary action: deep red.
- Secondary action: white/cream with red text.
- Positive action: restrained green, not oversized.
- Warning action: gold or amber.
- Destructive action: red border/text, filled red only in final confirmation.
- Money values align right.
- Dates use readable local formats, not raw ISO strings.
- Record rows should be 72px to 96px tall in tables, not 150px+ unless expanded.

## Filtering, Search, And Pagination Standards

Every queue/list page should have a consistent filter bar.

Required controls:

- Search by customer, booking ID, email, phone, or reference.
- Status filter.
- Owner/assignee filter where relevant.
- Date range filter.
- Sort selector.
- Clear filters button.
- Saved quick filters for common work.

Recommended quick filters:

Marketing:

- Unassigned
- Needs details
- Awaiting approval
- Urgent event date
- High value
- Has open messages
- Has tasting request

Accounting:

- Pending verification
- Overdue
- Due this week
- Provider mismatch
- Missing PayMongo ID
- Refund requested
- Failed refund

Pagination:

- Use server-side pagination for all lists over 25 records.
- Default page size: 10 for card queues, 25 for tables.
- Allow 10, 25, 50.
- Keep pagination sticky at the bottom of the work surface when possible.
- Show "Showing 1-25 of 97" so staff know the queue size.

## Marketing Workspace Redesign

## Marketing Today

Purpose: a daily command surface for Marketing staff.

Layout:

- Top metric strip:
  - New inquiries
  - Needs details
  - Unanswered messages
  - Upcoming tastings
  - Documents due
- Main two-column layout:
  - Left: Priority queue
  - Right: Today schedule and quick notes

Priority queue items:

- Booking/customer name
- Event date and pax
- Current status
- Why it needs attention
- One primary next action

Actions:

- Claim
- Request details
- Review booking
- Reply to customer
- Open preparation

No big calendar on Today. Today should be a queue.

## Marketing Calendar

Current issue: the month calendar consumes almost the entire viewport and requires too much vertical scrolling.

Recommended redesign:

- Use a split calendar:
  - Left 70%: compact month or week calendar.
  - Right 30%: selected date agenda.
- Add view switcher:
  - Month
  - Week
  - List
- Default to Week or List for operational work, not Month.
- Keep the calendar inside a fixed-height work area around 560px to 680px.
- Internal calendar scroll is acceptable only inside the calendar panel, not the full page.

Calendar controls:

- Today
- Previous/Next
- Month selector
- Status filter
- Event type filter
- Capacity toggle

Calendar event chips:

- Short title
- pax
- status color
- small attention marker if payment/menu/headcount missing

Selected date side panel:

- Capacity summary
- Bookings on that date
- Locked/override state
- Open booking detail
- Edit availability

## Marketing Availability

Current issue: the availability form is visually large, and the "Month Overrides" panel sits empty or loading.

Recommended redesign:

- Make Availability a compact split view:
  - Left: month capacity calendar/list.
  - Right: selected date editor.
- Replace large always-visible form with a contextual editor.
- If no date is selected, show a compact empty state: "Select a date to edit capacity."
- Month overrides should be a searchable table/list, not a large empty panel.

Filters:

- Month
- Locked only
- Reduced capacity
- Fully booked
- Has bookings

Selected date editor:

1. Date
2. Current bookings/capacity
3. Remaining slots
4. Remaining pax
5. Lock date toggle
6. Internal note
7. Save / Clear override

Modal behavior:

- Saving reduced capacity below existing bookings should open a warning modal.
- Fully locking a date with bookings should explain that existing bookings remain but new bookings are blocked.

## Marketing Preparation

Current issue: the preparation board is useful but too tall. Each booking expands into a large row with every task visible.

Recommended redesign:

- Use a dense table or split queue instead of full large cards.
- Default view shows one row per booking.
- Selecting a row opens a right drawer with readiness and tasks.

Table columns:

- Event date
- Customer/event
- Pax
- Readiness
- Task progress
- Attention
- Owner
- Actions

Compact readiness:

- Use six tiny indicators with tooltip labels:
  - payment
  - menu
  - venue
  - headcount
  - tasting
  - messages

Drawer:

- Header: booking, event date, status.
- Readiness checklist.
- Preparation tasks with toggles.
- Related messages.
- Open booking details.

Filters:

- Date range
- Needs attention
- Payment not clear
- Menu/headcount missing
- My tasks
- Department

Pagination:

- Default 10 bookings per page.
- Sort by event date ascending.

## Marketing Booking Review

Current issue: this is the strongest Marketing screen, but rows are still very tall and action buttons repeat heavily.

Recommended redesign:

- Use queue table with expandable detail drawer.
- Keep only one primary action visible per row.
- Move secondary actions into an action menu.

Row layout:

- Booking ID and event type
- Customer
- Event date
- Pax
- Value
- Owner
- Status
- Next action

Primary next action logic:

- Unassigned: Claim
- Claimed and submitted: Review
- Needs details: View request
- Ready to approve: Approve

Secondary menu:

- Request details
- Reject
- Transfer owner
- View booking
- View customer messages

Detail drawer steps:

1. Customer and event summary.
2. Menu/package review.
3. Payment readiness.
4. Clarification/messages.
5. Decision: approve, request details, reject.

Filters:

- Search
- Status
- Owner
- Event date range
- Event type
- Value range
- Urgent within 14 days
- Missing fields

Pagination:

- Default 25 rows.
- Keep actions visible without full-page scroll.

## Marketing Event Documents

Current issue: the page is simple but too bare, and actions float on each row without context.

Recommended redesign:

- Convert to document production queue.
- Add filters by date, document status, and event type.
- Add status per document: Not generated, Generated, Downloaded, Sent.

Table columns:

- Event date
- Booking/customer
- Event type
- Contract status
- Prep list status
- Last generated
- Actions

Actions:

- Generate contract
- Generate prep list
- Download
- Mark sent

Modal:

- Generation modal shows what will be included before creating the file.
- Success modal provides next step: download or open booking.

## Marketing Announcements

Current issue: composer and preview create a lot of vertical scrolling, and the right preview panel feels disconnected.

Recommended redesign:

- Use a two-pane composer:
  - Left: list of announcements.
  - Center: editor.
  - Right: live preview drawer/panel.
- On smaller screens, preview becomes a modal.

Workflow steps:

1. Content
2. Audience
3. Placement
4. Schedule
5. Preview
6. Publish

Filters:

- Draft
- Scheduled
- Published
- Homepage
- Customer dashboard
- Email sent

Pagination:

- Paginate announcement history.

Modal:

- Publish confirmation must summarize audience, placement, schedule, and email setting.

## Marketing Menu And Packages

Current issue: large forms, multi-select boxes, and table below the fold make the page feel like an internal admin form instead of business tooling.

Recommended redesign:

- Split into:
  - left list/table of packages/event types/menu items
  - right editor drawer
- Do not show giant create form above the table by default.
- Use "New package" button to open a drawer or modal.

Package table columns:

- Package
- Category
- Connected event types
- Price/head
- Minimum pax
- Active
- Actions

Editor drawer sections:

1. Basic info.
2. Pricing.
3. Event type connections.
4. Menu category counts.
5. Description and inclusions.
6. Cash bond and notes.

Controls:

- Use searchable multi-select chips for connected event types.
- Replace native multi-select box.
- Use compact number steppers for category counts.

Filters:

- Search
- Category
- Event type
- Active/inactive
- Price range

Pagination:

- 25 items per page for tables.

## Marketing Messages

Current issue: the messaging page is clean but too empty and does not provide enough triage controls.

Recommended redesign:

- Full inbox layout:
  - Left: conversation queue.
  - Center: conversation.
  - Right: customer/booking context.
- Keep height fixed to viewport minus header/tabs so there is no full-page scroll.

Conversation queue controls:

- Search customer or booking ID.
- Filters:
  - Unassigned
  - Mine
  - Waiting customer
  - Waiting staff
  - Resolved
  - Has booking
- Sort:
  - newest message
  - oldest waiting
  - event date

Conversation header:

- Customer name
- Booking link
- Owner
- Status
- Claim/transfer/resolve actions

Right context panel:

- Customer contact
- Related bookings
- Active booking status
- Event date
- Payment status
- Recent staff notes

Modals:

- Claim confirmation only if another staff member owns it.
- Transfer modal requires selecting a staff member and optional note.
- Resolve modal asks for resolution summary.

## Accounting Workspace Redesign

## Accounting Today

Purpose: a finance command surface.

Layout:

- Metric strip:
  - Pending verification
  - Overdue amount
  - Exceptions
  - Refund cases
  - Collected this month
- Main two-column layout:
  - Left: money actions due today.
  - Right: provider/reconciliation alerts.

Priority queue items:

- Payment pending verification
- Overdue payment
- Provider paid but local not verified
- Refund request
- Refund failed

Each item needs:

- Customer
- Booking ID
- Amount
- Due date
- Reason
- Primary action

## Accounting Payment Verification

Current issue: cards are oversized and repeated, and raw ISO dates appear.

Recommended redesign:

- Use a split verification desk:
  - Left: payment queue table/list.
  - Right: selected payment detail panel.
- Only expand one record at a time.
- Keep detail panel sticky.

Queue columns:

- Due date
- Customer/booking
- Payment type
- Amount
- Status
- Provider state
- Next action

Detail panel:

- Booking summary.
- Payment schedule.
- Uploaded proof or PayMongo reference.
- Payment events timeline.
- Staff notes.
- Actions.

Actions:

- Verify payment
- Reject/request proof
- Open PayMongo reference
- Mark exception reviewed

Filters:

- Search customer/booking/reference
- Payment status
- Payment type
- Due date range
- Provider state
- Has proof
- Missing provider ID

Pagination:

- 25 payments per page.

## Accounting Ledger

Current issue: ledger entries are too large and duplicate headers inside each booking card.

Recommended redesign:

- Ledger should be a true data table by default.
- Offer expandable row details, not full large cards.
- Keep money columns right-aligned.

Table columns:

- Booking ID
- Customer
- Package/event
- Event date
- Payment type
- Due date
- Amount
- Paid
- Balance
- Status

Filters:

- Search
- Package
- Status
- Payment type
- Event date range
- Due date range
- Balance due
- Overdue only

Actions:

- View booking
- View payments
- Export current view

Pagination:

- Default 25 rows.
- Allow 50 for ledger users.
- Sticky table header.

## Accounting Reconciliation

Current issue: useful but too raw and table rows are tall. Staff need exception handling, not just inspection.

Recommended redesign:

- Treat reconciliation as an exception queue.
- Add a compact summary bar:
  - Checkout unpaid
  - Provider paid/local pending
  - Pending past due
  - Missing payment ID
  - Webhook not received

Table columns:

- Severity
- Payment/booking
- Customer
- Amount
- Provider references
- Webhook state
- Exception type
- Next action

Next actions:

- Open payment detail
- Mark reviewed
- Verify manually
- Request customer action
- Add provider reference

Filters:

- Exception type
- Webhook state
- Provider reference present/missing
- Payment status
- Date range
- Search booking/customer/reference

Drawer:

- Provider references.
- Webhook/payment event timeline.
- Local payment status.
- Recommended resolution step.
- Staff note field.

Pagination:

- Required because exception counts can be high.
- Default 25.

## Accounting Refunds

Current issue: refund queue is readable but the table is tall, and refund actions lack staged workflow context.

Recommended redesign:

- Use refund case pipeline rather than direct refund rows.
- Tabs or quick filters:
  - Requested
  - Approved
  - Processing
  - Failed
  - Refunded
  - Rejected

Table columns:

- Case ID
- Booking
- Customer
- Event date
- Paid
- Refundable
- Fee
- Status
- Owner
- Actions

Actions:

- Review case
- Approve
- Process refund
- Reject
- Mark resolved

Refund drawer workflow:

1. Case summary.
2. Eligibility and policy.
3. Payment/provider reference.
4. Refund amount and fee.
5. Approval trail.
6. Process or reject.

Modal:

- Processing refund requires a confirmation modal that shows:
  - customer
  - booking
  - total paid
  - fee deducted
  - refund amount
  - provider reference state
- If provider payment ID is missing, show the safe staff message and route to manual handling.

Filters:

- Status
- Event date
- Request date
- Amount range
- Provider automatic/manual
- Failed only

Pagination:

- Default 25.

## Modal And Drawer Standards

Use drawers for record review where staff should keep their place in the queue.

Use modals for:

- final confirmations
- short prompts
- success/failure states
- focused create/edit forms

Drawer structure:

- Header with booking/customer title and status.
- Compact summary strip.
- Step sections or tabs.
- Sticky footer with primary action.

Modal structure:

- Ivory background.
- Deep red title or action.
- Gold kicker only when useful.
- Plain-language consequence.
- Primary and secondary actions.
- No raw backend messages.

Workflow modals should use booking-wizard thinking:

- Step 1: Review the record.
- Step 2: Confirm required fields.
- Step 3: Take action.
- Step 4: Show what happens next.

## Density And Scrolling Rules

To reduce vertical scrolling:

- Keep header + tabs under 180px total.
- Use max-height work surfaces with internal table/list scroll only where appropriate.
- Use pagination instead of infinite long lists.
- Use drawers for details instead of expanding many rows.
- Avoid full-width forms above tables.
- Use compact rows and aligned columns.
- Collapse secondary information behind row expansion or detail drawer.
- Keep primary actions visible in sticky drawer/table footers.

Recommended desktop viewport target:

- Staff should see:
  - page title
  - filters
  - at least 8 table rows or 5 queue cards
  - primary actions
without scrolling.

## Visual Polish Rules

Borrow from customer pages:

- spacious but not huge page background
- gold kickers
- deep red active nav
- warm panels
- premium typography

Borrow from booking wizard:

- steps
- summary side panels
- progress/readiness indicators
- review-before-submit modals
- consistent action footers

Avoid:

- oversized cards for every record
- giant empty states
- raw date strings
- native multi-select boxes
- too many pill badges
- repeated button groups on every row
- using cards where a table is better
- all-uppercase text for long labels

## Implementation Phases

## Phase 1: Staff UI Foundations

Implement shared components and styles:

- Staff shell
- Page header
- Tab nav
- Filter bar
- Data table
- Queue list
- Drawer
- Workflow modal
- Pagination
- Status badge

Acceptance criteria:

- Marketing and Accounting share visual primitives.
- Header and tabs are compact.
- Lists have pagination.
- Modals and drawers match booking wizard styling.

## Phase 2: Accounting Redesign

Start with Accounting because it is high-risk and data-heavy.

Build:

- Accounting Today
- Payment Verification split desk
- Ledger table
- Reconciliation exception queue
- Refund case pipeline

Acceptance criteria:

- No accounting list requires long scrolling for normal work.
- Payment dates are formatted for humans.
- Money columns align correctly.
- Every queue has search, filters, sort, and pagination.
- Refunds use a staged confirmation workflow.

## Phase 3: Marketing Redesign

Build:

- Marketing Today
- Compact Calendar/List view
- Availability date editor
- Preparation board table + drawer
- Booking Review queue + drawer
- Documents production queue
- Announcements step composer
- Menu/package list + editor drawer
- Messaging inbox with context panel

Acceptance criteria:

- Marketing staff can start from Today and reach every priority task.
- Booking review has clear next actions.
- Calendar and preparation do not dominate the full page height.
- Messages function like an inbox.
- Menu/package editing no longer starts with a giant form.

## Phase 4: Workflow Polish

Polish cross-role flows:

- Standardize empty/loading/error states.
- Add saved filters for common queues.
- Add keyboard-friendly search.
- Add sticky drawer action footers.
- Add confirmation modals for sensitive actions.
- Add success modals/toasts with next steps.

Acceptance criteria:

- Staff never lose context after opening details.
- Canceling a modal/drawer has no side effects.
- Successful actions refresh only the affected row/list.
- Errors are plain-language and actionable.

## Phase 5: Browser QA And Responsiveness

Verify:

- 1440px desktop
- 1920px desktop
- 1366px laptop
- tablet width
- mobile fallback for urgent tasks

Smoke tests:

- Marketing intake filter + drawer + action.
- Marketing prep task toggle.
- Marketing message claim/resolve.
- Accounting payment verification detail.
- Accounting reconciliation filter.
- Accounting refund confirmation.

## Success Criteria

The redesign is successful when:

- Marketing and Accounting feel like one coherent business system.
- Staff can see their daily queue immediately.
- Pages require much less vertical scrolling.
- Every major list has search, filters, sorting, and pagination.
- Details open in drawers or modals instead of expanding the whole page.
- Modals explain the next step and consequences.
- The visual style clearly matches Eloquente public pages and booking wizard.
- The UI feels premium, calm, and operational instead of demo-like.
