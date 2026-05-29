# Eloquente Generated Document Inventory

This inventory tracks every app-generated downloadable document, who owns it, and how it is tested. Document routes should remain stable unless a migration note is added here.

| Document | Owner | Route | Audience | Format | Renderer | Coverage |
| --- | --- | --- | --- | --- | --- | --- |
| Payment receipt | Accounting | `/documents/payments/{payment}/receipt.pdf` | Customer who owns the booking; Admin, Marketing, Accounting | PDF | Dompdf Blade template `pdf.receipt` | `DocumentExportTest` receipt auth/content test |
| Event preparation checklist | Marketing/Admin | `/documents/bookings/{booking}/preparation.pdf` | Admin and Marketing staff | PDF | Dompdf Blade template `pdf.preparation` | `DocumentExportTest` preparation auth/content test |
| Calendar export | Marketing/Admin | `/documents/calendar.pdf` | Admin and Marketing staff | PDF | Dompdf Blade template `pdf.calendar` | `DocumentExportTest` calendar export/date-cap tests |
| Management report | Admin | `/api/admin/report-runs/{run}/export?format=pdf` | Admin staff | PDF | Dompdf Blade template `pdf.report` | `ReportAndAnnouncementTest` report PDF export test |
| Management report spreadsheet | Admin | `/api/admin/report-runs/{run}/export?format=csv` | Admin staff | CSV | Streamed response | `ReportAndAnnouncementTest` report CSV export test |

## PDF Standards

- PDFs use A4 paper, UTF-8 HTML, DejaVu Sans, branded headers, page numbers, and table wrapping.
- Remote PDF assets are disabled by default. Use local app assets only.
- Calendar PDF exports are capped to one year and 500 rows. Report PDFs are capped to 300 lines with a truncation note. Use CSV/spreadsheet exports for large operational review.
- Business documents should be preserved through stable routes and must not depend on records being physically deleted.
