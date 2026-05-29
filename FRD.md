# Functional Requirements Document

Project: Eloquente Catering Event Catering System
Date: 2026-05-26
Prepared for: Development team, project evaluators, and business stakeholders

## 1. Document Purpose

This Functional Requirements Document defines the required behavior of the Eloquente Catering Event Catering System.

It describes what the system must do for:

- customers
- marketing staff
- accounting staff
- administrators
- public visitors

It also describes major workflows, user roles, functional modules, integrations, and expected business rules.

## 2. System Overview

The Eloquente Catering Event Catering System is a web-based catering management platform for handling customer inquiries, event bookings, menu/package selection, payment scheduling, PayMongo checkout, payment verification, refunds, food tasting requests, announcements, chat support, reports, analytics, and staff operations.

The system is intended to support the full business workflow:

1. A customer discovers the business through public marketing pages.
2. The customer creates an account or signs in.
3. The customer builds a catering event plan through a guided booking process.
4. Marketing reviews and approves the booking.
5. The customer pays required payment steps through PayMongo.
6. Accounting verifies payments, monitors collections, and handles refunds.
7. Marketing/Admin monitor event status and customer communication.
8. Admin manages staff, configuration, reports, analytics, and oversight.

## 2.1 Current Completion Status

This FRD reflects the codebase after the Phase 4-7 implementation and QA package committed on 2026-05-26.

Current assessed status:

```text
Overall system completion: 90.6 / 100
Functional FRD completion: 93.2 / 100
Production readiness: 86.5 / 100
Automated verification confidence: 90.0 / 100
Demo readiness: 96.0 / 100
```

Status summary:

- Phases 1-3 are complete locally: payment safety, security hardening, CSRF/throttling/upload hardening, and demo seeder protection are implemented and covered by tests.
- Phase 4 is complete locally: high-risk automated tests now cover PayMongo webhook handling, checkout safety, refunds, role access, reports, announcements, security, operations, and seeder behavior.
- Phase 5 is complete locally: customer and staff status wording is centralized and applied across key dashboards and payment return pages.
- Phase 6 is substantially complete locally: accounting refund queue behavior, operations handoff, food tasting staff workflow, and feedback review/testimonial workflow are implemented and tested.
- Phase 7 is locally ready: backend tests, production build, route listing, cache generation, and deployment documentation passed local QA.
- Final launch readiness still depends on staging or production-like verification of external services: PayMongo, mail, queue workers, Reverb/WebSocket, HTTPS cookies, storage, backups, monitoring, and manual role smoke tests.

## 3. Goals And Objectives

## 3.1 Business Goals

- Reduce booking abandonment by making event booking easier and more guided.
- Give customers a clear view of their booking, payments, tasting, and next actions.
- Give staff a structured way to review and approve bookings.
- Reduce missed handoffs between Marketing, Accounting, and Admin.
- Support online payment processing through PayMongo.
- Give the business useful reports and analytics based on real system data.
- Allow business staff to manage menu items, packages, event types, announcements, and user accounts.

## 3.2 System Goals

- Provide secure role-based access.
- Preserve booking, payment, and communication records.
- Keep customer-facing language clear and non-technical.
- Keep staff-facing workflows operational and action-oriented.
- Support production-ready growth through organized data, clear workflows, and scalable interfaces.

## 4. User Roles

## 4.1 Public Visitor

A public visitor can browse the website without logging in.

Main actions:

- View home page.
- View about page.
- View amenities page.
- View menu page.
- View contact page.
- View public announcements.
- Start registration or login.
- Submit a public food tasting request if allowed.

## 4.2 Customer / Client

A customer is a registered user who can create and manage catering bookings.

Main actions:

- Register and sign in.
- Create a booking.
- Select event type, date, time, guest count, package, menu, venue, and tasting preference.
- Review booking before submission.
- View booking dashboard.
- Pay required payment steps.
- Respond to staff clarification requests.
- Schedule or manage food tasting.
- Chat with staff.
- View notifications.
- Cancel or update eligible bookings.

## 4.3 Marketing Staff

Marketing staff handle customer-facing booking review, communication, event coordination, menu/package management, and announcements.

Main actions:

- View booking intake queue.
- Claim bookings.
- Review booking details.
- Mark review checklist tasks.
- Request missing details from customers.
- Approve, cancel, or update booking status.
- Update event live status.
- Coordinate food tasting requests.
- Manage event types and packages where allowed.
- Manage announcements/CMS content where allowed.
- Communicate with customers through chat.

## 4.4 Accounting Staff

Accounting staff handle payments, payment verification, ledgers, reminders, payment term updates, and refunds.

Main actions:

- View bookings with payment schedules.
- View pending payments.
- Verify or reject staff-reviewed payments.
- Edit payment terms where allowed.
- View ledger.
- Send payment reminders.
- View refund queue.
- Process eligible refunds through PayMongo where possible.

## 4.5 Administrator

Admin users supervise the whole system and have the broadest access.

Main actions:

- Manage staff accounts.
- Manage customer accounts.
- View all bookings.
- Approve or update bookings.
- Apply discounts.
- Manage menu items, packages, event types, and pricing.
- Manage announcements.
- View analytics.
- Build and export reports.
- View audit logs.
- Process or supervise refunds.
- Configure business settings.
- Manage own profile.

## 5. Public Website Requirements

## FR-PUB-001: Home Page

The system shall display a public home page that introduces Eloquente Catering and directs users to booking, menu, amenities, and contact pages.

Acceptance criteria:

- Public users can access the home page without login.
- Main calls to action are visible.
- Announcements or relevant updates may be displayed.

## FR-PUB-002: Menu Page

The system shall display available dishes and menu categories to public users and customers.

Acceptance criteria:

- Menu items are grouped by category.
- Menu data is loaded from stored menu records.
- Menu display should not show hidden or unavailable items.

## FR-PUB-003: Amenities Page

The system shall display catering amenities and setup inclusions.

Acceptance criteria:

- Amenities are readable and customer-friendly.
- The page links users toward booking or inquiries.

## FR-PUB-004: Contact Page

The system shall display business contact information and guidance for reaching staff.

Acceptance criteria:

- Users can find contact channels.
- Active customers are encouraged to use dashboard chat for booking-related concerns.

## FR-PUB-005: Public Announcements

The system shall show active public announcements.

Acceptance criteria:

- Only published announcements are visible publicly.
- Archived or draft announcements are not visible publicly.

## 6. Authentication And Profile Requirements

## FR-AUTH-001: Registration

The system shall allow customers to create an account.

Acceptance criteria:

- User must provide required account details.
- Duplicate username/email rules must be enforced.
- Password must meet minimum requirements.
- User is assigned the correct customer role.

## FR-AUTH-002: Login

The system shall allow registered users to sign in.

Acceptance criteria:

- Valid users can access the correct dashboard based on role.
- Invalid credentials show a safe error message.
- The UI updates after login without requiring manual reload.

## FR-AUTH-003: Logout

The system shall allow authenticated users to log out.

Acceptance criteria:

- Session is invalidated.
- User is redirected away from protected pages.

## FR-AUTH-004: Profile Management

The system shall allow users to update their profile information.

Acceptance criteria:

- Users can update permitted profile fields.
- Password changes require validation.
- Unauthorized users cannot update another user's profile.

## 7. Customer Booking Requirements

## FR-BOOK-001: Start Booking

The system shall allow customers to start a guided booking process.

Acceptance criteria:

- Booking process is accessible from the public/customer navigation.
- Customer is guided step by step.
- Booking draft information is preserved during the session where possible.

## FR-BOOK-002: Select Event Type

The system shall allow the customer to select an event type.

Acceptance criteria:

- Event types are loaded from configured records.
- Selecting an event type updates related package/setup information.
- Customer sees included setup information in a readable way.

## FR-BOOK-003: Select Date And Time

The system shall allow the customer to select an event date, start time, and service duration.

Acceptance criteria:

- Date availability is checked.
- Disabled or fully booked dates cannot be selected.
- Lead time rules are enforced.
- Customer sees simple availability wording.

## FR-BOOK-004: Enter Guest Count

The system shall allow the customer to enter estimated guest count and optional dietary notes.

Acceptance criteria:

- Minimum guest count rules are enforced.
- Guest count updates pricing estimates.
- Dietary notes are optional.

## FR-BOOK-005: Choose Package Method

The system shall require the customer to choose one package/menu starting method:

- build around a budget
- curated packages
- build my menu

Acceptance criteria:

- Customer must choose one option.
- Each option explains what the customer will do next.
- Build-my-menu users are guided through each dish category.

## FR-BOOK-006: Select Curated Package

The system shall allow customers to select from curated packages based on event type.

Acceptance criteria:

- Packages match the selected event type.
- Package cards show package name, description, per-head price, dish count, and estimated total.
- Package options are centered when only a few are available.
- Customer may still review or adjust dishes after selecting a package.

## FR-BOOK-007: Build Menu

The system shall allow customers to choose dishes by category.

Acceptance criteria:

- Dishes are grouped by menu category.
- Search, filtering, sorting, and pagination are available.
- Selected dishes are visually clear.
- Add/remove actions are visible and consistent.
- Price per head and estimated total are shown clearly.
- Required category minimums are enforced.

## FR-BOOK-008: Budget-Based Menu

The system shall allow customers to generate a menu based on a target budget.

Acceptance criteria:

- The system must not promise that a budget covers every category unless the generated menu can actually satisfy that.
- If the budget is too low, the customer receives a clear message.
- Generated menu can be reviewed and adjusted.

## FR-BOOK-009: Contact And Venue Details

The system shall collect customer contact and venue information.

Acceptance criteria:

- Required customer name, email, phone, and venue details are collected.
- Metro Manila and outside Metro Manila service rules are reflected.
- High-rise or difficult venue access fees are reflected where applicable.
- Explanations are clear and not overly technical.

## FR-BOOK-010: Food Tasting Preference

The system shall allow customers to request a food tasting or submit without tasting.

Acceptance criteria:

- Schedule tasting is selected/opened by default where configured.
- Customer may enter tasting guest name, contact details, preferred date/time, and notes.
- Tasting information is included in the final review.

## FR-BOOK-011: Final Review Modal

The system shall show a final review modal before submitting the booking.

Acceptance criteria:

- Customer sees event details, schedule, guests, menu/package, venue, tasting preference, and estimated total.
- Submit booking action is inside the final review modal.
- Customer can go back to edit before submission.

## FR-BOOK-012: Submit Booking

The system shall create a booking after successful validation.

Acceptance criteria:

- Booking is associated with the authenticated customer.
- Booking receives default review status of `Submitted`.
- Booking receives default Marketing review checklist tasks.
- Payment schedule is generated.
- Customer receives a success message.
- Staff can see the booking in Marketing intake.

## FR-BOOK-013: Booking Updates

The system shall allow eligible booking details/menu updates after submission.

Acceptance criteria:

- Customer can update only allowed fields.
- Locked or cancelled bookings cannot be edited.
- Menu lock rules are enforced near the event date.

## FR-BOOK-014: Booking Cancellation

The system shall allow eligible booking cancellation.

Acceptance criteria:

- Cancellation rules are enforced based on event date and booking timing.
- Cancellation can trigger refund eligibility calculations.
- Cancelled bookings are reflected in staff and customer views.

## 8. Customer Dashboard Requirements

## FR-CDASH-001: Dashboard Overview

The system shall display the customer's active bookings and relevant booking details.

Acceptance criteria:

- Customer can switch between bookings.
- Last selected event and tab are preserved when the site reloads.
- Dashboard shows booking status, schedule, menu, payments, tasting, history, and messages.

## FR-CDASH-002: Customer Next Actions

The system shall show clear next actions.

Acceptance criteria:

- Customer sees when booking is under review.
- Customer sees when payment is due.
- Customer sees staff clarification requests.
- Customer sees tasting status.

## FR-CDASH-003: Respond To Staff Request

The system shall allow customers to respond to staff clarification requests.

Acceptance criteria:

- Customer sees staff request in the dashboard.
- Customer can submit a response.
- Staff can view the response.
- Booking review status updates to `Clarification Received`.

## FR-CDASH-004: Payment Summary

The system shall show payment schedule, total paid, remaining balance, and next payable step.

Acceptance criteria:

- Paid and remaining values calculate correctly.
- Rush booking payment schedules are reflected correctly.
- Customer cannot pay future steps before required earlier steps.

## 9. Payment Requirements

## FR-PAY-001: Payment Schedule Generation

The system shall generate payment steps based on booking timing.

Business rules:

- Standard booking: reservation fee, down payment, final payment.
- Rush booking 1: immediate combined required payment, then final balance.
- Rush booking 2: immediate full payment.

Acceptance criteria:

- Payment amounts total the booking total.
- Payment due dates are generated.
- Payment labels are customer-friendly.

## FR-PAY-002: PayMongo Checkout

The system shall allow customers to pay eligible payment steps through PayMongo checkout.

Acceptance criteria:

- Customer can start checkout only for the next payable step.
- Checkout session is created with correct amount and reference.
- Customer is redirected to PayMongo checkout.
- Success/cancel pages return customer to the system.

## FR-PAY-003: PayMongo Webhook

The system shall process PayMongo payment webhooks.

Acceptance criteria:

- Webhook signature is verified.
- Local payment is matched using PayMongo reference/session data.
- Payment status is updated only when amount and currency match.
- Booking milestone status is updated after successful payment.

## FR-PAY-004: Payment Verification

The system shall allow Accounting to verify or reject pending payments where manual review is required.

Acceptance criteria:

- Only authorized Accounting/Admin users can verify payments.
- Verified payments update booking payment progress.
- Customer is notified of payment status where applicable.

## FR-PAY-005: Manual Payment Safety

The system shall not allow customers to directly mark payments as verified.

Acceptance criteria:

- Customer manual proof, if supported, is stored as pending review.
- Accounting must verify proof before payment is marked paid.
- Legacy direct verification routes must be disabled or restricted.

## 10. Marketing Requirements

## FR-MKT-001: Booking Intake Queue

The system shall provide Marketing with a queue of submitted bookings needing review.

Acceptance criteria:

- Queue shows booking reference, customer, event date, guests, review status, and owner.
- Unassigned bookings are visible.
- Bookings needing customer details are visible.

## FR-MKT-002: Claim Booking

The system shall allow Marketing staff to claim a booking.

Acceptance criteria:

- Booking owner becomes the current staff user.
- Review status moves from `Submitted` to `Under Review`.

## FR-MKT-003: Review Checklist

The system shall provide checklist tasks for booking review.

Acceptance criteria:

- Staff can mark tasks as done or pending.
- Checklist state is saved.
- Checklist supports consistent review before approval.

## FR-MKT-004: Request Customer Details

The system shall allow Marketing to request missing details from the customer.

Acceptance criteria:

- Staff can enter a request message.
- Customer sees the request in the dashboard.
- Booking status changes to `Needs Customer Details`.
- Customer response is stored and shown to staff.

## FR-MKT-005: Approve Or Decline Booking

The system shall allow Marketing/Admin to update booking review and booking status.

Acceptance criteria:

- Approved bookings become eligible for reservation/payment.
- Cancelled/unavailable bookings are marked clearly.
- Customer receives notification.

## FR-MKT-006: Live Event Status

The system shall allow Marketing to update live event status.

Acceptance criteria:

- Staff can update operational status such as preparation/on-the-way/completed.
- Customer and admin views reflect updates where appropriate.

## 11. Food Tasting Requirements

## FR-TASTE-001: Submit Tasting Request

The system shall allow public users or customers to submit a tasting request.

Acceptance criteria:

- Required tasting contact details are collected.
- Preferred date/time and notes are stored.
- Customer can see tasting records in dashboard if logged in.

## FR-TASTE-002: Manage Tasting Request

The system shall allow authenticated customers to view, update, or cancel their tasting requests.

Acceptance criteria:

- Customer can only manage their own tasting records.
- Cancelled tastings are marked as cancelled, not deleted from history where preservation is needed.

## 12. Accounting Requirements

## FR-ACC-001: Payment Verification Tab

The system shall provide Accounting with pending and completed payment filters.

Acceptance criteria:

- Pending payments can be reviewed.
- Completed/verified payments can be viewed.
- Paid and remaining amounts display correctly.

## FR-ACC-002: Ledger

The system shall provide a ledger of payment records.

Acceptance criteria:

- Ledger shows payment date, booking, customer, amount, method, and status.
- Ledger can be filtered or searched.

## FR-ACC-003: Payment Reminders

The system shall allow Accounting to send reminders for unpaid payments.

Acceptance criteria:

- Reminder can only be sent for valid unpaid payment records.
- Customer receives notification/email where configured.

## FR-ACC-004: Payment Term Editing

The system shall allow authorized staff to edit unpaid payment terms.

Acceptance criteria:

- Payment terms must total 100%.
- Paid/verified/refunded terms cannot be modified.
- Booking total must be valid before editing terms.

## FR-ACC-005: Refund Queue

The system shall show cancelled bookings with refundable payments.

Acceptance criteria:

- Refund queue includes cancellation/payment context.
- Refundable and non-refundable amounts are calculated.

## FR-ACC-006: Refund Processing

The system shall process refunds through PayMongo when provider payment IDs are available.

Acceptance criteria:

- Only authorized Accounting/Admin users can process refunds.
- Non-refundable reservation fee rules are applied.
- Local payment records are updated after successful refund.
- Failed PayMongo refunds are reported safely to staff.

## 13. Admin Requirements

## FR-ADM-001: Staff Account Management

The system shall allow Admin to create, update, and delete staff accounts.

Acceptance criteria:

- Admin cannot accidentally modify protected users.
- Staff role assignment is controlled.
- Password updates are validated.

## FR-ADM-002: Customer Account Management

The system shall allow Admin to view and manage customer accounts.

Acceptance criteria:

- Admin can update permitted customer fields.
- Admin can delete customer accounts where allowed.
- Related records are handled according to business/data rules.

## FR-ADM-003: Booking Management

The system shall allow Admin to view and manage bookings.

Acceptance criteria:

- Admin can view booking details, customer, schedule, venue, menu, payments, review status, and assigned staff.
- Admin can approve/update bookings where allowed.
- Admin can apply discounts where allowed.

## FR-ADM-004: Menu Management

The system shall allow Admin to manage menu items.

Acceptance criteria:

- Admin can create, update, delete menu items.
- Menu items include category, name, description, price, image, and availability fields.

## FR-ADM-005: Package And Event Type Management

The system shall allow Admin/Marketing to configure packages and event types.

Acceptance criteria:

- Packages can be created and updated.
- Event types can be created and updated.
- Packages can be associated with event types.
- Customer-facing package/event data updates after configuration changes.

## FR-ADM-006: Pricing Overrides

The system shall allow Admin to update dish pricing overrides.

Acceptance criteria:

- Price must be valid.
- Updated pricing affects relevant booking/menu calculations.

## FR-ADM-007: Audit Logs

The system shall allow Admin to view audit logs.

Acceptance criteria:

- Audit log shows staff actions, method/route where relevant, user, and time.
- Logs can be searched or filtered.

## 14. Announcement CMS Requirements

## FR-CMS-001: Create Announcement

The system shall allow authorized staff to create announcements.

Acceptance criteria:

- Announcement includes title, summary, body, target audience, visibility, schedule, and optional CTA.
- Announcement can be saved as draft.

## FR-CMS-002: Publish Announcement

The system shall allow authorized staff to publish announcements.

Acceptance criteria:

- Published announcement appears to selected audience.
- Public announcements appear on public/customer-facing pages.
- Customer-specific announcements appear in customer dashboard.

## FR-CMS-003: Archive Announcement

The system shall allow authorized staff to archive announcements.

Acceptance criteria:

- Archived announcements no longer appear to customers.
- Archived records remain available to staff.

## FR-CMS-004: Email Announcement

The system shall allow announcements to be sent by email where configured.

Acceptance criteria:

- Staff can configure subject/body or reuse announcement content.
- Test email can be sent.
- Audience selection is respected.

## 15. Chat And Messaging Requirements

## FR-CHAT-001: Customer Chat

The system shall allow customers to start or continue conversations with staff.

Acceptance criteria:

- Customer can send messages.
- Messages are associated with the customer and conversation.
- Customer can attach booking context where available.

## FR-CHAT-002: Staff Chat Inbox

The system shall allow staff to view and manage customer conversations.

Acceptance criteria:

- Staff can view unassigned and assigned conversations.
- Staff can claim, reply, resolve, and transfer conversations.
- Unread counts are shown.

## FR-CHAT-003: Realtime Or Refresh Behavior

The system shall update chat messages without requiring full page reload where possible.

Acceptance criteria:

- Existing messages are cached or retained during modal open/close.
- Chat load states are clear.
- New messages appear after refresh/realtime events.

## 16. Notification Requirements

## FR-NOTIF-001: Notification Bell

The system shall show unread notification count to authenticated users.

Acceptance criteria:

- User can view notifications.
- User can mark one or all notifications as read.

## FR-NOTIF-002: Booking Status Notifications

The system shall notify customers when booking status changes.

Acceptance criteria:

- Confirmation/cancellation/completion updates generate notification records.
- Email may be sent for major events such as booking approval.

## FR-NOTIF-003: Payment Notifications

The system shall notify customers about payment-related changes.

Acceptance criteria:

- Payment approval/reminders can generate notifications.
- Message wording is customer-friendly.

## 17. Reports And Analytics Requirements

## FR-REP-001: Analytics Dashboard

The system shall provide Admin analytics based on booking, payment, customer, menu, and operational data.

Acceptance criteria:

- Analytics show real records, not unlabelled demo data.
- Filters can be applied.
- Blocks provide useful operational insights.

## FR-REP-002: Report Builder

The system shall allow Admin to build reports using reusable report blocks.

Acceptance criteria:

- Admin can choose report blocks.
- Blocks can be added, removed, reordered, and previewed.
- Used blocks are visually distinguishable.
- Report library can be collapsed.

## FR-REP-003: Saved Reports

The system shall allow Admin to save, edit, delete, and load report templates.

Acceptance criteria:

- Template name and description are saved.
- Filters and selected blocks are preserved.
- Staff can edit or delete saved reports.

## FR-REP-004: Report Export

The system shall allow reports to be exported.

Acceptance criteria:

- PDF export is available.
- Spreadsheet export uses readable report wording.
- Export should not include unnecessary technical fields.

## 18. Data Requirements

The system shall store and manage these major data entities:

- users
- bookings
- booking review tasks
- payments
- food tastings
- messages/conversations
- notifications
- menu items
- packages
- event types
- announcements
- report templates
- report runs
- audit logs
- pricing overrides

## 19. Business Rules

## 19.1 Booking Rules

- Customers must be authenticated to submit bookings.
- Booking must belong to the authenticated customer.
- Booking date must satisfy lead-time rules.
- Fully booked dates cannot be selected.
- Guest count must meet minimum requirements.
- Booking total must be calculated server-side or validated against server-side rules.

## 19.2 Payment Rules

- Payment steps must total the booking total.
- Customers should only pay the next eligible payment step.
- Payments must not be marked verified directly by customer action.
- PayMongo webhook must validate signature, amount, and currency before marking paid.
- Accounting/Admin may verify eligible payment records.

## 19.3 Refund Rules

- Reservation fees may be non-refundable.
- Refund eligibility depends on event date proximity and payment status.
- PayMongo refunds require valid PayMongo payment IDs.
- Refund actions must be restricted to Accounting/Admin.

## 19.4 Role Rules

- Customers may only access their own bookings, payments, tastings, and messages.
- Marketing may access booking review and content-related workflows.
- Accounting may access payment/refund workflows.
- Admin may access all administrative workflows.

## 20. Non-Functional Requirements

## NFR-001: Security

- The system must enforce authentication and authorization.
- Sensitive actions must be restricted by role.
- Payment webhook signatures must be verified.
- User-submitted data must be validated.
- Raw technical errors should not be shown to customers.

## NFR-002: Performance

- Public menu/package/event-type data should be cached where safe.
- Dashboards should avoid unnecessary full reloads.
- Chat should avoid reloading all data every time the modal opens.
- Analytics should be query-optimized for production data volume.

## NFR-003: Usability

- Customer-facing UI must use plain language.
- Staff-facing UI must prioritize next actions.
- Similar actions must use consistent buttons, labels, filters, and modals.
- Important workflows should not rely on browser-native prompts/alerts.

## NFR-004: Reliability

- Payment updates must be idempotent where possible.
- Webhook processing must handle duplicate events safely.
- Refund attempts must log failures.
- Critical staff actions should be auditable.

## NFR-005: Maintainability

- Shared UI patterns should be reused across pages.
- Status labels should be centralized.
- Payment and booking business rules should remain in backend services where possible.
- Reports and analytics should avoid duplicated query logic.

## 21. Integrations

## 21.1 PayMongo

The system integrates with PayMongo for:

- checkout session creation
- online payment confirmation
- payment webhook processing
- refund processing where provider IDs are available

## 21.2 Email

The system uses email for:

- OTP/verification where configured
- booking approval notification
- payment reminders
- announcement emails
- future feedback requests

## 22. Current Known Limitations

The following items remain before real production launch:

1. Deploy to a staging or production-like server and verify the real environment configuration.
2. Confirm PayMongo sandbox or live checkout, webhook delivery, signature validation, and refund behavior using configured credentials.
3. Confirm production mail delivery for OTP, password verification, reminders, and announcement emails.
4. Confirm queue workers process queued mail and notification jobs, and failed jobs are visible.
5. Confirm Reverb/WebSocket chat works over HTTPS without browser console errors.
6. Confirm upload storage is linked or configured correctly and does not expose private server paths.
7. Confirm HTTPS session cookies, CSRF behavior, throttling, and role access in the deployed environment.
8. Configure production database backups, restore procedure, monitoring, and rollback procedure.
9. Perform manual smoke testing for public, customer, marketing, accounting, and admin workflows.
10. Review final production content, credentials, and operational procedures with the owner before go-live.

## 23. Acceptance Summary

The system can be considered functionally acceptable for demonstration when:

- customers can register, log in, book, review, and track events
- Marketing can claim, review, request details, and approve bookings
- customers can respond to Marketing requests
- PayMongo checkout works for payment steps
- Accounting can verify payments and process eligible refunds
- Admin can manage users, bookings, content, reports, analytics, and configuration
- reports and analytics load without server errors
- dashboards update without requiring manual reloads for normal actions

The system can be considered production-ready only when:

- staging or production-like smoke testing passes
- PayMongo, mail, queue, Reverb, and storage are verified with real configuration
- production database backups, monitoring, and rollback procedures are in place
- manual role smoke tests pass for Client, Marketing, Accounting, and Admin
- the owner has reviewed production `.env` values, credentials, and launch procedures

## 24. Latest QA Evidence

Latest local QA result before staging handoff:

```text
php artisan test: 61 passed, 324 assertions
npm run build: passed with no Vite large-chunk warning
php artisan route:list --except-vendor: 172 routes
config cache: passed
route cache: passed
view cache: passed
```

The current codebase is considered locally ready for staging deployment. It is not yet fully launch-complete until external services and production operations are verified outside local development.
