# Thesis Allowance Sections

## Approved Thesis Title

ELOQUENTE CATERING SYSTEM (ECS): A CATERING MANAGEMENT SYSTEM WITH DYNAMIC RULE-BASED AUTOMATION, DECISION SUPPORT, AND PREDICTIVE ANALYTICS FOR REVENUE AND DEMAND FORECASTING

## Brief Rationale

The study is rooted in the need to improve the booking, payment, communication, and decision-making processes of Eloquente Catering Services. Catering operations involve several connected activities, including customer inquiries, event reservations, package and menu selection, payment scheduling, food tasting, logistical coordination, and post-event follow-up. When these activities are handled through separate channels such as social media messages, phone calls, spreadsheets, manual payment records, and informal staff coordination, important information can become fragmented. This fragmentation increases the risk of missed details, delayed follow-ups, inconsistent customer updates, and difficulty in generating reliable business reports.

The operational challenge is not limited to transaction recording. Eloquente Catering Services also needs a way to transform booking and payment history into useful management information. Without a centralized system, management may have limited visibility into which packages or event types perform best, when demand peaks, how much revenue can be expected, and how many guests may need to be served in future periods. This makes planning for staffing, purchasing, customer coordination, and payment collection more reactive than strategic.

The Eloquente Catering System (ECS) addresses these needs by functioning as a web-based catering management platform with transaction processing, rule-based workflow automation, decision support, and predictive analytics. The implemented system centralizes public customer pages, a guided booking wizard, menu and package selection, food tasting requests, customer dashboards, PayMongo Checkout payments, digital receipts, staff dashboards, report generation, realtime Reverb-backed chat, feedback workflows, audit logs, and role-based management tools. These modules support the approved objective of creating a decision support and catering management system while reflecting the current revised state of the application.

The system also strengthens the analytics direction of the study. The Admin analytics module implements the required Frequency Distribution, Simple Linear Regression, and Simple Moving Average methods. Sales Frequency Distribution supports descriptive analysis of package/category demand. Simple Linear Regression, implemented through Ordinary Least Squares, supports revenue forecasting. Simple Moving Average supports pax demand projection. A Peak Season Cross-Tabulation Heatmap further supports decision-making by showing event type/category demand across months. These analytics allow management to move from scattered historical records to more organized, measurable, and data-informed planning.

Overall, ECS is intended to reduce manual bottlenecks, improve customer visibility, strengthen staff coordination, secure role-based access to business data, automate payment and receipt workflows, and provide management with descriptive and predictive analytics for business growth. The system remains aligned with the approved title by combining dynamic rule-based automation, decision support, and predictive analytics within a catering management platform.

## Objectives

### General Objectives

The general objective of this study is to design and develop a decision support and catering management system for Eloquente Catering Services, integrating descriptive and predictive analytics to streamline booking operations and provide data-driven strategic insights for business growth.

### Specific Objectives

a. To identify the operational bottlenecks in the current manual processes of Eloquente Catering Services and establish the technical requirements for an automated transaction and analytics platform.

b. To create a web-based portal featuring automated conflict checking, package customization, and a rule-based budget recommender to enhance the customer reservation experience.

c. To integrate a live chat module and status tracking system that facilitates direct, seamless communication between customers and marketing staff for specific event requests and logistical updates.

d. To integrate Role-Based Access Control (RBAC) to ensure data integrity and secure payment gateway to automate the 10/70/20 payment structure and generation of digital receipts.

e. To develop an analytics dashboard, which uses Frequency Distribution to perform descriptive sales analysis, Simple Linear Regression and Simple Moving Average to predict revenue and service demand respectively.

f. To evaluate the system in alpha and beta testing according to the characteristics of the international ISO/IEC 25010 standard to guarantee the technical quality and deployment of the software.

## Methodology

### Requirement Analysis

The requirement analysis defines the operational, technical, schedule, and economic feasibility of the Eloquente Catering System. The system requirements are based on the approved objectives and the revised current state of the application. The main requirement is to provide a centralized web-based platform that can support customer reservations, rule-based booking workflows, staff coordination, secure payments, realtime communication, reporting, and decision-support analytics.

The system is organized into the following core functional modules.

#### a. Customer Reservation and Booking Portal

The customer-facing module supports the approved objective of creating a web-based portal for the reservation experience. It includes public pages for business discovery, menu browsing, amenities, contact, booking, and food tasting. The booking wizard guides customers through the current seven-step process: Vision/Event Type, Date, Guests, Packages, Menu, Details, and Tasting. This supports package customization and menu decision-making while keeping the booking process structured and easier to complete.

The current implementation submits the booking as a request for staff review rather than treating booking submission as instant final approval. This aligns the system with the real operational workflow, where Marketing reviews event feasibility, customer details, date availability, package selections, and service requirements before the customer proceeds through later dashboard actions.

#### b. Dynamic Rule-Based Automation and Decision Support

The system includes rule-based mechanisms that support booking validation, package/menu behavior, pricing rules, payment terms, and business constraints. The Smart Budget Menu supports the approved rule-based budget recommender objective by helping customers build a menu within a stated budget and package/category limits. The implemented behavior follows a deterministic fit-within-budget approach: it first secures required category coverage using lower-cost dishes, then adds suitable dishes while staying within budget.

Business rules also support configurable payment terms and rush-event recalculation. Although the approved objective refers to automating the 10/70/20 payment structure, the revised system implements this in a more flexible way by using configurable rules that can default to 10/70/20 while still supporting adjusted schedules for rush or special cases.

#### c. Marketing and Operational Coordination

The Marketing workflow supports the approved objective of improving communication, status tracking, and reservation handling. Marketing users can manage booking intake, assisted bookings, booking review, assignments, claims, transfers, clarification requests, customer coordination, availability overrides, food tasting queues, feedback queues, event handoff, preparation tasks, public content, and messages.

This module replaces fragmented manual coordination with a structured staff workspace. It allows staff to monitor booking progress, manage operational requirements, coordinate with customers, and prepare events using centralized records.

#### d. Accounting, Payment, and Digital Receipt Workflow

The Accounting workflow supports the approved objective of integrating a secure payment gateway and digital receipt generation. The current system uses PayMongo Checkout and webhook handling for online payments. Customers proceed to secure checkout from the customer dashboard when payment is applicable, and payment records are tracked through the system. Accounting users can monitor pending payments, overdue balances, payment exceptions, provider references, reconciliation, refunds, voided payments, ledger history, and receipt records.

Digital receipt and document workflows are supported through Dompdf-based PDF generation. Implemented exports include payment receipts, preparation documents, calendar documents, and admin report outputs. This strengthens financial traceability and supports more reliable bookkeeping compared with manual payment monitoring alone.

#### e. Role-Based Access Control and Security

The system uses role-based access to separate Client, Marketing, Accounting, and Admin workflows. This supports the approved RBAC objective by ensuring that users access only the dashboards and operations appropriate to their role. The current system uses Laravel session authentication, CSRF-protected requests, role middleware and authorization, OTP/password controls, account lifecycle actions, staff audit logs, and Supabase PostgreSQL security practices.

Admin users manage accounts, roles, temporary password actions, system settings, pricing/catalog settings, payment rules, audit records, analytics, reports, and cross-role oversight. This ensures that sensitive business data, payment records, and staff actions are managed through controlled access.

#### f. Realtime Chat and Status Tracking

The communication module supports the approved objective of providing live chat and status tracking. The current system uses Laravel Reverb and Laravel Echo for realtime messaging through private conversation channels. It supports customer-staff conversations, staff queue handling, conversation claim/reopen/transfer actions, collaborators, internal notes, optimistic message reconciliation, and local cache/delta sync behavior.

Status tracking is provided through customer and staff dashboards. Customers can view booking review states, payment status, receipts, food tasting status, messages, feedback, and booking history. Staff can view booking intake, event preparation, payment status, refunds, tasting queues, feedback queues, and operational alerts.

#### g. Analytics Dashboard

The analytics module directly supports the approved objective of using Frequency Distribution, Simple Linear Regression, and Simple Moving Average for descriptive and predictive analytics. The current Admin analytics dashboard includes:

- Sales Frequency Distribution for descriptive sales analysis, showing frequency, percentage share, and revenue contribution.
- Revenue Forecasting using Simple Linear Regression through the Ordinary Least Squares method.
- Pax Demand Projection using Simple Moving Average for service demand forecasting.
- Peak Season Cross-Tabulation Heatmap for event type/category demand by month.

The analytics workspace includes filters, visual charts, method metadata, interpretation text, and insufficient-data states when historical data is not enough for responsible forecasting. This supports data-driven strategic insights for business growth while keeping the approved analytics intact.

### Project Development Model

The study follows the Agile Scrum methodology because the system contains several connected workflows that require iterative development and revision. These workflows include booking, menu selection, payment, staff review, realtime chat, food tasting, feedback, analytics, reports, account management, and operational preparation.

Agile Scrum allows the researchers to divide the project into manageable development cycles. Each cycle may include requirement review, interface design, backend implementation, frontend implementation, database updates, testing, adviser consultation, and revision. The Product Owner role represents business and academic requirements, the Scrum Master guides development workflow, and the Development Team, composed of the researchers, implements the technical components of the system.

This iterative model is appropriate because the paper and system must remain aligned as the actual implementation evolves. Features such as the current seven-step booking process, PayMongo payment flow, Reverb chat, configurable payment rules, and Admin analytics workspace are documented based on the revised implemented system.

### Model Evaluation

The system evaluation phase assesses whether ECS satisfies its functional requirements and technical quality expectations. The evaluation follows alpha and beta testing and uses ISO/IEC 25010 quality characteristics, as stated in the approved objectives.

#### ISO/IEC 25010 Quality Model Evaluation

The researchers will evaluate the system using the following ISO/IEC 25010 characteristics:

- Functional Suitability: Determines whether ECS provides the required booking, package customization, payment, live chat, status tracking, RBAC, receipt generation, reports, and analytics functions.
- Usability: Measures whether Clients, Marketing, Accounting, and Admin users can navigate the system, complete tasks, interpret dashboards, and understand booking and payment states.
- Reliability: Assesses whether booking submission, payment updates, realtime chat, staff workflows, reports, and analytics operate consistently without loss of important records.
- Performance Efficiency: Measures whether public pages, booking steps, menu lists, dashboards, charts, chat, and reports load and respond within acceptable time.
- Security: Evaluates whether authentication, CSRF protection, role-based authorization, account controls, audit logs, payment handling, and customer data protection are properly implemented.
- Compatibility: Checks whether the system works across common browsers and responsive screen sizes used by customers and staff.
- Maintainability: Assesses whether the Laravel, React/Inertia, Supabase PostgreSQL, Vite, Reverb, PayMongo, and modular component structure can be updated as business rules and workflows change.
- Portability: Evaluates whether the system can be configured and deployed across local and shared testing environments using the documented Laravel server, Vite assets, queue worker, Reverb server, Supabase PostgreSQL database, and PayMongo webhook setup.

## Source Alignment Notes

- The title and objectives above are kept from `C:/Users/John Darev/Downloads/LATEST_REVISIONS_4FRONT_CHAPS 1-3.pdf`.
- `C:/Users/John Darev/Downloads/Copy of DOST Thesis Allowance.pdf` was used only as a structure reference for arranging Brief Rationale, Objectives, and Methodology.
- Current system alignment comes from the implemented repository and revision notes, especially `README.md`, `routes/web.php`, `resources/js/Pages/client/BookingWizard.jsx`, `resources/js/Pages/client/ClientDashboard.jsx`, `resources/js/Components/client/MenuBuilder.jsx`, `app/Services/AdminReportService.php`, `app/Services/PaymentCalculationService.php`, `app/Http/Controllers/ChatController.php`, `app/Events/MessageSent.php`, `resources/js/utils/chatMessageStore.js`, `revisions.md`, and `revisions.tex`.
