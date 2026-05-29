# Whole-System Workflow Suggestions Plan

Created: 2026-05-25

## Purpose

This document reviews the full customer-to-staff workflow of the Eloquente Catering system and checks whether the staff processes make sense in relation to what customers do in their interfaces.

The goal is not only to list features. The goal is to make the entire business process feel complete:

- Customers should always know what to do next.
- Staff should always know what customer action needs a response.
- Admin should be able to monitor the whole operation without doing every task manually.
- Marketing, Accounting, and Admin should not duplicate work or miss handoffs.
- The system should guide the business from inquiry to event completion, payment, refund, feedback, and reporting.

## Executive Verdict

The system now has the main pieces needed for a real catering workflow:

- customer booking wizard
- customer dashboard
- package/menu selection
- food tasting option
- PayMongo payment flow
- payment milestones
- accounting payment verification
- refunds
- staff chat
- notifications
- announcement CMS
- reports
- analytics
- admin, marketing, and accounting dashboards

The biggest remaining issue is not that the system lacks screens. The bigger issue is that the process handoffs between customer actions and staff work need to become more explicit.

Right now, the customer journey is becoming clearer than the staff journey. The staff side needs stronger queues, ownership, statuses, reminders, and escalation rules so the business can operate every booking consistently.

## End-To-End Business Workflow Overview

## 1. Customer Discovers The Business

### Customer Actions

The customer visits:

- home page
- menu page
- amenities page
- contact page
- announcements
- chat support

They are trying to answer:

- Is this caterer suitable for my event?
- What kinds of events do they support?
- What food and packages are available?
- What is included?
- Can I trust them?
- How much might this cost?

### Current Staff Process

Marketing/Admin can manage:

- announcements
- event types
- packages
- menu items
- pricing
- customer-facing content

### What Makes Sense

This part is mostly aligned. Marketing should own customer-facing content, package presentation, announcements, and menu visibility. Admin should be able to override or review.

### Missing Or Weak

- No clear owner for keeping homepage/menu/package content fresh.
- No publishing checklist before content changes go live.
- No content approval flow if Marketing creates content but Admin wants control.
- Announcements exist, but they should be connected to business events such as holiday schedules, payment reminders, or limited availability.
- The customer sees offerings, but there is no strong "availability confidence" before starting a booking.

### Suggestions

1. Add a **Marketing Content Calendar**.
   - Shows scheduled announcements, promos, holiday notices, menu updates, and availability notices.
   - Helps staff plan customer communication instead of posting randomly.

2. Add a **Content Approval State** for announcements and major package/menu changes.
   - Draft
   - Ready for review
   - Approved
   - Published
   - Archived

3. Add a **Customer-facing availability notice**.
   - Example: "June weekends are filling quickly" if bookings/capacity show high demand.
   - Driven by real booking capacity data.

4. Add **content audit history**.
   - Who changed a package/menu item.
   - What changed.
   - When it was published.

## 2. Customer Starts A Booking

### Customer Actions

The customer goes through the booking wizard:

1. Event vision / event type
2. Date and time
3. Guest count
4. Package choice
5. Menu selection
6. Contact and venue details
7. Tasting preference
8. Final review modal and booking submission

### Current Staff Process

Marketing/Admin receive bookings for review. Admin can also view bookings. Accounting becomes involved later once payment is required.

### What Makes Sense

Marketing is the correct primary owner for new booking review because they handle customer communication, event fit, and operational coordination.

Admin should see the overall state and intervene when needed, but Admin should not be the default owner of every booking unless the business is very small.

### Missing Or Weak

- There is no strong visible "new booking intake queue" with ownership.
- A booking can be submitted, but staff may not have a structured checklist for reviewing it.
- There is no clear SLA such as "respond within 24 hours".
- The system should distinguish between:
  - booking submitted
  - staff reviewing
  - needs customer clarification
  - approved for reservation payment
  - rejected/unavailable
  - cancelled
- Food tasting is collected, but it should feed into staff scheduling and preparation.
- Customer abandonment is partly considered, but server-side draft persistence and staff visibility into high-intent abandoned bookings would improve recovery.

### Suggestions

1. Add a **Booking Intake Queue** for Marketing.
   - Default first screen for Marketing.
   - Sort by newest, oldest unanswered, event date urgency, and high value.
   - Show one clear next action per booking.

2. Add booking review statuses:
   - Submitted
   - Under Review
   - Needs Customer Details
   - Approved For Reservation
   - Not Available
   - Cancelled
   - Completed

3. Add a **review checklist** inside each booking:
   - Date still available
   - Menu/package valid
   - Venue within service area
   - Guest count and setup feasible
   - Payment schedule generated
   - Tasting preference checked
   - Customer contacted if needed

4. Add **booking assignment**.
   - Assign a Marketing staff member as owner.
   - Show "unassigned" bookings until claimed.
   - Admin can reassign.

5. Add a **customer clarification request** flow.
   - Staff can request missing/unclear details.
   - Customer dashboard shows a clear "Please answer these details" action.
   - Responses are tracked.

6. Add **draft recovery**.
   - Save meaningful booking drafts server-side.
   - Send reminder email if customer starts but does not submit.
   - Staff should not manually chase every abandoned draft, but high-value drafts can appear in a recovery list.

## 3. Staff Reviews And Approves Booking

### Customer Actions

After submission, the customer waits for review and may:

- check dashboard
- chat with staff
- adjust details if still allowed
- schedule/confirm food tasting

### Staff Actions

Marketing/Admin should:

- review booking details
- approve or reject booking
- contact customer if needed
- confirm date and logistics
- move booking to payment stage

### What Makes Sense

Marketing review before payment is sensible because the business should not accept money for an event it cannot serve.

### Missing Or Weak

- Approval should be a formal transition with side effects.
- There should be a clear separation between "submitted" and "approved for payment".
- Staff need a way to see unresolved customer messages directly inside booking review.
- There should be a clear rejection/decline reason for customer transparency and reporting.
- There is no visible operations handoff for confirmed bookings.

### Suggestions

1. Make **approval a formal workflow action**.
   - When approved, payment milestones become payable.
   - Customer gets a notification/email.
   - Booking status changes to Approved For Reservation.

2. Add **decline reasons**.
   - Date unavailable
   - Location not serviceable
   - Guest count not serviceable
   - Insufficient lead time
   - Customer cancelled
   - Other

3. Add a **booking communication panel**.
   - Show chat/messages connected to the booking.
   - Staff can send a message without leaving the booking review.

4. Add an **operations readiness checklist** after approval.
   - Menu locked date
   - Final headcount due date
   - Final payment due date
   - Tasting date if applicable
   - Internal preparation notes

## 4. Customer Pays

### Customer Actions

The customer uses PayMongo checkout to pay:

- standard milestone
- rush booking 1 immediate 80%, then final 20%
- rush booking 2 immediate 100%

Customer dashboard should show:

- what is due
- due date
- amount paid
- remaining balance
- next payment action

### Staff Actions

Accounting should:

- verify payment status
- monitor pending/overdue payments
- handle failed/abandoned payment checkouts
- send reminders
- reconcile PayMongo and local payment records

### What Makes Sense

Accounting should own money movement, verification, ledgers, and refunds. Marketing should see payment status, but not be responsible for financial reconciliation.

### Missing Or Weak

- PayMongo webhook updates exist, but staff need clearer reconciliation visibility.
- Accounting needs a "payment exceptions" queue, not only pending payments.
- There should be a distinction between:
  - PayMongo checkout started
  - checkout abandoned
  - payment paid by provider
  - webhook received
  - locally verified
  - payment overdue
  - refund requested
  - refund completed
- Client-accessible legacy payment recording should be removed or converted into proof upload only.
- Payment reminders should be scheduled, not manually remembered.

### Suggestions

1. Add an **Accounting Today** queue.
   - Payments needing verification
   - Overdue payments
   - PayMongo paid but local status not updated
   - Local pending but checkout expired
   - Refunds needing action

2. Add **PayMongo Reconciliation View**.
   - Shows provider reference, checkout session, payment id, webhook event id, local payment status, and mismatch state.
   - Staff should not need database access to diagnose payment issues.

3. Add **payment reminder automation**.
   - Reminder before due date.
   - Reminder on due date.
   - Overdue reminder.
   - Staff notification if still unpaid.

4. Add **payment exception statuses**.
   - Pending
   - Checkout Created
   - Paid By Provider
   - Verified
   - Failed
   - Expired
   - Overdue
   - Refunded

5. Remove or lock down **client manual payment verification**.
   - Customer should not be able to mark a payment as verified.
   - If manual proof is needed, create payment proof upload with Pending Review.

## 5. Food Tasting Workflow

### Customer Actions

Customer can choose to schedule a tasting or submit without tasting.

If tasting is selected, customer provides:

- guest name
- email
- phone
- preferred date
- preferred time
- notes

### Staff Actions

Marketing should:

- review tasting request
- confirm tasting schedule
- coordinate menu samples
- note customer feedback
- update booking/menu if needed

### What Makes Sense

Tasting belongs to Marketing or operations, not Accounting. It is part of customer experience and event planning.

### Missing Or Weak

- Tasting is treated like a preference, but it should become a staff task.
- No clear tasting calendar or conflict check.
- No tasting outcome record.
- No connection between tasting feedback and final menu lock.

### Suggestions

1. Add a **Tasting Queue** in Marketing.
   - Requested
   - Confirmed
   - Completed
   - Rescheduled
   - Cancelled

2. Add **tasting calendar capacity**.
   - Avoid double booking tastings.
   - Let staff confirm or suggest alternate slots.

3. Add **tasting outcome notes**.
   - Dishes liked
   - Dishes changed
   - Allergies or restrictions confirmed
   - Customer concerns
   - Final menu recommendation

4. Add **customer-facing tasting status**.
   - Requested
   - Confirmed
   - Completed
   - No tasting requested

## 6. Event Preparation And Operations

### Customer Actions

Before the event, the customer may:

- update details
- ask questions
- pay remaining balance
- finalize menu
- confirm venue information

### Staff Actions

Marketing/Admin should:

- lock menu at the correct deadline
- verify final venue details
- check logistics fees
- prepare event documents
- coordinate kitchen/service teams

Accounting should:

- ensure final payment is completed
- flag overdue balances

### What Makes Sense

Marketing handles event coordination. Accounting handles money. Admin supervises and can override.

### Missing Or Weak

- No dedicated event preparation board.
- No internal task assignments for kitchen/service/logistics.
- No final confirmation workflow.
- No "event locked" checklist.
- No inventory/resource planning for amenities/equipment.

### Suggestions

1. Add an **Event Preparation Board**.
   - Upcoming 30 days.
   - Sorted by event date.
   - Shows readiness state:
     - payment
     - menu
     - venue
     - tasting
     - staff notes
     - customer messages

2. Add **event lock milestones**.
   - Menu lock date
   - Final headcount deadline
   - Final payment deadline
   - Logistics confirmation deadline

3. Add **internal preparation tasks**.
   - Staff can create checklist items per booking.
   - Examples:
     - Confirm chairs/tables
     - Confirm waiter count
     - Print event sheet
     - Confirm delivery route
     - Prepare special dietary notes

4. Add **event sheet export**.
   - Printable/PDF summary for kitchen/service team.
   - Should include customer details, venue, menu, pax, setup, notes, and payment clearance.

5. Add **payment clearance gate**.
   - Clearly mark if event is not financially cleared.
   - Marketing can see it, Accounting owns resolution.

## 7. Event Day And Completion

### Customer Actions

Customer receives service. They may contact support if needed.

### Staff Actions

Staff should:

- mark event as in preparation / in progress / completed
- record event issues
- record any extra charges or adjustments
- trigger feedback request after completion

### What Makes Sense

The system currently supports statuses, but the completion workflow should become more formal because completion drives feedback, analytics, and final reporting.

### Missing Or Weak

- No explicit event-day workflow.
- No incident/issue logging.
- No completion confirmation that triggers feedback.
- No post-event adjustment flow.

### Suggestions

1. Add **event live status stages**.
   - Preparing
   - Ready
   - In Progress
   - Completed
   - Issue Reported

2. Add **event issue log**.
   - Late arrival
   - Missing item
   - Menu substitution
   - Customer complaint
   - Additional request
   - Equipment damage

3. Add **post-event completion action**.
   - Staff marks completed.
   - Feedback email is scheduled.
   - Final analytics/reports include the booking as completed.

4. Add **extra charge / adjustment process**.
   - If customer requests extra hours/services, staff can add an adjustment.
   - Accounting verifies whether additional payment is required.

## 8. Feedback And Customer Retention

### Customer Actions

After event completion, customer should receive:

- feedback request
- thank-you message
- option to give testimonial
- possible promo or rebooking path

### Staff Actions

Marketing/Admin should:

- review feedback
- respond to low ratings
- approve testimonials
- use insights for package/menu improvement

### What Makes Sense

Feedback is currently planned but not fully part of the workflow. It should be added because it closes the business process and feeds analytics.

### Missing Or Weak

- No automatic post-event feedback request.
- No service quality dashboard.
- No complaint escalation.
- No repeat-customer nurturing.

### Suggestions

1. Add **post-event feedback system**.
   - Tokenized feedback link.
   - Send 1 day after event completion.
   - Ratings for food, service, communication, value.
   - Optional testimonial permission.

2. Add **low-rating alert**.
   - Notify Marketing/Admin if rating is low.
   - Create follow-up task.

3. Add **testimonial approval**.
   - Staff can mark feedback as approved testimonial.
   - Later can be reused on marketing pages.

4. Add **repeat customer tagging**.
   - Analytics and customer profile should identify returning clients.
   - Marketing can send future promos.

## 9. Refund And Cancellation Workflow

### Customer Actions

Customer may cancel a booking if allowed by rules.

### Staff Actions

Accounting/Admin should:

- review cancellation
- calculate refundable amount
- process PayMongo refund if provider IDs exist
- track refund status
- notify customer

### What Makes Sense

Refunds belong to Accounting, with Admin oversight. Marketing should see cancellation state but should not process refunds.

### Missing Or Weak

- Refund attempts need first-class records.
- Refund policy should be visible to staff and customer.
- Customer should see refund status.
- Some cancellation decisions may need approval before refund.

### Suggestions

1. Add **refund case records**.
   - Requested
   - Approved
   - Processing
   - Refunded
   - Failed
   - Rejected

2. Add **refund approval rule**.
   - Accounting prepares refund.
   - Admin approval required above a threshold.

3. Add **customer refund status**.
   - Shows amount, status, and expected timeline.

4. Add **refund reason and audit trail**.
   - Required for every refund action.

## 10. Reports And Analytics Workflow

### Customer Actions

Customers create the data through bookings, payments, chats, announcements, feedback, and cancellations.

### Staff Actions

Admin should:

- monitor operations
- build reports
- review revenue and booking performance
- identify bottlenecks

Marketing should:

- review booking conversion
- review menu/package demand
- review feedback and communication performance

Accounting should:

- review collections, overdue payments, refunds, and ledger data

### What Makes Sense

Reports and analytics are appropriate for Admin, with limited role-specific reporting for Marketing and Accounting.

### Missing Or Weak

- Reports are strong for Admin, but Accounting/Marketing need role-specific reports too.
- Analytics should explicitly connect to operational action.
- Staff need fewer charts and more "what to do next" queues.

### Suggestions

1. Add **role-specific report presets**.
   - Admin:
     - Management Snapshot
     - Monthly Revenue
     - Booking Pipeline
   - Marketing:
     - Booking Follow-up Report
     - Menu Demand Report
     - Feedback Summary
   - Accounting:
     - Collection Aging
     - Refund Summary
     - Payment Reconciliation

2. Add **actionable analytics notes**.
   - Every analytics block should answer:
     - What happened?
     - Why does it matter?
     - What should staff do?

3. Add **export audit trail**.
   - Who exported reports.
   - Which filters were used.
   - When exported.

## Recommended Full Workflow Model

The ideal full workflow should look like this:

1. Customer explores marketing pages.
2. Customer starts booking wizard.
3. Customer selects event type, date, guests, package/menu, venue, tasting preference.
4. Customer reviews final event plan.
5. Customer submits booking.
6. Marketing receives booking in Intake Queue.
7. Marketing reviews feasibility and contacts customer if needed.
8. Marketing approves booking for reservation/payment.
9. Customer receives payment action.
10. Customer pays through PayMongo.
11. PayMongo webhook updates payment.
12. Accounting monitors payment status and exceptions.
13. Marketing coordinates tasting if selected.
14. Marketing finalizes menu, venue, and logistics.
15. Accounting monitors downpayment/final payment deadlines.
16. Event enters preparation board.
17. Staff complete event preparation checklist.
18. Event is served.
19. Staff marks event completed.
20. Feedback request is sent.
21. Feedback feeds analytics and service improvements.
22. Admin reviews reports and operational performance.

## Suggested Additions

## Priority 1: Workflow And Handoff Control

Add these first because they make staff work more coherent:

1. Booking Intake Queue
2. Booking assignment/claiming
3. Booking review checklist
4. Customer clarification request flow
5. Accounting Today queue
6. Payment exceptions and reconciliation view
7. Event preparation board
8. Event completion workflow

## Priority 2: Automation

Add these after the core workflow is clean:

1. Payment reminders
2. Booking draft recovery emails
3. Scheduled announcement publishing
4. Feedback request emails
5. PayMongo reconciliation job
6. Unanswered message escalation
7. Upcoming event readiness reminders

## Priority 3: Business Intelligence

Add these to make the business smarter:

1. Role-specific report presets
2. Feedback analytics
3. Repeat customer tracking
4. Package/menu conversion insights
5. Cancellation/refund reason analytics
6. Staff response time analytics

## Suggested Removals Or Reductions

## 1. Remove Duplicate Messaging Concepts

If the newer chat system is the real support inbox, old direct message routes and UI should be deprecated.

Reason:

- Two communication systems make staff miss messages.
- Customer history becomes split.
- Permissions are harder to secure.

Implementation:

1. Confirm all customer/staff communication can happen through the new chat system.
2. Migrate needed old message history if necessary.
3. Hide old direct message UI.
4. Remove old routes after testing.

## 2. Remove Customer Ability To Manually Verify Payments

Reason:

- Customers should never be able to mark payments as paid/verified.
- Payment truth should come from PayMongo or Accounting verification.

Implementation:

1. Remove or repurpose `POST /api/bookings/pay`.
2. Replace with payment proof upload if manual payments are allowed.
3. Accounting verifies proof.

## 3. Reduce Admin As Default Owner Of Everything

Reason:

- Admin should supervise and configure, not manually process every booking/payment/message.
- Marketing and Accounting need clear ownership.

Implementation:

1. Route booking review tasks to Marketing by default.
2. Route payment/refund tasks to Accounting by default.
3. Keep Admin override and reporting.

## 4. Hide Advanced Configuration From Daily Work

Reason:

- Staff daily screens should not feel like developer/admin setup screens.
- Configuration should be separate and less prominent.

Implementation:

1. Keep Business Setup under Management.
2. Add warnings for changes affecting customer-facing pricing.
3. Add preview/approval for major package or event type changes.

## 5. Remove Or Archive Demo/Placeholder Data From Production Views

Reason:

- Demo-looking data damages trust.
- Forecast or sample values can mislead business decisions.

Implementation:

1. Keep demo seeders local-only.
2. Label estimates clearly.
3. Hide empty analytics blocks until real data exists.

## Suggested New Data Models

These are the most useful database additions to support the process:

## 1. `booking_assignments`

Tracks who owns a booking review.

Fields:

- `id`
- `booking_id`
- `assigned_to`
- `assigned_by`
- `assigned_at`
- `status`
- timestamps

## 2. `booking_review_tasks`

Checklist and clarification tasks.

Fields:

- `id`
- `booking_id`
- `task_type`
- `label`
- `status`
- `assigned_to`
- `completed_by`
- `completed_at`
- `customer_visible`
- `customer_response`
- timestamps

## 3. `payment_events`

Local payment lifecycle events.

Fields:

- `id`
- `payment_id`
- `booking_id`
- `event_type`
- `source`
- `provider_reference`
- `metadata`
- timestamps

## 4. `refund_cases`

Refund workflow records.

Fields:

- `id`
- `booking_id`
- `payment_id`
- `amount`
- `non_refundable_amount`
- `reason`
- `status`
- `requested_by`
- `approved_by`
- `provider_refund_id`
- `provider_response`
- timestamps

## 5. `event_preparation_tasks`

Internal event prep checklist.

Fields:

- `id`
- `booking_id`
- `department`
- `label`
- `status`
- `due_at`
- `assigned_to`
- `completed_at`
- timestamps

## 6. `feedback_requests` And `feedback_responses`

Post-event feedback.

Fields:

- request token
- booking/customer links
- sent/completed/expired state
- rating fields
- notes
- testimonial permission

## 7. `staff_activity_metrics`

Optional derived metrics table or view.

Tracks:

- response time
- booking review time
- payment verification time
- unresolved task counts

## Staff Role Responsibilities

## Admin

Should own:

- system configuration
- user/staff accounts
- final overrides
- reports and analytics
- audit review
- high-value refund approval
- business rule changes

Should not be the only owner of:

- every booking review
- every payment
- every message

## Marketing

Should own:

- booking intake
- customer communication
- food tasting coordination
- event details and logistics coordination
- announcements/content
- package/menu customer presentation
- feedback follow-up

Should not own:

- final payment verification
- refunds
- sensitive accounting changes

## Accounting

Should own:

- payment verification
- PayMongo reconciliation
- overdue payment follow-up
- ledger
- refunds
- payment reminders

Should not own:

- event package/menu decisions
- customer-facing marketing content
- event logistics except payment clearance

## Customer

Should be able to:

- build and submit booking
- pay milestones
- update allowed details
- answer staff clarification requests
- schedule/respond to tasting
- chat with staff
- see refund/payment status
- give feedback after event

Should not be able to:

- set final authoritative totals
- mark payments verified
- alter locked event details without staff review
- access other customers' bookings/messages

## Implementation Roadmap

## Phase 1: Make The Workflow Explicit

1. Add booking statuses for review and customer clarification.
2. Add booking assignment/claiming.
3. Add Marketing Booking Intake Queue.
4. Add booking review checklist.
5. Add customer clarification request/response.
6. Update customer dashboard with clear next actions.

## Phase 2: Strengthen Accounting Operations

1. Add Accounting Today queue.
2. Add payment exception states.
3. Add PayMongo reconciliation view.
4. Remove or repurpose manual client payment verification.
5. Add scheduled payment reminders.
6. Add refund case records.

## Phase 3: Add Event Preparation Workflow

1. Add Event Preparation Board.
2. Add internal prep task checklist.
3. Add menu/headcount/payment lock milestones.
4. Add event sheet export.
5. Add event completion status.

## Phase 4: Close The Loop After The Event

1. Add post-event feedback request.
2. Add feedback dashboard.
3. Add low-rating alerts.
4. Add testimonial approval.
5. Add repeat customer tracking.

## Phase 5: Simplify And Remove Noise

1. Remove duplicate messaging paths if chat is the official support channel.
2. Hide advanced setup from daily work.
3. Archive demo-only or outdated UI/data.
4. Convert broad dashboards into role-specific task queues.
5. Add role-specific reports.

## UI, UX, Layout, And Consistency Suggestions

## Core UI/UX Verdict

The system has improved visually, especially in the booking wizard, but the interfaces still need a stronger shared design language across customer, admin, marketing, and accounting.

The most important rule should be:

If two elements do the same kind of job, they should look and behave the same way, even if they appear in different dashboards.

This matters because users build confidence through recognition. If a filter, status, table, modal, payment row, booking card, or action button changes style depending on the page, users have to re-learn the interface every time. That adds stress and makes staff slower.

## Shared Element Consistency Rules

## 1. Buttons

Use consistent button roles everywhere.

Primary button:

- Used for the main action on the screen.
- Deep red background.
- White text.
- Examples:
  - Continue
  - Submit Booking
  - Approve Booking
  - Verify Payment
  - Save Report
  - Publish Announcement

Secondary button:

- Used for safe alternate actions.
- White or ivory background.
- Thin red or slate border.
- Examples:
  - Back
  - Cancel
  - Edit Details
  - View Booking
  - Download

Destructive button:

- Used for delete, reject, cancel, archive, or refund actions.
- Should not look like the primary button unless confirmation is already shown.
- Prefer red text or muted red border before final confirmation.

Avoid:

- Different red shades for the same action type.
- Large glowing buttons.
- Gradient buttons.
- Too many buttons with equal visual weight.
- Icon-only buttons unless the icon is very familiar and has a tooltip.

## 2. Forms

All forms should follow one structure:

1. Field label.
2. Input.
3. Helper text or error text only when needed.

Rules:

- Labels should be above inputs.
- Required fields should be marked consistently.
- Error text should be plain and helpful.
- Optional fields should be clearly marked but not over-emphasized.
- Similar inputs should use the same height, border, radius, and focus state.

Customer forms should use warmer, more guided language.

Staff forms should use direct operational language.

Example:

- Customer: "Where should our team prepare for your event?"
- Staff: "Venue Address"

## 3. Modals

All modals should share the same structure:

1. Short title.
2. One-sentence explanation.
3. Main content.
4. Footer actions.

Rules:

- Use modals for confirmation, review, focused edits, and short workflows.
- Do not use modals for large tables or long multi-step work.
- Success modals should clearly say what happened and what the next action is.
- Error modals should explain what failed in plain language and avoid raw validation wording when possible.

Shared modal types:

- Review modal
- Confirmation modal
- Success modal
- Error modal
- Edit details modal

## 4. Status Labels

Status labels should be consistent across customer and staff views.

Recommended status language:

- Draft
- Submitted
- Under Review
- Needs Details
- Approved
- Payment Due
- Partially Paid
- Paid
- Preparing
- Completed
- Cancelled
- Refunded

Rules:

- Do not show different words for the same status in different interfaces.
- Customer-facing labels should be plain and reassuring.
- Staff-facing labels can be more operational but should still match the same meaning.

Example:

- Customer: "We need a few details"
- Staff: "Needs Details"

## 5. Tables And Lists

Staff pages should use tables or queue lists for repeated work, not many separate cards.

Use tables for:

- payments
- ledger
- customers
- users
- bookings
- reports
- refunds

Use queue lists for:

- booking intake
- payment verification
- refund cases
- customer messages
- event preparation tasks

Rules:

- Money values align right.
- Dates use one format.
- Status appears near the item it describes.
- Main action should be easy to find on each row.
- Search and filters should be at the top of the list.
- Pagination or load-more should appear where records can grow.

## 6. Filters

Filters should look and behave the same across analytics, reports, bookings, payments, and messages.

Recommended pattern:

- Search input first.
- Then dropdown filters.
- Then date range.
- Then reset button.

Rules:

- Known values should use dropdowns, not free-text inputs.
- Long dropdowns should be searchable.
- Filters should show active state clearly.
- The reset action should be visible but secondary.

Avoid:

- Filters scattered across the page.
- Raw technical field names.
- Different filter placement per dashboard.

## 7. Cards

Cards should be used carefully.

Use cards for:

- booking package choices
- individual customer-facing choices
- small summary metrics
- modal content
- repeated compact records on mobile

Do not use cards for:

- every section of a staff dashboard
- large tables
- nested content
- page-level layout containers inside other card containers

Staff interfaces should feel more like workspaces, not card galleries.

## 8. Navigation

Navigation should be based on user intent, not database objects.

Customer navigation should answer:

- What can I do next?
- Where is my booking?
- How do I pay?
- How do I message staff?

Marketing navigation should answer:

- What bookings need review?
- Who needs a reply?
- What events are coming up?
- What content needs publishing?

Accounting navigation should answer:

- What payments need action?
- What is overdue?
- What refunds need processing?
- What does the ledger show?

Admin navigation should answer:

- What needs attention across the business?
- What is the business performance?
- What needs configuration or approval?

Recommended navigation layout:

- Customer: simple top navigation plus dashboard next-action panel.
- Admin: persistent sidebar grouped by Daily Work, Business Insight, Management.
- Marketing: workspace navigation focused on Today, Booking Review, Calendar, Messages, Content.
- Accounting: workspace navigation focused on Today, Payment Verification, Ledger, Refunds, Reports.

## 9. Next-Action Design

Every major interface should show the next most important action.

Customer dashboard:

- Pay next milestone.
- Answer staff request.
- Confirm tasting.
- Review updated event details.

Marketing:

- Review new booking.
- Reply to customer.
- Confirm tasting.
- Prepare upcoming event.

Accounting:

- Verify payment.
- Follow up overdue balance.
- Process refund.
- Check PayMongo mismatch.

Admin:

- Review overdue operations.
- Check high-priority alerts.
- Review reports.
- Approve sensitive changes.

This reduces stress because users do not have to scan the whole system to know what matters.

## 10. Empty States

Empty states should be useful and calm.

Bad:

- "No data found."

Better:

- "No payments need verification right now."
- "No bookings are waiting for review."
- "No announcements are scheduled."

If possible, include a useful next action:

- "Create announcement"
- "Reset filters"
- "View all bookings"

## 11. Loading States

Loading should feel predictable.

Rules:

- Use skeleton rows for tables.
- Use simple loading text for smaller panels.
- Avoid full-page spinners when only one section is loading.
- Keep previous data visible during background refresh when safe.

This is especially important for:

- chat
- analytics
- reports
- booking details
- customer dashboard

## 12. Consistent Language

Avoid technical or system language in user-facing UI.

Replace:

- "payload"
- "visibility flag"
- "milestone"
- "tranche"
- "record"
- "resource"
- "provider"
- "checkout session"

With:

- "details"
- "where it appears"
- "payment step"
- "payment schedule"
- "booking"
- "PayMongo payment"
- "checkout"

Staff can see more operational detail, but it should still be understandable.

## Interface-Specific UI/UX Suggestions

## Customer Interfaces

### Booking Wizard

Keep:

- conversational steps
- whole-page layout
- collapsible booking summary
- final review modal

Improve:

- Keep summary behavior consistent on every step.
- Use the same card style for all customer choices.
- Make selected states visual, not only text labels.
- Reduce repeated helper text.
- Keep customer language reassuring.
- Add "saved just now" draft feedback.

### Customer Dashboard

Add:

- next-action panel at the top
- payment/action urgency
- staff request panel if clarification is needed
- clear refund status if cancellation/refund happens
- tasting status if selected

Reduce:

- long static explanations
- too many separate cards with equal weight
- repeated event details across sections

## Marketing Interface

Improve:

- Start on a Today / Intake Queue view.
- Use a split view:
  - left: bookings/messages needing action
  - right: selected booking details
- Make booking approval and clarification request actions obvious.
- Keep calendar as a planning tool, not the main daily work surface.
- Put content/announcement tools in a calm editor layout.

Reduce:

- settings mixed into daily marketing work
- duplicated booking summaries
- card-heavy booking lists

## Accounting Interface

Improve:

- Start on Accounting Today.
- Use queue layout for payment verification.
- Show PayMongo reference and local payment status together.
- Use right-aligned money columns.
- Add payment exception state.
- Add refund case timeline.

Reduce:

- unclear paid/remaining display
- manual hunting through bookings
- giant cards for financial records

## Admin Interface

Improve:

- Keep Admin as overview and control, not a duplicate of every staff job.
- Show alerts and cross-role bottlenecks.
- Keep reports and analytics action-oriented.
- Separate configuration from daily work.

Reduce:

- too many dashboard charts on overview
- repeated role workflows already owned by Marketing or Accounting
- advanced setup visible too prominently

## Cross-Interface Component Plan

Create or standardize these shared components:

- `PrimaryButton`
- `SecondaryButton`
- `DangerButton`
- `StatusText`
- `StatusSelect`
- `SearchInput`
- `SearchableSelect`
- `FilterBar`
- `DataTable`
- `QueueList`
- `PageHeader`
- `SectionHeader`
- `MetricStrip`
- `EmptyState`
- `LoadingRows`
- `ReviewModal`
- `ConfirmModal`
- `SuccessModal`
- `ErrorModal`
- `NextActionPanel`
- `Timeline`

These components should support variants:

- customer
- staff
- compact
- modal

But they should not become completely different designs.

## Layout Rules To Reduce Stress

1. One page should have one main purpose.
2. One screen should have one primary action.
3. Important information should be visible before advanced details.
4. Repeated records should use tables or queues.
5. Long details should open in a drawer/modal.
6. Staff dashboards should start with work that needs action.
7. Customer dashboards should start with what the customer should do next.
8. Use progressive disclosure for advanced controls.
9. Keep controls in predictable places.
10. Avoid making users scroll just to find the main action.

## Best UI/UX Next Step

The best next UI/UX improvement is to build a shared **Next Action + Queue pattern** and apply it to:

1. Customer dashboard
2. Marketing booking intake
3. Accounting payment verification
4. Admin overview

Reason:

- It solves navigation stress.
- It makes every role know what to do first.
- It creates consistency across different interfaces.
- It directly supports the business process instead of only improving appearance.

## Best Next Development Step

The best next feature to implement is the **Booking Intake Queue with assignment, review checklist, and customer clarification requests**.

Reason:

- It directly connects the customer booking wizard to staff work.
- It prevents new bookings from becoming passive records.
- It gives Marketing a real daily workflow.
- It creates the foundation for event preparation, payment follow-up, and reporting.

Recommended first version:

1. Add review statuses to bookings.
2. Add assigned staff field or `booking_assignments`.
3. Create Marketing "Today" / "Booking Intake" queue.
4. Add review checklist UI in booking detail.
5. Add "request details from customer" action.
6. Show requested details as a next action on the customer dashboard.

## Final Recommendation

The customer-facing process is now strong enough that the next major improvement should be staff operations, not more customer UI polish.

The system should behave like a relay:

- Customer submits event plan.
- Marketing reviews and owns the relationship.
- Accounting owns money movement.
- Operations prepares the event.
- Admin supervises, configures, and analyzes.
- Customer receives clear next actions at every stage.

Once these handoffs are explicit, the site will feel much closer to a real business operations platform instead of a set of separate dashboards.
