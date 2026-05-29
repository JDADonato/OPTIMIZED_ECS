# Backend Surface Audit

This audit tracks backend capabilities that need a visible UI, an explicit API-only reason, or a safe deprecation path.

## Newly Surfaced

- Accounting reconciliation: `/api/accounting/reconciliation` already powered a JSX view but was not reachable from the Accounting sidebar. It is now a first-class `Reconciliation` tab.
- Food tasting staff queue: `/api/marketing/food-tastings` and `/api/marketing/food-tastings/{tasting}` now have a staff queue component used by Marketing and Admin.
- Payment rules: `SettingsController::paymentRules` and `SettingsController::updatePaymentRules` now have Admin routes and an Admin settings panel.

## Intentionally API-Only

- `/webhook/paymongo`: provider webhook endpoint; no UI should post directly to it.
- `/api/conversion-events`: browser/customer-flow telemetry endpoint; surfaced through analytics instead of direct CRUD.
- `/api/session/csrf-token`: auth support endpoint; not user-facing.
- Document export routes under `/documents/*`: front-facing download actions, not standalone pages.

## Retired Surfaces

- `/api/messages/*`: retired with `410 Gone`. Current staff/customer messaging must use `/api/chat/*`, which enforces current ownership, deactivation, moderation, unread count, and archival policy.

## Intentional Destructive Exceptions

- Notification deletion is user-level dismissal only; it does not remove business records.
- Chat message deletion is soft deletion through `deleted_at`, preserving moderation/audit context.
- Calendar availability delete means clearing an override for that date; booking records remain intact.
- Announcement deletion is limited to draft/scheduled records. Published announcements should be archived.
- Avatar file deletion/replacement is user-local disposable media cleanup; profile identity and audit-relevant account records remain.
- Password reset token deletion after use or expiry is credential hygiene, not business-record deletion.
- Demo seeder cleanup may physically delete only local/demo-domain generated records and must stay disabled outside local/demo use.
- Catalog records such as menu items and event types should be archived/deactivated, not physically deleted.
- Generated payment schedule rows are voided with `payment_term_voided` events when recalculated or removed from Accounting terms; payment rows with money movement, provider IDs, uploaded proof, refund cases, or events are preserved as active records for review.

## Performance Follow-Up

- Keep public catalog/menu/package/event type endpoints cacheable.
- Prefer paginated list endpoints for staff workspaces.
- Profile real production-like data before adding more indexes; existing migrations already include many booking, payment, message, and analytics indexes.
