# Eloquente Brand Consistency Guide

## Brand Feel
- Eloquente should feel warm, polished, calm, and capable.
- Customer pages may feel more expressive and welcoming; staff pages should feel like a modern operations console.
- Use restrained maroon and gold as accents, not as heavy backgrounds everywhere.

## Core Visual Rules
- Primary maroon: `#720101`.
- Deep maroon: `#5a0101`.
- Gold accent: `#9f6500` for labels and small highlights.
- Warm workspace: `#f7f4ee`, `#fbf8f2`, and white surfaces.
- Use 8-12px radii for operational UI. Avoid oversized rounded panels except profile/avatar imagery.
- Use minimal shadows. Prefer borders and surface contrast.
- Typography should be compact and scannable: clear headings, short labels, strong table hierarchy.

## Staff Console Rules
- Every staff page follows: page header, priority metrics or actions, filters, main work surface, drawer/detail panel.
- Tables are default for queues and review work. Drawers are default for deep details and editing.
- Avoid long all-in-one pages. Group work by purpose and reveal detail only when needed.
- Use staff-friendly language: guests, payment review, payment issues, date changes, staff note.
- Do not show internal terms such as payload, slug, webhook, provider, endpoint, API, or database ID unless a staff workflow truly requires it.

## Loading States
- Use skeleton-first loading for staff interfaces.
- Use table skeletons for queues, metric skeletons for dashboards, and panel skeletons for analytics.
- Loading animation should use a warm neutral shimmer with restrained maroon accents. Avoid gold-heavy shimmer and large generic spinners.
- Preserve page structure while loading to reduce perceived wait time and layout jumps.
- Preserve existing rows during silent refreshes where possible so staff do not lose context while filters or background updates run.

## Role Tab Names
- Marketing: `Today`, `Booking Reviews`, `Guest Inquiries`, `Event Calendar`, `Event Preparation`, `Messages`, `Date Availability`, `Event Documents`, `Announcements`, `Menu & Packages`.
- Accounting: `Today`, `Payment Review`, `Payment Ledger`, `Payment Issues`, `Refund Queue`.
- Admin: `Overview`, `Bookings`, `Event Preparation`, `Refund Queue`, `Analytics`, `Reports`, `Announcements`, `Date Availability`, `People`, `Business Setup`, `Activity Log`.
- Keep tab names role-readable. Prefer `Date Availability` over plain `Availability` where the screen controls calendar dates.

## Admin Analytics
- Overview is for today’s owner priorities and operational action.
- Analytics is for deeper understanding: Revenue, Booking Pipeline, Payments, Menu Demand, Operations, and Forecasts.
- Each insight section should show a plain-language takeaway, one primary chart/table, and one next action.
- Advanced filters belong in a compact panel or drawer, not spread across every card.
- Overview should load lightweight summary data first. Deeper analytics sections should load only when Analytics is opened.

## Performance Rules
- Do not fetch every heavy tab dataset when opening a staff dashboard.
- Use server-backed pagination/filtering for operational queues such as bookings, people, activity logs, and preparation handoffs.
- Keep broad `per_page=100` fetches only for small catalog/reference data where staff need full dropdown choices.
- Debounce search inputs and prevent stale responses from replacing newer results.

## Email Rules
- All emails use the same brand shell: warm background, white card, maroon header, gold kicker, clear CTA, and quiet footer.
- Email copy should be customer-friendly and action-oriented.
- Use `PHP` for currency in email text.
- Avoid internal/system words in customer emails.
- Keep OTP codes prominent and readable.

## Approved Copy Patterns
- Primary action: `View booking`, `Continue booking`, `Review payment`, `Open message`.
- Empty state: `No records match these filters.`
- Loading: `Preparing your workspace...`, `Loading records...`, `Refreshing insights...`
- Status language: `Needs review`, `Ready`, `Closed`, `Limited`, `Paid`, `Payment issue`.
