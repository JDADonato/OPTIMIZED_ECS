# To Add After `newsuggestionsplan.md`

Created: 2026-05-25

## Purpose

This document lists recommended improvements to consider **after** the workflow, handoff, staff queue, and UI/UX consistency work in `newsuggestionsplan.md` is implemented.

The ideas here are not the immediate foundation. They are the next level of maturity once the main customer-to-staff process is already reliable.

## Priority 1: Customer Retention And Relationship Building

## 1. Customer Profiles With Event History

Add richer customer profiles that show:

- past events
- upcoming events
- total amount spent
- favorite packages or dishes
- dietary preferences
- common venue/location
- feedback history
- staff notes

Reason:

Once bookings and staff workflows are stable, the business can give returning customers a more personal experience.

Implementation:

1. Add a customer profile detail page for staff.
2. Pull booking, payment, feedback, and message history into one view.
3. Add internal notes with audit history.
4. Highlight returning customer status during booking review.

## 2. Repeat Customer Offers

Add simple retention tools:

- birthday or anniversary offers
- repeat booking discounts
- thank-you promos after completed events
- seasonal campaign targeting

Reason:

The system should not only process bookings. It should help the business get repeat customers.

Implementation:

1. Add customer tags.
2. Add audience filters in the announcement CMS.
3. Add promo code or discount rule support.
4. Track campaign-to-booking conversion.

## 3. Customer Saved Preferences

Allow customers to reuse:

- contact details
- usual venue
- dietary notes
- preferred service time
- favorite menu items

Reason:

Returning customers should not need to repeat everything.

Implementation:

1. Save preference snapshots after completed bookings.
2. Offer "Use details from my last event" in the booking wizard.
3. Let customers edit saved preferences in their dashboard.

## Priority 2: Better Operations Planning

## 1. Staff And Crew Scheduling

Add internal scheduling for waitstaff, kitchen team, delivery/setup team, and coordinators.

Reason:

Once the system knows upcoming confirmed events, it can help the business plan manpower.

Implementation:

1. Add staff availability records.
2. Add event crew assignment.
3. Add role requirements based on pax, package, and venue type.
4. Show staffing gaps on the event preparation board.

## 2. Equipment And Amenities Inventory

Track physical items such as:

- tables
- chairs
- linens
- chafing dishes
- dinnerware
- glassware
- decor sets
- buffet equipment

Reason:

Amenities are part of the catering promise. The business needs to avoid overcommitting equipment.

Implementation:

1. Add inventory items and quantities.
2. Link packages/event types to required equipment.
3. Reserve equipment per confirmed booking.
4. Show conflicts or shortages before approval.

## 3. Kitchen Production Planning

Add kitchen preparation planning based on selected menus and guest count.

Reason:

Menu selection should eventually feed preparation work, not only customer pricing.

Implementation:

1. Create a production sheet per event.
2. Group menu items by category and kitchen station.
3. Calculate servings based on pax.
4. Export prep sheets for kitchen staff.

## 4. Delivery And Route Planning

Add location-based planning for event delivery and setup.

Reason:

Outside Metro Manila, high-rise venues, and multiple events on the same day affect logistics.

Implementation:

1. Store normalized venue coordinates when possible.
2. Add route notes and estimated travel time.
3. Show same-day event map/list.
4. Add transport assignment and call time.

## Priority 3: Advanced Financial Controls

## 1. Invoices And Official Receipts

Add formal invoice and receipt generation.

Reason:

For real business use, customers and accounting staff may need downloadable documents beyond payment summaries.

Implementation:

1. Add invoice number generation.
2. Generate invoice PDF from booking/payment data.
3. Generate receipt PDF after verified payment.
4. Add invoice/receipt download from customer and accounting dashboards.

## 2. Tax And VAT Reporting

Add clearer VAT/tax reporting tools.

Reason:

The system already deals with pricing notes like VAT. Accounting needs reportable totals.

Implementation:

1. Store tax breakdown snapshots per booking/payment.
2. Add VAT summary report.
3. Add export for accounting use.
4. Keep historical tax values even if business rules change.

## 3. Expense Tracking

Track event-related expenses:

- ingredients
- staff cost
- transport
- rental/equipment
- miscellaneous adjustments

Reason:

Revenue reports are useful, but profit and margin reports are more useful once operations mature.

Implementation:

1. Add expense categories.
2. Link expenses to booking or date range.
3. Add gross margin report by event type/package.

## 4. Approval Rules For Discounts And Adjustments

Add approval workflows for:

- large discounts
- manual payment edits
- refunds above threshold
- pricing overrides

Reason:

As the business grows, not every staff member should be allowed to make sensitive financial changes alone.

Implementation:

1. Define approval thresholds.
2. Add approval request records.
3. Notify Admin for approval.
4. Audit every approval decision.

## Priority 4: Advanced Customer Experience

## 1. Customer Event Timeline

Show customers a simple event timeline:

- booking submitted
- staff review
- reservation payment
- tasting
- down payment
- menu lock
- final payment
- event day
- feedback

Reason:

Customers feel less anxious when they know what will happen next.

Implementation:

1. Map booking/payment/tasting/status events into a timeline.
2. Show completed, current, and upcoming steps.
3. Link each step to the relevant action.

## 2. Package Comparison Tool

Let customers compare packages side by side.

Reason:

Package selection can be stressful. Comparison reduces confusion.

Implementation:

1. Add compare mode in package selection.
2. Show price/head, included dishes, amenities, setup, and best-for notes.
3. Allow selecting directly from comparison.

## 3. Event Inspiration Board

Let customers upload or save inspirations:

- theme references
- colors
- setup photos
- peg images
- notes

Reason:

For weddings, debuts, birthdays, and corporate events, visual preference matters.

Implementation:

1. Add customer inspiration uploads with strict file validation.
2. Show inspiration board to Marketing during booking review.
3. Allow staff notes beside each inspiration item.

## 4. Customer Self-Service Changes

Allow controlled customer edits before lock deadlines:

- guest count update
- contact update
- venue update
- dietary notes
- tasting reschedule request

Reason:

This reduces staff workload while keeping business rules safe.

Implementation:

1. Define edit windows and locked fields.
2. Route risky edits to staff review.
3. Recalculate pricing when needed.
4. Notify staff of important changes.

## Priority 5: Advanced Analytics And Decision Support

## 1. Booking Conversion Funnel

Track:

- visitors who start booking
- step drop-off
- package selection rate
- menu completion rate
- submitted bookings
- approved bookings
- paid reservations

Reason:

This helps identify where customers abandon the process.

Implementation:

1. Add booking analytics events.
2. Store anonymized session/draft events.
3. Build funnel report.
4. Compare conversion by device, event type, and package.

## 2. Demand Forecasting

Add clearly labeled estimates for future demand.

Reason:

Once enough real data exists, forecasting can support staffing, inventory, and promos.

Implementation:

1. Require enough historical data before showing forecasts.
2. Label all projections as estimates.
3. Forecast bookings, pax, revenue pipeline, and busy dates.
4. Never mix projections with actual collected revenue.

## 3. Menu Profitability

Analyze dishes not only by popularity but by margin.

Reason:

Popular dishes are not always profitable. This helps package design.

Implementation:

1. Add ingredient or estimated cost per dish.
2. Compare selections, revenue, and margin.
3. Flag low-margin popular items.
4. Support package recommendations using profitability.

## 4. Staff Performance Metrics

Track operational metrics carefully:

- average booking response time
- payment verification time
- unresolved messages
- booking approval delay
- customer satisfaction by handled booking

Reason:

This helps management improve operations, but it should be used fairly and not as a punitive tool.

Implementation:

1. Track timestamps for key actions.
2. Build team-level metrics first.
3. Add individual metrics only if the business wants it.
4. Keep context visible so numbers are not misleading.

## Priority 6: Integrations

## 1. Calendar Integration

Allow confirmed events and tastings to sync to:

- Google Calendar
- Outlook Calendar

Reason:

Staff may already use external calendars.

Implementation:

1. Add calendar export links first.
2. Later add two-way calendar integration if needed.

## 2. SMS Notifications

Add SMS for important reminders:

- payment due
- tasting confirmation
- event final confirmation
- urgent staff request

Reason:

Customers may miss email. SMS is better for urgent reminders.

Implementation:

1. Choose SMS provider.
2. Add opt-in consent.
3. Send only high-value notifications.
4. Track delivery status.

## 3. Accounting Software Export

Export data for bookkeeping tools.

Reason:

The business may not want to use the system as its only accounting source.

Implementation:

1. Add CSV export formats for sales, collections, refunds, VAT, and receivables.
2. Later support specific tools if requested.

## 4. Map And Address Validation

Use address autocomplete and map validation.

Reason:

Venue location affects logistics fees and travel planning.

Implementation:

1. Add address autocomplete.
2. Normalize city and coordinates.
3. Calculate distance/zone rules more reliably.

## Priority 7: Governance, Privacy, And Long-Term Reliability

## 1. Data Retention Rules

Define how long to keep:

- chat messages
- uploaded documents
- payment proof
- feedback
- audit logs
- inactive accounts

Reason:

Real customer data should not be kept forever without a reason.

Implementation:

1. Define retention policy with the business.
2. Add archive/delete jobs.
3. Keep audit/legal records as required.

## 2. Staff Permission Matrix

Create a clear permission matrix for each role.

Reason:

As features grow, role boundaries need to be explicit.

Implementation:

1. Document each action by role.
2. Add policies/gates.
3. Add tests for every sensitive action.

## 3. Change Approval For Business Rules

Require approval or warnings when changing:

- package prices
- payment rules
- capacity
- cancellation/refund rules
- service fees

Reason:

These affect customer bookings and revenue.

Implementation:

1. Show impact preview before saving.
2. Store old and new values.
3. Require Admin confirmation for high-impact changes.

## 4. Staging Environment

Set up a staging environment separate from production.

Reason:

Payment, email, and booking changes should be tested before real users see them.

Implementation:

1. Create staging app/database.
2. Use PayMongo test keys.
3. Use test mail provider.
4. Add deployment checklist.

## Recommended Order After `newsuggestionsplan.md`

1. Customer profiles and event history.
2. Event preparation board extensions: crew, inventory, kitchen sheets.
3. Invoices, receipts, and tax reporting.
4. Post-event feedback and retention campaigns.
5. Booking conversion analytics.
6. Calendar/SMS integrations.
7. Expense and profitability tracking.
8. Governance, permissions, and data retention.

## What Not To Add Too Early

Avoid adding these before the core workflow is stable:

- complex AI recommendations
- full ERP-style inventory
- payroll
- public customer marketplace features
- advanced forecast dashboards
- two-way external integrations
- overly detailed staff performance scoring

Reason:

These can make the system feel impressive but harder to finish. The business needs reliable booking, payment, staff handoff, event preparation, and reporting first.

## Final Recommendation

After `newsuggestionsplan.md`, the system should move from **workflow reliability** to **business growth and operational intelligence**.

The best next theme is:

Turn completed bookings into long-term customer relationships, better staff planning, clearer financial records, and smarter business decisions.
