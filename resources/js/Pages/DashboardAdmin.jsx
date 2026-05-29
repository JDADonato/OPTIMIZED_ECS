import React, { Suspense, lazy, useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { router } from '@inertiajs/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line } from '../Components/charts/LazyRecharts';
import { CalendarDays, CheckCircle2, ChevronDown, ClipboardList, CreditCard, Filter, Loader2, Maximize2, Package, RefreshCw, Users, X } from 'lucide-react';
import useCachedJson from '../hooks/useCachedJson';
import useSmartRefresh from '../hooks/useSmartRefresh';
import useStaffWorkspaceState from '../hooks/useStaffWorkspaceState';
import ConfirmModal from '../Components/common/ConfirmModal';
import SmartImage from '../Components/common/SmartImage';
import StaffSkeleton, { StaffWorkspaceSkeleton } from '../Components/staff/StaffSkeleton';
import StaffWorkspaceLayout from '../Layouts/StaffWorkspaceLayout';
import { AdminCommandStrip, AdminPageSurface, AdminResponsiveTable, AdminSurfaceSection } from '../Components/admin/AdminSurface';
import StaffPageHeader from '../Components/staff/StaffPageHeader';
import StaffEmptyState from '../Components/staff/StaffEmptyState';
import EventHistoryPanel from '../Components/staff/EventHistoryPanel';
import NextActionPanel from '../Components/staff/NextActionPanel';
import RoleSettingsPanel from '../Components/staff/RoleSettingsPanel';
import AssistedBookingWizard from '../Components/marketing/AssistedBookingWizard';
import { getListData } from '../utils/apiResponses';
import csrfFetch from '../utils/csrf';
import { fetchSmartResource, getUserScopedCacheKey, readSmartCache } from '../utils/smartResource';
import { operationalChannelsForUser } from '../utils/liveChannels';
import {
    formatBookingRef,
    formatCurrency,
    formatDate,
    formatDateTime,
    formatFullAddress,
    formatTime,
    getBookingTotal,
    getErrorMessage,
    getSelectedDishes,
    normalizeStatus,
    paginate,
} from '../utils/dashboardUtils';
import { paymentTypeLabel, staffPaymentStatus } from '../utils/statusLabels';

const AnnouncementManager = lazy(() => import('../Components/content/AnnouncementManager'));
const PaymentTermEditorModal = lazy(() => import('../Components/finance/PaymentTermEditorModal'));
const PreparationBoard = lazy(() => import('../Components/operations/PreparationBoard'));
const StaffMessaging = lazy(() => import('../Components/common/StaffMessaging'));
const FoodTastingQueue = lazy(() => import('../Components/operations/FoodTastingQueue'));

const paymentLabel = paymentTypeLabel;

const PACKAGE_CATEGORY_OPTIONS = [
    { value: 'premium', label: 'Weddings & Debuts' },
    { value: 'birthday', label: 'Birthdays' },
    { value: 'standard', label: 'Standard Events' },
];

const SECURITY_OPTIONS = [
    { value: 'contingency', label: '10% Contingency' },
    { value: 'cash_bond', label: 'Php 1,500 Cash Bond' },
];

const FORECAST_PERIOD_OPTIONS = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
];

const SMA_WINDOW_OPTIONS = [2, 3, 4, 5, 6];
const FORECAST_HORIZON_OPTIONS = [3, 4, 6, 8, 12];
const ANALYTICS_YEARS = [2024, 2025, 2026];
const SNAPSHOT_WINDOW_OPTIONS = [
    { value: 'all', label: 'All time' },
    { value: '3m', label: 'Last 3 months' },
    { value: '6m', label: 'Last 6 months' },
    { value: '12m', label: 'Last 12 months' },
    { value: '24m', label: 'Last 24 months' },
    { value: 'ytd', label: 'Year to date' },
];

const PUBLIC_CONTENT_TABS = [
    ['announcements', 'Announcements'],
    ['packages', 'Packages'],
    ['eventTypes', 'Event Types'],
    ['menuItems', 'Menu Items'],
];

const PUBLIC_CONTENT_META = {
    announcements: {
        kicker: 'Customer updates',
        title: 'Announcements',
        description: 'Draft, schedule, publish, and email customer announcements from one place.',
    },
    packages: {
        kicker: 'Catalog setup',
        title: 'Packages',
        description: 'Manage package presets, pricing, connected event types, and customer-facing details.',
    },
    eventTypes: {
        kicker: 'Catalog setup',
        title: 'Event Types',
        description: 'Manage the event categories used by booking flows and package presets.',
    },
    menuItems: {
        kicker: 'Catalog setup',
        title: 'Menu Items',
        description: 'Review menu items by category and manage custom item records.',
    },
};

const MENU_CATEGORY_OPTIONS = [
    { value: 'all', label: 'All dish types' },
    { value: 'starter', label: 'Starters' },
    { value: 'main', label: 'Mains' },
    { value: 'side', label: 'Sides' },
    { value: 'dessert', label: 'Desserts' },
    { value: 'drink', label: 'Drinks' },
];

const PERFORMANCE_LIMIT_OPTIONS = [5, 8, 10, 15, 20];
const ACCOUNT_ROLE_OPTIONS = [
    { value: 'Marketing', label: 'Marketing', description: 'Booking review, customer communication, event preparation, and feedback follow-up.' },
    { value: 'Accounting', label: 'Accounting', description: 'Payment verification, receipts, refunds, and finance follow-up.' },
    { value: 'Admin', label: 'Admin', description: 'Full console access for trusted owner or operations administrators.' },
];

const DEFAULT_ANALYTICS_FILTERS = {
    trend_months: '6',
    revenue_forecast_period: 'quarterly',
    revenue_forecast_horizon: '4',
    revenue_sma_window: '3',
    pax_projection_period: 'monthly',
    pax_projection_horizon: '6',
    pax_sma_window: '3',
    pax_projection_year: '',
    pax_projection_quarter: '',
    snapshot_window: 'all',
};

const ADMIN_EMPLOYEES_URL = '/api/admin/employees?paginated=1&per_page=25';
const ADMIN_CUSTOMERS_URL = '/api/admin/customers?paginated=1&per_page=25';
const ADMIN_BOOKINGS_URL = '/api/admin/bookings?paginated=1&per_page=25';
const ADMIN_WORKSPACE_TABS = ['today', 'bookings-intake', 'calendar', 'handoff', 'tastings', 'finance', 'messages-inquiries', 'public-content', 'availability', 'accounts', 'settings', 'analytics', 'reports', 'system-audit', 'history'];
const ADMIN_FULL_SURFACE_TABS = ['bookings-intake', 'calendar', 'handoff', 'tastings', 'finance', 'messages-inquiries', 'public-content', 'availability', 'accounts', 'settings', 'system-audit', 'history'];
const ADMIN_TAB_ALIASES = {
    dashboard: 'today',
    overview: 'today',
    bookings: 'bookings-intake',
    intake: 'bookings-intake',
    preparation: 'handoff',
    tasting: 'tastings',
    food: 'tastings',
    'calendar-handoff': 'calendar',
    calendar: 'calendar',
    handoff: 'handoff',
    refunds: 'finance',
    accounting: 'finance',
    ledger: 'finance',
    messages: 'messages-inquiries',
    inquiries: 'messages-inquiries',
    content: 'public-content',
    configuration: 'settings',
    settings: 'settings',
    users: 'accounts',
    people: 'accounts',
    'analytics-reports': 'analytics',
    reports: 'reports',
    analytics: 'analytics',
    audits: 'system-audit',
    system: 'system-audit',
};
const handoffResponsibleArea = (department) => (
    ['Operations', 'Admin', 'Service prep', undefined, null, ''].includes(department) ? 'Service prep' : department
);
const adminEmployeesUrl = (filters = {}) => {
    const params = new URLSearchParams({ paginated: '1', per_page: '100' });
    Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') params.set(key, value);
    });
    return `/api/admin/employees?${params.toString()}`;
};
const adminCustomersUrl = (status = 'active', filters = {}) => {
    const params = new URLSearchParams({ paginated: '1', per_page: '100', status });
    Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') params.set(key, value);
    });
    return `/api/admin/customers?${params.toString()}`;
};

const emptyPackageForm = (defaultType = '') => ({
    name: '',
    type: defaultType,
    package_category: 'standard',
    event_type_slugs: defaultType ? [defaultType] : [],
    base_price_per_head: '',
    minimum_pax: 1,
    description: '',
    inclusions: '',
    amenities: '',
    applicable_setups: '',
    menu_structure: { starter: 1, main: 2, side: 1, dessert: 1, drink: 1 },
    security_type: 'cash_bond',
    security_label: 'Php 1,500 Cash Bond',
});

const emptyEventTypeForm = () => ({
    label: '',
    slug: '',
    icon: 'sparkles',
    description: '',
    image: '',
    package_category: 'standard',
    applicable_setups: '',
    security_type: 'cash_bond',
    security_label: 'Php 1,500 Cash Bond',
    security_description: 'Refundable deposit for broken plates or missing equipment.',
});
const eventDisplayName = (booking) => booking?.event_display_name || booking?.event_name || booking?.event_type || booking?.package_name || (booking?.id ? `Booking #${booking.id}` : 'Eloquente event');

const linesToText = (value) => Array.isArray(value) ? value.join('\n') : (value || '');
const getCategoryLabel = (value) => PACKAGE_CATEGORY_OPTIONS.find(option => option.value === value)?.label || value || 'Standard Events';
const getSecurityLabel = (value) => SECURITY_OPTIONS.find(option => option.value === value)?.label || value || 'Cash Bond';
const formatMonthLabel = (value) => {
    if (!value) return 'Selected month';
    const [year, month] = value.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};
const toMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const getMonthGridDays = (date) => {
    const firstWeekday = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return [
        ...Array.from({ length: firstWeekday }, (_, index) => ({ key: `blank-${index}`, blank: true })),
        ...Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            return { key: dateKey, day, dateKey };
        }),
    ];
};
const shiftMonthValue = (value, offset) => {
    const [year, month] = value.split('-').map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const DashboardAdmin = () => {
    const { user, logout } = useAuth();
    const adminWorkspacePrefs = user?.profile_preferences?.staff_workspace?.admin || {};
    const adminDefaultTab = ADMIN_WORKSPACE_TABS.includes(adminWorkspacePrefs.default_tab) ? adminWorkspacePrefs.default_tab : 'today';
    const [activeTab, setActiveTab] = useStaffWorkspaceState({
        storageKey: 'ecs:staff-workspace:admin',
        defaultTab: adminDefaultTab,
        allowedTabs: ADMIN_WORKSPACE_TABS,
        tabAliases: ADMIN_TAB_ALIASES,
    });
    const liveChannels = useMemo(() => operationalChannelsForUser(user), [user?.id, user?.role]);
    const [profileForm, setProfileForm] = useState({
        username: user?.username || '',
        email: user?.email || '',
        phone: user?.phone || '',
        current_password: '',
        new_password: '',
    });
    const [profileProcessing, setProfileProcessing] = useState(false);
    const [profileErrors, setProfileErrors] = useState({});

    // ==========================================
    // EMPLOYEE MANAGEMENT STATE
    // ==========================================
    const [employees, setEmployees] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [empLoading, setEmpLoading] = useState(false);
    const [customerLoading, setCustomerLoading] = useState(false);
    const [empModal, setEmpModal] = useState({ open: false, mode: 'add', data: null });
    const [temporaryPasswordModal, setTemporaryPasswordModal] = useState({ open: false, userId: null, username: '', email: '', password: '', expiresAt: null, deliveryHint: '', canRevealAgain: false });
    const [empForm, setEmpForm] = useState({ full_name: '', username: '', password: '', role: 'Marketing', email: '', phone: '' });
    const [empFormErrors, setEmpFormErrors] = useState({});
    const [empFormLoading, setEmpFormLoading] = useState(false);

    // ==========================================
    // PRICING CONTROL STATE
    // ==========================================
    const [pricingOverrides, setPricingOverrides] = useState({});
    const [pricingLoading, setPricingLoading] = useState(false);
    const [activeMenuCategory, setActiveMenuCategory] = useState('starter');
    const [activeConfigTab, setActiveConfigTab] = useState('packages');
    const [catalogDrawer, setCatalogDrawer] = useState(null);
    const [packages, setPackages] = useState([]);
    const [eventTypes, setEventTypes] = useState([]);
    const [eventTypeForm, setEventTypeForm] = useState(emptyEventTypeForm());
    const [editingEventTypeId, setEditingEventTypeId] = useState(null);
    const [packageForm, setPackageForm] = useState(emptyPackageForm());
    const [editingPackageId, setEditingPackageId] = useState(null);
    const [packageSaving, setPackageSaving] = useState(false);

    // ==========================================
    // CUSTOM MENU ITEMS STATE
    // ==========================================
    const [customMenuItems, setCustomMenuItems] = useState([]);
    const [menuItemModal, setMenuItemModal] = useState({ open: false, mode: 'add', data: null });
    const [menuItemForm, setMenuItemForm] = useState({
        name: '', category: 'starter', cost_per_head: '', price_adj: '0',
        image: '', description: '', is_best_seller: false
    });
    const [menuItemFormLoading, setMenuItemFormLoading] = useState(false);

    // ==========================================
    // DISCOUNTS STATE
    // ==========================================
    const [bookings, setBookings] = useState([]);
    const [bookingsLoading, setBookingsLoading] = useState(false);
    const [bookingSearch, setBookingSearch] = useState('');
    const [bookingStatusFilter, setBookingStatusFilter] = useState('All');
    const [bookingSourceFilter, setBookingSourceFilter] = useState('all');
    const [bookingSort, setBookingSort] = useState('latest');
    const [adminCalendarMonth, setAdminCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [adminCalendarView, setAdminCalendarView] = useState('month');
    const [adminCalendarSearch, setAdminCalendarSearch] = useState('');
    const [approvingBookingId, setApprovingBookingId] = useState(null);
    const [assistedBookingOpen, setAssistedBookingOpen] = useState(false);
    const [discountModal, setDiscountModal] = useState({ open: false, data: null });
    const [discountForm, setDiscountForm] = useState({ discount_type: 'fixed', discount_value: 0 });
    const [discountLoading, setDiscountLoading] = useState(false);
    const [refundQueue, setRefundQueue] = useState([]);
    const [refundLoading, setRefundLoading] = useState(false);
    const [processingRefundId, setProcessingRefundId] = useState(null);
    const [activeFinanceSegment, setActiveFinanceSegment] = useState('payments');
    const [messageRefreshToken, setMessageRefreshToken] = useState(0);
    const [adminMessageMetrics, setAdminMessageMetrics] = useState({
        open: 0,
        needsAttention: 0,
        unassigned: 0,
        resolvedToday: 0,
    });

    const [eventDetailsModal, setEventDetailsModal] = useState({ open: false, data: null });
    const [editPaymentModal, setEditPaymentModal] = useState({ isOpen: false, payment: null, booking: null });

    // ==========================================
    // ANALYTICS STATE
    // ==========================================
    const [analytics, setAnalytics] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [expandedAnalyticsPanel, setExpandedAnalyticsPanel] = useState(null);
    const [analyticsSlowLoading, setAnalyticsSlowLoading] = useState(false);
    const [analyticsFilters, setAnalyticsFilters] = useState(DEFAULT_ANALYTICS_FILTERS);
    const [activeAnalyticsFilterPanel, setActiveAnalyticsFilterPanel] = useState(null);
    const [packageViewFilters, setPackageViewFilters] = useState({
        limit: '8',
        sort: 'revenue',
        minBookings: '',
    });
    const [menuViewFilters, setMenuViewFilters] = useState({
        category: 'all',
        limit: '10',
        sort: 'selections',
    });
    const [paymentRiskFilters, setPaymentRiskFilters] = useState({
        status: 'all',
        minBalance: '',
    });
    const [workloadFilters, setWorkloadFilters] = useState({
        status: 'all',
        minPax: '',
    });
    const [alertFilters, setAlertFilters] = useState({
        severity: 'all',
    });
    const [activeDashboardFilterPanel, setActiveDashboardFilterPanel] = useState(null);
    const [reportWidgets, setReportWidgets] = useState([]);
    const [reportTemplates, setReportTemplates] = useState([]);
    const [reportExecutiveSummary, setReportExecutiveSummary] = useState(null);
    const [reportTemplateId, setReportTemplateId] = useState('');
    const [reportBuilder, setReportBuilder] = useState({
        name: 'Management Snapshot',
        description: 'Finance, bookings, menu performance, and operational alerts.',
        widgets: ['revenue_summary', 'payment_breakdown', 'booking_pipeline', 'operational_alerts'],
        filters: { date_from: '', date_to: '', booking_status: '', payment_status: '', city: '' },
    });
    const [reportPreview, setReportPreview] = useState([]);
    const [reportView, setReportView] = useState('build');
    const [reportDraggedIndex, setReportDraggedIndex] = useState(null);
    const [reportDraggedWidgetId, setReportDraggedWidgetId] = useState(null);
    const [reportDropIndex, setReportDropIndex] = useState(null);
    const [reportLibraryCollapsed, setReportLibraryCollapsed] = useState(false);
    const [reportLibraryExpanded, setReportLibraryExpanded] = useState(false);
    const [reportSetupOpen, setReportSetupOpen] = useState(false);
    const [reportLibraryDropActive, setReportLibraryDropActive] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportSaving, setReportSaving] = useState(false);
    const reportPreviewTimerRef = useRef(null);
        const [audits, setAudits] = useState([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditSearch, setAuditSearch] = useState('');
    const [auditRoleFilter, setAuditRoleFilter] = useState('All');
    const [auditResultFilter, setAuditResultFilter] = useState('All');
    const [auditWorkspaceFilter, setAuditWorkspaceFilter] = useState('All');
    const [auditActivityFilter, setAuditActivityFilter] = useState('Operational');
    const [availabilityMonth, setAvailabilityMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [availabilityOverrides, setAvailabilityOverrides] = useState([]);
    const [availabilityEvents, setAvailabilityEvents] = useState([]);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);
    const [availabilitySaving, setAvailabilitySaving] = useState(false);
    const [availabilityDate, setAvailabilityDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [availabilityForm, setAvailabilityForm] = useState({ is_locked: false, remaining_events: '', remaining_pax: '', note: '' });

    const analyticsSummary = analytics?.summary || {};
    const revenueTrendData = analytics?.revenueTrends || [];
    const revenueHealth = analytics?.revenueHealth || {};
    const paymentStatusBreakdown = revenueHealth.paymentStatusBreakdown || [];
    const paymentAgingData = analytics?.paymentAging || revenueHealth.paymentAging || [];
    const bookingPipelineData = analytics?.bookingPipeline || [];
    const upcomingWorkloadData = analytics?.upcomingWorkload || analytics?.projectedPaxDemand || [];
    const packagePerformanceData = analytics?.packagePerformance || analytics?.topSellers || [];
    const menuPerformanceData = analytics?.menuPerformance || [];
    const operationsLoadData = analytics?.operationsLoad || [];
    const operationalAlerts = analytics?.operationalAlerts || analytics?.alerts || [];
    const topSellerData = analytics?.topSellers || [];
    const peakSeasonData = analytics?.peakSeasons || [];
    const revenueForecast = analytics?.revenueForecast || {};
    const revenueForecastData = revenueForecast.rows || [];
    const revenueForecastSummary = revenueForecast.summary || {};
    const paxDemandProjection = analytics?.paxDemandProjection || {};
    const paxDemandData = paxDemandProjection.rows || [];
    const paxDemandSummary = paxDemandProjection.summary || {};
    const businessSnapshot = analytics?.businessSnapshot || {};
    const businessSnapshotCards = businessSnapshot.cards || [];
    const conversionFunnel = analytics?.conversionFunnel || analyticsSummary.conversionFunnel || {};
    const analyticsInsights = analytics?.insights || {};
    const analyticsInsightItems = analyticsInsights.items || {};
    const analyticsTakeaways = analyticsInsights.takeaways || [];
    const visiblePackagePerformanceData = useMemo(() => {
        const minBookings = Number(packageViewFilters.minBookings || 0);
        const rows = packagePerformanceData
            .filter(pkg => Number(pkg.count || 0) >= minBookings)
            .sort((a, b) => {
                if (packageViewFilters.sort === 'bookings') return Number(b.count || 0) - Number(a.count || 0);
                if (packageViewFilters.sort === 'name') return String(a.label || a.name || '').localeCompare(String(b.label || b.name || ''));
                return Number(b.revenue || 0) - Number(a.revenue || 0);
            });

        return rows.slice(0, Number(packageViewFilters.limit || 8));
    }, [packagePerformanceData, packageViewFilters]);
    const visibleMenuPerformanceData = useMemo(() => {
        const rows = menuPerformanceData
            .filter(row => menuViewFilters.category === 'all' || row.category === menuViewFilters.category)
            .sort((a, b) => {
                if (menuViewFilters.sort === 'pax') return Number(b.paxServed || 0) - Number(a.paxServed || 0);
                if (menuViewFilters.sort === 'name') return String(a.label || '').localeCompare(String(b.label || ''));
                return Number(b.selections || 0) - Number(a.selections || 0);
            });

        return rows.slice(0, Number(menuViewFilters.limit || 10));
    }, [menuPerformanceData, menuViewFilters]);
    const visiblePaymentStatusBreakdown = useMemo(() => (
        paymentStatusBreakdown.filter(row => paymentRiskFilters.status === 'all' || String(row.label || '').toLowerCase() === paymentRiskFilters.status)
    ), [paymentStatusBreakdown, paymentRiskFilters.status]);
    const visiblePaymentAgingData = useMemo(() => {
        const minBalance = Number(paymentRiskFilters.minBalance || 0);
        return paymentAgingData.filter(bucket => Number(bucket.value || 0) >= minBalance);
    }, [paymentAgingData, paymentRiskFilters.minBalance]);
    const visibleUpcomingWorkloadData = useMemo(() => {
        const minPax = Number(workloadFilters.minPax || 0);
        return upcomingWorkloadData.filter(event => {
            const status = String(event.status || '').toLowerCase();
            const statusMatches = workloadFilters.status === 'all' || status === workloadFilters.status;
            return statusMatches && Number(event.pax || 0) >= minPax;
        });
    }, [upcomingWorkloadData, workloadFilters]);
    const visibleOperationalAlerts = useMemo(() => (
        operationalAlerts.filter(alert => alertFilters.severity === 'all' || alert.severity === alertFilters.severity)
    ), [operationalAlerts, alertFilters.severity]);
    const maxPackageRevenue = Math.max(...visiblePackagePerformanceData.map(pkg => Number(pkg.revenue || 0)), 1);
    const visibleReportWidgetIds = reportBuilder.widgets;
    const reportCanvasOffset = 0;
    const visibleReportLibraryWidgets = reportLibraryExpanded ? reportWidgets : reportWidgets.slice(0, 6);
    const reportBookingStatusOptions = useMemo(() => {
        const statuses = bookings.map(booking => booking.status).filter(Boolean);
        return Array.from(new Set(['Pending', 'Confirmed', 'Completed', 'Cancelled', ...statuses.filter(status => status !== 'Reserved')]));
    }, [bookings]);
    const reportPaymentStatusOptions = useMemo(() => {
        const statuses = bookings.flatMap(booking => (booking.payments || []).map(payment => payment.status)).filter(Boolean);
        return Array.from(new Set(['Pending', 'Paid', 'Verified', 'Refunded', 'Overdue', ...statuses]));
    }, [bookings]);
    const reportCityOptions = useMemo(() => (
        Array.from(new Set(bookings.map(booking => booking.venue_city || booking.city).filter(Boolean))).sort()
    ), [bookings]);

    // Toast notification
    const [toast, setToast] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', confirmText: 'Confirm', tone: 'default', busy: false, onConfirm: null });
    const { bustCache: bustAdminCache, fetchCachedJson } = useCachedJson(['/api/admin/audits?per_page=25']);
    const [packagePage, setPackagePage] = useState(1);
    const [eventTypePage, setEventTypePage] = useState(1);
    const [menuItemPage, setMenuItemPage] = useState(1);
    const [employeePage, setEmployeePage] = useState(1);
    const [customerPage, setCustomerPage] = useState(1);
    const [accountSegment, setAccountSegment] = useState('staff');
    const [customerStatusFilter, setCustomerStatusFilter] = useState('active');
    const [employeeFilters, setEmployeeFilters] = useState({ search: '', role: 'all', account_status: 'all', must_change_password: 'all' });
    const [customerFilters, setCustomerFilters] = useState({ search: '', booking_activity: 'all' });
    const [confirmNotifyCustomer, setConfirmNotifyCustomer] = useState(true);
    const confirmNotifyCustomerRef = useRef(true);
    const [bookingPage, setBookingPage] = useState(1);
    const [auditPage, setAuditPage] = useState(1);
    const rowsPerPage = 8;
    const smartCacheKey = (resourceKey) => getUserScopedCacheKey(user, resourceKey);

    useEffect(() => {
        setProfileForm(prev => ({
            ...prev,
            username: user?.username || '',
            email: user?.email || '',
            phone: user?.phone || '',
        }));
    }, [user?.username, user?.email, user?.phone]);

    useEffect(() => {
        if (!analyticsLoading) {
            setAnalyticsSlowLoading(false);
            return undefined;
        }

        const timer = window.setTimeout(() => setAnalyticsSlowLoading(true), 2500);
        return () => window.clearTimeout(timer);
    }, [analyticsLoading]);

    useEffect(() => {
        if (!expandedAnalyticsPanel) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setExpandedAnalyticsPanel(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [expandedAnalyticsPanel]);

    useEffect(() => {
        setCustomerPage(1);
    }, [customerStatusFilter, customerFilters]);

    useEffect(() => {
        setEmployeePage(1);
    }, [employeeFilters]);

    const handleLogout = () => {
        router.post('/logout');
    };

    const updateProfileField = (field, value) => {
        setProfileForm(prev => ({ ...prev, [field]: value }));
        setProfileErrors(prev => ({ ...prev, [field]: undefined }));
    };

    const submitProfile = (event) => {
        event.preventDefault();
        setProfileProcessing(true);
        router.put('/profile', profileForm, {
            preserveScroll: true,
            onSuccess: () => {
                setProfileForm(prev => ({ ...prev, current_password: '', new_password: '' }));
                setProfileErrors({});
                showToast('Profile updated.');
            },
            onError: (errors) => {
                setProfileErrors(errors || {});
                showToast('Please review the profile fields.', 'error');
            },
            onFinish: () => setProfileProcessing(false),
        });
    };

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        const handleSessionExpired = (event) => {
            showToast(event.detail?.message || 'Your session expired. Refresh the page and try again.', 'error');
        };

        window.addEventListener('ecs:session-expired', handleSessionExpired);
        return () => window.removeEventListener('ecs:session-expired', handleSessionExpired);
    }, []);

    const closeConfirmDialog = () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', confirmText: 'Confirm', tone: 'default', busy: false, onConfirm: null });
    };

    const openTemporaryPasswordModal = (data, fallback = {}) => {
        if (!data?.temporary_password) return;

        setTemporaryPasswordModal({
            open: true,
            userId: data.id || fallback.id || null,
            username: data.username || fallback.username || '',
            email: data.email || fallback.email || '',
            password: data.temporary_password,
            expiresAt: data.temporary_password_expires_at || null,
            deliveryHint: data.email_delivery || (data.email || fallback.email ? 'Email delivery depends on the configured mail queue.' : 'No email address was set, so no invitation email was sent.'),
            canRevealAgain: Boolean(data.id || fallback.id),
        });
    };

    const closeTemporaryPasswordModal = () => {
        setTemporaryPasswordModal({ open: false, userId: null, username: '', email: '', password: '', expiresAt: null, deliveryHint: '', canRevealAgain: false });
    };

    const copyTemporaryPassword = async () => {
        try {
            await navigator.clipboard.writeText(temporaryPasswordModal.password);
            showToast('Temporary password copied.');
        } catch (error) {
            console.error(error);
            showToast('Could not copy password automatically. Select and copy it manually.', 'error');
        }
    };

    const handleRevealTemporaryPassword = (account) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Show temporary password?',
            message: 'This password can only be shown until it expires or the account owner changes it. The reveal will be recorded in the activity log.',
            confirmText: 'Show password',
            tone: 'default',
            onConfirm: () => confirmRevealTemporaryPassword(account),
        });
    };

    const confirmRevealTemporaryPassword = async (account) => {
        closeConfirmDialog();
        try {
            const res = await csrfFetch(`/api/admin/employees/${account.id}/temporary-password/reveal`, {
                method: 'POST',
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                showToast('Temporary password is available until expiry.');
                openTemporaryPasswordModal(data, account);
            } else {
                showToast(getErrorMessage(data, 'Temporary password is no longer available. Reset temporary password to generate a new one.'), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Could not show temporary password. Please try again.', 'error');
        }
    };

    const formatAnalyticsCardValue = (value, format) => {
        if (format === 'currency') return formatCurrency(value || 0);
        if (format === 'percent') return `${Number(value || 0).toLocaleString()}%`;
        return Number(value || 0).toLocaleString();
    };

    const refreshCurrentTab = ({ silent = false } = {}) => {
        if (activeTab === 'accounts') {
            bustAdminCache(ADMIN_EMPLOYEES_URL, ADMIN_CUSTOMERS_URL, adminCustomersUrl('active'), adminCustomersUrl('deactivated'), adminCustomersUrl('all'));
            fetchEmployees({ silent });
            fetchCustomers({ silent });
        } else if (activeTab === 'public-content') {
            bustAdminCache('/api/pricing', '/api/admin/menu-items', '/api/menu-items', '/api/packages?per_page=100', '/api/admin/event-types', '/api/event-types?per_page=100');
            fetchPricingOverrides({ silent });
            fetchCustomMenuItems();
            fetchPackages();
        } else if (activeTab === 'today') {
            bustAdminCache('/api/admin/analytics/summary');
            fetchAnalyticsSummary({ silent });
        } else if (activeTab === 'analytics' || activeTab === 'reports') {
            bustAdminCache('/api/admin/analytics');
            fetchAnalytics({ silent });
            fetchReportBuilder({ silent });
            fetchReportPreview({ silent });
        } else if (activeTab === 'bookings-intake') {
            bustAdminCache(ADMIN_BOOKINGS_URL);
            fetchBookings({ silent });
        } else if (activeTab === 'finance') {
            bustAdminCache('/api/admin/refunds/queue');
            fetchRefundQueue({ silent });
        } else if (activeTab === 'availability') {
            fetchAvailabilityOverrides({ silent });
        } else if (activeTab === 'system-audit') {
            bustAdminCache('/api/admin/audits?per_page=25');
            fetchAudits({ silent });
        }
    };

    const bookingStatusStyles = {
        pending: 'bg-amber-100 text-amber-800 border-amber-200',
        confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };
    const pageMeta = {
        today: {
            eyebrow: 'Daily work',
            title: 'Owner Today',
            description: 'Priority bookings, finance blockers, account issues, and system activity that need attention.',
        },
        analytics: {
            eyebrow: 'Business insight',
            title: 'Analytics',
            description: 'Understand performance signals, chart trends, and owner-level business takeaways.',
        },
        reports: {
            eyebrow: 'Business insight',
            title: 'Reports',
            description: 'Build, preview, and export business-ready summaries with interpretations.',
        },
        profile: {
            eyebrow: 'Admin profile',
            title: 'My Account',
            description: 'Update your admin contact details and password.',
        },
        'public-content': {
            eyebrow: 'Customer-facing setup',
            title: 'Public Content',
            description: 'Manage announcements, packages, event types, menu pricing, and customer-facing previews.',
        },
        availability: {
            eyebrow: 'Calendar control',
            title: 'Availability',
            description: 'Close dates or control remaining event slots and guest capacity.',
        },
        accounts: {
            eyebrow: 'Access control',
            title: 'Account Management',
            description: 'Manage staff access, customer account status, and password recovery actions.',
        },
        settings: {
            eyebrow: 'Owner controls',
            title: 'Settings',
            description: 'Manage workspace preferences, notifications, business profile, and payment rules.',
        },
        'bookings-intake': {
            eyebrow: 'Booking operations',
            title: 'Bookings & Intake',
            description: 'Review, approve, adjust, and create customer bookings without switching accounts.',
        },
        finance: {
            eyebrow: 'Accounting override',
            title: 'Finance',
            description: 'Review payment exposure, process refunds, and open finance records from one place.',
        },
        calendar: {
            eyebrow: 'Event calendar',
            title: 'Calendar',
            description: 'Review confirmed event dates and open event details without handoff clutter.',
        },
        handoff: {
            eyebrow: 'Event handoff',
            title: 'Handoff',
            description: 'Track readiness, blockers, and preparation tasks for upcoming confirmed events.',
        },
        tastings: {
            eyebrow: 'Customer experience',
            title: 'Food Tastings',
            description: 'Manage tasting requests, confirmations, and tasting outcomes.',
        },
        'messages-inquiries': {
            eyebrow: 'Support desk',
            title: 'Messages & Inquiries',
            description: 'Review guest inquiries and route booking-linked communication.',
        },
        'system-audit': {
            eyebrow: 'System control',
            title: 'System & Audit',
            description: 'Monitor delivery health, account/session checks, and staff/admin activity.',
        },
        history: {
            eyebrow: 'Shared history',
            title: 'Event History',
            description: 'Completed events, staff notes, and limited post-event follow-up context.',
        },
    };
    const adminNavGroups = [
        {
            label: 'Owner Workbench',
            items: [
                { id: 'today', label: 'Today' },
                { id: 'bookings-intake', label: 'Bookings & Intake' },
                { id: 'calendar', label: 'Calendar' },
                { id: 'handoff', label: 'Handoff' },
                { id: 'tastings', label: 'Food Tastings' },
                { id: 'finance', label: 'Finance' },
                { id: 'messages-inquiries', label: 'Messages & Inquiries' },
            ],
        },
        {
            label: 'Business Control',
            items: [
                { id: 'public-content', label: 'Public Content' },
                { id: 'availability', label: 'Availability' },
                { id: 'accounts', label: 'Accounts' },
                { id: 'settings', label: 'Settings' },
            ],
        },
        {
            label: 'Insight & Governance',
            items: [
                { id: 'analytics', label: 'Analytics' },
                { id: 'reports', label: 'Reports' },
                { id: 'system-audit', label: 'System & Audit' },
                { id: 'history', label: 'Event History' },
            ],
        },
    ];
    const currentPage = pageMeta[activeTab] || pageMeta.today;
    const bookingStats = useMemo(() => {
        const activeBookings = bookings.filter((booking) => normalizeStatus(booking.status) === 'confirmed');
        const pendingBookings = bookings.filter((booking) => normalizeStatus(booking.status) === 'pending');

        return {
            total: bookings.length,
            pending: pendingBookings.length,
            active: activeBookings.length,
            value: bookings.reduce((sum, booking) => sum + getBookingTotal(booking), 0),
        };
    }, [bookings]);

    const refundStats = useMemo(() => {
        return refundQueue.reduce((stats, item) => {
            const totalPaid = Number(item.total_paid || 0);
            const fee = totalPaid * 0.1;
            stats.count += 1;
            stats.paid += totalPaid;
            stats.fees += fee;
            stats.refundable += Math.max(totalPaid - fee, 0);
            return stats;
        }, { count: 0, paid: 0, fees: 0, refundable: 0 });
    }, [refundQueue]);

    const financeStats = useMemo(() => {
        return bookings.reduce((stats, booking) => {
            const bookingTotal = getBookingTotal(booking);
            const payments = Array.isArray(booking.payments) ? booking.payments : [];
            const paid = payments.reduce((sum, payment) => {
                const status = String(payment.status || '').toLowerCase();
                return ['paid', 'verified'].includes(status) ? sum + Number(payment.amount || 0) : sum;
            }, 0);

            stats.totalExposure += bookingTotal;
            stats.paid += paid;
            stats.remaining += Math.max(bookingTotal - paid, 0);
            stats.pendingPayments += payments.filter(payment => ['pending', 'submitted', 'for review'].includes(String(payment.status || '').toLowerCase())).length;
            stats.overdue += payments.filter(payment => staffPaymentStatus(payment.status, payment.due_date).label.toLowerCase().includes('overdue')).length;
            return stats;
        }, { totalExposure: 0, paid: 0, remaining: 0, pendingPayments: 0, overdue: 0 });
    }, [bookings]);

    const financePaymentRows = useMemo(() => {
        const unsettledStatuses = ['pending', 'submitted', 'for review', 'unverified', 'overdue', 'rejected', 'failed'];

        return bookings.flatMap((booking) => {
            const payments = Array.isArray(booking.payments) ? booking.payments : [];

            return payments.map((payment) => {
                const rawStatus = String(payment.status || '').toLowerCase();
                const readableStatus = staffPaymentStatus(payment.status, payment.due_date).label;
                const readableStatusLower = readableStatus.toLowerCase();
                const isSettled = ['paid', 'verified', 'refunded'].includes(rawStatus) || ['paid', 'verified', 'refunded'].includes(readableStatusLower);
                const isException = ['rejected', 'failed'].includes(rawStatus) || ['rejected', 'failed'].includes(readableStatusLower);
                const isOverdue = rawStatus === 'overdue' || readableStatusLower.includes('overdue');
                const isPending = unsettledStatuses.includes(rawStatus) || readableStatusLower.includes('pending') || readableStatusLower.includes('review');

                if (isSettled || (!isException && !isOverdue && !isPending)) {
                    return null;
                }

                return {
                    booking,
                    payment,
                    statusLabel: readableStatus,
                    queueLabel: isException ? 'Exception' : isOverdue ? 'Overdue' : 'Needs review',
                    priority: isException ? 0 : isOverdue ? 1 : 2,
                    dueTime: payment.due_date ? new Date(payment.due_date).getTime() : Number.MAX_SAFE_INTEGER,
                };
            }).filter(Boolean);
        }).sort((a, b) => a.priority - b.priority || a.dueTime - b.dueTime || Number(b.booking?.id || 0) - Number(a.booking?.id || 0));
    }, [bookings]);

    const upcomingConfirmedEvents = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return bookings
            .filter((booking) => normalizeStatus(booking.status) === 'confirmed' && booking.event_date)
            .filter((booking) => new Date(booking.event_date) >= today)
            .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
            .slice(0, 6);
    }, [bookings]);

    const adminCalendarMonthKey = useMemo(() => toMonthKey(adminCalendarMonth), [adminCalendarMonth]);
    const adminCalendarEvents = useMemo(() => {
        const search = adminCalendarSearch.trim().toLowerCase();

        return bookings
            .filter((booking) => normalizeStatus(booking.status) === 'confirmed' && booking.event_date)
            .filter((booking) => String(booking.event_date).substring(0, 7) === adminCalendarMonthKey)
            .filter((booking) => {
                if (!search) return true;
                return [
                    formatBookingRef(booking.id),
                    eventDisplayName(booking),
                    booking.event_type,
                    booking.client_full_name,
                    booking.client_name,
                    booking.username,
                    booking.client_email,
                    booking.client_phone,
                    booking.venue_name,
                    booking.venue_address,
                ].filter(Boolean).some((value) => String(value).toLowerCase().includes(search));
            })
            .sort((a, b) => `${a.event_date || ''} ${a.event_time || ''}`.localeCompare(`${b.event_date || ''} ${b.event_time || ''}`));
    }, [bookings, adminCalendarMonthKey, adminCalendarSearch]);
    const adminCalendarEventsByDate = useMemo(() => {
        return adminCalendarEvents.reduce((map, booking) => {
            const dateKey = String(booking.event_date || '').substring(0, 10);
            if (!map.has(dateKey)) map.set(dateKey, []);
            map.get(dateKey).push(booking);
            return map;
        }, new Map());
    }, [adminCalendarEvents]);
    const adminCalendarDays = useMemo(() => getMonthGridDays(adminCalendarMonth), [adminCalendarMonth]);
    const changeAdminCalendarMonth = (offset) => {
        setAdminCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
    };

    const adminNextActions = useMemo(() => {
        const failedAudits = audits.filter((audit) => Number(audit.status_code || 0) >= 400).length;
        const blockedStaff = employees.filter((employee) => employee.account_status === 'deactivated' || employee.must_change_password).length;
        const topAlertCount = visibleOperationalAlerts.reduce((sum, alert) => sum + Number(alert.count || 0), 0);

        return [
            {
                id: 'booking-oversight',
                priority: bookingStats.pending > 0 ? 'action' : 'info',
                title: 'Review booking oversight',
                description: bookingStats.pending > 0 ? `${bookingStats.pending} bookings are still awaiting review.` : 'No pending booking requests need admin oversight.',
                badge: bookingStats.pending,
                primaryLabel: 'Open',
                tone: bookingStats.pending > 0 ? 'warn' : 'good',
                onOpen: () => setActiveTab('bookings-intake'),
            },
            {
                id: 'refund-oversight',
                priority: refundQueue.length > 0 ? 'urgent' : 'info',
                title: 'Monitor refund queue',
                description: refundQueue.length > 0 ? `${refundQueue.length} refund cases may need approval or processing.` : 'No refund cases are waiting.',
                badge: refundQueue.length,
                primaryLabel: 'Open',
                tone: refundQueue.length > 0 ? 'danger' : 'good',
                onOpen: () => setActiveTab('finance'),
            },
            {
                id: 'people-accounts',
                priority: blockedStaff > 0 ? 'action' : 'info',
                title: 'Check staff account access',
                description: blockedStaff > 0 ? `${blockedStaff} staff accounts need account-status or password attention.` : 'Staff account access looks clear.',
                badge: blockedStaff,
                primaryLabel: 'Open',
                tone: blockedStaff > 0 ? 'warn' : 'good',
                onOpen: () => setActiveTab('accounts'),
            },
            {
                id: 'system-activity',
                priority: failedAudits > 0 ? 'urgent' : 'info',
                title: 'Inspect activity exceptions',
                description: failedAudits > 0 ? `${failedAudits} recent activity records ended with blocked or failed results.` : 'No failed activity records in the recent log.',
                badge: failedAudits,
                primaryLabel: 'Open',
                tone: failedAudits > 0 ? 'danger' : 'good',
                onOpen: () => setActiveTab('system-audit'),
            },
            {
                id: 'operational-alerts',
                priority: topAlertCount > 0 ? 'followup' : 'info',
                title: 'Review operational alerts',
                description: topAlertCount > 0 ? `${topAlertCount} alert items are showing in the overview.` : 'Operational alerts are quiet for this filter.',
                badge: topAlertCount,
                primaryLabel: 'Review',
                tone: topAlertCount > 0 ? 'warn' : 'good',
                onOpen: () => setActiveTab('today'),
            },
        ];
    }, [audits, bookingStats.pending, employees, refundQueue.length, visibleOperationalAlerts]);

    const visibleBookings = useMemo(() => {
        const query = bookingSearch.trim().toLowerCase();

        return bookings
            .filter((booking) => {
                const status = normalizeStatus(booking.status);
                if (bookingStatusFilter === 'Pending' && status !== 'pending') return false;
                if (bookingStatusFilter === 'Active' && status !== 'confirmed') return false;
                if (bookingSourceFilter !== 'all') {
                    const source = booking.booking_source || 'customer';
                    if (bookingSourceFilter === 'assisted' && !['marketing_assisted', 'admin_assisted'].includes(source)) return false;
                    if (bookingSourceFilter !== 'assisted' && source !== bookingSourceFilter) return false;
                }

                if (!query) return true;

                const searchable = [
                    formatBookingRef(booking.id),
                    booking.client_full_name,
                    booking.client_name,
                    booking.client_email,
                    booking.client_phone,
                    booking.event_type,
                    booking.username,
                    booking.user_email,
                    booking.user_phone,
                ].filter(Boolean).join(' ').toLowerCase();

                return searchable.includes(query);
            })
            .sort((a, b) => {
                if (bookingSort === 'az' || bookingSort === 'za') {
                    const left = String(a.client_full_name || a.client_name || a.username || '').toLowerCase();
                    const right = String(b.client_full_name || b.client_name || b.username || '').toLowerCase();
                    return bookingSort === 'az' ? left.localeCompare(right) : right.localeCompare(left);
                }

                const leftDate = new Date(a.created_at || a.event_date || 0).getTime();
                const rightDate = new Date(b.created_at || b.event_date || 0).getTime();
                return bookingSort === 'oldest' ? leftDate - rightDate : rightDate - leftDate;
            });
    }, [bookings, bookingSearch, bookingStatusFilter, bookingSourceFilter, bookingSort]);

    const getAuditWorkspace = (audit) => {
        const path = String(audit.path || '').toLowerCase();

        if (path.includes('/dashboard/admin') || path.includes('/api/admin')) return 'Admin workspace';
        if (path.includes('/dashboard/marketing') || path.includes('/api/marketing')) return 'Marketing workspace';
        if (path.includes('/dashboard/accounting') || path.includes('/api/accounting')) return 'Accounting workspace';
        if (path.includes('/api/operations')) return 'Event preparation';
        if (path.includes('/api/calendar-availability')) return 'Date availability';
        if (path.includes('/api/settings') || path.includes('/api/menu') || path.includes('/api/packages') || path.includes('/api/event-types')) return 'Business setup';
        if (path.includes('/profile')) return 'Profile';
        if (path.includes('/logout')) return 'Sign out';
        if (path.includes('/login')) return 'Sign in';
        if (path.includes('/dashboard/client') || path.includes('/api/dashboard/client')) return 'Customer dashboard';

        return 'System activity';
    };

    const getAuditResult = (audit) => {
        const statusCode = Number(audit.status_code || 0);

        if (!statusCode || statusCode < 400) {
            return { label: 'Completed', className: 'bg-emerald-50 text-emerald-700' };
        }

        if (statusCode === 401 || statusCode === 403) {
            return { label: 'Access blocked', className: 'bg-amber-50 text-amber-700' };
        }

        if (statusCode === 404) {
            return { label: 'Not found', className: 'bg-amber-50 text-amber-700' };
        }

        return { label: 'Needs review', className: 'bg-red-50 text-red-700' };
    };

    const visibleAudits = useMemo(() => {
        const query = auditSearch.trim().toLowerCase();

        return audits.filter((audit) => {
            if (auditRoleFilter !== 'All' && audit.role !== auditRoleFilter) return false;
            const workspace = getAuditWorkspace(audit);
            const result = getAuditResult(audit).label;
            const actionText = String(audit.action || '').toLowerCase();
            const isSystemAccess = actionText.includes('opened') || actionText.includes('dashboard') || actionText.includes('viewed');

            if (auditWorkspaceFilter !== 'All' && workspace !== auditWorkspaceFilter) return false;
            if (auditResultFilter !== 'All' && result !== auditResultFilter) return false;
            if (auditActivityFilter === 'Operational' && isSystemAccess) return false;
            if (auditActivityFilter === 'System access' && !isSystemAccess) return false;
            if (!query) return true;

            return [
                audit.username,
                audit.role,
                audit.action,
                workspace,
                result,
            ].filter(Boolean).join(' ').toLowerCase().includes(query);
        });
    }, [audits, auditActivityFilter, auditResultFilter, auditRoleFilter, auditSearch, auditWorkspaceFilter]);
    const auditWorkspaceOptions = useMemo(() => Array.from(new Set(audits.map(getAuditWorkspace).filter(Boolean))).sort(), [audits]);
    const auditResultOptions = useMemo(() => Array.from(new Set(audits.map((audit) => getAuditResult(audit).label).filter(Boolean))).sort(), [audits]);
    const selectedAvailabilityEvents = useMemo(() => (
        availabilityEvents.filter((event) => event.date === availabilityDate)
    ), [availabilityEvents, availabilityDate]);
    const availabilityEventCounts = useMemo(() => (
        availabilityEvents.reduce((counts, event) => ({
            ...counts,
            [event.date]: (counts[event.date] || 0) + 1,
        }), {})
    ), [availabilityEvents]);
    const availabilityCalendarDays = useMemo(() => {
        const [year, month] = availabilityMonth.split('-').map(Number);
        const firstWeekday = new Date(year, month - 1, 1).getDay();
        const daysInMonth = new Date(year, month, 0).getDate();
        const blanks = Array.from({ length: firstWeekday }, (_, index) => ({ key: `blank-${index}`, blank: true }));
        const days = Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            return {
                key: date,
                date,
                day,
                eventCount: availabilityEventCounts[date] || 0,
            };
        });

        return [...blanks, ...days];
    }, [availabilityMonth, availabilityEventCounts]);
    const monthlyAvailabilityEventCount = useMemo(() => (
        availabilityEvents.reduce((count, event) => count + (event.date ? 1 : 0), 0)
    ), [availabilityEvents]);

    const paginatedPackages = paginate(packages, packagePage, rowsPerPage);
    const paginatedEventTypes = paginate(eventTypes, eventTypePage, rowsPerPage);
    const paginatedMenuItems = paginate(getMergedDishes(activeMenuCategory), menuItemPage, rowsPerPage);
    const paginatedEmployees = paginate(employees, employeePage, rowsPerPage);
    const paginatedCustomers = paginate(customers, customerPage, rowsPerPage);
    const employeeAccountStats = useMemo(() => ({
        active: employees.filter((employee) => employee.account_status !== 'deactivated').length,
        deactivated: employees.filter((employee) => employee.account_status === 'deactivated').length,
        password: employees.filter((employee) => Boolean(employee.must_change_password)).length,
    }), [employees]);
    const customerAccountStats = useMemo(() => ({
        shown: customers.length,
        active: customers.filter((customer) => customer.account_status !== 'deactivated').length,
        deactivated: customers.filter((customer) => customer.account_status === 'deactivated').length,
        withBookings: customers.filter((customer) => Number(customer.bookings_count || 0) > 0).length,
    }), [customers]);
    const roleBadgeClass = (role) => {
        if (role === 'Admin') return 'border-[#720101]/15 bg-[#720101]/5 text-[#720101]';
        if (role === 'Marketing') return 'border-purple-200 bg-purple-50 text-purple-800';
        return 'border-green-200 bg-green-50 text-green-800';
    };
    const paginatedBookings = paginate(visibleBookings, bookingPage, rowsPerPage);
    const paginatedAudits = paginate(visibleAudits, auditPage, 12);

    const PaginationControls = ({ pageInfo, onPageChange }) => (
        <div className="admin-pagination">
            <span>
                Showing <strong>{pageInfo.start}</strong>-<strong>{pageInfo.end}</strong> of <strong>{pageInfo.total}</strong>
            </span>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    disabled={pageInfo.page <= 1}
                    onClick={() => onPageChange(pageInfo.page - 1)}
                    className="admin-page-btn"
                >
                    Prev
                </button>
                <span className="text-xs font-black text-slate-500">Page {pageInfo.page} / {pageInfo.totalPages}</span>
                <button
                    type="button"
                    disabled={pageInfo.page >= pageInfo.totalPages}
                    onClick={() => onPageChange(pageInfo.page + 1)}
                    className="admin-page-btn"
                >
                    Next
                </button>
            </div>
        </div>
    );

    useEffect(() => {
        if (activeTab === 'accounts') {
            fetchEmployees();
            fetchCustomers();
        } else if (activeTab === 'public-content') {
            fetchPricingOverrides();
            fetchCustomMenuItems();
            fetchPackages();
        } else if (activeTab === 'today') {
            fetchAnalyticsSummary();
        } else if (activeTab === 'analytics' || activeTab === 'reports') {
            if (!packages.length || !eventTypes.length) fetchPackages();
            fetchAnalytics();
            fetchReportBuilder();
            fetchReportPreview();
        } else if (activeTab === 'bookings-intake') {
            fetchBookings();
        } else if (activeTab === 'finance') {
            fetchBookings();
            fetchRefundQueue();
        } else if (activeTab === 'calendar' || activeTab === 'handoff') {
            fetchBookings();
        } else if (activeTab === 'availability') {
            fetchAvailabilityOverrides();
        } else if (activeTab === 'system-audit') {
            fetchAudits();
        }
    }, [activeTab, availabilityMonth, customerStatusFilter, employeeFilters, customerFilters]);

    useSmartRefresh({
        enabled: ['today', 'analytics', 'reports', 'bookings-intake', 'calendar', 'handoff', 'finance', 'accounts', 'public-content', 'availability', 'system-audit'].includes(activeTab),
        interval: activeTab === 'today' || activeTab === 'analytics' || activeTab === 'reports' ? 120000 : 90000,
        idleAfter: 180000,
        channels: liveChannels,
        resources: ['bookings', 'finance', 'payments', 'refunds', 'accounts', 'contact_inquiries', 'food_tastings', 'feedback', 'announcements', 'catalog', 'report_templates', 'reports', 'availability'],
        refresh: refreshCurrentTab,
    });

    useEffect(() => () => {
        if (reportPreviewTimerRef.current) {
            clearTimeout(reportPreviewTimerRef.current);
        }
    }, []);

    useEffect(() => {
        setMenuItemPage(1);
    }, [activeMenuCategory]);

    useEffect(() => {
        setBookingPage(1);
    }, [bookingSearch, bookingStatusFilter, bookingSourceFilter, bookingSort]);

    useEffect(() => {
        setAuditPage(1);
    }, [auditSearch, auditRoleFilter]);

    const fetchAvailabilityOverrides = async ({ silent = false } = {}) => {
        if (!silent) setAvailabilityLoading(true);
        try {
            const response = await fetch(`/api/calendar-availability?month=${availabilityMonth}`, {
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) throw new Error('Availability load failed');
            const data = await response.json();
            setAvailabilityOverrides(getListData(data));
            setAvailabilityEvents(Array.isArray(data.events) ? data.events : []);
        } catch (error) {
            console.error(error);
            showToast('Could not load availability controls', 'error');
        } finally {
            if (!silent) setAvailabilityLoading(false);
        }
    };

    const selectAvailabilityDate = async (date) => {
        setAvailabilityDate(date);
        if (date?.slice(0, 7) && date.slice(0, 7) !== availabilityMonth) {
            setAvailabilityMonth(date.slice(0, 7));
        }
        const existing = availabilityOverrides.find(item => item.date === date);
        if (existing) {
            setAvailabilityForm({
                is_locked: Boolean(existing.is_locked),
                remaining_events: existing.remainingEvents ?? '',
                remaining_pax: existing.remainingPax ?? '',
                note: existing.note || '',
            });
            return;
        }

        setAvailabilityForm({ is_locked: false, remaining_events: '', remaining_pax: '', note: '' });
        try {
            const response = await fetch(`/api/bookings/availability/${date}`, { headers: { Accept: 'application/json' } });
            if (!response.ok) return;
            const data = await response.json();
            setAvailabilityForm({
                is_locked: Boolean(data.isLocked),
                remaining_events: data.remainingEvents ?? '',
                remaining_pax: data.remainingPax ?? '',
                note: '',
            });
        } catch (error) {
            console.error(error);
        }
    };

    const moveAvailabilityMonth = (offset) => {
        const nextMonth = shiftMonthValue(availabilityMonth, offset);
        setAvailabilityMonth(nextMonth);
        selectAvailabilityDate(`${nextMonth}-01`);
    };

    const saveAvailabilityOverride = async (event) => {
        event.preventDefault();
        setAvailabilitySaving(true);
        try {
            const payload = {
                is_locked: availabilityForm.is_locked,
                remaining_events: availabilityForm.remaining_events === '' ? null : Number(availabilityForm.remaining_events),
                remaining_pax: availabilityForm.remaining_pax === '' ? null : Number(availabilityForm.remaining_pax),
                note: availabilityForm.note,
            };
            const response = await fetch(`/api/calendar-availability/${availabilityDate}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error('Save failed');
            showToast('Availability updated.');
            fetchAvailabilityOverrides({ silent: true });
        } catch (error) {
            console.error(error);
            showToast('Could not save availability override', 'error');
        } finally {
            setAvailabilitySaving(false);
        }
    };

    const clearAvailabilityOverride = async () => {
        setAvailabilitySaving(true);
        try {
            const response = await fetch(`/api/calendar-availability/${availabilityDate}`, { method: 'DELETE', headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error('Clear failed');
            setAvailabilityForm({ is_locked: false, remaining_events: '', remaining_pax: '', note: '' });
            showToast('Availability override cleared.');
            fetchAvailabilityOverrides({ silent: true });
        } catch (error) {
            console.error(error);
            showToast('Could not clear availability override', 'error');
        } finally {
            setAvailabilitySaving(false);
        }
    };

    const fetchEmployees = async ({ silent = false } = {}) => {
        if (!silent) setEmpLoading(true);
        try {
            const data = await fetchCachedJson(adminEmployeesUrl(employeeFilters), 60000);
            setEmployees(getListData(data));
        } catch (error) {
            console.error(error);
            showToast("Could not load employees", 'error');
        } finally {
            if (!silent) setEmpLoading(false);
        }
    };

    const fetchCustomers = async ({ silent = false } = {}) => {
        if (!silent) setCustomerLoading(true);
        try {
            const data = await fetchCachedJson(adminCustomersUrl(customerStatusFilter, customerFilters), 60000);
            setCustomers(getListData(data));
        } catch (error) {
            console.error(error);
            showToast("Could not load customers", 'error');
        } finally {
            if (!silent) setCustomerLoading(false);
        }
    };

    const fetchPricingOverrides = async ({ silent = false } = {}) => {
        if (!silent) setPricingLoading(true);
        try {
            const data = await fetchCachedJson('/api/pricing', 60000);
            setPricingOverrides(data.overrides || {});
        } catch (error) {
            console.error(error);
            showToast("Could not load pricing", 'error');
        } finally {
            if (!silent) setPricingLoading(false);
        }
    };

    const handlePricingUpdate = async (item_type, item_id, new_price) => {
        if (!new_price || isNaN(new_price) || new_price < 0) {
            return showToast("Invalid price amount", 'error');
        }
        try {
            // Session auth - no token needed
            const res = await fetch('/api/admin/pricing', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: `${item_type}_${item_id}`,
                    item_type,
                    item_id,
                    new_price: parseFloat(new_price)
                })
            });

            if (res.ok) {
                showToast("Price updated successfully");
                bustAdminCache('/api/pricing');
                fetchPricingOverrides();
            } else {
                showToast("Could not update price", 'error');
            }
        } catch (error) {
            console.error(error);
            showToast("Could not update price. Please try again.", 'error');
        }
    };

    const fetchPackages = async () => {
        try {
            const [packageData, eventData] = await Promise.all([
                fetchCachedJson('/api/packages?per_page=100', 60000),
                fetchCachedJson('/api/admin/event-types', 60000),
            ]);
            setPackages(packageData.data || packageData);
            const types = eventData.data || eventData;
            setEventTypes(types);
            setPackageForm(prev => {
                const defaultType = prev.type || types[0]?.slug || '';
                return {
                    ...prev,
                    type: defaultType,
                    event_type_slugs: prev.event_type_slugs?.length ? prev.event_type_slugs : (defaultType ? [defaultType] : []),
                };
            });
        } catch (error) {
            console.error(error);
        }
    };

    const handlePackageSubmit = async (e) => {
        e.preventDefault();
        setPackageSaving(true);
        try {
            const res = await fetch(editingPackageId ? `/api/admin/packages/${editingPackageId}` : '/api/admin/packages', {
                method: editingPackageId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(packageForm),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                showToast(editingPackageId ? 'Package preset updated' : 'Package preset created');
                setEditingPackageId(null);
                setPackageForm(emptyPackageForm(eventTypes[0]?.slug || ''));
                setCatalogDrawer(null);
                bustAdminCache('/api/packages?per_page=100');
                fetchPackages();
            } else {
                showToast(getErrorMessage(data, 'Could not create package'), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Could not create package. Please try again.', 'error');
        } finally {
            setPackageSaving(false);
        }
    };

    const startEditingPackage = (pkg) => {
        const defaultType = pkg.type || eventTypes[0]?.slug || '';
        setEditingPackageId(pkg.id);
        setPackageForm({
            name: pkg.name || '',
            type: defaultType,
            package_category: pkg.package_category || 'standard',
            event_type_slugs: pkg.event_type_slugs?.length ? pkg.event_type_slugs : (defaultType ? [defaultType] : []),
            base_price_per_head: pkg.base_price_per_head ?? '',
            minimum_pax: pkg.minimum_pax ?? 1,
            description: pkg.description || '',
            inclusions: linesToText(pkg.inclusions),
            amenities: linesToText(pkg.amenities),
            applicable_setups: linesToText(pkg.applicable_setups),
            menu_structure: {
                starter: Number(pkg.menu_structure?.starter ?? pkg.menu_structure?.starters ?? 0),
                main: Number(pkg.menu_structure?.main ?? pkg.menu_structure?.mains ?? 0),
                side: Number(pkg.menu_structure?.side ?? pkg.menu_structure?.sides ?? 0),
                dessert: Number(pkg.menu_structure?.dessert ?? pkg.menu_structure?.desserts ?? 0),
                drink: Number(pkg.menu_structure?.drink ?? pkg.menu_structure?.refreshments ?? 0),
            },
            security_type: pkg.security_type || 'cash_bond',
            security_label: pkg.security_label || (pkg.security_type === 'contingency' ? '10% Contingency' : 'Php 1,500 Cash Bond'),
        });
    };

    const resetPackageForm = () => {
        setEditingPackageId(null);
        setPackageForm(emptyPackageForm(eventTypes[0]?.slug || ''));
    };

    const resetEventTypeForm = () => {
        setEditingEventTypeId(null);
        setEventTypeForm(emptyEventTypeForm());
    };

    const handleEventTypeSubmit = async (e) => {
        e.preventDefault();
        setPackageSaving(true);
        try {
            const url = editingEventTypeId ? `/api/admin/event-types/${editingEventTypeId}` : '/api/admin/event-types';
            const res = await fetch(url, {
                method: editingEventTypeId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventTypeForm),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                showToast(editingEventTypeId ? 'Event type updated' : 'Event type created');
                resetEventTypeForm();
                setCatalogDrawer(null);
                bustAdminCache('/api/admin/event-types', '/api/event-types?per_page=100', '/api/packages?per_page=100');
                fetchPackages();
            } else {
                showToast(getErrorMessage(data, 'Could not save event type'), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Could not save event type. Please try again.', 'error');
        } finally {
            setPackageSaving(false);
        }
    };

    const startEditingEventType = (eventType) => {
        setEditingEventTypeId(eventType.id);
        setEventTypeForm({
            label: eventType.label || '',
            slug: eventType.slug || '',
            icon: eventType.icon || 'sparkles',
            description: eventType.description || '',
            image: eventType.image || '',
            package_category: eventType.package_category || 'standard',
            applicable_setups: linesToText(eventType.applicable_setups),
            security_type: eventType.security_type || 'cash_bond',
            security_label: eventType.security_label || (eventType.security_type === 'contingency' ? '10% Contingency' : 'Php 1,500 Cash Bond'),
            security_description: eventType.security_description || '',
        });
    };

    const handleArchiveEventType = async (eventType) => {
        setConfirmDialog({
            isOpen: true,
            title: `Archive ${eventType.label}?`,
            message: 'This hides the event type from future customer booking choices while preserving historical bookings, packages, and reports.',
            confirmText: 'Archive',
            tone: 'danger',
            onConfirm: () => confirmArchiveEventType(eventType),
        });
    };

    const confirmArchiveEventType = async (eventType) => {
        closeConfirmDialog();
        setPackageSaving(true);
        try {
            const res = await fetch(`/api/admin/event-types/${eventType.id}/archive`, { method: 'PATCH' });
            if (res.ok) {
                showToast('Event type archived');
                bustAdminCache('/api/admin/event-types', '/api/event-types?per_page=100', '/api/packages?per_page=100');
                fetchPackages();
            } else {
                const data = await res.json().catch(() => ({}));
                showToast(getErrorMessage(data, 'Could not archive event type'), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Could not archive event type. Please try again.', 'error');
        } finally {
            setPackageSaving(false);
        }
    };

    // ==========================================
    // CUSTOM MENU ITEMS HANDLERS
    // ==========================================

    const fetchCustomMenuItems = async () => {
        try {
            const data = await fetchCachedJson('/api/admin/menu-items', 60000);
            setCustomMenuItems(data);
        } catch (error) {
            console.error(error);
        }
    };

    const openMenuItemModal = () => {
        setMenuItemForm({
            name: '', category: activeMenuCategory, cost_per_head: '', price_adj: '0',
            image: '', description: '', is_best_seller: false
        });
        setMenuItemModal({ open: true, mode: 'add', data: null });
    };

    const openEditMenuItemModal = (item) => {
        setMenuItemForm({
            name: item.name || '',
            category: item.category || activeMenuCategory,
            cost_per_head: item.costPerHead ?? '',
            price_adj: item.priceAdj ?? '0',
            image: item.image || '',
            description: item.description || '',
            is_best_seller: Boolean(item.isBestSeller),
        });
        setMenuItemModal({ open: true, mode: 'edit', data: item });
    };

    const handleMenuItemSubmit = async (e) => {
        e.preventDefault();
        setMenuItemFormLoading(true);
        const isEditing = menuItemModal.mode === 'edit';
        const menuItemId = menuItemModal.data?._dbId;

        if (isEditing && !menuItemId) {
            setMenuItemFormLoading(false);
            return showToast('Unable to find menu item to edit', 'error');
        }

        try {
            const res = await fetch(isEditing ? `/api/admin/menu-items/${menuItemId}` : '/api/admin/menu-items', {
                method: isEditing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...menuItemForm,
                    cost_per_head: parseFloat(menuItemForm.cost_per_head) || 0,
                    price_adj: parseFloat(menuItemForm.price_adj) || 0,
                    image: menuItemForm.image || null,
                })
            });

            if (res.ok) {
                showToast(isEditing ? 'Menu item updated successfully' : 'Menu item added successfully');
                setMenuItemModal({ open: false, mode: 'add', data: null });
                bustAdminCache('/api/admin/menu-items', '/api/menu-items', '/api/admin/analytics');
                fetchCustomMenuItems();
            } else {
                const err = await res.json();
                showToast(err.message || (isEditing ? 'Could not update menu item' : 'Could not add menu item'), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Could not save menu item. Please try again.', 'error');
        } finally {
            setMenuItemFormLoading(false);
        }
    };

    const handleArchiveMenuItem = async (id) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Archive menu item?',
            message: 'This hides the dish from future customer menus while preserving historical bookings and reports.',
            confirmText: 'Archive',
            tone: 'danger',
            onConfirm: () => confirmArchiveMenuItem(id),
        });
    };

    const confirmArchiveMenuItem = async (id) => {
        closeConfirmDialog();
        try {
            const res = await fetch(`/api/admin/menu-items/${id}/archive`, { method: 'PATCH' });
            if (res.ok) {
                showToast('Menu item archived');
                bustAdminCache('/api/admin/menu-items', '/api/menu-items', '/api/admin/analytics');
                fetchCustomMenuItems();
            } else {
                showToast('Could not archive menu item', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Could not archive menu item. Please try again.', 'error');
        }
    };

    // Menu items are loaded from the app data source.
    const MENU_CATEGORIES = ['starter', 'main', 'side', 'dessert', 'drink'];

    function getMergedDishes(category) {
        return customMenuItems
            .filter(item => item.category === category)
            .map(item => ({
                id: item.dish_id,
                _dbId: item.id,
                name: item.name,
                category: item.category,
                costPerHead: parseFloat(item.cost_per_head),
                priceAdj: parseFloat(item.price_adj),
                image: item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400',
                isBestSeller: item.is_best_seller,
                description: item.description || '',
                isActive: item.is_active !== false,
                _isCustom: true,
            }));
    }

    const fetchAnalyticsSummary = async ({ silent = false, filters = analyticsFilters } = {}) => {
        if (!silent) setAnalyticsLoading(true);
        try {
            const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== ''));
            const query = params.toString() ? `?${params.toString()}` : '';
            const cacheKey = smartCacheKey(`/api/admin/analytics/summary${query}`);
            const cached = readSmartCache(cacheKey);
            if (cached?.data && !analytics?.summary) {
                setAnalytics((current) => ({
                    ...(current || {}),
                    summary: cached.data.summary || {},
                    businessSnapshot: cached.data.businessSnapshot || {},
                }));
                setAnalyticsLoading(false);
            }
            const result = await fetchSmartResource(`/api/admin/analytics/summary${query}`, {
                cacheKey,
                ttl: 30000,
            });
            const summary = result.raw || result.data;

            setAnalytics((current) => ({
                ...(current || {}),
                summary: summary.summary || {},
                businessSnapshot: summary.businessSnapshot || {},
                conversionFunnel: summary.conversionFunnel || current?.conversionFunnel || {},
                insights: summary.insights || current?.insights || {},
            }));
        } catch (error) {
            console.error(error);
            if (!silent) showToast('We could not load the latest data. Showing saved data if available.', 'error');
        } finally {
            if (!silent) setAnalyticsLoading(false);
        }
    };

    const fetchAnalytics = async ({ silent = false, filters = analyticsFilters } = {}) => {
        if (!silent) setAnalyticsLoading(true);
        try {
            const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== ''));
            const query = params.toString() ? `?${params.toString()}` : '';
            const fetchPart = async (path) => {
                const res = await fetch(`${path}${query}`);
                if (!res.ok) throw new Error(`Analytics request failed: ${path}`);
                return res.json();
            };
            const [summary, revenueHealth, pipeline, menu, customerExperience, operations, forecasts] = await Promise.all([
                fetchPart('/api/admin/analytics/summary'),
                fetchPart('/api/admin/analytics/revenue'),
                fetchPart('/api/admin/analytics/pipeline'),
                fetchPart('/api/admin/analytics/menu-performance'),
                fetchPart('/api/admin/analytics/customer-experience'),
                fetchPart('/api/admin/analytics/operations'),
                fetchPart('/api/admin/analytics/forecasts'),
            ]);

            setAnalytics({
                summary: summary.summary || {},
                businessSnapshot: summary.businessSnapshot || {},
                conversionFunnel: summary.conversionFunnel || {},
                revenueTrends: revenueHealth.settledRevenueOverTime || [],
                revenueHealth,
                paymentAging: revenueHealth.paymentAging || [],
                bookingPipeline: pipeline.bookingPipeline || [],
                upcomingWorkload: pipeline.upcomingWorkload || [],
                packagePerformance: menu.packagePerformance || [],
                menuPerformance: menu.menuPerformance || [],
                customerExperience,
                operationsLoad: operations.operationsLoad || [],
                alerts: operations.alerts || [],
                operationalAlerts: operations.alerts || [],
                revenueForecast: forecasts.revenueForecast || {},
                paxDemandProjection: forecasts.paxDemandProjection || {},
                insights: summary.insights || {},
                projectedPaxDemand: forecasts.projectedPaxDemand || [],
                topSellers: menu.packagePerformance || [],
                peakSeasons: operations.operationsLoad || [],
            });
        } catch (error) {
            console.error(error);
            if (!silent) showToast('We could not load the latest analytics. Showing saved data if available.', 'error');
        } finally {
            if (!silent) setAnalyticsLoading(false);
        }
    };

    const fetchReportBuilder = async ({ silent = false } = {}) => {
        if (!silent) setReportLoading(true);
        try {
            const [widgetsRes, templatesRes] = await Promise.all([
                fetch('/api/admin/report-widgets'),
                fetch('/api/admin/report-templates?paginated=1&per_page=75'),
            ]);
            const [widgets, templates] = await Promise.all([widgetsRes.json(), templatesRes.json()]);
            setReportWidgets(Array.isArray(widgets) ? widgets : []);
            setReportTemplates(Array.isArray(templates) ? templates : (templates.data || []));
        } catch (error) {
            console.error(error);
            showToast('Could not load report builder', 'error');
        } finally {
            if (!silent) setReportLoading(false);
        }
    };

    const fetchReportPreview = async ({ silent = false, builder = reportBuilder } = {}) => {
        if (!silent) setReportLoading(true);
        try {
            const res = await fetch('/api/admin/report-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    widgets: builder.widgets,
                    filters: Object.fromEntries(Object.entries(builder.filters || {}).filter(([, value]) => value !== '')),
                }),
            });
            const data = await res.json();
            setReportPreview(data.widgets || []);
            setReportExecutiveSummary(data.executive_summary || null);
        } catch (error) {
            console.error(error);
            showToast('Could not preview report', 'error');
        } finally {
            if (!silent) setReportLoading(false);
        }
    };

    const scheduleReportPreview = ({ builder = reportBuilder, delay = 350 } = {}) => {
        if (reportPreviewTimerRef.current) {
            clearTimeout(reportPreviewTimerRef.current);
        }

        reportPreviewTimerRef.current = setTimeout(() => {
            fetchReportPreview({ silent: true, builder });
        }, delay);
    };

    const previewReport = async () => {
        setReportView('preview');
        await fetchReportPreview();
    };

    const saveReportTemplate = async () => {
        setReportSaving(true);
        try {
            const payload = {
                name: reportBuilder.name,
                description: reportBuilder.description,
                layout_json: reportBuilder.widgets.map((id, index) => ({ id, order: index + 1 })),
                filters_json: reportBuilder.filters,
            };
            const url = reportTemplateId ? `/api/admin/report-templates/${reportTemplateId}` : '/api/admin/report-templates';
            const res = await fetch(url, {
                method: reportTemplateId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error('Save failed');
            const template = await res.json();
            setReportTemplateId(String(template.id));
            await fetchReportBuilder({ silent: true });
            showToast('Saved report updated');
            return template;
        } catch (error) {
            console.error(error);
            showToast('Could not save report', 'error');
            return null;
        } finally {
            setReportSaving(false);
        }
    };

    const createNewSavedReport = () => {
        setReportTemplateId('');
        setReportBuilder({
            name: 'Management Snapshot',
            description: 'Finance, bookings, menu performance, and operational alerts.',
            widgets: ['revenue_summary', 'payment_breakdown', 'booking_pipeline', 'operational_alerts'],
            filters: { date_from: '', date_to: '', booking_status: '', payment_status: '', city: '' },
        });
        setReportView('build');
        setReportSetupOpen(true);
    };

    const duplicateSavedReport = () => {
        setReportTemplateId('');
        setReportBuilder(prev => ({
            ...prev,
            name: `${prev.name || 'Report'} Copy`,
        }));
        setReportSetupOpen(true);
        showToast('Editing a new copy. Save it when ready.');
    };

    const archiveSavedReport = async () => {
        if (!reportTemplateId) return;
        setConfirmDialog({
            isOpen: true,
            title: 'Archive saved report?',
            message: 'This hides the saved report template from default pickers. Generated exports and report runs remain in records.',
            confirmText: 'Archive',
            tone: 'danger',
            onConfirm: confirmArchiveSavedReport,
        });
    };

    const confirmArchiveSavedReport = async () => {
        closeConfirmDialog();
        try {
            const res = await fetch(`/api/admin/report-templates/${reportTemplateId}/archive`, { method: 'PATCH' });
            if (!res.ok) throw new Error('Archive failed');
            setReportTemplateId('');
            await fetchReportBuilder({ silent: true });
            showToast('Saved report archived');
        } catch (error) {
            console.error(error);
            showToast('Could not archive saved report', 'error');
        }
    };

    const runReportExport = async (format = 'csv') => {
        const template = await saveReportTemplate();
        if (!template?.id) return;
        try {
            const res = await fetch(`/api/admin/report-templates/${template.id}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filters: reportBuilder.filters }),
            });
            if (!res.ok) throw new Error('Run failed');
            const run = await res.json();
            window.location.href = `/api/admin/report-runs/${run.id}/export?format=${format}`;
        } catch (error) {
            console.error(error);
            showToast('Could not download report', 'error');
        }
    };

    const loadReportTemplate = (id) => {
        setReportTemplateId(id);
        const template = reportTemplates.find(item => String(item.id) === String(id));
        if (!template) return;

        const widgets = (template.layout_json || [])
            .map(item => typeof item === 'string' ? item : item.id)
            .filter(Boolean);
        const nextBuilder = {
            name: template.name || 'Management Snapshot',
            description: template.description || '',
            widgets: widgets.length ? widgets : reportBuilder.widgets,
            filters: template.filters_json || reportBuilder.filters,
        };
        setReportBuilder(nextBuilder);
        setReportView('build');
        scheduleReportPreview({ builder: nextBuilder });
    };

    const reorderReportWidgets = (fromIndex, toIndex) => {
        const next = [...reportBuilder.widgets];
        if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return;
        if (fromIndex < 0 || toIndex < 0 || fromIndex >= next.length || toIndex >= next.length || fromIndex === toIndex) return;
        const [moved] = next.splice(fromIndex, 1);
        next.splice(fromIndex < toIndex ? toIndex - 1 : toIndex, 0, moved);
        const nextBuilder = { ...reportBuilder, widgets: next };
        setReportBuilder(nextBuilder);
        scheduleReportPreview({ builder: nextBuilder });
    };

    const addReportWidgetAt = (widgetId, index = reportBuilder.widgets.length) => {
        if (!widgetId || reportBuilder.widgets.includes(widgetId)) return;
        const next = [...reportBuilder.widgets];
        next.splice(Math.max(0, Math.min(index, next.length)), 0, widgetId);
        const nextBuilder = { ...reportBuilder, widgets: next };
        setReportBuilder(nextBuilder);
        setReportView('build');
        scheduleReportPreview({ builder: nextBuilder });
    };

    const handleReportDrop = (index) => {
        if (reportDraggedWidgetId) {
            addReportWidgetAt(reportDraggedWidgetId, index);
        } else if (Number.isInteger(reportDraggedIndex)) {
            reorderReportWidgets(reportDraggedIndex, index);
        }
        setReportDraggedWidgetId(null);
        setReportDraggedIndex(null);
        setReportDropIndex(null);
    };

    const removeDraggedReportWidget = () => {
        if (!Number.isInteger(reportDraggedIndex)) return;
        const nextBuilder = {
            ...reportBuilder,
            widgets: reportBuilder.widgets.filter((_, itemIndex) => itemIndex !== reportDraggedIndex),
        };
        setReportBuilder(nextBuilder);
        scheduleReportPreview({ builder: nextBuilder });
        setReportDraggedIndex(null);
        setReportDraggedWidgetId(null);
        setReportDropIndex(null);
        setReportLibraryDropActive(false);
    };

    const moveReportWidget = (index, direction) => {
        reorderReportWidgets(index, index + direction);
    };

    const formatReportPreviewValue = (key, value) => {
        if (value === null || value === undefined || value === '') return 'None';
        if (typeof value === 'number') {
            const lowerKey = String(key).toLowerCase();
            if (lowerKey.includes('revenue') || lowerKey.includes('amount') || lowerKey.includes('total') || lowerKey.includes('value') || lowerKey.includes('balance')) {
                return formatCurrency(value);
            }
            if (lowerKey.includes('rate') || lowerKey.includes('percent')) {
                return `${Number(value || 0).toLocaleString()}%`;
            }
            return Number(value).toLocaleString();
        }
        return String(value);
    };

    const humanizeReportKey = (key) => String(key || '')
        .replace(/[_-]/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, char => char.toUpperCase());

    const getReportSummaryMetrics = (data = {}) => Object.entries(data)
        .filter(([key, value]) => key !== 'action' && !Array.isArray(value) && value !== null && typeof value !== 'object')
        .map(([key, value]) => ({
            label: humanizeReportKey(key),
            value: formatReportPreviewValue(key, value),
        }));

    const updateReportFilter = (key, value) => {
        setReportBuilder({ ...reportBuilder, filters: { ...reportBuilder.filters, [key]: value } });
    };

    const summarizeReportWidget = (widget) => {
        const data = widget.data || {};
        if (Array.isArray(data.rows)) {
            return `${data.rows.length} rows`;
        }
        const numericKeys = Object.keys(data).filter(key => typeof data[key] === 'number');
        return numericKeys.length ? numericKeys.map(key => `${key}: ${key.toLowerCase().includes('rate') ? `${data[key]}%` : formatCurrency(data[key])}`).join(' | ') : (data.message || 'Ready');
    };

    const toggleAnalyticsFilterPanel = (panel) => {
        setActiveAnalyticsFilterPanel(current => current === panel ? null : panel);
    };

    const toggleDashboardFilterPanel = (panel) => {
        setActiveDashboardFilterPanel(current => current === panel ? null : panel);
    };

    const renderAnalyticsFilterButton = (panel, label = 'Filters') => (
        <button
            type="button"
            onClick={() => toggleAnalyticsFilterPanel(panel)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#720101]/15 bg-[#fff7e8] px-3 py-2 text-xs font-black text-[#720101] transition-colors hover:bg-[#fff1d0]"
            aria-expanded={activeAnalyticsFilterPanel === panel}
        >
            <Filter className="h-4 w-4" />
            {label}
            <ChevronDown className={`h-4 w-4 transition-transform ${activeAnalyticsFilterPanel === panel ? 'rotate-180' : ''}`} />
        </button>
    );

    const insightToneClass = (severity = 'good') => ({
        critical: 'border-red-100 bg-red-50 text-red-800',
        warning: 'border-amber-100 bg-amber-50 text-amber-900',
        watch: 'border-[#f0aa0b]/20 bg-[#fff7e8] text-[#720101]',
        good: 'border-emerald-100 bg-emerald-50 text-emerald-800',
    }[severity] || 'border-slate-100 bg-slate-50 text-slate-700');

    const LoadingFeedback = ({ label = 'Loading your dashboard data...', compact = false }) => (
        <div className={`admin-loading-note ${compact ? 'is-compact' : ''}`} role="status" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{analyticsSlowLoading ? 'Still working. Your connection may be slow, but we are checking.' : label}</span>
        </div>
    );

    const normalizeInsight = (insight, fallbackHeadline = 'Review this chart for context.') => {
        if (!insight) return null;
        if (typeof insight === 'string') {
            return {
                headline: fallbackHeadline,
                meaning: insight,
                recommended_action: 'Use this trend alongside current queues before making decisions.',
                severity: 'watch',
            };
        }
        return insight;
    };

    const InsightLine = ({ insight, compact = true }) => {
        const normalized = normalizeInsight(insight);
        if (!normalized) return null;

        return (
            <div className={`admin-insight-line ${insightToneClass(normalized.severity)} ${compact ? 'is-compact' : ''}`}>
                <strong>{normalized.headline}</strong>
                {!compact && (
                    <>
                        <p>{normalized.meaning}</p>
                        {normalized.recommended_action && <span>{normalized.recommended_action}</span>}
                    </>
                )}
            </div>
        );
    };

    const AnalyticsPanel = ({ id, kicker, title, description, insight, actions, children, loading = false, className = '', chartHeight = 'h-64' }) => (
        <section className={`admin-panel admin-analytics-panel overflow-hidden ${className}`}>
            <div className="admin-analytics-panel-head">
                <div>
                    {kicker && <p className="admin-kicker">{kicker}</p>}
                    <h3>{title}</h3>
                    {description && <p>{description}</p>}
                </div>
                <div className="admin-analytics-panel-actions">
                    {actions}
                    <button type="button" onClick={() => setExpandedAnalyticsPanel(id)} className="admin-mini-button inline-flex items-center gap-2">
                        <Maximize2 className="h-3.5 w-3.5" />
                        Expand
                    </button>
                </div>
            </div>
            <div className="admin-analytics-panel-body">
                {loading && <LoadingFeedback label="Preparing analytics..." compact />}
                <div className={chartHeight}>{children}</div>
                <InsightLine insight={insight} />
            </div>
        </section>
    );

    const renderExpandedAnalyticsContent = (panelId) => {
        if (panelId === 'revenue-trend') {
            return revenueTrendData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueTrendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(value) => `PHP ${Math.round(value / 1000)}k`} />
                        <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                        <Bar dataKey="revenue" fill="#720101" radius={[6, 6, 0, 0]} name="Revenue" />
                    </BarChart>
                </ResponsiveContainer>
            ) : null;
        }

        if (panelId === 'payment-breakdown') {
            return visiblePaymentStatusBreakdown.length ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={visiblePaymentStatusBreakdown}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(value) => `PHP ${Math.round(value / 1000)}k`} />
                        <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                        <Bar dataKey="total" fill="#720101" radius={[6, 6, 0, 0]} name="Amount" />
                    </BarChart>
                </ResponsiveContainer>
            ) : null;
        }

        if (panelId === 'booking-pipeline') {
            return bookingPipelineData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bookingPipelineData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                        <RechartsTooltip />
                        <Bar dataKey="count" fill="#720101" radius={[6, 6, 0, 0]} name="Bookings" />
                    </BarChart>
                </ResponsiveContainer>
            ) : null;
        }

        if (panelId === 'conversion-funnel') {
            const data = [
                { label: 'Booking starts', value: conversionFunnel.booking_starts || 0 },
                { label: 'Submissions', value: conversionFunnel.booking_submissions || 0 },
                { label: 'Payment starts', value: conversionFunnel.payment_checkout_starts || 0 },
                { label: 'Payments', value: conversionFunnel.payment_confirmations || 0 },
                { label: 'Feedback', value: conversionFunnel.feedback_submissions || 0 },
            ];
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                        <RechartsTooltip />
                        <Bar dataKey="value" fill="#720101" radius={[6, 6, 0, 0]} name="Events" />
                    </BarChart>
                </ResponsiveContainer>
            );
        }

        if (panelId === 'package-performance') {
            return visiblePackagePerformanceData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={visiblePackagePerformanceData} layout="vertical" margin={{ left: 24, right: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(value) => `PHP ${Math.round(value / 1000)}k`} />
                        <YAxis type="category" dataKey="label" width={160} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#374151', fontWeight: 700 }} />
                        <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                        <Bar dataKey="revenue" fill="#720101" radius={[0, 6, 6, 0]} name="Revenue" />
                    </BarChart>
                </ResponsiveContainer>
            ) : null;
        }

        if (panelId === 'menu-performance') {
            return visibleMenuPerformanceData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={visibleMenuPerformanceData} layout="vertical" margin={{ left: 24, right: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                        <YAxis type="category" dataKey="label" width={160} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#374151', fontWeight: 700 }} />
                        <RechartsTooltip />
                        <Bar dataKey={menuViewFilters.sort === 'pax' ? 'paxServed' : 'selections'} fill="#720101" radius={[0, 6, 6, 0]} name={menuViewFilters.sort === 'pax' ? 'Guests served' : 'Selections'} />
                    </BarChart>
                </ResponsiveContainer>
            ) : null;
        }

        if (panelId === 'revenue-forecast') {
            return revenueForecastData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueForecastData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(value) => `PHP ${Math.round(value / 1000)}k`} />
                        <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                        <Bar dataKey="revenue" fill="#720101" radius={[6, 6, 0, 0]} name="Actual collected" />
                        <Bar dataKey="forecast" fill="#f0aa0b" radius={[6, 6, 0, 0]} name="SMA forecast" />
                    </BarChart>
                </ResponsiveContainer>
            ) : null;
        }

        if (panelId === 'pax-forecast') {
            return paxDemandData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={paxDemandData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                        <RechartsTooltip />
                        <Bar dataKey="pax" fill="#720101" radius={[6, 6, 0, 0]} name="Actual guests" />
                        <Bar dataKey="forecast" fill="#f0aa0b" radius={[6, 6, 0, 0]} name="SMA forecast" />
                    </BarChart>
                </ResponsiveContainer>
            ) : null;
        }

        return null;
    };

    const expandedPanelMeta = {
        'revenue-trend': ['Revenue trend', analyticsInsightItems.revenue],
        'payment-breakdown': ['Payment breakdown', analyticsInsightItems.payments],
        'booking-pipeline': ['Booking pipeline', analyticsInsightItems.pipeline],
        'conversion-funnel': ['Conversion funnel', analyticsInsightItems.conversion],
        'package-performance': ['Package performance', analyticsInsightItems.menu],
        'menu-performance': ['Menu performance', analyticsInsightItems.menu],
        'revenue-forecast': ['Revenue forecast', analyticsInsightItems.forecast || normalizeInsight(revenueForecast.insight, 'Forecast gives planning context.')],
        'pax-forecast': ['Guest demand forecast', analyticsInsightItems.forecast || normalizeInsight(paxDemandProjection.insight, 'Demand forecast gives planning context.')],
    };

    const renderAnalyticsWorkbench = () => {
        const insightCards = [
            {
                key: 'revenue',
                title: 'Revenue',
                value: formatCurrency(analyticsSummary.totalRevenue || 0),
                context: `Collected ${formatCurrency(analyticsSummary.settledRevenue || 0)} with ${formatCurrency(analyticsSummary.pendingRevenue || 0)} still pending.`,
                action: 'Review payments',
                onClick: () => setActiveTab('finance'),
            },
            {
                key: 'pipeline',
                title: 'Booking pipeline',
                value: analyticsSummary.activeBookings || 0,
                context: `${analyticsSummary.pendingBookings || 0} booking requests still need attention.`,
                action: 'Open bookings',
                onClick: () => setActiveTab('bookings-intake'),
            },
            {
                key: 'payments',
                title: 'Collection health',
                value: `${analyticsSummary.collectionRate || 0}%`,
                context: 'Collection rate based on verified and pending payment records.',
                action: 'View finance',
                onClick: () => setActiveTab('finance'),
            },
            {
                key: 'demand',
                title: 'Guest demand',
                value: Number(analyticsSummary.totalPax || 0).toLocaleString(),
                context: `Average booking value is ${formatCurrency(analyticsSummary.averageBookingValue || 0)}.`,
                action: 'Review menu demand',
                onClick: () => setActiveAnalyticsFilterPanel(activeAnalyticsFilterPanel === 'menuPerformance' ? null : 'menuPerformance'),
            },
        ];
        const topAlerts = visibleOperationalAlerts.slice(0, 3);
        const topPackages = visiblePackagePerformanceData.slice(0, 5);
        const topDishes = visibleMenuPerformanceData.slice(0, 5);
        const conversionCards = [
            ['Booking completion', `${conversionFunnel.booking_completion_rate || 0}%`, `${conversionFunnel.booking_submissions || 0} submissions from ${conversionFunnel.booking_starts || 0} starts`],
            ['Payment completion', `${conversionFunnel.payment_completion_rate || 0}%`, `${conversionFunnel.payment_confirmations || 0} confirmed from ${conversionFunnel.payment_checkout_starts || 0} checkout starts`],
            ['Feedback captured', conversionFunnel.feedback_submissions || 0, `${conversionFunnel.testimonial_candidates || 0} testimonial candidates`],
        ];

        return (
            <div className="admin-insight-workbench animate-fadeIn space-y-5">
                <section className="admin-panel overflow-hidden">
                    <div className="flex flex-col gap-4 border-b border-gray-100 bg-[#fffaf3] p-6 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="admin-kicker">Insight workbench</p>
                            <h3 className="mt-1 text-2xl font-black text-gray-950">Understand the business without scrolling through every chart</h3>
                            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-gray-500">Start with the signals that need decisions, then drill into revenue, bookings, payments, menu demand, operations, and forecasts.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {renderAnalyticsFilterButton('snapshot', businessSnapshot.label || 'Timeframe')}
                            <button onClick={() => fetchAnalytics()} disabled={analyticsLoading} className="admin-button-primary inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-black">
                                <RefreshCw className={`h-4 w-4 ${analyticsLoading ? 'animate-spin' : ''}`} />
                                {analyticsLoading ? 'Refreshing...' : 'Refresh insights'}
                            </button>
                        </div>
                    </div>
                    {activeAnalyticsFilterPanel === 'snapshot' && (
                        <div className="border-b border-gray-100 bg-white p-5">
                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                Timeframe
                                <select
                                    value={analyticsFilters.snapshot_window}
                                    onChange={(event) => {
                                        const nextFilters = { ...analyticsFilters, snapshot_window: event.target.value };
                                        setAnalyticsFilters(nextFilters);
                                        fetchAnalytics({ filters: nextFilters });
                                    }}
                                    className="mt-2 w-full max-w-xs rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none"
                                >
                                    {SNAPSHOT_WINDOW_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                            </label>
                        </div>
                    )}
                    {analyticsLoading && !analytics ? (
                        <StaffSkeleton variant="metrics" rows={4} />
                    ) : (
                        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
                            {insightCards.map(card => (
                                <article key={card.key} className="rounded-xl border border-gray-100 bg-white p-4">
                                    <p className="text-xs font-black uppercase tracking-widest text-[#9f6500]">{card.title}</p>
                                    <p className="mt-3 text-2xl font-black text-gray-950">{card.value}</p>
                                    <p className="mt-2 min-h-12 text-sm font-semibold leading-6 text-gray-500">{card.context}</p>
                                    <button type="button" onClick={card.onClick} className="mt-4 text-xs font-black uppercase tracking-widest text-[#720101]">{card.action}</button>
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                <section className="admin-panel overflow-hidden">
                    <div className="flex flex-col gap-2 border-b border-gray-100 bg-white p-5 md:flex-row md:items-end md:justify-between">
                        <div>
                            <p className="admin-kicker">Conversion roadmap</p>
                            <h3 className="mt-1 text-xl font-black text-gray-950">Completed booking signals</h3>
                            <p className="mt-1 text-sm font-semibold text-gray-500">Tracks the funnel signals from `PLANS.md`: booking completion, payment movement, and post-event trust.</p>
                        </div>
                        <button type="button" onClick={() => setActiveTab('bookings-intake')} className="text-xs font-black uppercase tracking-widest text-[#720101]">Open booking work</button>
                    </div>
                    <div className="grid gap-3 p-5 md:grid-cols-3">
                        {conversionCards.map(([label, value, context]) => (
                            <article key={label} className="rounded-xl border border-[#720101]/10 bg-[#fffaf3] p-4">
                                <p className="text-xs font-black uppercase tracking-widest text-[#9f6500]">{label}</p>
                                <p className="mt-3 text-3xl font-black text-gray-950">{value}</p>
                                <p className="mt-2 text-sm font-semibold leading-6 text-gray-500">{context}</p>
                            </article>
                        ))}
                    </div>
                    {(conversionFunnel.low_feedback_followups || 0) > 0 && (
                        <div className="border-t border-[#720101]/10 bg-[#fff7e8] px-5 py-3 text-sm font-bold text-[#720101]">
                            {conversionFunnel.low_feedback_followups} low-rating follow-up{conversionFunnel.low_feedback_followups === 1 ? '' : 's'} need retention attention.
                        </div>
                    )}
                </section>

                <section className="admin-key-takeaways">
                    <div>
                        <p className="admin-kicker">Key takeaways</p>
                        <h3>What Admin should notice first</h3>
                    </div>
                    <div className="admin-key-takeaway-grid">
                        {(analyticsTakeaways.length ? analyticsTakeaways : [
                            analyticsInsightItems.revenue,
                            analyticsInsightItems.conversion,
                            analyticsInsightItems.operations,
                        ].filter(Boolean)).slice(0, 3).map((insight, index) => (
                            <InsightLine key={`${insight.headline}-${index}`} insight={insight} compact={false} />
                        ))}
                        {!analyticsTakeaways.length && !analyticsInsightItems.revenue && (
                            <div className="admin-loading-note is-compact">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Checking for the latest updates...</span>
                            </div>
                        )}
                    </div>
                </section>

                <div className="admin-analytics-grid">
                    <AnalyticsPanel
                        id="revenue-trend"
                        kicker="Revenue"
                        title="Revenue trend"
                        description="Verified collections over the selected window."
                        insight={analyticsInsightItems.revenue}
                        loading={analyticsLoading && !!analytics}
                        actions={renderAnalyticsFilterButton('revenueTrend', `Last ${analyticsFilters.trend_months} months`)}
                    >
                        {revenueTrendData.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={revenueTrendData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                    <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                                    <Bar dataKey="revenue" fill="#720101" radius={[6, 6, 0, 0]} name="Revenue" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="admin-chart-empty">No collected revenue for this window.</div>}
                    </AnalyticsPanel>

                    <AnalyticsPanel
                        id="payment-breakdown"
                        kicker="Finance"
                        title="Payment breakdown"
                        description="Shows payment exposure by current status."
                        insight={analyticsInsightItems.payments}
                        loading={analyticsLoading && !!analytics}
                        actions={renderAnalyticsFilterButton('dashboardPayment', paymentRiskFilters.status === 'all' ? 'Payment status' : paymentRiskFilters.status)}
                    >
                        {visiblePaymentStatusBreakdown.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={visiblePaymentStatusBreakdown}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(value) => `PHP ${Math.round(value / 1000)}k`} />
                                    <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                                    <Bar dataKey="total" fill="#720101" radius={[6, 6, 0, 0]} name="Amount" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="admin-chart-empty">No payment rows for this filter.</div>}
                    </AnalyticsPanel>

                    <AnalyticsPanel
                        id="booking-pipeline"
                        kicker="Bookings"
                        title="Booking pipeline"
                        description="Counts requests and confirmed work by status."
                        insight={analyticsInsightItems.pipeline}
                        loading={analyticsLoading && !!analytics}
                    >
                        {bookingPipelineData.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={bookingPipelineData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                    <RechartsTooltip />
                                    <Bar dataKey="count" fill="#720101" radius={[6, 6, 0, 0]} name="Bookings" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="admin-chart-empty">No booking pipeline data yet.</div>}
                    </AnalyticsPanel>

                    <AnalyticsPanel
                        id="conversion-funnel"
                        kicker="Conversion"
                        title="Booking completion funnel"
                        description="Tracks starts, submissions, payment movement, and feedback."
                        insight={analyticsInsightItems.conversion}
                        loading={analyticsLoading && !!analytics}
                    >
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                                { label: 'Starts', value: conversionFunnel.booking_starts || 0 },
                                { label: 'Bookings', value: conversionFunnel.booking_submissions || 0 },
                                { label: 'Payments', value: conversionFunnel.payment_confirmations || 0 },
                                { label: 'Feedback', value: conversionFunnel.feedback_submissions || 0 },
                            ]}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                <RechartsTooltip />
                                <Bar dataKey="value" fill="#720101" radius={[6, 6, 0, 0]} name="Events" />
                            </BarChart>
                        </ResponsiveContainer>
                    </AnalyticsPanel>

                    <AnalyticsPanel
                        id="package-performance"
                        kicker="Menu demand"
                        title="Package performance"
                        description="Top package choices by revenue."
                        insight={analyticsInsightItems.menu}
                        loading={analyticsLoading && !!analytics}
                        actions={renderAnalyticsFilterButton('packagePerformance', `Top ${packageViewFilters.limit}`)}
                    >
                        {visiblePackagePerformanceData.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={visiblePackagePerformanceData} layout="vertical" margin={{ left: 24, right: 12 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(value) => `PHP ${Math.round(value / 1000)}k`} />
                                    <YAxis type="category" dataKey="label" width={130} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#374151', fontWeight: 700 }} />
                                    <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                                    <Bar dataKey="revenue" fill="#720101" radius={[0, 6, 6, 0]} name="Revenue" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="admin-chart-empty">No package data for this filter.</div>}
                    </AnalyticsPanel>

                    <AnalyticsPanel
                        id="menu-performance"
                        kicker="Kitchen signal"
                        title="Menu performance"
                        description="Most selected dishes from actual bookings."
                        insight={analyticsInsightItems.menu}
                        loading={analyticsLoading && !!analytics}
                        actions={renderAnalyticsFilterButton('menuPerformance', MENU_CATEGORY_OPTIONS.find(option => option.value === menuViewFilters.category)?.label || 'Dish type')}
                    >
                        {visibleMenuPerformanceData.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={visibleMenuPerformanceData} layout="vertical" margin={{ left: 24, right: 12 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                    <YAxis type="category" dataKey="label" width={130} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#374151', fontWeight: 700 }} />
                                    <RechartsTooltip />
                                    <Bar dataKey={menuViewFilters.sort === 'pax' ? 'paxServed' : 'selections'} fill="#720101" radius={[0, 6, 6, 0]} name={menuViewFilters.sort === 'pax' ? 'Guests served' : 'Selections'} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="admin-chart-empty">No menu selections for this filter.</div>}
                    </AnalyticsPanel>

                    <AnalyticsPanel
                        id="revenue-forecast"
                        kicker="Forecast"
                        title="Revenue forecast"
                        description="Moving average forecast for collected revenue."
                        insight={analyticsInsightItems.forecast || normalizeInsight(revenueForecast.insight, 'Forecast gives planning context.')}
                        loading={analyticsLoading && !!analytics}
                        actions={renderAnalyticsFilterButton('revenueForecast', `${analyticsFilters.revenue_forecast_period} forecast`)}
                    >
                        {revenueForecastData.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={revenueForecastData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(value) => `PHP ${Math.round(value / 1000)}k`} />
                                    <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                                    <Bar dataKey="revenue" fill="#720101" radius={[6, 6, 0, 0]} name="Actual collected" />
                                    <Bar dataKey="forecast" fill="#f0aa0b" radius={[6, 6, 0, 0]} name="SMA forecast" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="admin-chart-empty">No revenue forecast data yet.</div>}
                    </AnalyticsPanel>

                    <AnalyticsPanel
                        id="pax-forecast"
                        kicker="Operations forecast"
                        title="Guest demand forecast"
                        description="Projected pax for staffing and preparation planning."
                        insight={analyticsInsightItems.forecast || normalizeInsight(paxDemandProjection.insight, 'Demand forecast gives planning context.')}
                        loading={analyticsLoading && !!analytics}
                        actions={renderAnalyticsFilterButton('paxForecast', `${analyticsFilters.pax_projection_period} demand`)}
                    >
                        {paxDemandData.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={paxDemandData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                    <RechartsTooltip />
                                    <Bar dataKey="pax" fill="#720101" radius={[6, 6, 0, 0]} name="Actual guests" />
                                    <Bar dataKey="forecast" fill="#f0aa0b" radius={[6, 6, 0, 0]} name="SMA forecast" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="admin-chart-empty">No guest demand forecast data yet.</div>}
                    </AnalyticsPanel>
                </div>

                <div className="hidden grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,.75fr)]">
                    <section className="admin-panel overflow-hidden">
                        <div className="border-b border-gray-100 bg-white p-5">
                            <p className="admin-kicker">Revenue and pipeline</p>
                            <h3 className="mt-1 text-xl font-black text-gray-950">Collections and booking movement</h3>
                            <p className="mt-1 text-sm font-semibold text-gray-500">Use this section to see whether bookings are turning into collected revenue.</p>
                        </div>
                        <div className="grid gap-4 p-5 lg:grid-cols-2">
                            <div className="rounded-xl border border-gray-100 p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <h4 className="text-sm font-black text-gray-950">Revenue trend</h4>
                                    {renderAnalyticsFilterButton('revenueTrend', `Last ${analyticsFilters.trend_months} months`)}
                                </div>
                                {activeAnalyticsFilterPanel === 'revenueTrend' && (
                                    <select
                                        value={analyticsFilters.trend_months}
                                        onChange={(event) => {
                                            const nextFilters = { ...analyticsFilters, trend_months: event.target.value };
                                            setAnalyticsFilters(nextFilters);
                                            fetchAnalytics({ filters: nextFilters });
                                        }}
                                        className="mb-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-800 outline-none"
                                    >
                                        {[3, 6, 9, 12, 18, 24].map(months => <option key={months} value={months}>Last {months} months</option>)}
                                    </select>
                                )}
                                <div className="h-64">
                                    {revenueTrendData.length ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={revenueTrendData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                                <RechartsTooltip />
                                                <Bar dataKey="revenue" fill="#720101" radius={[6, 6, 0, 0]} name="Revenue" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : <StaffSkeleton variant="panel" rows={3} />}
                                </div>
                            </div>
                            <div className="rounded-xl border border-gray-100 p-4">
                                <h4 className="text-sm font-black text-gray-950">Booking pipeline</h4>
                                <div className="mt-4 space-y-3">
                                    {bookingPipelineData.slice(0, 6).map((row, index) => (
                                        <div key={`${row.label || row.status}-${index}`} className="flex items-center justify-between rounded-lg bg-[#fbf8f2] px-3 py-2">
                                            <span className="text-sm font-bold text-gray-600">{row.label || row.status || 'Bookings'}</span>
                                            <strong className="text-sm font-black text-gray-950">{row.count ?? row.value ?? 0}</strong>
                                        </div>
                                    ))}
                                    {!bookingPipelineData.length && <StaffSkeleton rows={4} className="p-0" />}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="admin-panel overflow-hidden">
                        <div className="border-b border-gray-100 bg-white p-5">
                            <p className="admin-kicker">Operations</p>
                            <h3 className="mt-1 text-xl font-black text-gray-950">Priority alerts</h3>
                        </div>
                        <div className="space-y-3 p-5">
                            {topAlerts.map((alert, index) => (
                                <div key={`${alert.label}-${index}`} className="rounded-xl border border-amber-100 bg-[#fffaf3] p-4">
                                    <p className="text-sm font-black text-gray-950">{alert.label || alert.title}</p>
                                    <p className="mt-1 text-sm font-semibold text-gray-500">{alert.detail || alert.message || 'Review this item before the next operations update.'}</p>
                                    <button onClick={() => alert.label?.toLowerCase().includes('payment') ? setActiveTab('finance') : setActiveTab('bookings-intake')} className="mt-3 text-xs font-black uppercase tracking-widest text-[#720101]">Open queue</button>
                                </div>
                            ))}
                            {!topAlerts.length && <div className="rounded-xl bg-gray-50 p-6 text-sm font-bold text-gray-400">No priority alerts for this timeframe.</div>}
                        </div>
                    </section>
                </div>

                <div className="hidden grid gap-5 xl:grid-cols-2">
                    <section className="admin-panel overflow-hidden">
                        <div className="flex items-center justify-between border-b border-gray-100 bg-white p-5">
                            <div>
                                <p className="admin-kicker">Menu demand</p>
                                <h3 className="mt-1 text-xl font-black text-gray-950">Top packages</h3>
                            </div>
                            {renderAnalyticsFilterButton('packagePerformance', `Top ${packageViewFilters.limit}`)}
                        </div>
                        <div className="space-y-3 p-5">
                            {topPackages.map((pkg, index) => (
                                <div key={`${pkg.label || pkg.name}-${index}`} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-gray-100 p-3">
                                    <div>
                                        <p className="font-black text-gray-950">{pkg.label || pkg.name || 'Package'}</p>
                                        <p className="text-sm font-semibold text-gray-500">{pkg.count || 0} bookings</p>
                                    </div>
                                    <strong className="text-sm font-black text-[#720101]">{formatCurrency(pkg.revenue || 0)}</strong>
                                </div>
                            ))}
                            {!topPackages.length && <StaffSkeleton rows={5} className="p-0" />}
                        </div>
                    </section>
                    <section className="admin-panel overflow-hidden">
                        <div className="flex items-center justify-between border-b border-gray-100 bg-white p-5">
                            <div>
                                <p className="admin-kicker">Kitchen signal</p>
                                <h3 className="mt-1 text-xl font-black text-gray-950">Most selected dishes</h3>
                            </div>
                            {renderAnalyticsFilterButton('menuPerformance', MENU_CATEGORY_OPTIONS.find(option => option.value === menuViewFilters.category)?.label || 'Dish type')}
                        </div>
                        <div className="space-y-3 p-5">
                            {topDishes.map((dish, index) => (
                                <div key={`${dish.label}-${index}`} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-gray-100 p-3">
                                    <div>
                                        <p className="font-black text-gray-950">{dish.label || 'Dish'}</p>
                                        <p className="text-sm font-semibold text-gray-500">{dish.category || 'Menu item'}</p>
                                    </div>
                                    <strong className="text-sm font-black text-[#720101]">{menuViewFilters.sort === 'pax' ? `${dish.paxServed || 0} guests` : `${dish.selections || 0} selections`}</strong>
                                </div>
                            ))}
                            {!topDishes.length && <StaffSkeleton rows={5} className="p-0" />}
                        </div>
                    </section>
                </div>
            </div>
        );
    };

    const renderDashboardFilterButton = (panel, label = 'Filters') => (
        <button
            type="button"
            onClick={() => toggleDashboardFilterPanel(panel)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#720101]/15 bg-[#fff7e8] px-3 py-2 text-xs font-black text-[#720101] transition-colors hover:bg-[#fff1d0]"
            aria-expanded={activeDashboardFilterPanel === panel}
        >
            <Filter className="h-4 w-4" />
            {label}
            <ChevronDown className={`h-4 w-4 transition-transform ${activeDashboardFilterPanel === panel ? 'rotate-180' : ''}`} />
        </button>
    );

    const fetchAudits = async ({ silent = false } = {}) => {
        if (!silent) setAuditLoading(true);
        try {
            const data = await fetchCachedJson('/api/admin/audits?per_page=25', 15000);
            setAudits(data.data || []);
        } catch (error) {
            console.error(error);
            showToast(getErrorMessage(error, 'Could not load audit logs'), 'error');
        } finally {
            if (!silent) setAuditLoading(false);
        }
    };

    const fetchBookings = async ({ silent = false } = {}) => {
        if (!silent) setBookingsLoading(true);
        try {
            const data = await fetchCachedJson(ADMIN_BOOKINGS_URL, 30000);
            setBookings(getListData(data));
        } catch (error) {
            console.error(error);
            showToast(getErrorMessage(error, "Could not load bookings"), 'error');
        } finally {
            if (!silent) setBookingsLoading(false);
        }
    };

    const handleAssistedBookingCreated = (booking) => {
        setAssistedBookingOpen(false);
        showToast('Admin-assisted booking created.');
        bustAdminCache(ADMIN_BOOKINGS_URL, '/api/admin/analytics/summary', '/api/admin/analytics');
        fetchBookings({ silent: true });
        fetchAnalyticsSummary({ silent: true });
        if (booking) {
            setEventDetailsModal({ open: true, data: booking });
        }
    };

    const fetchRefundQueue = async ({ silent = false } = {}) => {
        if (!silent) setRefundLoading(true);
        try {
            const data = await fetchCachedJson('/api/admin/refunds/queue', 15000);
            setRefundQueue(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error(error);
            showToast(getErrorMessage(error, 'Could not load refund requests'), 'error');
        } finally {
            if (!silent) setRefundLoading(false);
        }
    };

    const handleApproveBooking = async (booking) => {
        if (!booking || normalizeStatus(booking.status) !== 'pending') return;
        setApprovingBookingId(booking.id);

        try {
            const res = await fetch(`/api/admin/bookings/${booking.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Confirmed' }),
            });

            if (res.ok) {
                showToast("Booking approved and customer notified");
                bustAdminCache(ADMIN_BOOKINGS_URL, '/api/admin/analytics');
                fetchBookings();
            } else {
                const err = await res.json().catch(() => ({}));
                showToast(getErrorMessage(err, "Could not approve booking"), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast("Could not approve booking. Please try again.", 'error');
        } finally {
            setApprovingBookingId(null);
        }
    };

    const handleDiscountSubmit = async (e) => {
        e.preventDefault();
        setDiscountLoading(true);
        try {
            // Session auth - no token needed
            const res = await fetch(`/api/admin/bookings/${discountModal.data.id}/discount`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(discountForm)
            });

            if (res.ok) {
                showToast("Discount applied successfully");
                setDiscountModal({ open: false, data: null });
                bustAdminCache(ADMIN_BOOKINGS_URL, '/api/admin/analytics');
                fetchBookings();
            } else {
                showToast("Could not apply discount", 'error');
            }
        } catch (error) {
            console.error(error);
            showToast("Could not apply discount. Please try again.", 'error');
        } finally {
            setDiscountLoading(false);
        }
    };

    const handleProcessRefund = async (itemOrBookingId) => {
        const item = typeof itemOrBookingId === 'object' ? itemOrBookingId : null;
        const bookingId = item?.booking_id || itemOrBookingId;
        const refundCase = item?.refund_cases?.[0] || null;
        const action = refundCase?.next_actions?.includes('retry_provider_refund') ? 'retry_provider_refund' : 'process';
        setConfirmDialog({
            isOpen: true,
            title: `${action === 'retry_provider_refund' ? 'Retry provider refund' : 'Process refund'} for booking #${bookingId}?`,
            message: action === 'retry_provider_refund'
                ? 'Admin will retry the PayMongo refund and keep the case open if the provider fails again.'
                : 'The non-refundable reservation fee will be retained and a refund case will be recorded.',
            confirmText: action === 'retry_provider_refund' ? 'Retry Refund' : 'Process Refund',
            tone: 'danger',
            onConfirm: () => confirmProcessRefund(bookingId, action, refundCase?.id || null),
        });
    };

    const confirmProcessRefund = async (bookingId, action = 'process', refundCaseId = null) => {
        closeConfirmDialog();
        setProcessingRefundId(bookingId);
        try {
            const isRetry = action === 'retry_provider_refund';
            const res = await fetch(isRetry ? `/api/admin/refund/${bookingId}/retry_provider_refund` : `/api/admin/refund/${bookingId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: isRetry ? JSON.stringify({ refund_case_id: refundCaseId }) : undefined,
            });
            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                showToast(data.message || 'Refund processed successfully');
                bustAdminCache('/api/admin/refunds/queue', '/api/admin/analytics');
                fetchRefundQueue();
                if (bookings.length > 0) fetchBookings({ silent: true });
            } else {
                const message = data?.details?.[0] || getErrorMessage(data, 'Could not process refund');
                showToast(message, 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Could not process refund. Please try again.', 'error');
        } finally {
            setProcessingRefundId(null);
        }
    };

    const handleEmpSubmit = async (e) => {
        e.preventDefault();
        setEmpFormLoading(true);
        setEmpFormErrors({});
        try {
            const isCustomerEdit = empModal.mode === 'edit' && empModal.data?.role === 'Client';
            const url = empModal.mode === 'add'
                ? '/api/admin/employees'
                : isCustomerEdit
                    ? `/api/admin/customers/${empModal.data.id}`
                    : `/api/admin/employees/${empModal.data.id}`;
            const method = empModal.mode === 'add' ? 'POST' : 'PUT';

            // Only send password if provided (for edits)
            const payload = { ...empForm };
            if (empModal.mode === 'edit' && !payload.password) {
                delete payload.password;
            }
            if (isCustomerEdit) {
                delete payload.role;
            }

            const res = await csrfFetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                showToast(`${isCustomerEdit ? 'Customer' : 'Account'} ${empModal.mode === 'add' ? 'created' : 'updated'} successfully.`);
                openTemporaryPasswordModal(data, payload);
                setEmpModal({ open: false, mode: 'add', data: null });
                bustAdminCache(ADMIN_EMPLOYEES_URL, ADMIN_CUSTOMERS_URL);
                fetchEmployees();
                fetchCustomers();
            } else {
                const err = await res.json().catch(() => ({}));
                setEmpFormErrors(err.errors || {});
                showToast(getErrorMessage(err, "Could not save account"), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast("Could not save account. Please try again.", 'error');
        } finally {
            setEmpFormLoading(false);
        }
    };

    const handleDeleteEmployee = async (id) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Deactivate staff account?',
            message: 'This staff account will lose access, but bookings, audit history, and operational records remain preserved.',
            confirmText: 'Deactivate',
            tone: 'danger',
            onConfirm: () => confirmDeleteEmployee(id),
        });
    };

    const confirmDeleteEmployee = async (id) => {
        closeConfirmDialog();
        try {
            // Session auth - no token needed
            const res = await csrfFetch(`/api/admin/employees/${id}`, {
                method: 'DELETE',
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                showToast(data.email_delivery || data.message || "Employee deactivated successfully");
                bustAdminCache(ADMIN_EMPLOYEES_URL);
                fetchEmployees();
            } else {
                showToast(getErrorMessage(data, "Could not deactivate employee"), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast("Could not deactivate employee. Please try again.", 'error');
        }
    };

    const handleReactivateEmployee = async (id) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Restore staff access?',
            message: 'This staff member will be able to sign in again with their current password unless a password change is required.',
            confirmText: 'Reactivate',
            tone: 'default',
            onConfirm: () => confirmReactivateEmployee(id),
        });
    };

    const confirmReactivateEmployee = async (id) => {
        closeConfirmDialog();
        try {
            const res = await csrfFetch(`/api/admin/employees/${id}/reactivate`, {
                method: 'POST',
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                showToast(data.email_delivery || data.message || 'Employee reactivated successfully');
                bustAdminCache(ADMIN_EMPLOYEES_URL);
                fetchEmployees();
            } else {
                showToast(getErrorMessage(data, 'Could not reactivate employee'), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Could not reactivate employee. Please try again.', 'error');
        }
    };

    const handleResetEmployeePassword = async (id) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Reset temporary password?',
            message: 'This creates a new temporary password, expires it in 24 hours, and asks the staff member to change it after signing in.',
            confirmText: 'Reset password',
            tone: 'default',
            onConfirm: () => confirmResetEmployeePassword(id),
        });
    };

    const confirmResetEmployeePassword = async (id) => {
        closeConfirmDialog();
        try {
            const res = await csrfFetch(`/api/admin/employees/${id}/reset-password`, {
                method: 'POST',
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                showToast(data.email_delivery || 'Temporary password generated.');
                openTemporaryPasswordModal(data, { id });
                fetchEmployees();
            } else {
                showToast(getErrorMessage(data, 'Could not reset password'), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Could not reset password. Please try again.', 'error');
        }
    };

    const handleForceEmployeePasswordChange = async (id) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Require password change?',
            message: 'This keeps the current password, but the staff member must set a new one on the next sign-in.',
            confirmText: 'Require change',
            tone: 'default',
            onConfirm: () => confirmForceEmployeePasswordChange(id),
        });
    };

    const confirmForceEmployeePasswordChange = async (id) => {
        closeConfirmDialog();
        try {
            const res = await csrfFetch(`/api/admin/employees/${id}/force-password-change`, {
                method: 'POST',
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                showToast(data.email_delivery || data.message || 'Staff will change password on next sign-in.');
                bustAdminCache(ADMIN_EMPLOYEES_URL);
                fetchEmployees();
            } else {
                showToast(getErrorMessage(data, 'Could not require password change'), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Could not require password change. Please try again.', 'error');
        }
    };

    const handleDeleteCustomer = async (id) => {
        setConfirmNotifyCustomer(true);
        confirmNotifyCustomerRef.current = true;
        setConfirmDialog({
            isOpen: true,
            title: 'Deactivate customer account?',
            message: 'This disables customer sign-in while preserving booking, payment, and audit records.',
            confirmText: 'Deactivate',
            tone: 'danger',
            showNotifyCustomer: true,
            onConfirm: () => confirmDeleteCustomer(id),
        });
    };

    const confirmDeleteCustomer = async (id) => {
        closeConfirmDialog();
        try {
            const res = await csrfFetch(`/api/admin/customers/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notify_customer: confirmNotifyCustomerRef.current }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                showToast(data.email_delivery || data.message || "Customer account deactivated successfully");
                bustAdminCache(ADMIN_CUSTOMERS_URL, adminCustomersUrl('active'), adminCustomersUrl('deactivated'), adminCustomersUrl('all'), ADMIN_BOOKINGS_URL, '/api/admin/analytics');
                fetchCustomers();
            } else {
                showToast(getErrorMessage(data, res.status === 419 ? "Your session expired. Refresh the page and try again." : "Could not update customer account"), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast("Could not update customer account. Please try again.", 'error');
        }
    };

    const handleReactivateCustomer = async (id) => {
        setConfirmNotifyCustomer(true);
        confirmNotifyCustomerRef.current = true;
        setConfirmDialog({
            isOpen: true,
            title: 'Restore customer access?',
            message: 'The customer will be able to sign in again with their current password. Booking and payment history stays preserved.',
            confirmText: 'Reactivate',
            tone: 'default',
            showNotifyCustomer: true,
            onConfirm: () => confirmReactivateCustomer(id),
        });
    };

    const confirmReactivateCustomer = async (id) => {
        closeConfirmDialog();
        try {
            const res = await csrfFetch(`/api/admin/customers/${id}/reactivate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notify_customer: confirmNotifyCustomerRef.current }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                showToast(data.email_delivery || data.message || 'Customer account reactivated successfully');
                bustAdminCache(ADMIN_CUSTOMERS_URL, adminCustomersUrl('active'), adminCustomersUrl('deactivated'), adminCustomersUrl('all'));
                fetchCustomers();
            } else {
                showToast(getErrorMessage(data, 'Could not reactivate customer account'), 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Could not reactivate customer account. Please try again.', 'error');
        }
    };

    const openEmpModal = (mode, employee = null) => {
        setEmpFormErrors({});
        if (mode === 'add') {
            setEmpForm({ full_name: '', username: '', password: '', role: 'Marketing', email: '', phone: '' });
        } else {
            setEmpForm({
                full_name: employee.full_name || '',
                username: employee.username,
                password: '', // blank password for editing implies no change
                role: employee.role,
                email: employee.email || '',
                phone: employee.phone || ''
            });
        }
        setEmpModal({ open: true, mode, data: employee });
    };

    const openCustomerModal = (customer) => {
        setEmpFormErrors({});
        setEmpForm({
            full_name: customer.full_name || '',
            username: customer.username,
            password: '',
            role: 'Client',
            email: customer.email || '',
            phone: customer.phone || ''
        });
        setEmpModal({ open: true, mode: 'edit', data: customer });
    };

    const openPackageDrawer = (pkg = null) => {
        if (pkg) {
            startEditingPackage(pkg);
        } else {
            resetPackageForm();
        }
        setCatalogDrawer('package');
    };

    const openEventTypeDrawer = (eventType = null) => {
        if (eventType) {
            startEditingEventType(eventType);
        } else {
            resetEventTypeForm();
        }
        setCatalogDrawer('eventType');
    };

    const closeCatalogDrawer = () => {
        if (catalogDrawer === 'package') resetPackageForm();
        if (catalogDrawer === 'eventType') resetEventTypeForm();
        setCatalogDrawer(null);
    };

    const togglePackageEventType = (slug) => {
        const current = packageForm.event_type_slugs || [];
        const next = current.includes(slug) ? current.filter(item => item !== slug) : [...current, slug];
        setPackageForm({ ...packageForm, event_type_slugs: next });
    };

    const renderCatalogDrawer = () => catalogDrawer && (
        <div className="staff-drawer-backdrop" role="dialog" aria-modal="true">
            <form onSubmit={catalogDrawer === 'package' ? handlePackageSubmit : handleEventTypeSubmit} className="staff-catalog-drawer">
                <header className="staff-drawer-header">
                    <div>
                        <p className="admin-kicker">{catalogDrawer === 'package' ? 'Package editor' : 'Event type editor'}</p>
                        <h3 className="staff-section-title">{catalogDrawer === 'package' ? (editingPackageId ? 'Edit package' : 'Create package') : (editingEventTypeId ? 'Edit event type' : 'Create event type')}</h3>
                    </div>
                    <button type="button" onClick={closeCatalogDrawer} className="staff-icon-button" aria-label="Close editor">X</button>
                </header>
                <div className="staff-drawer-body custom-scrollbar">
                    {catalogDrawer === 'package' ? (
                        <>
                            <section className="staff-drawer-section">
                                <p className="staff-section-title">Basics</p>
                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    <input required value={packageForm.name} onChange={e => setPackageForm({ ...packageForm, name: e.target.value })} placeholder="Package name" className="staff-control" />
                                    <select required value={packageForm.type} onChange={e => setPackageForm({ ...packageForm, type: e.target.value, event_type_slugs: packageForm.event_type_slugs?.includes(e.target.value) ? packageForm.event_type_slugs : [...(packageForm.event_type_slugs || []), e.target.value] })} className="staff-control">
                                        {eventTypes.map(type => <option key={type.id} value={type.slug}>{type.label}</option>)}
                                    </select>
                                    <select value={packageForm.package_category} onChange={e => setPackageForm({ ...packageForm, package_category: e.target.value })} className="staff-control">
                                        {PACKAGE_CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </select>
                                    <input required type="number" min="0" value={packageForm.base_price_per_head} onChange={e => setPackageForm({ ...packageForm, base_price_per_head: e.target.value })} placeholder="Price / head" className="staff-control" />
                                    <input required type="number" min="1" value={packageForm.minimum_pax} onChange={e => setPackageForm({ ...packageForm, minimum_pax: e.target.value })} placeholder="Minimum guests" className="staff-control sm:col-span-2" />
                                </div>
                            </section>
                            <section className="staff-drawer-section">
                                <p className="staff-section-title">Connected event types</p>
                                <div className="staff-checkbox-grid mt-4">
                                    {eventTypes.map(type => (
                                        <label key={type.id} className="staff-checkbox-chip">
                                            <input type="checkbox" checked={(packageForm.event_type_slugs || []).includes(type.slug)} onChange={() => togglePackageEventType(type.slug)} />
                                            <span>{type.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </section>
                            <section className="staff-drawer-section">
                                <p className="staff-section-title">Customer-facing details</p>
                                <div className="mt-4 grid gap-3">
                                    <textarea value={packageForm.description} onChange={e => setPackageForm({ ...packageForm, description: e.target.value })} placeholder="Description" rows={3} className="staff-control" />
                                    <textarea value={packageForm.inclusions} onChange={e => setPackageForm({ ...packageForm, inclusions: e.target.value })} placeholder="Inclusions, one per line" rows={3} className="staff-control" />
                                    <textarea value={packageForm.amenities} onChange={e => setPackageForm({ ...packageForm, amenities: e.target.value })} placeholder="Amenities, one per line" rows={3} className="staff-control" />
                                    <textarea value={packageForm.applicable_setups} onChange={e => setPackageForm({ ...packageForm, applicable_setups: e.target.value })} placeholder="Applicable setup notes, one per line" rows={3} className="staff-control" />
                                </div>
                            </section>
                            <section className="staff-drawer-section">
                                <p className="staff-section-title">Menu structure</p>
                                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                                    {[
                                        ['starter', 'Starters'],
                                        ['main', 'Main'],
                                        ['side', 'Sides'],
                                        ['dessert', 'Dessert'],
                                        ['drink', 'Drinks'],
                                    ].map(([key, label]) => (
                                        <label key={key} className="text-xs font-black uppercase tracking-wide text-slate-500">
                                            {label}
                                            <input type="number" min="0" value={packageForm.menu_structure?.[key] ?? 0} onChange={e => setPackageForm({ ...packageForm, menu_structure: { ...(packageForm.menu_structure || {}), [key]: Number(e.target.value || 0) } })} className="staff-control mt-2" />
                                        </label>
                                    ))}
                                </div>
                            </section>
                            <section className="staff-drawer-section">
                                <p className="staff-section-title">Security term</p>
                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    <select value={packageForm.security_type} onChange={e => setPackageForm({ ...packageForm, security_type: e.target.value, security_label: e.target.value === 'contingency' ? '10% Contingency' : 'Php 1,500 Cash Bond' })} className="staff-control">
                                        {SECURITY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </select>
                                    <input value={packageForm.security_label} onChange={e => setPackageForm({ ...packageForm, security_label: e.target.value })} placeholder="Security label" className="staff-control" />
                                </div>
                            </section>
                        </>
                    ) : (
                        <>
                            <section className="staff-drawer-section">
                                <p className="staff-section-title">Basics</p>
                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    <input required value={eventTypeForm.label} onChange={e => setEventTypeForm({ ...eventTypeForm, label: e.target.value })} placeholder="Event type name" className="staff-control" />
                                    <input value={eventTypeForm.slug} onChange={e => setEventTypeForm({ ...eventTypeForm, slug: e.target.value })} placeholder="Short name" className="staff-control" />
                                    <select value={eventTypeForm.package_category} onChange={e => setEventTypeForm({ ...eventTypeForm, package_category: e.target.value })} className="staff-control sm:col-span-2">
                                        {PACKAGE_CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </select>
                                </div>
                            </section>
                            <section className="staff-drawer-section">
                                <p className="staff-section-title">Display</p>
                                <div className="mt-4 grid gap-3">
                                    <input value={eventTypeForm.icon} onChange={e => setEventTypeForm({ ...eventTypeForm, icon: e.target.value })} placeholder="Icon name" className="staff-control" />
                                    <input value={eventTypeForm.image} onChange={e => setEventTypeForm({ ...eventTypeForm, image: e.target.value })} placeholder="Image link" className="staff-control" />
                                    <textarea value={eventTypeForm.description} onChange={e => setEventTypeForm({ ...eventTypeForm, description: e.target.value })} placeholder="Description" rows={3} className="staff-control" />
                                </div>
                            </section>
                            <section className="staff-drawer-section">
                                <p className="staff-section-title">Security and notes</p>
                                <div className="mt-4 grid gap-3">
                                    <select value={eventTypeForm.security_type} onChange={e => setEventTypeForm({ ...eventTypeForm, security_type: e.target.value, security_label: e.target.value === 'contingency' ? '10% Contingency' : 'Php 1,500 Cash Bond' })} className="staff-control">
                                        {SECURITY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </select>
                                    <input value={eventTypeForm.security_label} onChange={e => setEventTypeForm({ ...eventTypeForm, security_label: e.target.value })} placeholder="Security label" className="staff-control" />
                                    <textarea value={eventTypeForm.applicable_setups} onChange={e => setEventTypeForm({ ...eventTypeForm, applicable_setups: e.target.value })} placeholder="Applicable setups, one per line" rows={3} className="staff-control" />
                                    <textarea value={eventTypeForm.security_description} onChange={e => setEventTypeForm({ ...eventTypeForm, security_description: e.target.value })} placeholder="Security term explanation" rows={3} className="staff-control" />
                                </div>
                            </section>
                        </>
                    )}
                </div>
                <footer className="staff-drawer-footer flex justify-end gap-2">
                    <button type="button" onClick={closeCatalogDrawer} className="staff-button-secondary">Cancel</button>
                    <button type="submit" disabled={packageSaving} className="staff-button-primary">
                        {packageSaving ? 'Saving...' : catalogDrawer === 'package' ? (editingPackageId ? 'Save package' : 'Create package') : (editingEventTypeId ? 'Save event type' : 'Create event type')}
                    </button>
                </footer>
            </form>
        </div>
    );

    if (analyticsLoading && activeTab === 'today' && !analytics?.summary) {
        return (
            <StaffWorkspaceSkeleton
                title="Admin Console"
                roleLabel="Owner operations"
                label="Preparing admin console"
                navGroups={[
                    { label: 'Owner Workbench', items: ['Today', 'Bookings & Intake', 'Calendar', 'Handoff', 'Finance', 'Messages & Inquiries'] },
                    { label: 'Business Control', items: ['Public Content', 'Availability', 'Accounts'] },
                    { label: 'Insight & Governance', items: ['Analytics', 'Reports', 'System & Audit', 'Event History'] },
                ]}
            />
        );
    }

    return (
        <StaffWorkspaceLayout
            title="Admin Console"
            roleLabel="Owner operations"
            username={user?.username}
            active={activeTab}
            onNavigate={setActiveTab}
            onLogout={handleLogout}
            navGroups={adminNavGroups}
            roleKey="admin"
            workspaceClassName="admin-page"
        >
                <StaffPageHeader
                    eyebrow={currentPage.eyebrow}
                    title={currentPage.title}
                    description={currentPage.description}
                    metrics={[
                        { label: 'Bookings', value: bookingStats.total },
                        { label: 'Customers', value: customers.length },
                        { label: 'Staff', value: employees.length },
                        { label: 'Refunds', value: refundQueue.length },
                    ]}
                />

                <div className={ADMIN_FULL_SURFACE_TABS.includes(activeTab) ? 'admin-full-surface-tab-shell' : 'space-y-5'}>
                    {activeTab === 'today' && (
                        <div className="animate-fadeIn">
                            <div className="space-y-6">
                                <section className="admin-panel admin-today-command overflow-hidden">
                                    <div className="admin-compact-command border-0 bg-[#fffaf3]">
                                        <div>
                                            <p className="admin-kicker">Daily work</p>
                                            <h3>What needs attention today</h3>
                                            <p>A focused view of bookings, collections, refunds, and activity that may need staff action.</p>
                                        </div>
                                        <div className="admin-command-actions">
                                            <div className="admin-primary-actions">
                                                <button onClick={() => setAssistedBookingOpen(true)} className="admin-button-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-black">
                                                    Create booking
                                                </button>
                                                <button onClick={() => setActiveTab('handoff')} className="admin-button-secondary inline-flex items-center justify-center px-3 py-2.5 text-sm font-black">
                                                    Handoff
                                                </button>
                                                <button onClick={() => setActiveTab('reports')} className="admin-button-secondary inline-flex items-center justify-center px-3 py-2.5 text-sm font-black">
                                                    Reports
                                                </button>
                                            </div>
                                            <div className="admin-utility-actions">
                                                {renderDashboardFilterButton('dashboardSnapshot', businessSnapshot.label || 'Timeframe')}
                                                <button
                                                    onClick={() => fetchAnalytics()}
                                                    disabled={analyticsLoading}
                                                    className="admin-icon-action"
                                                    title={analyticsLoading ? 'Refreshing dashboard data' : 'Refresh dashboard data'}
                                                    aria-label={analyticsLoading ? 'Refreshing dashboard data' : 'Refresh dashboard data'}
                                                >
                                                    <RefreshCw className={`h-4 w-4 ${analyticsLoading ? 'animate-spin' : ''}`} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    {activeDashboardFilterPanel === 'dashboardSnapshot' && (
                                        <div className="border-t border-gray-100 bg-white px-4 py-3">
                                            <label className="block max-w-xs text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                <span className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" /> Overview timeframe</span>
                                                <select
                                                    value={analyticsFilters.snapshot_window}
                                                    onChange={(event) => {
                                                        const nextFilters = { ...analyticsFilters, snapshot_window: event.target.value };
                                                        setAnalyticsFilters(nextFilters);
                                                        fetchAnalytics({ filters: nextFilters });
                                                    }}
                                                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none"
                                                >
                                                    {SNAPSHOT_WINDOW_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                </select>
                                            </label>
                                        </div>
                                    )}
                                    <div className="admin-stat-strip border-t border-gray-100 bg-white px-4 py-3">
                                        {[
                                            ['Total revenue', formatCurrency(analyticsSummary.totalRevenue || 0), `Collected ${formatCurrency(analyticsSummary.settledRevenue || 0)}`],
                                            ['Collection rate', `${analyticsSummary.collectionRate || 0}%`, `Pending ${formatCurrency(analyticsSummary.pendingRevenue || 0)}`],
                                            ['Active bookings', analyticsSummary.activeBookings || 0, `${analyticsSummary.pendingBookings || 0} pending requests`],
                                            ['Total guests', Number(analyticsSummary.totalPax || 0).toLocaleString(), `Avg booking ${formatCurrency(analyticsSummary.averageBookingValue || 0)}`],
                                        ].map(([label, value, hint]) => (
                                            <span key={label} className="admin-stat-chip admin-stat-chip-wide">
                                                <strong>{value}</strong>
                                                <em>{label}</em>
                                                <small>{hint}</small>
                                            </span>
                                        ))}
                                    </div>
                                </section>

                                <NextActionPanel
                                    eyebrow="Oversight"
                                    title="Admin work needing attention"
                                    description="Exceptions, account access, refunds, and system activity are grouped here before the detailed reports."
                                    actions={adminNextActions}
                                    emptyTitle="No admin actions waiting"
                                    emptyMessage="Booking, refund, account, and system exceptions will appear here."
                                />

                                <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                                    <section className="admin-panel p-6 xl:col-span-2">
                                        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <p className="admin-kicker">Financial pulse</p>
                                                <h3 className="mt-1 text-lg font-black text-gray-950">Collected Revenue Trend</h3>
                                                <p className="mt-1 text-sm font-semibold text-gray-500">Verified collections across the selected historical window.</p>
                                            </div>
                                            {renderDashboardFilterButton('dashboardRevenue', `Last ${analyticsFilters.trend_months} months`)}
                                        </div>
                                        {activeDashboardFilterPanel === 'dashboardRevenue' && (
                                            <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                    <span className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" /> Trend window</span>
                                                    <select
                                                        value={analyticsFilters.trend_months}
                                                        onChange={(event) => {
                                                            const nextFilters = { ...analyticsFilters, trend_months: event.target.value };
                                                            setAnalyticsFilters(nextFilters);
                                                            fetchAnalytics({ filters: nextFilters });
                                                        }}
                                                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none"
                                                    >
                                                        {[3, 6, 9, 12, 18, 24].map(months => <option key={months} value={months}>Last {months} months</option>)}
                                                    </select>
                                                </label>
                                            </div>
                                        )}
                                        <div className="h-72">
                                            {revenueTrendData.length ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={revenueTrendData}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(value) => `PHP ${Math.round(value / 1000)}k`} />
                                                        <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                                                        <Line type="monotone" dataKey="revenue" stroke="#720101" strokeWidth={3} dot={{ r: 4 }} name="Collected" />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            ) : <div className="flex h-full items-center justify-center rounded-xl bg-gray-50 text-sm font-bold text-gray-400">No collected revenue for this window.</div>}
                                        </div>
                                    </section>

                                    <section className="admin-panel p-6">
                                        <div className="mb-5 flex items-start justify-between gap-3">
                                            <div>
                                                <p className="admin-kicker">Attention center</p>
                                                <h3 className="mt-1 text-lg font-black text-gray-950">Operational Alerts</h3>
                                                <p className="mt-1 text-sm font-semibold text-gray-500">Items that need admin action.</p>
                                            </div>
                                            {renderDashboardFilterButton('dashboardAlerts', alertFilters.severity === 'all' ? 'Severity' : alertFilters.severity)}
                                        </div>
                                        {activeDashboardFilterPanel === 'dashboardAlerts' && (
                                            <div className="mb-5 rounded-xl border border-gray-100 bg-gray-50 p-4">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                    Alert severity
                                                    <select value={alertFilters.severity} onChange={(e) => setAlertFilters({ ...alertFilters, severity: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                        <option value="all">All severities</option>
                                                        <option value="danger">Danger</option>
                                                        <option value="warning">Warning</option>
                                                        <option value="success">Healthy</option>
                                                    </select>
                                                </label>
                                            </div>
                                        )}
                                        <div className="space-y-3">
                                            {visibleOperationalAlerts.map((alert) => (
                                                <div key={alert.label} className={`rounded-xl border p-4 ${alert.severity === 'danger' ? 'border-red-200 bg-red-50' : alert.severity === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-emerald-100 bg-emerald-50'}`}>
                                                    <div className="flex items-start justify-between gap-4">
                                                        <p className="text-sm font-black text-gray-900">{alert.label}</p>
                                                        <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-gray-950 shadow-sm">{alert.count}</span>
                                                    </div>
                                                    <button onClick={() => alert.label.includes('payment') ? setActiveTab('finance') : setActiveTab('bookings-intake')} className="mt-3 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-900">Open queue</button>
                                                </div>
                                            ))}
                                            {!visibleOperationalAlerts.length && <div className="rounded-xl bg-gray-50 p-6 text-sm font-bold text-gray-400">No alerts match this severity.</div>}
                                        </div>
                                    </section>
                                </div>

                                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                                    <section className="admin-panel p-6">
                                        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <p className="admin-kicker">Collections</p>
                                                <h3 className="mt-1 text-lg font-black text-gray-950">Payment Risk</h3>
                                                <p className="mt-1 text-sm font-semibold text-gray-500">Payment exposure by status and aging bucket.</p>
                                            </div>
                                            {renderDashboardFilterButton('dashboardPayment', paymentRiskFilters.status === 'all' ? 'Risk filters' : paymentRiskFilters.status)}
                                        </div>
                                        {activeDashboardFilterPanel === 'dashboardPayment' && (
                                            <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                    <span className="flex items-center gap-2"><CreditCard className="h-3.5 w-3.5" /> Payment status</span>
                                                    <select value={paymentRiskFilters.status} onChange={(e) => setPaymentRiskFilters({ ...paymentRiskFilters, status: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                        <option value="all">All statuses</option>
                                                        {paymentStatusBreakdown.map(row => <option key={row.label} value={String(row.label || '').toLowerCase()}>{row.label}</option>)}
                                                    </select>
                                                </label>
                                                <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                    Minimum aging balance
                                                    <input type="number" min="0" value={paymentRiskFilters.minBalance} onChange={(e) => setPaymentRiskFilters({ ...paymentRiskFilters, minBalance: e.target.value })} placeholder="Show all" className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none" />
                                                </label>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                            <div className="h-56">
                                                {visiblePaymentStatusBreakdown.length ? (
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={visiblePaymentStatusBreakdown}>
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                                            <RechartsTooltip formatter={(value, name) => name === 'total' ? formatCurrency(value) : value} />
                                                            <Bar dataKey="total" fill="#f0aa0b" radius={[6, 6, 0, 0]} name="Amount" />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                ) : <div className="flex h-full items-center justify-center rounded-xl bg-gray-50 text-sm font-bold text-gray-400">No payment rows.</div>}
                                            </div>
                                            <div className="space-y-3">
                                                {visiblePaymentAgingData.map((bucket) => (
                                                    <div key={bucket.label} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span className="text-sm font-black text-gray-800">{bucket.label}</span>
                                                            <span className="text-sm font-black text-gray-950">{formatCurrency(bucket.value || 0)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {!visiblePaymentAgingData.length && <div className="rounded-xl bg-gray-50 p-6 text-sm font-bold text-gray-400">No aging balances match this filter.</div>}
                                            </div>
                                        </div>
                                    </section>

                                    <section className="admin-panel p-6">
                                        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <p className="admin-kicker">Workload</p>
                                                <h3 className="mt-1 text-lg font-black text-gray-950">Booking Pipeline & Next Events</h3>
                                                <p className="mt-1 text-sm font-semibold text-gray-500">Operational volume and near-term service load.</p>
                                            </div>
                                            {renderDashboardFilterButton('dashboardWorkload', workloadFilters.status === 'all' ? 'Workload filters' : workloadFilters.status)}
                                        </div>
                                        {activeDashboardFilterPanel === 'dashboardWorkload' && (
                                            <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                    <span className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5" /> Upcoming status</span>
                                                    <select value={workloadFilters.status} onChange={(e) => setWorkloadFilters({ ...workloadFilters, status: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                        <option value="all">All statuses</option>
                                                        {Array.from(new Set(upcomingWorkloadData.map(event => String(event.status || '').toLowerCase()).filter(Boolean))).map(status => <option key={status} value={status}>{status}</option>)}
                                                    </select>
                                                </label>
                                                <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                    <span className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Minimum guests</span>
                                                    <input type="number" min="0" value={workloadFilters.minPax} onChange={(e) => setWorkloadFilters({ ...workloadFilters, minPax: e.target.value })} placeholder="Show all" className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none" />
                                                </label>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                            {bookingPipelineData.slice(0, 3).map((row) => (
                                                <div key={row.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                                                    <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{row.label}</p>
                                                    <p className="mt-2 text-2xl font-black text-gray-950">{row.count}</p>
                                                    <p className="text-xs font-bold text-amber-700">{formatCurrency(row.value || 0)}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-5 overflow-hidden rounded-xl border border-gray-100">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 text-xs font-black uppercase tracking-widest text-gray-500">
                                                    <tr><th className="px-4 py-3 text-left">Upcoming Event</th><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-right">Guests</th><th className="px-4 py-3 text-left">Status</th></tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {visibleUpcomingWorkloadData.slice(0, 6).map((event) => (
                                                        <tr key={event.id || `${event.client}-${event.date}`}>
                                                            <td className="px-4 py-3 font-bold text-gray-900">{event.client || event.eventType || 'Event'}</td>
                                                            <td className="px-4 py-3 text-gray-600">{event.date}</td>
                                                            <td className="px-4 py-3 text-right font-bold text-gray-900">{event.pax}</td>
                                                            <td className="px-4 py-3 text-gray-600">{event.status || event.eventType}</td>
                                                        </tr>
                                                    ))}
                                                    {!visibleUpcomingWorkloadData.length && <tr><td colSpan="4" className="px-4 py-8 text-center font-bold text-gray-400">No upcoming events match this filter.</td></tr>}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>
                                </div>

                                <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                                    <section className="admin-panel p-6">
                                        <div className="mb-5 flex items-start justify-between gap-3">
                                            <div>
                                                <p className="admin-kicker">Sales mix</p>
                                                <h3 className="mt-1 text-lg font-black text-gray-950">Top Packages</h3>
                                            </div>
                                            {renderDashboardFilterButton('dashboardPackages', `Top ${packageViewFilters.limit}`)}
                                        </div>
                                        {activeDashboardFilterPanel === 'dashboardPackages' && (
                                            <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                                                <select value={packageViewFilters.limit} onChange={(e) => setPackageViewFilters({ ...packageViewFilters, limit: e.target.value })} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-800 outline-none">
                                                    {PERFORMANCE_LIMIT_OPTIONS.map(value => <option key={value} value={value}>Top {value} packages</option>)}
                                                </select>
                                                <select value={packageViewFilters.sort} onChange={(e) => setPackageViewFilters({ ...packageViewFilters, sort: e.target.value })} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-800 outline-none">
                                                    <option value="revenue">Revenue</option>
                                                    <option value="bookings">Bookings</option>
                                                    <option value="name">Package name</option>
                                                </select>
                                            </div>
                                        )}
                                        <div className="space-y-3">
                                            {visiblePackagePerformanceData.slice(0, 5).map((pkg) => (
                                                <div key={pkg.label || pkg.name}>
                                                    <div className="flex items-center justify-between gap-3 text-sm">
                                                        <span className="truncate font-black text-gray-800">{pkg.label || pkg.name}</span>
                                                        <span className="font-black text-amber-700">{formatCurrency(pkg.revenue || 0)}</span>
                                                    </div>
                                                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                                                        <div className="h-full rounded-full bg-[#720101]" style={{ width: `${Math.max(8, (Number(pkg.revenue || 0) / maxPackageRevenue) * 100)}%` }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    <section className="admin-panel p-6">
                                        <div className="mb-5 flex items-start justify-between gap-3">
                                            <div>
                                                <p className="admin-kicker">Menu velocity</p>
                                                <h3 className="mt-1 text-lg font-black text-gray-950">Top Dishes</h3>
                                            </div>
                                            {renderDashboardFilterButton('dashboardMenu', MENU_CATEGORY_OPTIONS.find(option => option.value === menuViewFilters.category)?.label || 'Dish type')}
                                        </div>
                                        {activeDashboardFilterPanel === 'dashboardMenu' && (
                                            <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                                                <select value={menuViewFilters.category} onChange={(e) => setMenuViewFilters({ ...menuViewFilters, category: e.target.value })} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-800 outline-none">
                                                    {MENU_CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                </select>
                                                <select value={menuViewFilters.sort} onChange={(e) => setMenuViewFilters({ ...menuViewFilters, sort: e.target.value })} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-800 outline-none">
                                                    <option value="selections">Selections</option>
                                                    <option value="pax">Guests served</option>
                                                    <option value="name">Dish name</option>
                                                </select>
                                            </div>
                                        )}
                                        <div className="space-y-3">
                                            {visibleMenuPerformanceData.slice(0, 6).map((dish) => (
                                                <div key={dish.label} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-black text-gray-900">{dish.label}</p>
                                                        <p className="text-xs font-bold uppercase text-gray-400">{dish.category}</p>
                                                    </div>
                                                    <span className="text-sm font-black text-[#720101]">{menuViewFilters.sort === 'pax' ? dish.paxServed : dish.selections}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    <section className="admin-panel p-6">
                                        <div className="mb-5">
                                            <p className="admin-kicker">Demand intensity</p>
                                            <h3 className="mt-1 text-lg font-black text-gray-950">Peak Season Heatmap</h3>
                                            <p className="mt-1 text-sm font-semibold text-gray-500">Monthly event load for planning purchasing and staffing.</p>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3 text-center text-xs sm:grid-cols-4">
                                            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month) => {
                                                const val = peakSeasonData.find(item => item.month === month)?.events || peakSeasonData.find(item => item.month === month)?.count || 0;
                                                const bgColor = val <= 3 ? 'bg-green-100 text-green-800' : val <= 6 ? 'bg-yellow-200 text-yellow-800' : val <= 8 ? 'bg-orange-300 text-orange-900' : 'bg-red-500 text-white font-bold';
                                                return (
                                                    <div key={month} className={`rounded-xl p-3 ${bgColor}`}>
                                                        <span className="block font-black">{month}</span>
                                                        <span className="text-[11px] font-bold">{val} events</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="admin-heatmap-legend mt-5">
                                            {[
                                                ['bg-green-100', 'Low', '0-3 events'],
                                                ['bg-yellow-200', 'Moderate', '4-6 events'],
                                                ['bg-orange-300', 'High', '7-8 events'],
                                                ['bg-red-500', 'Peak', '9+ events'],
                                            ].map(([color, label, range]) => (
                                                <span key={label}>
                                                    <i className={color} />
                                                    <strong>{label}</strong>
                                                    <em>{range}</em>
                                                </span>
                                            ))}
                                        </div>
                                    </section>
                                </div>
                            </div>

                            <div className="hidden">
                            <section className="admin-hero rounded-2xl p-6 text-white">
                                <div className="max-w-3xl">
                                    <p className="text-xs font-black uppercase text-[#f0aa0b]">Today’s operating picture</p>
                                    <h3 className="mt-2 text-3xl font-black">Keep service decisions tied to actual bookings.</h3>
                                    <p className="mt-2 max-w-2xl text-sm font-medium text-white/72">Revenue, menu movement, demand, and payment exposure stay refreshed from current operations.</p>
                                </div>
                            </section>

                            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="admin-metric-card overflow-hidden">
                                    <div className="px-5 py-5">
                                        <dt className="text-sm font-bold text-slate-500 truncate flex items-center gap-2">
                                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            Total Revenue
                                        </dt>
                                        <dd className="mt-2 text-3xl font-extrabold text-gray-900">{formatCurrency(analyticsSummary.totalRevenue)}</dd>
                                        <p className="mt-2 text-xs font-semibold text-emerald-700">Settled: {formatCurrency(analyticsSummary.settledRevenue)}</p>
                                    </div>
                                </div>
                                <div className="admin-metric-card overflow-hidden">
                                    <div className="px-5 py-5">
                                        <dt className="text-sm font-bold text-slate-500 truncate flex items-center gap-2">
                                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                            Pending Bookings
                                        </dt>
                                        <dd className="mt-2 text-3xl font-extrabold text-gray-900">{analyticsSummary.pendingBookings || 0}</dd>
                                        <p className="mt-2 text-xs font-semibold text-amber-700">Needs approval or follow-up</p>
                                    </div>
                                </div>
                                <div className="admin-metric-card overflow-hidden">
                                    <div className="px-5 py-5">
                                        <dt className="text-sm font-bold text-slate-500 truncate flex items-center gap-2">
                                            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            Confirmed Bookings
                                        </dt>
                                        <dd className="mt-2 text-3xl font-extrabold text-gray-900">{analyticsSummary.activeBookings || 0}</dd>
                                        <p className="mt-2 text-xs font-semibold text-[#720101]">Events moving through service</p>
                                    </div>
                                </div>
                                <div className="admin-metric-card overflow-hidden">
                                    <div className="px-5 py-5">
                                        <dt className="text-sm font-bold text-slate-500 truncate flex items-center gap-2">
                                            <svg className="w-4 h-4 text-[#f0aa0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m8-4a4 4 0 10-8 0 4 4 0 008 0z" /></svg>
                                            Total Guests
                                        </dt>
                                        <dd className="mt-2 text-3xl font-extrabold text-gray-900">{Number(analyticsSummary.totalPax || 0).toLocaleString()}</dd>
                                        <p className="mt-2 text-xs font-semibold text-slate-500">Avg. value: {formatCurrency(analyticsSummary.averageBookingValue)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Revenue Trends */}
                                <div className="admin-panel p-6">
                                    <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-[#720101]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                        Revenue Trends (Last {analyticsFilters.trend_months || 6} Months)
                                    </h3>
                                    <div className="mb-4 flex justify-end">
                                        <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                            Window
                                            <select
                                                value={analyticsFilters.trend_months}
                                                onChange={(event) => {
                                                    const nextFilters = { ...analyticsFilters, trend_months: event.target.value };
                                                    setAnalyticsFilters(nextFilters);
                                                    fetchAnalytics({ filters: nextFilters });
                                                }}
                                                className="ml-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-gray-800 outline-none focus:ring-2 focus:ring-amber-100"
                                            >
                                                {[3, 6, 9, 12, 18, 24].map(months => <option key={months} value={months}>Last {months} months</option>)}
                                            </select>
                                        </label>
                                    </div>
                                    <div className="h-64 flex items-end justify-between gap-2 overflow-hidden">
                                        {(revenueTrendData.length ? revenueTrendData : []).map((item, i) => {
                                            const maxRevenue = Math.max(...revenueTrendData.map(row => row.revenue || 0), 1);
                                            const val = Math.max(8, Math.round(((item.revenue || 0) / maxRevenue) * 100));
                                            return (
                                            <div key={i} className="w-full h-full flex flex-col items-center justify-end gap-2 group">
                                                <div className="w-full bg-[#f8ead5] rounded-t-md relative flex items-end justify-center group-hover:bg-[#f0d9b4] transition-colors" style={{ height: `${val}%` }}>
                                                    <div className="absolute -top-8 bg-gray-900 text-white text-xs font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                                        {formatCurrency(item.revenue)}
                                                    </div>
                                                    <div className="w-full bg-[#720101] rounded-t-md opacity-80" style={{ height: `${val > 50 ? val - 20 : val}%` }}></div>
                                                </div>
                                                <span className="text-xs font-medium text-gray-500">{item.label || item.month}</span>
                                            </div>
                                        )})}
                                    </div>
                                </div>

                                {/* Market Intelligence: Top Sellers */}
                                <div className="admin-panel p-6">
                                    <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                        Market Intelligence (Top Sellers)
                                    </h3>
                                    <div className="space-y-6">
                                        {topSellerData.map((item, i) => {
                                            const maxCount = Math.max(...topSellerData.map(row => row.count || 0), 1);
                                            return (
                                            <div key={i}>
                                                <div className="flex justify-between text-sm mb-2">
                                                    <span className="font-bold text-gray-700">{item.label || item.name}</span>
                                                    <span className="text-gray-500 font-bold">{item.count} Bookings</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                                    <div className="bg-[#720101] h-3 rounded-full" style={{ width: `${Math.max(10, (item.count / maxCount) * 100)}%` }}></div>
                                                </div>
                                            </div>
                                        )})}
                                    </div>
                                </div>

                                {/* Peak Season Heatmap Placeholder */}
                                <div className="admin-panel p-6 lg:col-span-2">
                                    <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        Peak Season Heatmap (Demand Intensity)
                                    </h3>
                                    <div className="grid grid-cols-6 md:grid-cols-12 gap-3 text-center text-xs">
                                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, i) => {
                                            const val = peakSeasonData.find(item => item.month === month)?.events || peakSeasonData.find(item => item.month === month)?.count || 0;
                                            const bgColor = val <= 3 ? 'bg-green-100 text-green-800' : val <= 6 ? 'bg-yellow-200 text-yellow-800' : val <= 8 ? 'bg-orange-300 text-orange-900' : 'bg-red-500 text-white font-bold shadow-sm';

                                            return (
                                                <div key={i} className={`flex flex-col items-center justify-center p-4 rounded-xl ${bgColor} transition-transform hover:scale-105 cursor-default`}>
                                                    <span className="font-bold text-sm mb-1">{month}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-6 flex items-center justify-end gap-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
                                        <span className="flex items-center gap-2"><div className="w-4 h-4 bg-green-100 rounded"></div> Low</span>
                                        <span className="flex items-center gap-2"><div className="w-4 h-4 bg-yellow-200 rounded"></div> Med</span>
                                        <span className="flex items-center gap-2"><div className="w-4 h-4 bg-orange-300 rounded"></div> High</span>
                                        <span className="flex items-center gap-2"><div className="w-4 h-4 bg-red-500 rounded"></div> Peak</span>
                                    </div>
                                </div>
                            </div>

                            </div>
                        </div>
                    )}
                    {activeTab === 'analytics' && (
                        <>
                        {renderAnalyticsWorkbench()}
                        <div className="hidden">
                            <section className="admin-panel overflow-hidden">
                                <div className="flex flex-col gap-4 border-b border-gray-100 bg-[#fffaf3] p-6 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <p className="admin-kicker">Predictive Intelligence</p>
                                        <h3 className="mt-1 text-2xl font-black text-gray-950">Business Forecasting & Operational Signals</h3>
                                        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-gray-500">Forecast revenue and guest demand with simple moving averages, then review the operational signals admins need for staffing, purchasing, and payment follow-up.</p>
                                    </div>
                                    <button onClick={() => fetchAnalytics()} disabled={analyticsLoading} className="admin-button-primary inline-flex w-full items-center justify-center gap-2 px-5 py-2.5 text-sm font-black sm:w-auto">
                                        <RefreshCw className={`h-4 w-4 ${analyticsLoading ? 'animate-spin' : ''}`} />
                                        {analyticsLoading ? 'Refreshing...' : 'Refresh Analytics'}
                                    </button>
                                </div>
                                <div className="p-5">
                                    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                        <div>
                                            <h4 className="text-lg font-black text-gray-950">Business Snapshot</h4>
                                            <p className="mt-1 text-sm font-semibold text-gray-500">High-signal metrics for revenue, demand, bookings, and collection health.</p>
                                        </div>
                                        {renderAnalyticsFilterButton('snapshot', businessSnapshot.label || 'Timeframe')}
                                    </div>
                                    {activeAnalyticsFilterPanel === 'snapshot' && (
                                        <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                <span className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" /> Snapshot timeframe</span>
                                                <select
                                                    value={analyticsFilters.snapshot_window}
                                                    onChange={(event) => {
                                                        const nextFilters = { ...analyticsFilters, snapshot_window: event.target.value };
                                                        setAnalyticsFilters(nextFilters);
                                                        fetchAnalytics({ filters: nextFilters });
                                                    }}
                                                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none focus:ring-2 focus:ring-amber-100"
                                                >
                                                    {SNAPSHOT_WINDOW_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                </select>
                                            </label>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                        {businessSnapshotCards.map((card) => (
                                            <div key={card.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                                                <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{card.label}</p>
                                                <p className="mt-2 text-2xl font-black text-gray-950">{formatAnalyticsCardValue(card.value, card.format)}</p>
                                                <p className="mt-1 text-xs font-semibold text-gray-500">{card.hint}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {businessSnapshot.insight && (
                                        <p className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">{businessSnapshot.insight}</p>
                                    )}
                                </div>
                            </section>

                            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                                <section className="admin-panel p-6">
                                    <div className="border-b border-gray-100 pb-5">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div>
                                                <p className="admin-kicker">Finance Forecast</p>
                                                <h3 className="mt-1 text-xl font-black text-gray-950">Revenue Forecast Using SMA</h3>
                                                <p className="mt-2 text-sm font-semibold leading-6 text-gray-500">Projects short-term collected revenue by smoothing verified payment history.</p>
                                            </div>
                                            {renderAnalyticsFilterButton('revenueForecast', `${analyticsFilters.revenue_forecast_period} forecast`)}
                                        </div>
                                        {activeAnalyticsFilterPanel === 'revenueForecast' && <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-3">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Period
                                                <select value={analyticsFilters.revenue_forecast_period} onChange={(e) => setAnalyticsFilters({ ...analyticsFilters, revenue_forecast_period: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    {FORECAST_PERIOD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                </select>
                                            </label>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Smoothing
                                                <select value={analyticsFilters.revenue_sma_window} onChange={(e) => setAnalyticsFilters({ ...analyticsFilters, revenue_sma_window: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    {SMA_WINDOW_OPTIONS.map(value => <option key={value} value={value}>{value}-period SMA</option>)}
                                                </select>
                                            </label>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Forecast
                                                <select value={analyticsFilters.revenue_forecast_horizon} onChange={(e) => setAnalyticsFilters({ ...analyticsFilters, revenue_forecast_horizon: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    {FORECAST_HORIZON_OPTIONS.map(value => <option key={value} value={value}>{value} periods ahead</option>)}
                                                </select>
                                            </label>
                                            <button type="button" onClick={() => fetchAnalytics()} className="rounded-xl bg-[#720101] px-4 py-2.5 text-xs font-black text-white shadow-sm transition-colors hover:bg-[#8d0808] sm:col-span-3">Apply Forecast Filters</button>
                                        </div>}
                                    </div>
                                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        {[
                                            ['Next forecast', formatCurrency(revenueForecastSummary.nextForecast || 0)],
                                            ['Last actual', formatCurrency(revenueForecastSummary.lastActual || 0)],
                                            ['Movement', `${revenueForecastSummary.changePercent || 0}% ${revenueForecastSummary.direction === 'up' ? 'increase' : 'decrease'}`],
                                        ].map(([label, value]) => (
                                            <div key={label} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                                                <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                                                <p className="mt-1 text-lg font-black text-gray-950">{value}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-6 h-80">
                                        {revenueForecastData.length ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={revenueForecastData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(value) => `PHP ${Math.round(value / 1000)}k`} />
                                                    <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                                                    <Bar dataKey="revenue" fill="#720101" radius={[6, 6, 0, 0]} name="Actual collected" />
                                                    <Bar dataKey="forecast" fill="#f0aa0b" radius={[6, 6, 0, 0]} name="SMA forecast" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : <div className="flex h-full items-center justify-center rounded-xl bg-gray-50 text-sm font-bold text-gray-400">No revenue data available.</div>}
                                    </div>
                                    <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">{revenueForecast.insight}</p>
                                </section>

                                <section className="admin-panel p-6">
                                    <div className="border-b border-gray-100 pb-5">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div>
                                                <p className="admin-kicker">Operations Forecast</p>
                                                <h3 className="mt-1 text-xl font-black text-gray-950">Moving Averages for Guest Demand Projection</h3>
                                                <p className="mt-2 text-sm font-semibold leading-6 text-gray-500">Smooths historical guest demand so culinary and logistics planning is not distorted by one-off spikes.</p>
                                            </div>
                                            {renderAnalyticsFilterButton('paxForecast', `${analyticsFilters.pax_projection_period} demand`)}
                                        </div>
                                        {activeAnalyticsFilterPanel === 'paxForecast' && <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-3">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Period
                                                <select value={analyticsFilters.pax_projection_period} onChange={(e) => setAnalyticsFilters({ ...analyticsFilters, pax_projection_period: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    {FORECAST_PERIOD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                </select>
                                            </label>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Year
                                                <select value={analyticsFilters.pax_projection_year} onChange={(e) => setAnalyticsFilters({ ...analyticsFilters, pax_projection_year: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    <option value="">All years</option>
                                                    {ANALYTICS_YEARS.map(year => <option key={year} value={year}>{year}</option>)}
                                                </select>
                                            </label>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Quarter
                                                <select value={analyticsFilters.pax_projection_quarter} onChange={(e) => setAnalyticsFilters({ ...analyticsFilters, pax_projection_quarter: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    <option value="">All quarters</option>
                                                    {[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}
                                                </select>
                                            </label>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Smoothing
                                                <select value={analyticsFilters.pax_sma_window} onChange={(e) => setAnalyticsFilters({ ...analyticsFilters, pax_sma_window: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    {SMA_WINDOW_OPTIONS.map(value => <option key={value} value={value}>{value}-period SMA</option>)}
                                                </select>
                                            </label>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 sm:col-span-2">
                                                Forecast horizon
                                                <select value={analyticsFilters.pax_projection_horizon} onChange={(e) => setAnalyticsFilters({ ...analyticsFilters, pax_projection_horizon: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    {FORECAST_HORIZON_OPTIONS.map(value => <option key={value} value={value}>{value} periods ahead</option>)}
                                                </select>
                                            </label>
                                            <button type="button" onClick={() => fetchAnalytics()} className="rounded-xl bg-[#720101] px-4 py-2.5 text-xs font-black text-white shadow-sm transition-colors hover:bg-[#8d0808] sm:col-span-3">Apply Demand Filters</button>
                                        </div>}
                                    </div>
                                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        {[
                                            ['Next guest forecast', Number(paxDemandSummary.nextForecast || 0).toLocaleString()],
                                            ['Forecast horizon guests', Number(paxDemandSummary.forecastPax || 0).toLocaleString()],
                                            ['Peak historical period', paxDemandSummary.peakPeriod || 'No data'],
                                        ].map(([label, value]) => (
                                            <div key={label} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                                                <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                                                <p className="mt-1 text-lg font-black text-gray-950">{value}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-6 h-80">
                                        {paxDemandData.length ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={paxDemandData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                                    <RechartsTooltip />
                                                    <Bar dataKey="pax" fill="#2563eb" radius={[6, 6, 0, 0]} name="Actual guests" />
                                                    <Bar dataKey="forecast" fill="#22c55e" radius={[6, 6, 0, 0]} name="SMA forecast" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : <div className="flex h-full items-center justify-center rounded-xl bg-gray-50 text-sm font-bold text-gray-400">No guest demand data available.</div>}
                                    </div>
                                    <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-900">{paxDemandProjection.insight}</p>
                                </section>
                            </div>

                            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                                <section className="admin-panel p-6">
                                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <h3 className="text-lg font-black text-gray-950">Collected Revenue Trend</h3>
                                            <p className="mt-1 text-sm font-semibold text-gray-500">Historical verified collections ending at the current month.</p>
                                        </div>
                                        {renderAnalyticsFilterButton('revenueTrend', `Last ${analyticsFilters.trend_months} months`)}
                                    </div>
                                    {activeAnalyticsFilterPanel === 'revenueTrend' && (
                                        <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                <span className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" /> Trend window</span>
                                                <select
                                                    value={analyticsFilters.trend_months}
                                                    onChange={(event) => {
                                                        const nextFilters = { ...analyticsFilters, trend_months: event.target.value };
                                                        setAnalyticsFilters(nextFilters);
                                                        fetchAnalytics({ filters: nextFilters });
                                                    }}
                                                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none"
                                                >
                                                    {[3, 6, 9, 12, 18, 24].map(months => <option key={months} value={months}>Last {months} months</option>)}
                                                </select>
                                            </label>
                                        </div>
                                    )}
                                    <div className="h-72">
                                        {revenueTrendData.length ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={revenueTrendData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(value) => `PHP ${Math.round(value / 1000)}k`} />
                                                    <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                                                    <Line type="monotone" dataKey="revenue" stroke="#720101" strokeWidth={3} dot={{ r: 4 }} name="Collected" />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        ) : <div className="flex h-full items-center justify-center rounded-xl bg-gray-50 text-sm font-bold text-gray-400">No collected revenue for this window.</div>}
                                    </div>
                                </section>

                                <section className="admin-panel p-6">
                                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <h3 className="text-lg font-black text-gray-950">Payment Risk</h3>
                                            <p className="mt-1 text-sm font-semibold text-gray-500">Balances by payment status and aging bucket.</p>
                                        </div>
                                        {renderAnalyticsFilterButton('paymentRisk', paymentRiskFilters.status === 'all' ? 'Risk filters' : paymentRiskFilters.status)}
                                    </div>
                                    {activeAnalyticsFilterPanel === 'paymentRisk' && (
                                        <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                <span className="flex items-center gap-2"><CreditCard className="h-3.5 w-3.5" /> Payment status</span>
                                                <select value={paymentRiskFilters.status} onChange={(e) => setPaymentRiskFilters({ ...paymentRiskFilters, status: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    <option value="all">All statuses</option>
                                                    {paymentStatusBreakdown.map(row => <option key={row.label} value={String(row.label || '').toLowerCase()}>{row.label}</option>)}
                                                </select>
                                            </label>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Minimum aging balance
                                                <input type="number" min="0" value={paymentRiskFilters.minBalance} onChange={(e) => setPaymentRiskFilters({ ...paymentRiskFilters, minBalance: e.target.value })} placeholder="Show all" className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none" />
                                            </label>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                                        <div className="h-64">
                                            {visiblePaymentStatusBreakdown.length ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={visiblePaymentStatusBreakdown}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                                        <RechartsTooltip formatter={(value, name) => name === 'total' ? formatCurrency(value) : value} />
                                                        <Bar dataKey="total" fill="#f0aa0b" radius={[6, 6, 0, 0]} name="Amount" />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            ) : <div className="flex h-full items-center justify-center rounded-xl bg-gray-50 text-sm font-bold text-gray-400">No payment rows.</div>}
                                        </div>
                                        <div className="space-y-3">
                                            {visiblePaymentAgingData.map((bucket) => (
                                                <div key={bucket.label} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="text-sm font-black text-gray-800">{bucket.label}</span>
                                                        <span className="text-sm font-black text-gray-950">{formatCurrency(bucket.value || 0)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {!visiblePaymentAgingData.length && <div className="rounded-xl bg-gray-50 p-6 text-sm font-bold text-gray-400">No aging balances match this filter.</div>}
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                                <section className="admin-panel overflow-hidden">
                                    <div className="flex flex-col gap-3 border-b border-gray-100 bg-white p-6 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="admin-kicker">Sales Mix</p>
                                            <h3 className="mt-1 text-lg font-black text-gray-950">Package Performance</h3>
                                            <p className="mt-1 text-sm font-semibold text-gray-500">Which packages are producing bookings and value.</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="inline-flex items-center gap-2 rounded-xl bg-[#fff7e8] px-3 py-2 text-xs font-black text-[#720101]">
                                                <Package className="h-4 w-4" />
                                                {visiblePackagePerformanceData.length} of {packagePerformanceData.length}
                                            </span>
                                            {renderAnalyticsFilterButton('packagePerformance', `Top ${packageViewFilters.limit}`)}
                                        </div>
                                    </div>
                                    {activeAnalyticsFilterPanel === 'packagePerformance' && (
                                        <div className="grid grid-cols-1 gap-3 border-b border-gray-100 bg-gray-50 p-5 sm:grid-cols-3">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Show
                                                <select value={packageViewFilters.limit} onChange={(e) => setPackageViewFilters({ ...packageViewFilters, limit: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    {PERFORMANCE_LIMIT_OPTIONS.map(value => <option key={value} value={value}>Top {value} packages</option>)}
                                                </select>
                                            </label>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Sort by
                                                <select value={packageViewFilters.sort} onChange={(e) => setPackageViewFilters({ ...packageViewFilters, sort: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    <option value="revenue">Revenue</option>
                                                    <option value="bookings">Bookings</option>
                                                    <option value="name">Package name</option>
                                                </select>
                                            </label>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Min bookings
                                                <input type="number" min="0" value={packageViewFilters.minBookings} onChange={(e) => setPackageViewFilters({ ...packageViewFilters, minBookings: e.target.value })} placeholder="Show all" className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none" />
                                            </label>
                                        </div>
                                    )}
                                    <div className="max-h-[31rem] space-y-3 overflow-y-auto p-6">
                                        {visiblePackagePerformanceData.map((pkg) => (
                                            <div key={pkg.label || pkg.name} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="min-w-0">
                                                        <p className="truncate font-black text-gray-950">{pkg.label || pkg.name}</p>
                                                        <p className="mt-1 text-xs font-bold text-gray-500">{pkg.count} bookings</p>
                                                    </div>
                                                    <p className="shrink-0 text-right font-black text-amber-700">{formatCurrency(pkg.revenue || 0)}</p>
                                                </div>
                                                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                                                    <div className="h-full rounded-full bg-[#720101]" style={{ width: `${Math.max(8, (Number(pkg.revenue || 0) / maxPackageRevenue) * 100)}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                        {!visiblePackagePerformanceData.length && <div className="rounded-xl bg-gray-50 p-6 text-sm font-bold text-gray-400">No package data for the selected filters.</div>}
                                    </div>
                                </section>

                                <section className="admin-panel overflow-hidden">
                                    <div className="flex flex-col gap-3 border-b border-gray-100 bg-white p-6 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="admin-kicker">Dish Velocity</p>
                                            <h3 className="mt-1 text-lg font-black text-gray-950">Menu Performance</h3>
                                            <p className="mt-1 text-sm font-semibold text-gray-500">Dish selections from actual booking items.</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="inline-flex items-center gap-2 rounded-xl bg-[#fff7e8] px-3 py-2 text-xs font-black text-[#720101]">
                                                <ClipboardList className="h-4 w-4" />
                                                Top {visibleMenuPerformanceData.length}
                                            </span>
                                            {renderAnalyticsFilterButton('menuPerformance', MENU_CATEGORY_OPTIONS.find(option => option.value === menuViewFilters.category)?.label || 'Dish type')}
                                        </div>
                                    </div>
                                    {activeAnalyticsFilterPanel === 'menuPerformance' && (
                                        <div className="grid grid-cols-1 gap-3 border-b border-gray-100 bg-gray-50 p-5 sm:grid-cols-3">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Dish type
                                                <select value={menuViewFilters.category} onChange={(e) => setMenuViewFilters({ ...menuViewFilters, category: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    {MENU_CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                </select>
                                            </label>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Show
                                                <select value={menuViewFilters.limit} onChange={(e) => setMenuViewFilters({ ...menuViewFilters, limit: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    {PERFORMANCE_LIMIT_OPTIONS.map(value => <option key={value} value={value}>Top {value} dishes</option>)}
                                                </select>
                                            </label>
                                            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                Rank by
                                                <select value={menuViewFilters.sort} onChange={(e) => setMenuViewFilters({ ...menuViewFilters, sort: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                    <option value="selections">Selections</option>
                                                    <option value="pax">Guests served</option>
                                                    <option value="name">Dish name</option>
                                                </select>
                                            </label>
                                        </div>
                                    )}
                                    <div className="h-[31rem] p-6">
                                        {visibleMenuPerformanceData.length ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={visibleMenuPerformanceData} layout="vertical" margin={{ left: 24, right: 12, top: 6, bottom: 6 }}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                                    <YAxis type="category" dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#374151', fontWeight: 700 }} width={150} />
                                                    <RechartsTooltip />
                                                    <Bar dataKey={menuViewFilters.sort === 'pax' ? 'paxServed' : 'selections'} fill="#720101" radius={[0, 6, 6, 0]} name={menuViewFilters.sort === 'pax' ? 'Guests served' : 'Selections'} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : <div className="flex h-full items-center justify-center rounded-xl bg-gray-50 text-sm font-bold text-gray-400">No menu selections for the selected filters.</div>}
                                    </div>
                                </section>
                            </div>
                        </div>
                        </>
                    )}
                    {activeTab === 'public-content' && (
                        <AdminPageSurface>
                            <div className="animate-fadeIn">
                                {pricingLoading ? (
                                    <StaffSkeleton variant="panel" rows={3} label="Loading pricing configuration" />
                                ) : (
                                    <>
                                    <div className="admin-surface-grid overflow-hidden">
                                        <div className="staff-catalog-head">
                                            <div>
                                                <p className="admin-kicker">{PUBLIC_CONTENT_META[activeConfigTab]?.kicker || 'Public content'}</p>
                                                <h3 className="staff-section-title">
                                                    {PUBLIC_CONTENT_META[activeConfigTab]?.title || 'Public Content'}
                                                </h3>
                                                <p className="staff-section-copy">
                                                    {PUBLIC_CONTENT_META[activeConfigTab]?.description || 'Manage customer-facing content.'}
                                                </p>
                                            </div>
                                            {activeConfigTab === 'packages' && <button type="button" onClick={() => openPackageDrawer()} className="staff-button-primary">Create package</button>}
                                            {activeConfigTab === 'eventTypes' && <button type="button" onClick={() => openEventTypeDrawer()} className="staff-button-primary">Create event type</button>}
                                            {activeConfigTab === 'menuItems' && <button type="button" onClick={openMenuItemModal} className="staff-button-primary">Add menu item</button>}
                                        </div>
                                        <div className="staff-catalog-tabs">
                                            <nav className="flex gap-2 overflow-x-auto">
                                                {PUBLIC_CONTENT_TABS.map(([key, label]) => (
                                                    <button
                                                        key={key}
                                                        onClick={() => setActiveConfigTab(key)}
                                                        className={`staff-catalog-tab ${activeConfigTab === key ? 'is-active' : ''}`}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </nav>
                                        </div>

                                        {activeConfigTab === 'announcements' && (
                                            <Suspense fallback={<StaffSkeleton variant="panel" rows={3} label="Loading announcements" />}>
                                                <AnnouncementManager variant="admin" user={user} />
                                            </Suspense>
                                        )}

                                        {activeConfigTab === 'packages' && (
                                            <div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-500">
                                                            <tr>
                                                                <th className="px-6 py-4 text-left">Package</th>
                                                                <th className="px-6 py-4 text-left">Event Type</th>
                                                                <th className="px-6 py-4 text-left">Category</th>
                                                                <th className="px-6 py-4 text-left">Connected To</th>
                                                                <th className="px-6 py-4 text-right">Price / Head</th>
                                                                <th className="px-6 py-4 text-right">Minimum Guests</th>
                                                                <th className="px-6 py-4 text-left">Description</th>
                                                                <th className="px-6 py-4 text-right">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {paginatedPackages.items.map(pkg => (
                                                                <tr key={pkg.id} className="hover:bg-gray-50">
                                                                    <td className="px-6 py-4 font-bold text-gray-900">{pkg.name}</td>
                                                                    <td className="px-6 py-4 text-sm font-bold text-gray-700">{eventTypes.find(type => type.slug === pkg.type)?.label || pkg.type}</td>
                                                                    <td className="px-6 py-4 text-gray-600">{getCategoryLabel(pkg.package_category)}</td>
                                                                    <td className="px-6 py-4 text-gray-600">{(pkg.event_type_slugs || [pkg.type]).map(slug => eventTypes.find(type => type.slug === slug)?.label || slug).join(', ')}</td>
                                                                    <td className="px-6 py-4 text-right font-bold text-gray-900">PHP {Number(pkg.base_price_per_head || 0).toLocaleString()}</td>
                                                                    <td className="px-6 py-4 text-right text-gray-600">{pkg.minimum_pax}</td>
                                                                    <td className="px-6 py-4 text-gray-600">{pkg.description || 'No description'}</td>
                                                                    <td className="px-6 py-4 text-right">
                                                                        <button type="button" onClick={() => openPackageDrawer(pkg)} className="staff-row-action">Edit</button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <PaginationControls pageInfo={paginatedPackages} onPageChange={setPackagePage} />
                                            </div>
                                        )}

                                        {activeConfigTab === 'eventTypes' && (
                                            <div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-500">
                                                            <tr>
                                                                <th className="px-6 py-4 text-left">Event Type</th>
                                                                <th className="px-6 py-4 text-left">Short Name</th>
                                                                <th className="px-6 py-4 text-left">Category</th>
                                                                <th className="px-6 py-4 text-left">Security</th>
                                                                <th className="px-6 py-4 text-left">Icon</th>
                                                                <th className="px-6 py-4 text-left">Description</th>
                                                                <th className="px-6 py-4 text-right">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {paginatedEventTypes.items.map(type => (
                                                                <tr key={type.id} className="hover:bg-gray-50">
                                                                    <td className="px-6 py-4 font-bold text-gray-900">
                                                                        {type.label}
                                                                        {type.is_active === false && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-500">Inactive</span>}
                                                                    </td>
                                                                    <td className="px-6 py-4 text-sm font-semibold text-gray-600">{type.slug}</td>
                                                                    <td className="px-6 py-4 text-gray-600">{getCategoryLabel(type.package_category)}</td>
                                                                    <td className="px-6 py-4 text-gray-600">{type.security_label || getSecurityLabel(type.security_type)}</td>
                                                                    <td className="px-6 py-4 text-gray-600">{type.icon}</td>
                                                                    <td className="px-6 py-4 text-gray-600">{type.description || 'No description'}</td>
                                                                    <td className="px-6 py-4 text-right">
                                                                        <div className="inline-flex flex-wrap justify-end gap-2">
                                                                            <button type="button" onClick={() => openEventTypeDrawer(type)} className="staff-row-action">Edit</button>
                                                                            <button type="button" onClick={() => handleArchiveEventType(type)} className="staff-row-action staff-row-action-danger">Archive</button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <PaginationControls pageInfo={paginatedEventTypes} onPageChange={setEventTypePage} />
                                            </div>
                                        )}

                                        {activeConfigTab === 'menuItems' && (
                                            <div>
                                                <div className="flex flex-col gap-4 border-b border-gray-100 p-6 lg:flex-row lg:items-center lg:justify-between">
                                                    <nav className="flex gap-2 overflow-x-auto">
                                                        {MENU_CATEGORIES.map(category => (
                                                            <button key={category} onClick={() => setActiveMenuCategory(category)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold capitalize transition-colors ${activeMenuCategory === category ? 'bg-[#720101] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                                                {category}
                                                            </button>
                                                        ))}
                                                    </nav>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-500">
                                                            <tr>
                                                                <th className="px-6 py-4 text-left">Menu Item</th>
                                                                <th className="px-6 py-4 text-left">Category</th>
                                                                <th className="px-6 py-4 text-right">Current Price</th>
                                                                <th className="px-6 py-4 text-right">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {paginatedMenuItems.items.map(item => {
                                                                return (
                                                                    <tr key={item.id} className="hover:bg-gray-50">
                                                                        <td className="px-6 py-4">
                                                                            <div className="flex min-w-0 items-center gap-3">
                                                                                <SmartImage
                                                                                    src={item.image}
                                                                                    alt={item.name}
                                                                                    aspectRatio="1 / 1"
                                                                                    containerClassName="shrink-0 rounded-lg ring-1 ring-gray-200"
                                                                                    style={{ width: '3.25rem', height: '3.25rem', flex: '0 0 3.25rem' }}
                                                                                />
                                                                                <div className="min-w-0">
                                                                                    <div className="font-bold text-gray-900">
                                                                                        {item.name}
                                                                                        {!item.isActive && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-500">Inactive</span>}
                                                                                    </div>
                                                                                    <div className="line-clamp-1 text-xs text-gray-500">{item.description || 'No description'}</div>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-6 py-4 capitalize text-gray-600">{item.category}</td>
                                                                        <td className="px-6 py-4 text-right font-bold text-gray-900">PHP {Number(item.costPerHead || 0).toLocaleString()}</td>
                                                                        <td className="px-6 py-4 text-right">
                                                                            <button onClick={() => openEditMenuItemModal(item)} className="mr-2 rounded-lg bg-[#720101] px-3 py-2 text-xs font-bold text-white hover:bg-[#5a0101]">Edit</button>
                                                                            {item._isCustom && item.isActive && <button onClick={() => handleArchiveMenuItem(item._dbId)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100">Archive</button>}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                    {getMergedDishes(activeMenuCategory).length === 0 && <div className="p-8 text-center text-sm text-gray-500">No menu items in this category.</div>}
                                                </div>
                                                <PaginationControls pageInfo={paginatedMenuItems} onPageChange={setMenuItemPage} />
                                            </div>
                                        )}
                                    </div>

                                    <div className="hidden">
                                        {/* Menu Pricing (Custom Pricing) */}
                                        <div className="bg-white shadow overflow-hidden rounded-xl border border-gray-100">
                                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Preset Packages by Event Type</h3>
                                                <p className="text-xs text-gray-500 mt-1">Create reusable package offers for weddings, corporate events, social events, and other inquiries.</p>
                                            </div>
                                            <form onSubmit={handlePackageSubmit} className="p-6 grid grid-cols-1 md:grid-cols-6 gap-4">
                                                <input required value={packageForm.name} onChange={e => setPackageForm({ ...packageForm, name: e.target.value })} placeholder="Package name" className="md:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#720101]/10" />
                                                <select required value={packageForm.type} onChange={e => setPackageForm({ ...packageForm, type: e.target.value })} className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#720101]/10">
                                                    {eventTypes.map(type => <option key={type.id} value={type.slug}>{type.label}</option>)}
                                                </select>
                                                <input required type="number" min="0" value={packageForm.base_price_per_head} onChange={e => setPackageForm({ ...packageForm, base_price_per_head: e.target.value })} placeholder="Price / head" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#720101]/10" />
                                                <input required type="number" min="1" value={packageForm.minimum_pax} onChange={e => setPackageForm({ ...packageForm, minimum_pax: e.target.value })} placeholder="Min pax" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#720101]/10" />
                                                <button disabled={packageSaving} className="rounded-lg bg-[#720101] px-4 py-3 text-sm font-bold text-white hover:bg-[#5a0101] disabled:opacity-60">{packageSaving ? 'Saving...' : 'Create'}</button>
                                                <textarea value={packageForm.description} onChange={e => setPackageForm({ ...packageForm, description: e.target.value })} placeholder="Description" className="md:col-span-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#720101]/10" />
                                                <textarea value={packageForm.inclusions} onChange={e => setPackageForm({ ...packageForm, inclusions: e.target.value })} placeholder="Inclusions, one per line" className="md:col-span-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#720101]/10" />
                                            </form>
                                            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                                                {packages.map(pkg => (
                                                    <div key={pkg.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                                                        <p className="text-xs font-black uppercase text-[#720101]">{pkg.type}</p>
                                                        <h4 className="mt-1 font-bold text-gray-900">{pkg.name}</h4>
                                                        <p className="text-sm text-gray-600">PHP {Number(pkg.base_price_per_head || 0).toLocaleString()} / head · min {pkg.minimum_pax} pax</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="bg-white shadow overflow-hidden rounded-xl border border-gray-100">
                                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Event Types</h3>
                                                <p className="text-xs text-gray-500 mt-1">Create, modify, or archive event categories used by package presets.</p>
                                            </div>
                                            <form onSubmit={handleEventTypeSubmit} className="p-6 grid grid-cols-1 md:grid-cols-6 gap-4">
                                                <input required value={eventTypeForm.label} onChange={e => setEventTypeForm({ ...eventTypeForm, label: e.target.value })} placeholder="Event type name" className="md:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#720101]/10" />
                                                <input value={eventTypeForm.slug} onChange={e => setEventTypeForm({ ...eventTypeForm, slug: e.target.value })} placeholder="Short name (optional)" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#720101]/10" />
                                                <input value={eventTypeForm.icon} onChange={e => setEventTypeForm({ ...eventTypeForm, icon: e.target.value })} placeholder="Icon name" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#720101]/10" />
                                                <input value={eventTypeForm.image} onChange={e => setEventTypeForm({ ...eventTypeForm, image: e.target.value })} placeholder="Image link" className="md:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#720101]/10" />
                                                <textarea value={eventTypeForm.description} onChange={e => setEventTypeForm({ ...eventTypeForm, description: e.target.value })} placeholder="Description" className="md:col-span-4 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#720101]/10" />
                                                <div className="md:col-span-2 flex gap-2">
                                                    {editingEventTypeId && <button type="button" onClick={resetEventTypeForm} className="flex-1 rounded-lg border border-gray-200 px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50">Cancel</button>}
                                                    <button disabled={packageSaving} className="flex-1 rounded-lg bg-[#720101] px-4 py-3 text-sm font-bold text-white hover:bg-[#5a0101] disabled:opacity-60">{packageSaving ? 'Saving...' : editingEventTypeId ? 'Save type' : 'Create Type'}</button>
                                                </div>
                                            </form>
                                            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                                                {eventTypes.map(type => (
                                                    <div key={type.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                                                        <p className="text-xs font-black uppercase text-[#720101]">{type.slug}</p>
                                                        <h4 className="mt-1 font-bold text-gray-900">{type.label}</h4>
                                                        <p className="text-sm text-gray-600 line-clamp-2">{type.description || 'No description'}</p>
                                                        <div className="mt-3 flex gap-2">
                                                            <button onClick={() => startEditingEventType(type)} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-gray-700 border border-gray-200 hover:bg-gray-50">Edit</button>
                                                            <button onClick={() => handleArchiveEventType(type)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100">Archive</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="bg-white shadow overflow-hidden rounded-xl border border-gray-100">
                                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Menu Items (Premium Add-ons)</h3>
                                            </div>
                                            <div className="border-b border-gray-100 px-6 pt-2">
                                                <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
                                                    {MENU_CATEGORIES.map(category => (
                                                        <button
                                                            key={category}
                                                            onClick={() => setActiveMenuCategory(category)}
                                                            className={`whitespace-nowrap py-3 px-1 border-b-2 font-bold text-sm capitalize transition-colors ${activeMenuCategory === category ? 'border-[#720101] text-[#720101]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                                                        >
                                                            {category}
                                                        </button>
                                                    ))}
                                                </nav>
                                            </div>
                                            <div className="p-6 bg-gray-50">
                                                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm animate-fadeIn">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                            {getMergedDishes(activeMenuCategory).map(item => {
                                                                const overrideId = `dish_${item.id}`;
                                                                const currentPrice = pricingOverrides[overrideId] !== undefined ? pricingOverrides[overrideId] : item.costPerHead;

                                                                return (
                                                                    <div key={item.id} className="overflow-hidden border border-gray-200 rounded-2xl bg-white flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-md relative group">
                                                                        {/* Archive button for custom items */}
                                                                        {item._isCustom && item.isActive && (
                                                                            <button
                                                                                onClick={() => handleArchiveMenuItem(item._dbId)}
                                                                                className="absolute top-3 left-3 z-20 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                                                                title="Archive this menu item"
                                                                            >
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                            </button>
                                                                        )}
                                                                        <div className="h-48 w-full relative">
                                                                            <SmartImage src={item.image} alt={item.name} aspectRatio="1 / 1" containerClassName="h-full w-full" />
                                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                                                            {item._isCustom && (
                                                                                <div className="absolute top-3 right-3 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded shadow-lg uppercase tracking-wider border border-emerald-400">
                                                                                    Custom Item
                                                                                </div>
                                                                            )}
                                                                            {!item._isCustom && pricingOverrides[overrideId] !== undefined && (
                                                                                <div className="absolute top-3 right-3 bg-[#720101] text-white text-[10px] font-bold px-2.5 py-1.5 rounded shadow-lg uppercase tracking-wider border border-[#720101]/25">
                                                                                    Custom Price
                                                                                </div>
                                                                            )}
                                                                            <h5 className="absolute bottom-3 left-4 right-4 font-bold text-white text-lg leading-tight text-shadow-sm">{item.name}</h5>
                                                                        </div>
                                                                        <div className="p-5 flex flex-col flex-grow bg-white">
                                                                            <p className="text-sm text-gray-500 mb-4 flex-grow line-clamp-2">{item.description}</p>
                                                                            
                                                                            <div className="mt-auto flex items-center justify-between gap-3 pt-4 border-t border-gray-100">
                                                                                <div className="flex-1 flex items-center bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-200 focus-within:border-[#720101] focus-within:ring-2 focus-within:ring-[#720101]/10 focus-within:bg-white transition-all shadow-inner">
                                                                                    <span className="text-gray-400 font-bold text-base mr-1">+₱</span>
                                                                                    <input
                                                                                        type="number"
                                                                                        id={`price_input_${item.id}`}
                                                                                        defaultValue={currentPrice}
                                                                                        className="w-full text-base font-bold text-gray-900 bg-transparent outline-none"
                                                                                    />
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const el = document.getElementById(`price_input_${item.id}`);
                                                                                        handlePricingUpdate('dish', item.id, el.value);
                                                                                    }}
                                                                                    className="px-5 py-2.5 bg-[#720101] hover:bg-[#5a0101] text-white font-bold text-sm rounded-xl transition-colors shadow-md hover:shadow-lg active:transform active:scale-95"
                                                                                >
                                                                                    Save
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {getMergedDishes(activeMenuCategory).length === 0 && (
                                                                <div className="text-sm text-gray-400 italic">No items in this category.</div>
                                                            )}
                                                        </div>
                                                    </div>
                                            </div>
                                        </div>
                                    </div>
                                    </>
                                )}
                            </div>
                        </AdminPageSurface>
                    )}
                    {
                        activeTab === 'reports' && (
                            <div className="animate-fadeIn admin-report-page">
                                <section className="admin-report-setup admin-report-setup-compact">
                                    <div className="admin-report-setup-summary">
                                        <div>
                                            <p className="admin-kicker">Report setup</p>
                                            <h3 className="mt-1 text-lg font-black text-gray-950">{reportBuilder.name || 'Untitled report'}</h3>
                                            <p className="mt-1 text-sm font-semibold text-gray-500">{reportBuilder.description || 'Choose blocks, apply filters, then export.'}</p>
                                        </div>
                                        <div className="admin-report-filter-chips">
                                            {Object.entries(reportBuilder.filters || {}).filter(([, value]) => value).slice(0, 3).map(([key, value]) => (
                                                <span key={key}>{humanizeReportKey(key)}: {value}</span>
                                            ))}
                                            {!Object.values(reportBuilder.filters || {}).some(Boolean) && <span>No filters applied</span>}
                                        </div>
                                        <div className="admin-report-summary-actions">
                                            <button type="button" onClick={() => setReportSetupOpen(open => !open)} className="admin-button-secondary px-4 py-2 text-sm font-black">
                                                {reportSetupOpen ? 'Hide Details' : 'Edit Report'}
                                            </button>
                                            <button type="button" onClick={createNewSavedReport} className="admin-button-secondary px-4 py-2 text-sm font-black">New Report</button>
                                        </div>
                                    </div>

                                    {reportSetupOpen && (
                                    <div className="mt-5">
                                    <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1.5fr]">
                                        <label className="admin-field-label">
                                            Saved report
                                            <select value={reportTemplateId} onChange={(e) => loadReportTemplate(e.target.value)} className="admin-input mt-2">
                                                <option value="">Unsaved report</option>
                                                {reportTemplates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
                                            </select>
                                        </label>
                                        <label className="admin-field-label">
                                            Report name
                                            <input value={reportBuilder.name} onChange={(e) => setReportBuilder({ ...reportBuilder, name: e.target.value })} className="admin-input mt-2" />
                                        </label>
                                        <label className="admin-field-label">
                                            Short description
                                            <input value={reportBuilder.description} onChange={(e) => setReportBuilder({ ...reportBuilder, description: e.target.value })} className="admin-input mt-2" />
                                        </label>
                                    </div>
                                    <div className="admin-report-manage-actions">
                                        <button type="button" onClick={createNewSavedReport} className="admin-mini-button">Start New</button>
                                        <button type="button" onClick={duplicateSavedReport} className="admin-mini-button" disabled={!reportTemplateId}>Save As Copy</button>
                                        <button type="button" onClick={archiveSavedReport} className="admin-mini-button admin-mini-button-danger" disabled={!reportTemplateId}>Archive Saved Report</button>
                                    </div>
                                    <div className="admin-report-filter-grid">
                                        <label className="admin-field-label">
                                            From
                                            <input type="date" value={reportBuilder.filters.date_from || ''} onChange={(e) => updateReportFilter('date_from', e.target.value)} className="admin-input mt-2" />
                                        </label>
                                        <label className="admin-field-label">
                                            To
                                            <input type="date" value={reportBuilder.filters.date_to || ''} onChange={(e) => updateReportFilter('date_to', e.target.value)} className="admin-input mt-2" />
                                        </label>
                                        <label className="admin-field-label">
                                            Booking status
                                            <input list="report-booking-status-options" value={reportBuilder.filters.booking_status || ''} onChange={(e) => updateReportFilter('booking_status', e.target.value)} placeholder="All booking statuses" className="admin-input mt-2" />
                                        </label>
                                        <label className="admin-field-label">
                                            Payment status
                                            <input list="report-payment-status-options" value={reportBuilder.filters.payment_status || ''} onChange={(e) => updateReportFilter('payment_status', e.target.value)} placeholder="All payment statuses" className="admin-input mt-2" />
                                        </label>
                                        <label className="admin-field-label">
                                            City
                                            <input list="report-city-options" value={reportBuilder.filters.city || ''} onChange={(e) => updateReportFilter('city', e.target.value)} placeholder="All cities" className="admin-input mt-2" />
                                        </label>
                                        <datalist id="report-booking-status-options">
                                            {reportBookingStatusOptions.map(option => <option key={option} value={option} />)}
                                        </datalist>
                                        <datalist id="report-payment-status-options">
                                            {reportPaymentStatusOptions.map(option => <option key={option} value={option} />)}
                                        </datalist>
                                        <datalist id="report-city-options">
                                            {reportCityOptions.map(option => <option key={option} value={option} />)}
                                        </datalist>
                                    </div>
                                    </div>
                                    )}
                                </section>

                                <div className="admin-report-actions">
                                    <div className="admin-report-view-toggle">
                                        <button type="button" onClick={() => setReportView('build')} className={reportView === 'build' ? 'is-active' : ''}>Build</button>
                                        <button type="button" onClick={previewReport} className={reportView === 'preview' ? 'is-active' : ''}>{reportLoading ? 'Generating preview...' : 'Preview'}</button>
                                    </div>
                                    <button onClick={saveReportTemplate} disabled={reportSaving} className="admin-button-secondary px-5 py-2.5 text-sm font-black">{reportSaving ? 'Saving...' : 'Save Report'}</button>
                                    <button onClick={() => runReportExport('csv')} className="admin-button-secondary px-5 py-2.5 text-sm font-black">Download Spreadsheet</button>
                                    <button onClick={() => runReportExport('pdf')} className="admin-button-secondary px-5 py-2.5 text-sm font-black">Download PDF</button>
                                </div>

                                <div className={`admin-report-workspace ${reportLibraryCollapsed ? 'is-library-collapsed' : ''}`}>
                                    <aside
                                        className={`admin-report-rail ${reportLibraryCollapsed ? 'is-collapsed' : ''} ${reportLibraryDropActive ? 'is-drop-active' : ''}`}
                                        onDragOver={(event) => {
                                            if (Number.isInteger(reportDraggedIndex)) {
                                                event.preventDefault();
                                                setReportLibraryDropActive(true);
                                            }
                                        }}
                                        onDragLeave={() => setReportLibraryDropActive(false)}
                                        onDrop={(event) => {
                                            event.preventDefault();
                                            removeDraggedReportWidget();
                                        }}
                                    >
                                        <div className="admin-report-rail-head">
                                            <div>
                                                <p className="admin-kicker">1. Choose blocks</p>
                                                <h3 className="mt-1 text-lg font-black text-gray-950">Report Library</h3>
                                                {!reportLibraryCollapsed && <p className="mt-1 text-sm font-semibold text-gray-500">Drag blocks into the report canvas.</p>}
                                            </div>
                                            <button type="button" onClick={() => setReportLibraryCollapsed(collapsed => !collapsed)} className="admin-mini-button">
                                                {reportLibraryCollapsed ? 'Open' : 'Collapse'}
                                            </button>
                                        </div>
                                        {!reportLibraryCollapsed && (
                                        <div className="admin-report-library-drop">Drop used blocks here to remove them</div>
                                        )}
                                        {!reportLibraryCollapsed && (
                                        <div className="mt-4 grid gap-2">
                                            {visibleReportLibraryWidgets.map(widget => {
                                                const selected = reportBuilder.widgets.includes(widget.id);
                                                return (
                                                    <button
                                                        key={widget.id}
                                                        type="button"
                                                        draggable={!selected}
                                                        disabled={selected}
                                                        onDragStart={() => {
                                                            if (!selected) {
                                                                setReportDraggedWidgetId(widget.id);
                                                                setReportDraggedIndex(null);
                                                            }
                                                        }}
                                                        onDragEnd={() => {
                                                            setReportDraggedWidgetId(null);
                                                            setReportDropIndex(null);
                                                        }}
                                                        onClick={() => {
                                                            const nextBuilder = { ...reportBuilder, widgets: [...reportBuilder.widgets, widget.id] };
                                                            setReportBuilder(nextBuilder);
                                                            scheduleReportPreview({ builder: nextBuilder });
                                                        }}
                                                        className={`admin-report-widget ${selected ? 'admin-report-widget-selected' : ''}`}
                                                    >
                                                        <span>
                                                            {widget.name}
                                                            <small>{widget.category}</small>
                                                        </span>
                                                        <strong>{selected ? 'Used' : 'Drag'}</strong>
                                                    </button>
                                                );
                                            })}
                                            {reportWidgets.length > 6 && (
                                                <button type="button" onClick={() => setReportLibraryExpanded(expanded => !expanded)} className="admin-report-library-more">
                                                    {reportLibraryExpanded ? 'Show less' : `See all ${reportWidgets.length} blocks`}
                                                </button>
                                            )}
                                        </div>
                                        )}
                                    </aside>

                                    <section className="admin-report-main">
                                        <div className="admin-report-canvas-head">
                                            <div>
                                                <p className="admin-kicker">{reportView === 'preview' ? 'Report preview' : 'Report canvas'}</p>
                                                <h3 className="mt-1 text-xl font-black text-gray-950">{reportView === 'preview' ? reportBuilder.name || 'Preview' : 'Arrange Selected Blocks'}</h3>
                                                <p className="mt-1 text-sm font-semibold text-gray-500">
                                                    {reportView === 'preview'
                                                        ? 'This is how the report will read before you download or save it.'
                                                        : 'Drag blocks to reorder them, or use the move buttons for precise control.'}
                                                </p>
                                            </div>
                                            <div className="admin-report-canvas-tools">
                                                <span>{reportBuilder.widgets.length} blocks</span>
                                            </div>
                                        </div>

                                        {reportView === 'build' ? (
                                        <div
                                            className={`admin-report-canvas-body ${reportDraggedWidgetId !== null || reportDraggedIndex !== null ? 'is-drop-ready' : ''}`}
                                            onDragOver={(event) => {
                                                event.preventDefault();
                                                if (!reportBuilder.widgets.length) setReportDropIndex(0);
                                            }}
                                            onDrop={() => handleReportDrop(reportBuilder.widgets.length)}
                                        >
                                            <div className="mt-4 space-y-2">
                                                <div
                                                    className={`admin-report-drop-zone ${reportDropIndex === 0 ? 'is-active' : ''}`}
                                                    onDragOver={(event) => {
                                                        event.preventDefault();
                                                        setReportDropIndex(0);
                                                    }}
                                                    onDrop={(event) => {
                                                        event.stopPropagation();
                                                        handleReportDrop(0);
                                                    }}
                                                />
                                                {visibleReportWidgetIds.map((id, visibleIndex) => {
                                                    const index = reportCanvasOffset + visibleIndex;
                                                    const meta = reportWidgets.find(widget => widget.id === id) || { name: id, category: 'Custom' };
                                                    return (
                                                        <React.Fragment key={`${id}-${index}`}>
                                                        <div
                                                            className={`admin-report-selected-row ${reportDraggedIndex === index ? 'is-dragging' : ''}`}
                                                            draggable
                                                            onDragStart={() => {
                                                                setReportDraggedIndex(index);
                                                                setReportDraggedWidgetId(null);
                                                            }}
                                                            onDragOver={(event) => {
                                                                event.preventDefault();
                                                                setReportDropIndex(index);
                                                            }}
                                                            onDrop={(event) => {
                                                                event.stopPropagation();
                                                                handleReportDrop(index);
                                                            }}
                                                            onDragEnd={() => {
                                                                setReportDraggedIndex(null);
                                                                setReportDropIndex(null);
                                                            }}
                                                        >
                                                            <div>
                                                                <p className="text-xs font-black uppercase tracking-widest text-gray-400">Block {index + 1} - {meta.category}</p>
                                                                <p className="mt-1 font-black text-gray-950">{meta.name}</p>
                                                                {meta.description && <p className="mt-1 text-sm font-semibold text-gray-500">{meta.description}</p>}
                                                            </div>
                                                            <div className="flex flex-wrap justify-end gap-2">
                                                                <button onClick={() => moveReportWidget(index, -1)} className="admin-mini-button">Up</button>
                                                                <button onClick={() => moveReportWidget(index, 1)} className="admin-mini-button">Down</button>
                                                                <button
                                                                    onClick={() => {
                                                                        const nextBuilder = { ...reportBuilder, widgets: reportBuilder.widgets.filter((_, itemIndex) => itemIndex !== index) };
                                                                        setReportBuilder(nextBuilder);
                                                                        scheduleReportPreview({ builder: nextBuilder });
                                                                    }}
                                                                    className="admin-mini-button admin-mini-button-danger"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div
                                                            className={`admin-report-drop-zone ${reportDropIndex === index + 1 ? 'is-active' : ''}`}
                                                            onDragOver={(event) => {
                                                                event.preventDefault();
                                                                setReportDropIndex(index + 1);
                                                            }}
                                                            onDrop={(event) => {
                                                                event.stopPropagation();
                                                                handleReportDrop(index + 1);
                                                            }}
                                                        />
                                                        </React.Fragment>
                                                    );
                                                })}
                                                {!reportBuilder.widgets.length && <div className="admin-empty-state">Choose at least one block to build a report.</div>}
                                            </div>
                                        </div>
                                        ) : (
                                        <div className="admin-report-preview-canvas">
                                            <div className="space-y-4">
                                                {reportLoading && <LoadingFeedback label="Fetching report details..." compact />}
                                                {reportExecutiveSummary && (
                                                    <section className="admin-report-executive">
                                                        <div>
                                                            <p className="admin-kicker">Executive summary</p>
                                                            <h3>{reportExecutiveSummary.headline || 'Report ready for review.'}</h3>
                                                            <p>{reportExecutiveSummary.recommended_action || 'Review the selected report blocks and follow up on any active queues.'}</p>
                                                        </div>
                                                        <div className="admin-report-executive-grid">
                                                            {(reportExecutiveSummary.takeaways || []).slice(0, 5).map((takeaway, index) => (
                                                                <InsightLine key={`${takeaway.headline}-${index}`} insight={takeaway} compact={false} />
                                                            ))}
                                                        </div>
                                                    </section>
                                                )}
                                                {reportPreview.map(widget => {
                                                    const meta = reportWidgets.find(item => item.id === widget.id) || { name: widget.id };
                                                    const data = widget.data || {};
                                                    const rows = widget.data?.rows || [];
                                                    const summaryMetrics = getReportSummaryMetrics(data);
                                                    return (
                                                        <div key={widget.id} className="admin-report-preview-block">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div>
                                                                    <p className="font-black text-gray-950">{meta.name}</p>
                                                                    <p className="mt-1 text-xs font-semibold text-gray-500">{widget.data?.action || summarizeReportWidget(widget)}</p>
                                                                </div>
                                                                {!!rows.length && <span className="text-xs font-black uppercase tracking-wider text-[#9f6500]">{summarizeReportWidget(widget)}</span>}
                                                            </div>
                                                            <InsightLine insight={data.insight} compact={false} />
                                                            {summaryMetrics.length > 0 && (
                                                                <div className="admin-report-metric-grid">
                                                                    {summaryMetrics.map(metric => (
                                                                        <div key={`${widget.id}-${metric.label}`} className="admin-report-metric">
                                                                            <span>{metric.label}</span>
                                                                            <strong>{metric.value}</strong>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {rows.length > 0 && (
                                                                <div className="mt-3 divide-y divide-gray-100">
                                                                    {rows.slice(0, 12).map((row, i) => (
                                                                        <div key={i} className="flex items-center justify-between gap-3 py-2">
                                                                            <span className="text-xs font-bold text-gray-700">{row.label || row.client || row.date || 'Row'}</span>
                                                                            <span className="text-xs font-black text-gray-950">{row.total ? formatCurrency(row.total) : row.value ? formatCurrency(row.value) : row.revenue ? formatCurrency(row.revenue) : row.count ?? row.selections ?? row.pax ?? ''}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {!reportPreview.length && <div className="admin-empty-state">Preview your report to check the result before saving or downloading.</div>}
                                            </div>
                                        </div>
                                        )}
                                    </section>
                                </div>
                            </div>
                        )
                    }
                    {activeTab === 'messages-inquiries' && (
                        <div className="admin-messages-page-surface animate-fadeIn">
                            <div className="admin-flat-strip">
                                {[
                                    ['Open conversations', adminMessageMetrics.open],
                                    ['Needs admin attention', adminMessageMetrics.needsAttention],
                                    ['Unassigned', adminMessageMetrics.unassigned],
                                    ['Resolved today', adminMessageMetrics.resolvedToday],
                                ].map(([label, value]) => (
                                    <div key={label} className="admin-flat-strip-item">
                                        <strong>{value}</strong>
                                        <span>{label}</span>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setMessageRefreshToken((value) => value + 1)}
                                    className="admin-flat-strip-item admin-flat-strip-action inline-flex justify-center text-[#720101] transition hover:bg-[#fff7ed]"
                                    aria-label="Refresh conversations"
                                    title="Refresh conversations"
                                >
                                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                                </button>
                            </div>
                            <Suspense fallback={<StaffSkeleton variant="panel" rows={6} label="Loading message desk" />}>
                                <StaffMessaging
                                    variant="admin-oversight"
                                    surfaceMode="admin-full"
                                    refreshToken={messageRefreshToken}
                                    onMetricsChange={setAdminMessageMetrics}
                                />
                            </Suspense>
                        </div>
                    )}
                    {activeTab === 'settings' && (
                        <AdminPageSurface className="admin-settings-surface">
                            <RoleSettingsPanel role="admin" onNavigate={setActiveTab} />
                        </AdminPageSurface>
                    )}
                    {activeTab === 'profile' && (
                        <div className="animate-fadeIn admin-profile-page">
                            <section className="admin-profile-identity">
                                <div className="admin-profile-avatar">
                                    {user?.username?.charAt(0).toUpperCase() || 'A'}
                                </div>
                                <div>
                                    <p className="admin-kicker">Administrator</p>
                                    <h3 className="mt-1 text-2xl font-black text-gray-950">{user?.username || 'Admin user'}</h3>
                                    <p className="mt-1 text-sm font-semibold text-gray-500">{user?.email || 'No email saved'}</p>
                                </div>
                            </section>

                            <form onSubmit={submitProfile} className="admin-profile-form">
                                <div>
                                    <p className="admin-kicker">Account details</p>
                                    <h3 className="mt-1 text-xl font-black text-gray-950">Profile Settings</h3>
                                    <p className="mt-1 text-sm font-semibold text-gray-500">Keep the admin contact information accurate for system records.</p>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <label className="admin-field-label">
                                        Username
                                        <input value={profileForm.username} onChange={(event) => updateProfileField('username', event.target.value)} className="admin-input mt-2" />
                                        {profileErrors.username && <span className="admin-field-error">{profileErrors.username}</span>}
                                    </label>
                                    <label className="admin-field-label">
                                        Email address
                                        <input type="email" value={profileForm.email} onChange={(event) => updateProfileField('email', event.target.value)} className="admin-input mt-2" />
                                        {profileErrors.email && <span className="admin-field-error">{profileErrors.email}</span>}
                                    </label>
                                    <label className="admin-field-label">
                                        Phone number
                                        <input value={profileForm.phone} onChange={(event) => updateProfileField('phone', event.target.value)} className="admin-input mt-2" />
                                        {profileErrors.phone && <span className="admin-field-error">{profileErrors.phone}</span>}
                                    </label>
                                    <div className="hidden md:block" />
                                    <label className="admin-field-label">
                                        Current password
                                        <input type="password" value={profileForm.current_password} onChange={(event) => updateProfileField('current_password', event.target.value)} placeholder="Only needed to change password" className="admin-input mt-2" />
                                        {profileErrors.current_password && <span className="admin-field-error">{profileErrors.current_password}</span>}
                                    </label>
                                    <label className="admin-field-label">
                                        New password
                                        <input type="password" value={profileForm.new_password} onChange={(event) => updateProfileField('new_password', event.target.value)} placeholder="Leave blank to keep current" className="admin-input mt-2" />
                                        {profileErrors.new_password && <span className="admin-field-error">{profileErrors.new_password}</span>}
                                    </label>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#720101]/10 pt-5">
                                    <p className="text-sm font-semibold text-gray-500">Password fields can stay blank if you are only updating contact details.</p>
                                    <button type="submit" disabled={profileProcessing} className="admin-button-primary px-5 py-2.5 text-sm font-black">
                                        {profileProcessing ? 'Saving...' : 'Save Profile'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                    {activeTab === 'availability' && (
                        <AdminPageSurface className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_22rem]">
                            <form onSubmit={saveAvailabilityOverride} className="bg-white p-6">
                                <div className="mb-6">
                                    <div>
                                        <p className="admin-kicker">Selected date</p>
                                        <h3 className="mt-1 text-xl font-black text-gray-950">Control daily availability</h3>
                                        <p className="staff-section-copy">Set whether this date can still accept bookings and guests.</p>
                                    </div>
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <label className="block">
                                        <span className="text-xs font-black uppercase tracking-widest text-gray-500">Date</span>
                                        <input type="date" value={availabilityDate} onChange={(event) => selectAvailabilityDate(event.target.value)} className="admin-input mt-2" />
                                    </label>
                                    <label className="block">
                                        <span className="text-xs font-black uppercase tracking-widest text-gray-500">Booking status</span>
                                        <span className="admin-input mt-2 flex items-center gap-3 border-red-100 bg-red-50/50 px-4">
                                            <input type="checkbox" checked={availabilityForm.is_locked} onChange={(event) => setAvailabilityForm(prev => ({ ...prev, is_locked: event.target.checked }))} className="h-4 w-4" />
                                            <span className="text-sm font-black text-red-800">Stop bookings for this date</span>
                                        </span>
                                    </label>
                                    <label className="block">
                                        <span className="text-xs font-black uppercase tracking-widest text-gray-500">Remaining event slots</span>
                                        <input type="number" min="0" value={availabilityForm.remaining_events} onChange={(event) => setAvailabilityForm(prev => ({ ...prev, remaining_events: event.target.value }))} className="admin-input mt-2" />
                                    </label>
                                    <label className="block">
                                        <span className="text-xs font-black uppercase tracking-widest text-gray-500">Remaining guests</span>
                                        <input type="number" min="0" value={availabilityForm.remaining_pax} onChange={(event) => setAvailabilityForm(prev => ({ ...prev, remaining_pax: event.target.value }))} className="admin-input mt-2" />
                                    </label>
                                </div>
                                <label className="mt-4 block">
                                    <span className="text-xs font-black uppercase tracking-widest text-gray-500">Staff note</span>
                                    <textarea rows={4} value={availabilityForm.note} onChange={(event) => setAvailabilityForm(prev => ({ ...prev, note: event.target.value }))} className="admin-input mt-2" placeholder="Reason for closing the date or changing capacity" />
                                </label>
                                <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-gray-500">Events on this date</p>
                                            <p className="mt-1 text-sm font-bold text-gray-600">{formatDate(availabilityDate)}</p>
                                        </div>
                                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-gray-700">{selectedAvailabilityEvents.length}</span>
                                    </div>
                                    {selectedAvailabilityEvents.length === 0 ? (
                                        <p className="mt-4 text-sm font-bold text-gray-500">No booked events are scheduled for this date.</p>
                                    ) : (
                                        <div className="mt-4 space-y-3">
                                            {selectedAvailabilityEvents.map((event) => {
                                                const status = normalizeStatus(event.status);
                                                return (
                                                    <div key={event.id} className="rounded-lg border border-gray-100 bg-white p-3">
                                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                                            <div>
                                                                <p className="text-sm font-black text-gray-950">{event.name}</p>
                                                                <p className="mt-1 text-xs font-bold text-gray-500">{event.client || 'Client'} / {formatTime(event.time) || 'Time to confirm'}</p>
                                                            </div>
                                                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${bookingStatusStyles[status] || 'border-gray-200 bg-gray-100 text-gray-700'}`}>
                                                                {event.status || 'Scheduled'}
                                                            </span>
                                                        </div>
                                                        <p className="mt-2 text-xs font-semibold text-gray-500">{Number(event.pax || 0).toLocaleString()} guests{event.city ? ` / ${event.city}` : ''}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                <div className="mt-6 flex flex-wrap justify-end gap-3">
                                    <button type="button" onClick={clearAvailabilityOverride} disabled={availabilitySaving || !availabilityOverrides.some(item => item.date === availabilityDate)} className="admin-button-secondary px-5 py-2.5 text-sm font-black disabled:opacity-50">Clear date change</button>
                                    <button type="submit" disabled={availabilitySaving} className="admin-button-primary px-5 py-2.5 text-sm font-black disabled:opacity-50">{availabilitySaving ? 'Saving...' : 'Save date settings'}</button>
                                </div>
                            </form>

                            <aside className="border-t border-[#720101]/10 bg-white p-5 lg:border-l lg:border-t-0">
                                <div className="mb-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-black uppercase tracking-widest text-gray-900">Date changes</h3>
                                            <p className="mt-1 text-sm font-bold text-gray-500">{formatMonthLabel(availabilityMonth)}</p>
                                        </div>
                                        <span className="rounded-full bg-[#fff7e8] px-3 py-1 text-xs font-black text-[#720101]">{availabilityOverrides.length}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button type="button" onClick={() => moveAvailabilityMonth(-1)} className="admin-button-secondary px-3 py-2 text-xs">Previous month</button>
                                        <button type="button" onClick={() => moveAvailabilityMonth(1)} className="admin-button-secondary px-3 py-2 text-xs">Next month</button>
                                    </div>
                                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase text-gray-400">
                                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
                                        </div>
                                        <div className="mt-2 grid grid-cols-7 gap-1">
                                            {availabilityCalendarDays.map((day) => day.blank ? (
                                                <span key={day.key} className="aspect-square" />
                                            ) : (
                                                <button
                                                    key={day.key}
                                                    type="button"
                                                    onClick={() => selectAvailabilityDate(day.date)}
                                                    className={`aspect-square rounded-lg border text-xs font-black transition ${availabilityDate === day.date ? 'border-[#720101] bg-[#720101] text-white' : day.eventCount > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : 'border-transparent bg-white text-gray-600 hover:border-gray-200'}`}
                                                >
                                                    <span>{day.day}</span>
                                                    {day.eventCount > 0 && (
                                                        <span className={`mt-0.5 block text-[9px] ${availabilityDate === day.date ? 'text-white' : 'text-emerald-700'}`}>{day.eventCount}</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                {availabilityLoading ? (
                                    <StaffSkeleton variant="panel" rows={3} className="p-0" label="Loading date changes" />
                                ) : (
                                    <div className="space-y-5">
                                        <div>
                                            <div className="mb-3 flex items-center justify-between">
                                                <h4 className="text-xs font-black uppercase tracking-widest text-gray-500">Booked events</h4>
                                                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{monthlyAvailabilityEventCount}</span>
                                            </div>
                                            {availabilityEvents.length === 0 ? (
                                                <p className="rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-500">No booked events for this month.</p>
                                            ) : (
                                                <div className="space-y-3">
                                                    {availabilityEvents.map((event) => (
                                                        <button key={event.id} type="button" onClick={() => selectAvailabilityDate(event.date)} className={`w-full rounded-xl border p-4 text-left transition ${availabilityDate === event.date ? 'border-emerald-300 bg-emerald-50' : 'border-gray-100 bg-gray-50 hover:bg-white'}`}>
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span className="text-sm font-black text-gray-950">{formatDate(event.date)}</span>
                                                                <span className="text-xs font-black text-gray-500">{formatTime(event.time) || 'Time to confirm'}</span>
                                                            </div>
                                                            <p className="mt-2 text-xs font-black text-gray-800">{event.name}</p>
                                                            <p className="mt-1 text-xs font-semibold text-gray-500">{event.client || 'Client'} / {Number(event.pax || 0).toLocaleString()} guests</p>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="mb-3 flex items-center justify-between">
                                                <h4 className="text-xs font-black uppercase tracking-widest text-gray-500">Date changes</h4>
                                                <span className="rounded-full bg-[#fff7e8] px-3 py-1 text-xs font-black text-[#720101]">{availabilityOverrides.length}</span>
                                            </div>
                                            {availabilityOverrides.length === 0 ? (
                                                <p className="rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-500">No date changes for this month.</p>
                                            ) : (
                                                <div className="space-y-3">
                                                    {availabilityOverrides.map((item) => (
                                                        <button key={item.id} type="button" onClick={() => selectAvailabilityDate(item.date)} className={`w-full rounded-xl border p-4 text-left transition ${availabilityDate === item.date ? 'border-[#720101]/25 bg-[#fff7e8]' : 'border-gray-100 bg-gray-50 hover:bg-white'}`}>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-sm font-black text-gray-950">{formatDate(item.date)}</span>
                                                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${item.is_locked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{item.is_locked ? 'Closed' : 'Limited'}</span>
                                                            </div>
                                                            <p className="mt-2 text-xs font-bold text-gray-500">{item.remainingEvents} event slots / {Number(item.remainingPax || 0).toLocaleString()} guests remaining</p>
                                                            {item.note && <p className="mt-2 text-xs font-semibold text-gray-400">{item.note}</p>}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </aside>
                        </AdminPageSurface>
                    )}
                    {
                        activeTab === 'accounts' && (
                            <AdminPageSurface>
                                <AdminCommandStrip>
                                    <div>
                                        <p className="admin-kicker">Access controls</p>
                                        <p className="admin-command-copy">Staff access, customer account status, temporary passwords, and reactivation.</p>
                                    </div>
                                    <button onClick={() => openEmpModal('add')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#720101] px-4 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-[#5a0101]">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                        Add staff account
                                    </button>
                                </AdminCommandStrip>

                                <div className="admin-stat-strip border-b border-[#720101]/10">
                                    {[
                                        { label: 'Active staff', value: employeeAccountStats.active },
                                        { label: 'Need password change', value: employeeAccountStats.password },
                                        { label: 'Deactivated staff', value: employeeAccountStats.deactivated },
                                        { label: 'Customers with bookings', value: customerAccountStats.withBookings },
                                    ].map((stat) => (
                                        <span key={stat.label} className="admin-stat-chip">
                                            <strong>{stat.value}</strong>
                                            <em>{stat.label}</em>
                                        </span>
                                    ))}
                                </div>

                                <details className="admin-help-disclosure m-0 rounded-none border-x-0 border-t-0 shadow-none">
                                    <summary>Account action guide</summary>
                                    <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <p className="text-sm font-black text-amber-950">Account emails are available as a fallback, and temporary passwords can be shown again until they expire or are changed.</p>
                                            <p className="mt-1 text-xs font-bold text-amber-800">Deactivate preserves records. Reset creates a temporary password. Force change keeps the current password but requires a new one on next sign-in.</p>
                                        </div>
                                        <button type="button" onClick={() => setActiveTab('public-content')} className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-xs font-black text-amber-900 hover:bg-amber-100">
                                            Open delivery settings
                                        </button>
                                    </div>
                                </details>

                                <AdminCommandStrip>
                                    {[
                                        { value: 'staff', label: 'Staff Accounts', count: employees.length },
                                        { value: 'customers', label: 'Customer Accounts', count: customerAccountStats.shown },
                                    ].map((segment) => (
                                        <button
                                            key={segment.value}
                                            type="button"
                                            onClick={() => setAccountSegment(segment.value)}
                                            className={`rounded-xl px-4 py-2 text-sm font-black transition ${accountSegment === segment.value ? 'bg-[#720101] text-white' : 'text-slate-500 hover:bg-[#fff7e8] hover:text-[#720101]'}`}
                                        >
                                            {segment.label}<span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">{segment.count}</span>
                                        </button>
                                    ))}
                                </AdminCommandStrip>

                                <div>
                                    {accountSegment === 'staff' && <AdminSurfaceSection className="border-t-0">
                                        <div className="mb-3 flex items-center justify-between">
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Staff Accounts</h3>
                                                <p className="text-xs text-gray-500 mt-1">Marketing and Accounting personnel accounts.</p>
                                            </div>
                                            <span className="text-xs font-bold text-[#720101] bg-[#fff7e8] border border-[#720101]/10 rounded-full px-3 py-1">{employees.length} staff</span>
                                        </div>
                                        <AdminCommandStrip className="-mx-4 mb-0 border-x-0 md:grid md:grid-cols-[minmax(220px,1fr)_160px_170px_190px]">
                                            <input
                                                type="search"
                                                value={employeeFilters.search}
                                                onChange={(event) => setEmployeeFilters(prev => ({ ...prev, search: event.target.value }))}
                                                placeholder="Search staff name, username, email, or phone"
                                                className="admin-input"
                                            />
                                            <select value={employeeFilters.role} onChange={(event) => setEmployeeFilters(prev => ({ ...prev, role: event.target.value }))} className="admin-input">
                                                <option value="all">All roles</option>
                                                <option value="Admin">Admin</option>
                                                <option value="Marketing">Marketing</option>
                                                <option value="Accounting">Accounting</option>
                                            </select>
                                            <select value={employeeFilters.account_status} onChange={(event) => setEmployeeFilters(prev => ({ ...prev, account_status: event.target.value }))} className="admin-input">
                                                <option value="all">All statuses</option>
                                                <option value="active">Active</option>
                                                <option value="deactivated">Deactivated</option>
                                            </select>
                                            <select value={employeeFilters.must_change_password} onChange={(event) => setEmployeeFilters(prev => ({ ...prev, must_change_password: event.target.value }))} className="admin-input">
                                                <option value="all">All password states</option>
                                                <option value="1">Password change needed</option>
                                                <option value="0">Password current</option>
                                            </select>
                                        </AdminCommandStrip>

                                        <AdminResponsiveTable className="-mx-4">
                                            {empLoading ? (
                                                <StaffSkeleton rows={6} label="Loading staff accounts" />
                                            ) : employees.length === 0 ? (
                                                <div className="p-12 text-center text-gray-500">No employee accounts found.</div>
                                            ) : (
                                                <table className="staff-table">
                                                    <thead>
                                                        <tr>
                                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Created</th>
                                                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {paginatedEmployees.items.map(emp => (
                                                            <tr key={emp.id} className="hover:bg-gray-50/80 transition-colors">
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="flex items-center">
                                                                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-[#fff7e8] to-[#f8d58b] flex items-center justify-center text-[#720101] font-bold">
                                                                            {(emp.full_name || emp.username).charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <div className="ml-4">
                                                                            <div className="text-sm font-bold text-gray-900">{emp.full_name || emp.username}</div>
                                                                            <div className="text-xs text-gray-500">@{emp.username}{emp.phone ? ` / ${emp.phone}` : ' / No phone'}</div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-700">{emp.email || <span className="text-gray-400 italic">No email</span>}</div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${roleBadgeClass(emp.role)}`}>
                                                                        {emp.role}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${emp.account_status === 'deactivated' ? 'bg-red-50 text-red-700 border-red-100' : emp.must_change_password ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-green-100 text-green-800 border-green-200'}`}>
                                                                        {emp.account_status === 'deactivated' ? 'Deactivated' : emp.must_change_password ? 'Password change needed' : 'Active'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-500">{formatDate(emp.created_at)}</div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                                    <details className="relative inline-block text-left">
                                                                        <summary className="list-none rounded-xl border border-[#720101]/10 bg-white px-3 py-2 text-xs font-black text-[#720101] shadow-sm marker:hidden hover:bg-[#fff7e8]">
                                                                            Actions <ChevronDown className="ml-1 inline h-3.5 w-3.5" />
                                                                        </summary>
                                                                        <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-100 bg-white p-1 shadow-xl">
                                                                            {emp.role === 'Admin' && emp.id === user?.id ? (
                                                                                <div className="rounded-lg bg-slate-50 px-3 py-2 text-left text-xs font-bold leading-5 text-slate-500">Your own Admin account is protected from account actions here.</div>
                                                                            ) : emp.role === 'Admin' ? (
                                                                                <>
                                                                                    {emp.must_change_password && (
                                                                                        <button type="button" onClick={() => handleRevealTemporaryPassword(emp)} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-amber-700 hover:bg-amber-50">Show temporary password</button>
                                                                                    )}
                                                                                    <button type="button" onClick={() => handleResetEmployeePassword(emp.id)} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-amber-700 hover:bg-amber-50">Reset temporary password</button>
                                                                                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-left text-xs font-bold leading-5 text-slate-500">Admin profile edits and deactivation stay protected.</div>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <button type="button" onClick={() => openEmpModal('edit', emp)} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50">Edit account</button>
                                                                                    {emp.must_change_password && (
                                                                                        <button type="button" onClick={() => handleRevealTemporaryPassword(emp)} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-amber-700 hover:bg-amber-50">Show temporary password</button>
                                                                                    )}
                                                                                    <button type="button" onClick={() => handleResetEmployeePassword(emp.id)} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-amber-700 hover:bg-amber-50">Reset temporary password</button>
                                                                                    <button type="button" onClick={() => handleForceEmployeePasswordChange(emp.id)} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50">Force password change</button>
                                                                                    {emp.account_status === 'deactivated' ? (
                                                                                        <button type="button" onClick={() => handleReactivateEmployee(emp.id)} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-emerald-700 hover:bg-emerald-50">Reactivate access</button>
                                                                                    ) : (
                                                                                        <button type="button" onClick={() => handleDeleteEmployee(emp.id)} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-red-600 hover:bg-red-50">Deactivate access</button>
                                                                                    )}
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </details>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </AdminResponsiveTable>
                                        {!empLoading && employees.length > 0 && (
                                            <PaginationControls pageInfo={paginatedEmployees} onPageChange={setEmployeePage} />
                                        )}
                                    </AdminSurfaceSection>}

                                    {accountSegment === 'customers' && <AdminSurfaceSection className="border-t-0">
                                        <div className="mb-3 flex items-center justify-between">
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Customer Accounts</h3>
                                                <p className="text-xs text-gray-500 mt-1">Active customer accounts by default. Deactivated customers are preserved for booking and payment history.</p>
                                            </div>
                                            <div className="flex flex-wrap items-center justify-end gap-2">
                                                {[
                                                    { value: 'active', label: 'Active' },
                                                    { value: 'deactivated', label: 'Deactivated' },
                                                    { value: 'all', label: 'All' },
                                                ].map(option => (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => setCustomerStatusFilter(option.value)}
                                                        className={`rounded-full border px-3 py-1 text-xs font-black transition ${customerStatusFilter === option.value ? 'border-rose-700 bg-rose-700 text-white' : 'border-rose-100 bg-white text-rose-700 hover:bg-rose-50'}`}
                                                    >
                                                        {option.label}
                                                    </button>
                                                ))}
                                                <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-100 rounded-full px-3 py-1">{customers.length} shown</span>
                                            </div>
                                        </div>
                                        <AdminCommandStrip className="-mx-4 mb-0 border-x-0 md:grid md:grid-cols-[minmax(220px,1fr)_190px]">
                                            <input
                                                type="search"
                                                value={customerFilters.search}
                                                onChange={(event) => setCustomerFilters(prev => ({ ...prev, search: event.target.value }))}
                                                placeholder="Search customer name, username, email, or phone"
                                                className="admin-input"
                                            />
                                            <select value={customerFilters.booking_activity} onChange={(event) => setCustomerFilters(prev => ({ ...prev, booking_activity: event.target.value }))} className="admin-input">
                                                <option value="all">All booking activity</option>
                                                <option value="with_bookings">With bookings</option>
                                                <option value="without_bookings">No bookings</option>
                                            </select>
                                        </AdminCommandStrip>

                                        <AdminResponsiveTable className="-mx-4">
                                            {customerLoading ? (
                                                <StaffSkeleton rows={6} label="Loading customer accounts" />
                                            ) : customers.length === 0 ? (
                                                <div className="p-12 text-center text-gray-500">No customer accounts found.</div>
                                            ) : (
                                                <table className="staff-table">
                                                    <thead>
                                                        <tr>
                                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Customer</th>
                                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Bookings</th>
                                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Registered</th>
                                                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {paginatedCustomers.items.map(customer => (
                                                            <tr key={customer.id} className="hover:bg-gray-50/80 transition-colors">
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="flex items-center">
                                                                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 font-bold">
                                                                            {(customer.username || customer.full_name || 'C').charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <div className="ml-4">
                                                                            <div className="text-sm font-bold text-gray-900">{customer.username || customer.full_name || 'Customer'}</div>
                                                                            <div className="mt-1 flex flex-wrap gap-1">
                                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
                                                                                    {customer.role}
                                                                                </span>
                                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${customer.account_status === 'deactivated' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                                                                    {customer.account_status === 'deactivated' ? 'Deactivated' : 'Active'}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="text-sm text-gray-700">{customer.email || <span className="text-gray-400 italic">No email</span>}</div>
                                                                    <div className="text-xs text-gray-500 mt-1">{customer.phone || 'No phone'}</div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm font-bold text-gray-900">{customer.bookings_count || 0}</div>
                                                                    <div className="text-xs text-gray-500">Latest: {formatDate(customer.bookings_max_event_date)}</div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-500">{formatDate(customer.created_at)}</div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                                    <details className="relative inline-block text-left">
                                                                        <summary className="list-none rounded-xl border border-[#720101]/10 bg-white px-3 py-2 text-xs font-black text-[#720101] shadow-sm marker:hidden hover:bg-[#fff7e8]">
                                                                            Actions <ChevronDown className="ml-1 inline h-3.5 w-3.5" />
                                                                        </summary>
                                                                        <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-slate-100 bg-white p-1 shadow-xl">
                                                                            <button type="button" onClick={() => openCustomerModal(customer)} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50">Edit account</button>
                                                                            {customer.account_status === 'deactivated' ? (
                                                                                <button type="button" onClick={() => handleReactivateCustomer(customer.id)} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-emerald-700 hover:bg-emerald-50">Reactivate access</button>
                                                                            ) : (
                                                                                <button type="button" onClick={() => handleDeleteCustomer(customer.id)} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-red-600 hover:bg-red-50">Deactivate access</button>
                                                                            )}
                                                                        </div>
                                                                    </details>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </AdminResponsiveTable>
                                        {!customerLoading && customers.length > 0 && (
                                            <PaginationControls pageInfo={paginatedCustomers} onPageChange={setCustomerPage} />
                                        )}
                                    </AdminSurfaceSection>}
                                </div>
                            </AdminPageSurface>
                        )
                    }
                    {
                        activeTab === 'bookings-intake' && (
                            <AdminPageSurface>
                                <AdminCommandStrip className="admin-booking-command">
                                    <div className="admin-stat-strip admin-booking-stat-strip">
                                        {[
                                            { label: 'Current', value: bookingStats.total },
                                            { label: 'Pending', value: bookingStats.pending },
                                            { label: 'Active', value: bookingStats.active },
                                            { label: 'Expected', value: formatCurrency(bookingStats.value) },
                                        ].map((stat) => (
                                            <span key={stat.label} className="admin-stat-chip">
                                                <strong>{stat.value}</strong>
                                                <em>{stat.label}</em>
                                            </span>
                                        ))}
                                    </div>
                                    <button type="button" onClick={() => setAssistedBookingOpen(true)} className="admin-button-primary admin-booking-command-button inline-flex items-center justify-center px-4 py-2.5 text-sm font-black">
                                        Create booking
                                    </button>
                                </AdminCommandStrip>

                                <AdminCommandStrip>
                                    <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                        <div className="relative flex-1">
                                            <svg className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                            <input
                                                type="search"
                                                value={bookingSearch}
                                                onChange={(e) => setBookingSearch(e.target.value)}
                                                placeholder="Search booking ref, client, email, phone, event type..."
                                                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm font-medium text-gray-800 outline-none transition-all focus:border-[#720101] focus:bg-white focus:ring-2 focus:ring-[#720101]/10"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                                                {['All', 'Pending', 'Active'].map((filter) => (
                                                    <button
                                                        key={filter}
                                                        type="button"
                                                        onClick={() => setBookingStatusFilter(filter)}
                                                        className={`rounded-md px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors ${bookingStatusFilter === filter ? 'bg-white text-[#720101] shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                                                    >
                                                        {filter}
                                                    </button>
                                                ))}
                                            </div>
                                            <select
                                                value={bookingSort}
                                                onChange={(e) => setBookingSort(e.target.value)}
                                                className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 outline-none transition-all focus:border-[#720101] focus:ring-2 focus:ring-[#720101]/10"
                                            >
                                                <option value="latest">Latest to Oldest</option>
                                                <option value="oldest">Oldest to Latest</option>
                                                <option value="az">A-Z</option>
                                                <option value="za">Z-A</option>
                                            </select>
                                            <select
                                                value={bookingSourceFilter}
                                                onChange={(e) => setBookingSourceFilter(e.target.value)}
                                                className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 outline-none transition-all focus:border-[#720101] focus:ring-2 focus:ring-[#720101]/10"
                                            >
                                                <option value="all">All sources</option>
                                                <option value="customer">Customer submitted</option>
                                                <option value="assisted">Any assisted</option>
                                                <option value="marketing_assisted">Marketing assisted</option>
                                                <option value="admin_assisted">Admin assisted</option>
                                            </select>
                                        </div>
                                    </div>
                                </AdminCommandStrip>

                                <AdminResponsiveTable className="admin-bookings-table-wrap">
                                    {bookingsLoading ? (
                                        <StaffSkeleton rows={7} label="Loading bookings" />
                                    ) : visibleBookings.length === 0 ? (
                                        <div className="p-12 text-center">
                                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                                                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            </div>
                                            <h3 className="text-base font-black text-gray-900">No bookings match this view</h3>
                                            <p className="mt-1 text-sm text-gray-500">Try clearing the search or switching filters.</p>
                                        </div>
                                    ) : (
                                        <table className="staff-table admin-bookings-table">
                                            <colgroup>
                                                <col className="admin-bookings-col-ref" />
                                                <col className="admin-bookings-col-client" />
                                                <col className="admin-bookings-col-event" />
                                                <col className="admin-bookings-col-total" />
                                                <col className="admin-bookings-col-status" />
                                                <col className="admin-bookings-col-actions" />
                                            </colgroup>
                                            <thead>
                                                <tr>
                                                    <th>Booking</th>
                                                    <th>Client</th>
                                                    <th>Event</th>
                                                    <th className="text-right">Total</th>
                                                    <th className="text-center">Status</th>
                                                    <th className="text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginatedBookings.items.map(booking => {
                                                    const status = normalizeStatus(booking.status);
                                                    return (
                                                    <tr key={booking.id} className="cursor-pointer transition-colors" onClick={() => setEventDetailsModal({ open: true, data: booking })}>
                                                        <td>
                                                            <div className="admin-booking-ref">{formatBookingRef(booking.id)}</div>
                                                            <div className="admin-booking-muted">Submitted {formatDate(booking.created_at)}</div>
                                                            {booking.booking_source && booking.booking_source !== 'customer' && (
                                                                <div className="admin-booking-source">
                                                                    {booking.created_by_staff_label || 'Created by staff'}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <div className="admin-booking-primary">{booking.client_full_name || booking.client_name || booking.username || 'Unnamed client'}</div>
                                                            <div className="admin-booking-muted admin-booking-truncate">{booking.client_email || booking.user_email || 'No email'}</div>
                                                            <div className="admin-booking-muted">{booking.client_phone || booking.user_phone || 'No phone'}</div>
                                                        </td>
                                                        <td>
                                                            <div className="admin-booking-primary admin-booking-truncate">{eventDisplayName(booking)}</div>
                                                            <div className="admin-booking-date">{formatDate(booking.event_date)} / {formatTime(booking.event_time)}</div>
                                                            <div className="admin-booking-muted">{booking.event_type || 'Event'} / {booking.pax} guests</div>
                                                        </td>
                                                        <td className="text-right">
                                                            <div className="admin-booking-money">{formatCurrency(getBookingTotal(booking))}</div>
                                                            {Number(booking.discount_value || 0) > 0 && (
                                                                <div className="admin-booking-discount">
                                                                    Discounted
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="text-center">
                                                            <span className={`admin-booking-status ${bookingStatusStyles[status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                                                {status === 'confirmed' ? 'Active' : booking.status}
                                                            </span>
                                                        </td>
                                                        <td className="text-right" onClick={(e) => e.stopPropagation()}>
                                                            <div className="admin-booking-actions">
                                                                {status === 'pending' && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleApproveBooking(booking);
                                                                        }}
                                                                        disabled={approvingBookingId === booking.id}
                                                                        className="admin-booking-action admin-booking-action-approve"
                                                                    >
                                                                        {approvingBookingId === booking.id ? 'Approving...' : 'Approve'}
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setDiscountForm({ discount_type: booking.discount_type || 'fixed', discount_value: booking.discount_value || 0 });
                                                                        setDiscountModal({ open: true, data: booking });
                                                                    }}
                                                                    className="admin-booking-action admin-booking-action-discount"
                                                                >
                                                                    Discount
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </AdminResponsiveTable>
                                {!bookingsLoading && visibleBookings.length > 0 && (
                                    <PaginationControls pageInfo={paginatedBookings} onPageChange={setBookingPage} />
                                )}
                            </AdminPageSurface>
                        )
                    }
                    {activeTab === 'calendar' && (
                        <AdminPageSurface>
                            <AdminCommandStrip>
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="flex min-w-0 flex-wrap items-center gap-2 lg:flex-nowrap">
                                        <button type="button" onClick={() => changeAdminCalendarMonth(-1)} className="admin-icon-action" aria-label="Previous month" title="Previous month">
                                            <ChevronDown className="h-4 w-4 rotate-90" />
                                        </button>
                                        <div className="flex h-10 w-36 items-center rounded-xl border border-[#720101]/10 bg-[#fffaf3] px-3">
                                            <span className="text-sm font-black text-slate-950">{formatMonthLabel(adminCalendarMonthKey)}</span>
                                        </div>
                                        <button type="button" onClick={() => changeAdminCalendarMonth(1)} className="admin-icon-action" aria-label="Next month" title="Next month">
                                            <ChevronDown className="h-4 w-4 -rotate-90" />
                                        </button>
                                        <button type="button" onClick={() => setAdminCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="admin-button-secondary h-10 px-3 text-xs font-black">This month</button>
                                        <span className="inline-flex h-10 items-center rounded-xl border border-slate-100 bg-slate-50 px-3 text-xs font-black text-slate-700">
                                            {adminCalendarEvents.length} {adminCalendarEvents.length === 1 ? 'event' : 'events'}
                                        </span>
                                        <span className="inline-flex h-10 max-w-56 items-center rounded-xl border border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-600">
                                            <span className="mr-2 shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-400">Next</span>
                                            <span className="truncate">{upcomingConfirmedEvents[0] ? eventDisplayName(upcomingConfirmedEvents[0]) : 'None scheduled'}</span>
                                        </span>
                                    </div>

                                    <div className="flex min-w-0 shrink-0 flex-col gap-2 md:flex-row md:items-center lg:justify-end">
                                        <input
                                            type="search"
                                            value={adminCalendarSearch}
                                            onChange={(event) => setAdminCalendarSearch(event.target.value)}
                                            placeholder="Search event, customer, venue..."
                                            className="staff-control h-10 w-full md:w-72"
                                        />
                                        <div className="inline-flex h-10 rounded-xl border border-slate-200 bg-slate-50 p-1">
                                            {['month', 'list'].map((view) => (
                                                <button key={view} type="button" onClick={() => setAdminCalendarView(view)} className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-widest ${adminCalendarView === view ? 'bg-white text-[#720101] shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
                                                    {view}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </AdminCommandStrip>

                            {adminCalendarView === 'month' ? (
                                <div className="grid grid-cols-7 overflow-hidden border-t border-[#720101]/10 bg-[#f4e7df]">
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                                        <div key={day} className="bg-[#fffaf3] py-3 text-center text-xs font-black uppercase tracking-wide text-slate-500">{day}</div>
                                    ))}
                                    {adminCalendarDays.map((day) => {
                                        if (day.blank) return <div key={day.key} className="marketing-calendar-cell marketing-calendar-cell-empty" />;
                                        const dayEvents = adminCalendarEventsByDate.get(day.dateKey) || [];
                                        return (
                                            <div key={day.key} className="marketing-calendar-cell custom-scrollbar bg-white">
                                                <div className="mb-2 flex items-center justify-between">
                                                    <span className="text-xs font-black text-slate-700">{day.day}</span>
                                                    {dayEvents.length > 0 && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">{dayEvents.length}</span>}
                                                </div>
                                                {dayEvents.map((booking) => (
                                                    <button
                                                        type="button"
                                                        key={booking.id}
                                                        title={`${formatBookingRef(booking.id)}\n${eventDisplayName(booking)}\n${formatTime(booking.event_time)} / ${booking.pax || 0} guests`}
                                                        onClick={() => setEventDetailsModal({ open: true, data: booking })}
                                                        className="marketing-event-chip mb-1 rounded-lg bg-emerald-100 px-2 py-1 text-left text-[11px] font-bold text-emerald-800 transition-transform hover:-translate-y-0.5"
                                                    >
                                                        <span className="marketing-event-primary">{eventDisplayName(booking)}</span>
                                                        <span className="marketing-event-secondary">{formatTime(booking.event_time)} / {booking.pax || 0} guests</span>
                                                    </button>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <AdminResponsiveTable>
                                    <table className="staff-table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Event</th>
                                                <th>Client</th>
                                                <th>Guests</th>
                                                <th className="text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {adminCalendarEvents.map((booking) => (
                                                <tr key={booking.id} className="cursor-pointer hover:bg-[#fffaf3]" onClick={() => setEventDetailsModal({ open: true, data: booking })}>
                                                    <td className="font-bold text-slate-700">{formatDate(booking.event_date)} {formatTime(booking.event_time)}</td>
                                                    <td>
                                                        <div className="font-black text-slate-950">{eventDisplayName(booking)}</div>
                                                        <div className="text-xs font-semibold text-slate-500">{formatBookingRef(booking.id)} / {booking.event_type || 'Event'}</div>
                                                    </td>
                                                    <td>{booking.client_full_name || booking.client_name || booking.username || 'Unnamed client'}</td>
                                                    <td>{booking.pax || 0}</td>
                                                    <td className="text-right"><button type="button" className="admin-button-secondary px-3 py-1.5 text-xs font-black">Open</button></td>
                                                </tr>
                                            ))}
                                            {!adminCalendarEvents.length && (
                                                <tr><td colSpan="5" className="px-4 py-10"><StaffEmptyState title="No calendar events found" message="No confirmed events match this month or search." /></td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </AdminResponsiveTable>
                            )}
                            {bookingsLoading && (
                                <p className="rounded-xl bg-[#fffaf3] p-4 text-sm font-bold text-slate-500">Loading calendar events...</p>
                            )}
                        </AdminPageSurface>
                    )}
                    {activeTab === 'handoff' && (
                        <AdminPageSurface>
                            <Suspense fallback={<StaffSkeleton variant="panel" rows={3} label="Loading handoff board" />}>
                                <PreparationBoard surfaceMode="admin-full" />
                            </Suspense>
                        </AdminPageSurface>
                    )}
                    {activeTab === 'tastings' && (
                        <AdminPageSurface>
                            <Suspense fallback={<StaffSkeleton variant="panel" rows={4} label="Loading food tasting queue" />}>
                                <FoodTastingQueue onToast={showToast} surfaceMode="admin-full" />
                            </Suspense>
                        </AdminPageSurface>
                    )}
                    {activeTab === 'history' && (
                        <AdminPageSurface>
                            <EventHistoryPanel role="admin" onToast={showToast} surfaceMode="admin-full" />
                        </AdminPageSurface>
                    )}
                    {
                        activeTab === 'finance' && (
                            <AdminPageSurface>
                                <AdminCommandStrip className="admin-finance-strip">
                                    <div className="grid w-full gap-0 2xl:grid-cols-[18rem_minmax(0,1fr)] 2xl:items-stretch">
                                        <div className="inline-flex h-full min-h-14 w-full border-r border-[#720101]/10 bg-slate-50 p-1">
                                            {[
                                                { id: 'payments', label: 'Payments', count: financePaymentRows.length },
                                                { id: 'refunds', label: 'Refunds', count: refundStats.count },
                                            ].map((segment) => (
                                                <button
                                                    key={segment.id}
                                                    type="button"
                                                    onClick={() => setActiveFinanceSegment(segment.id)}
                                                    className={`flex-1 rounded-lg px-3 text-xs font-black uppercase tracking-wider transition-colors ${activeFinanceSegment === segment.id ? 'bg-white text-[#720101] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                                >
                                                    {segment.label} <span className="ml-1 text-[11px]">{segment.count}</span>
                                                </button>
                                            ))}
                                        </div>
                                        <div className="grid min-w-0 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
                                            {[
                                                { label: 'Expected', value: formatCurrency(financeStats.totalExposure), emphasis: true },
                                                { label: 'Collected', value: formatCurrency(financeStats.paid), emphasis: true },
                                                { label: 'Remaining', value: formatCurrency(financeStats.remaining), emphasis: true },
                                                { label: 'Review', value: financeStats.pendingPayments },
                                                { label: 'Overdue', value: financeStats.overdue },
                                            ].map((stat) => (
                                                <span key={stat.label} className="flex h-14 min-w-0 flex-col justify-center overflow-hidden border-r border-[#720101]/10 bg-[#fbf8f2] px-3 last:border-r-0">
                                                    <em className="text-[10px] font-black uppercase not-italic tracking-widest text-slate-400">{stat.label}</em>
                                                    <strong className="mt-1 truncate text-lg font-black leading-none text-gray-950">{stat.value}</strong>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </AdminCommandStrip>

                                {activeFinanceSegment === 'payments' && <div className="admin-surface-grid overflow-hidden">
                                    <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <h3 className="text-base font-black text-gray-950">Payment work queue</h3>
                                            <p className="mt-1 text-sm font-medium text-gray-500">Review pending proofs, overdue terms, and payment exceptions before refund work.</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
                                            <span className="rounded-full bg-[#fff7e1] px-3 py-1 text-[#720101]">{financePaymentRows.length} open</span>
                                            {financePaymentRows.length > 8 && <span>Showing first 8</span>}
                                        </div>
                                    </div>

                                    {bookingsLoading ? (
                                        <StaffSkeleton rows={5} label="Loading payment work" />
                                    ) : financePaymentRows.length === 0 ? (
                                        <div className="flex items-center justify-center gap-3 px-5 py-6 text-center">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                                                <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                            <div className="text-left">
                                                <h3 className="text-base font-black text-gray-900">No payment items waiting</h3>
                                                <p className="mt-1 text-sm text-gray-500">Pending proofs and overdue terms will appear here.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <AdminResponsiveTable>
                                            <table className="staff-table">
                                                <thead>
                                                    <tr>
                                                        <th>Booking</th>
                                                        <th>Client</th>
                                                        <th>Payment</th>
                                                        <th className="text-right">Amount</th>
                                                        <th>Status</th>
                                                        <th className="text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {financePaymentRows.slice(0, 8).map(({ booking, payment, statusLabel, queueLabel }) => (
                                                        <tr key={`${booking.id}-${payment.id}`} className="transition-colors hover:bg-[#fffaf3]">
                                                            <td>
                                                                <div className="font-black text-gray-950">{formatBookingRef(booking.id)}</div>
                                                                <div className="text-xs font-semibold text-slate-500">{eventDisplayName(booking)}</div>
                                                            </td>
                                                            <td>
                                                                <div className="font-bold text-gray-900">{booking.client_full_name || booking.client_name || booking.username || 'Unnamed client'}</div>
                                                                <div className="text-xs text-gray-500">{booking.client_email || booking.client_phone || 'No contact recorded'}</div>
                                                            </td>
                                                            <td>
                                                                <div className="font-bold text-gray-900">{paymentLabel(payment.payment_type)}</div>
                                                                <div className="text-xs font-semibold text-slate-500">Due {formatDate(payment.due_date)}</div>
                                                            </td>
                                                            <td className="text-right font-black text-gray-950">{formatCurrency(payment.amount)}</td>
                                                            <td>
                                                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${queueLabel === 'Overdue' ? 'bg-red-50 text-red-700' : queueLabel === 'Exception' ? 'bg-amber-50 text-amber-700' : 'bg-[#fff7e8] text-[#720101]'}`}>
                                                                    {statusLabel}
                                                                </span>
                                                            </td>
                                                            <td className="text-right">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEventDetailsModal({ open: true, data: booking })}
                                                                    className="admin-button-secondary px-3 py-1.5 text-xs font-black"
                                                                >
                                                                    Open
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </AdminResponsiveTable>
                                    )}
                                </div>}

                                {activeFinanceSegment === 'refunds' && <div className="admin-surface-grid overflow-hidden">
                                    <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <h3 className="text-base font-black text-gray-950">Cancelled bookings with refundable payments</h3>
                                            <p className="mt-1 text-sm font-medium text-gray-500">Refunds retain the 10% reservation fee and update payment records.</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                            {[
                                                { label: 'Cases', value: refundStats.count },
                                                { label: 'Paid', value: formatCurrency(refundStats.paid) },
                                                { label: 'Fees', value: formatCurrency(refundStats.fees) },
                                                { label: 'Refundable', value: formatCurrency(refundStats.refundable) },
                                            ].map((stat) => (
                                                <span key={stat.label} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#720101]/10 bg-[#fbf8f2] px-3 text-xs font-black text-slate-500">
                                                    <strong className="text-sm text-gray-950">{stat.value}</strong>
                                                    <em className="not-italic uppercase tracking-wider">{stat.label}</em>
                                                </span>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => { bustAdminCache('/api/admin/refunds/queue'); fetchRefundQueue(); }}
                                                className="admin-button-secondary h-10 px-3 text-xs font-black"
                                            >
                                                Refresh
                                            </button>
                                        </div>
                                    </div>

                                    {refundLoading ? (
                                        <StaffSkeleton rows={6} label="Loading refund queue" />
                                    ) : refundQueue.length === 0 ? (
                                        <div className="flex items-center justify-center gap-3 px-5 py-6 text-center">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                                                <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                            <div className="text-left">
                                                <h3 className="text-base font-black text-gray-900">No refunds waiting</h3>
                                                <p className="mt-1 text-sm text-gray-500">Cancelled bookings with verified payments will appear here.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <AdminResponsiveTable>
                                            <table className="staff-table">
                                                <thead>
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Booking</th>
                                                        <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Client</th>
                                                        <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Event Date</th>
                                                        <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">Paid</th>
                                                        <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">Refund</th>
                                                        <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {refundQueue.map((item) => {
                                                        const totalPaid = Number(item.total_paid || 0);
                                                        const penalty = totalPaid * 0.1;
                                                        const refundAmount = Math.max(totalPaid - penalty, 0);

                                                        return (
                                                            <tr key={item.booking_id} className="transition-colors hover:bg-gray-50">
                                                                <td className="px-6 py-4">
                                                                    <div className="text-sm font-black text-gray-900">{formatBookingRef(item.booking_id)}</div>
                                                                    <div className="text-xs font-medium text-gray-500">Cancelled booking</div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="text-sm font-bold text-gray-900">{item.client_full_name || 'Unnamed client'}</div>
                                                                    <div className="text-xs text-gray-500">{item.client_email || 'No email'}</div>
                                                                </td>
                                                                <td className="px-6 py-4 text-sm font-bold text-gray-700">{formatDate(item.event_date)}</td>
                                                                <td className="px-6 py-4 text-right text-sm font-black text-gray-900">{formatCurrency(totalPaid)}</td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <div className="text-sm font-black text-[#720101]">{formatCurrency(refundAmount)}</div>
                                                                    <div className="text-xs font-semibold text-gray-400">{formatCurrency(penalty)} retained</div>
                                                                    <div className="mt-1 text-[10px] font-black uppercase tracking-wide text-gray-500">{item.refund_status || 'Needs Review'}</div>
                                                                </td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleProcessRefund(item)}
                                                                        disabled={processingRefundId === item.booking_id}
                                                                        className="rounded-lg bg-[#720101] px-4 py-2 text-xs font-black text-white transition-colors hover:bg-[#5f0101] disabled:opacity-60"
                                                                    >
                                                                        {processingRefundId === item.booking_id ? 'Processing...' : item.refund_cases?.[0]?.next_actions?.includes('retry_provider_refund') ? 'Retry Provider' : 'Process Refund'}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </AdminResponsiveTable>
                                    )}
                                </div>}
                            </AdminPageSurface>
                        )
                    }
                    {
                        activeTab === 'system-audit' && (
                            <AdminPageSurface>
                                <AdminCommandStrip className="justify-end">
                                    <button onClick={() => { bustAdminCache('/api/admin/audits?per_page=25'); fetchAudits(); }} className="admin-button-secondary px-4 py-2 text-sm font-bold">
                                        Refresh Logs
                                    </button>
                                </AdminCommandStrip>

                                <AdminCommandStrip>
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                                        <div className="relative flex-1">
                                            <svg className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                            <input value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} placeholder="Search staff member, activity, or workspace..." className="w-full border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm font-medium outline-none focus:border-[#720101] focus:ring-2 focus:ring-[#720101]/10" />
                                        </div>
                                        <select value={auditRoleFilter} onChange={(e) => setAuditRoleFilter(e.target.value)} className="admin-select px-4 py-3 text-sm font-bold outline-none">
                                            <option value="All">All Roles</option>
                                            <option value="Admin">Admin</option>
                                            <option value="Marketing">Marketing</option>
                                            <option value="Accounting">Accounting</option>
                                        </select>
                                        <select value={auditActivityFilter} onChange={(e) => setAuditActivityFilter(e.target.value)} className="admin-select px-4 py-3 text-sm font-bold outline-none">
                                            <option value="Operational">Operational activity</option>
                                            <option value="System access">System access</option>
                                            <option value="All">All activity</option>
                                        </select>
                                        <select value={auditWorkspaceFilter} onChange={(e) => setAuditWorkspaceFilter(e.target.value)} className="admin-select px-4 py-3 text-sm font-bold outline-none">
                                            <option value="All">All workspaces</option>
                                            {auditWorkspaceOptions.map((workspace) => <option key={workspace} value={workspace}>{workspace}</option>)}
                                        </select>
                                        <select value={auditResultFilter} onChange={(e) => setAuditResultFilter(e.target.value)} className="admin-select px-4 py-3 text-sm font-bold outline-none">
                                            <option value="All">All results</option>
                                            {auditResultOptions.map((result) => <option key={result} value={result}>{result}</option>)}
                                        </select>
                                    </div>
                                </AdminCommandStrip>

                                <div className="admin-surface-grid overflow-hidden">
                                    {auditLoading ? (
                                        <StaffSkeleton rows={7} label="Loading activity log" />
                                    ) : visibleAudits.length === 0 ? (
                                        <StaffEmptyState title="No activity matches these filters" message="Adjust the role, workspace, result, or activity type to review more staff activity." />
                                    ) : (
                                        <table className="staff-table">
                                            <thead>
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Time</th>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Staff</th>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Activity</th>
                                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Workspace</th>
                                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Result</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginatedAudits.items.map((audit) => {
                                                    const result = getAuditResult(audit);

                                                    return (
                                                        <tr key={audit.id}>
                                                            <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-700">{formatDateTime(audit.created_at)}</td>
                                                            <td className="px-6 py-4">
                                                                <div className="font-black text-gray-900">{audit.username || 'Unknown'}</div>
                                                                <div className="text-xs font-bold text-[#720101]">{audit.role || 'Staff'}</div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="font-bold text-gray-900">{audit.action || 'Reviewed workspace activity'}</div>
                                                            </td>
                                                            <td className="px-6 py-4 max-w-sm">
                                                                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{getAuditWorkspace(audit)}</span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${result.className}`}>
                                                                    {result.label}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                                {!auditLoading && visibleAudits.length > 0 && (
                                    <PaginationControls pageInfo={paginatedAudits} onPageChange={setAuditPage} />
                                )}
                            </AdminPageSurface>
                        )
                    }
                </div>

            {/* Employee Add/Edit Modal */}
            {
                empModal.open && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setEmpModal({ open: false, mode: 'add', data: null })}></div>
                        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-fadeIn overflow-hidden">
                            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#9f6500]">{empModal.mode === 'add' ? 'New access' : 'Account access'}</p>
                                <h3 className="text-lg font-bold text-gray-900">
                                    {empModal.mode === 'add' ? 'Provision New Account' : empModal.data?.role === 'Client' ? 'Modify Customer Account' : 'Modify Staff Credentials'}
                                </h3>
                                <p className="mt-1 text-sm font-semibold text-slate-500">Set the account identity, contact details, and workspace privilege level.</p>
                            </div>
                            <form onSubmit={handleEmpSubmit} className="max-h-[78vh] overflow-y-auto p-6 custom-scrollbar">
                                <div className="mb-5 grid gap-3 rounded-2xl border border-[#720101]/10 bg-[#fffaf3] p-4 text-sm font-semibold text-slate-600">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-widest text-[#9f6500]">Access setup</p>
                                        <p className="mt-1 text-slate-700">A temporary password is generated automatically and expires in 24 hours. Email it when available, then copy it from the one-time password dialog as a fallback.</p>
                                    </div>
                                    {empModal.mode === 'add' && empForm.role === 'Admin' && (
                                        <div className="rounded-xl border border-[#720101]/10 bg-white px-4 py-3 text-[#720101]">
                                            Admin accounts have full console access. Create these only for trusted owner or operations administrators.
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    {empModal.data?.role !== 'Client' && (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Full Name</label>
                                            <input type="text" required value={empForm.full_name} onChange={e => setEmpForm({ ...empForm, full_name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#720101] outline-none transition-all text-sm font-medium" />
                                            {empFormErrors.full_name && <p className="mt-1 text-xs font-bold text-red-600">{empFormErrors.full_name[0]}</p>}
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Username</label>
                                        <input type="text" required value={empForm.username} onChange={e => setEmpForm({ ...empForm, username: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#720101] outline-none transition-all text-sm font-medium" />
                                        {empFormErrors.username && <p className="mt-1 text-xs font-bold text-red-600">{empFormErrors.username[0]}</p>}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Email (Optional)</label>
                                            <input type="email" value={empForm.email} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#720101] outline-none transition-all text-sm" />
                                            {empFormErrors.email && <p className="mt-1 text-xs font-bold text-red-600">{empFormErrors.email[0]}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Phone (Optional)</label>
                                            <input type="text" value={empForm.phone} onChange={e => setEmpForm({ ...empForm, phone: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#720101] outline-none transition-all text-sm" />
                                            {empFormErrors.phone && <p className="mt-1 text-xs font-bold text-red-600">{empFormErrors.phone[0]}</p>}
                                        </div>
                                    </div>
                                    {empModal.mode === 'add' && empModal.data?.role !== 'Client' && (
                                        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                                            A temporary password will be generated, emailed when possible, and this account must change it on first sign-in.
                                        </div>
                                    )}
                                    {empModal.mode === 'edit' && (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">New Password</label>
                                            <input type="text" minLength="6" value={empForm.password} onChange={e => setEmpForm({ ...empForm, password: e.target.value })} placeholder="Leave blank to keep current" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#720101] outline-none transition-all text-sm" />
                                            {empFormErrors.password && <p className="mt-1 text-xs font-bold text-red-600">{empFormErrors.password[0]}</p>}
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Privilege Level</label>
                                        {empModal.data?.role === 'Client' ? (
                                            <div className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-600">
                                                Client / Customer
                                            </div>
                                        ) : (
                                            <div className="grid gap-2">
                                                {ACCOUNT_ROLE_OPTIONS
                                                    .filter((option) => empModal.mode === 'add' || option.value !== 'Admin')
                                                    .map((option) => (
                                                    <label key={option.value} className={`cursor-pointer rounded-xl border px-4 py-3 transition ${empForm.role === option.value ? 'border-[#720101] bg-[#fff7e8]' : 'border-gray-200 bg-gray-50 hover:bg-white'}`}>
                                                        <input
                                                            type="radio"
                                                            name="account_role"
                                                            value={option.value}
                                                            checked={empForm.role === option.value}
                                                            onChange={e => setEmpForm({ ...empForm, role: e.target.value })}
                                                            className="sr-only"
                                                        />
                                                        <span className="flex items-start justify-between gap-3">
                                                            <span>
                                                                <span className="block text-sm font-black text-slate-950">{option.label}</span>
                                                                <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{option.description}</span>
                                                            </span>
                                                            <span className={`mt-1 h-4 w-4 rounded-full border ${empForm.role === option.value ? 'border-[#720101] bg-[#720101]' : 'border-slate-300 bg-white'}`}></span>
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                        {empFormErrors.role && <p className="mt-1 text-xs font-bold text-red-600">{empFormErrors.role[0]}</p>}
                                    </div>
                                </div>
                                <div className="mt-8 flex justify-end gap-3">
                                    <button type="button" onClick={() => setEmpModal({ open: false, mode: 'add', data: null })} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                                    <button type="submit" disabled={empFormLoading} className="px-5 py-2.5 text-sm font-bold text-white bg-[#720101] hover:bg-[#5a0101] rounded-lg shadow-sm transition-colors disabled:opacity-50">
                                        {empFormLoading ? 'Configuring...' : empModal.mode === 'add' ? 'Create Account' : 'Update Account'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Discount Modal */}
            {
                discountModal.open && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setDiscountModal({ open: false, data: null })}></div>
                        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fadeIn overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="text-lg font-bold text-gray-900">Apply Booking Discount</h3>
                                <p className="text-xs text-gray-500 mt-1">{discountModal.data?.client_full_name || discountModal.data?.client_name || discountModal.data?.username}'s Event (#BK-{discountModal.data?.id.toString().padStart(4, '0')})</p>
                            </div>
                            <form onSubmit={handleDiscountSubmit} className="p-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Discount Type</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <label className={`border rounded-lg p-3 flex cursor-pointer transition-colors ${discountForm.discount_type === 'fixed' ? 'bg-[#fff7e8] border-[#720101] text-[#720101]' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                                <input type="radio" name="discount_type" value="fixed" checked={discountForm.discount_type === 'fixed'} onChange={() => setDiscountForm({ ...discountForm, discount_type: 'fixed' })} className="hidden" />
                                                <div className="font-bold text-sm text-center w-full">Fixed Amount (₱)</div>
                                            </label>
                                            <label className={`border rounded-lg p-3 flex cursor-pointer transition-colors ${discountForm.discount_type === 'percentage' ? 'bg-[#fff7e8] border-[#720101] text-[#720101]' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                                <input type="radio" name="discount_type" value="percentage" checked={discountForm.discount_type === 'percentage'} onChange={() => setDiscountForm({ ...discountForm, discount_type: 'percentage' })} className="hidden" />
                                                <div className="font-bold text-sm text-center w-full">Percentage (%)</div>
                                            </label>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Discount Value</label>
                                        <div className="relative">
                                            {discountForm.discount_type === 'fixed' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₱</span>}
                                            <input
                                                type="number"
                                                required
                                                min="0"
                                                value={discountForm.discount_value}
                                                onChange={e => setDiscountForm({ ...discountForm, discount_value: parseFloat(e.target.value) || 0 })}
                                                className={`w-full ${discountForm.discount_type === 'fixed' ? 'pl-8' : 'px-4'} py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#720101] outline-none transition-all text-lg font-bold`}
                                            />
                                            {discountForm.discount_type === 'percentage' && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">%</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-8 flex justify-end gap-3">
                                    <button type="button" onClick={() => setDiscountModal({ open: false, data: null })} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                                    <button type="submit" disabled={discountLoading} className="px-5 py-2.5 text-sm font-bold text-white bg-[#720101] hover:bg-[#5a0101] rounded-lg shadow-sm transition-colors disabled:opacity-50">
                                        {discountLoading ? 'Applying...' : 'Apply Discount'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Event Details Modal */}
            {
                eventDetailsModal.open && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setEventDetailsModal({ open: false, data: null })}></div>
                        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl animate-fadeIn overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="px-5 py-4 border-b border-[#720101]/10 bg-white flex justify-between items-start sticky top-0 z-10">
                                <div>
                                    <p className="marketing-kicker">Event details</p>
                                    <h3 className="mt-1 text-2xl font-black leading-tight text-slate-950">{eventDisplayName(eventDetailsModal.data)}</h3>
                                    <p className="mt-1 text-sm font-bold text-slate-500">{formatBookingRef(eventDetailsModal.data?.id)} / {eventDetailsModal.data?.event_type || 'Event'} / {eventDetailsModal.data?.pax || 0} guests</p>
                                </div>
                                <button onClick={() => setEventDetailsModal({ open: false, data: null })} className="staff-icon-button" aria-label="Close event details">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4 bg-[#fbf8f2]">
                                {(() => {
                                    const selectedDishes = getSelectedDishes(eventDetailsModal.data);
                                    return (
                                        <>
                                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr]">
                                    {[
                                        ['Customer', eventDetailsModal.data?.client_full_name || eventDetailsModal.data?.username || 'N/A', `${eventDetailsModal.data?.client_email || 'No email'} / ${eventDetailsModal.data?.client_phone || 'No phone'}`],
                                        ['Schedule', `${formatDate(eventDetailsModal.data?.event_date)} / ${formatTime(eventDetailsModal.data?.event_time)}`, eventDetailsModal.data?.status || 'Pending'],
                                        ['Venue', formatFullAddress(eventDetailsModal.data), eventDetailsModal.data?.venue_building_details || 'No building notes'],
                                        ['Total', formatCurrency(getBookingTotal(eventDetailsModal.data)), `${selectedDishes.length} dishes / ${eventDetailsModal.data?.transport_fee ? `Travel ${formatCurrency(eventDetailsModal.data.transport_fee)}` : 'No travel fee'}`],
                                    ].map(([label, value, meta]) => (
                                        <section key={label} className="rounded-xl border border-[#720101]/10 bg-white px-4 py-3">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-[#a16207]">{label}</p>
                                            <p className="mt-1 break-words text-sm font-black leading-snug text-slate-950">{value}</p>
                                            <p className="mt-1 break-words text-xs font-bold text-slate-500">{meta}</p>
                                        </section>
                                    ))}
                                </div>

                                {selectedDishes.length > 0 && (
                                    <section>
                                        <div className="mb-2 flex items-center justify-between border-b border-gray-100 pb-2">
                                            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Selected Dishes</h4>
                                            <span className="rounded-full bg-[#fff7e8] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#720101]">{selectedDishes.length} dishes</span>
                                        </div>
                                        <div className="grid max-h-40 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-4 custom-scrollbar">
                                            {selectedDishes.map((dish, index) => (
                                                <div key={`${dish.category}-${dish.name}-${index}`} className="rounded-lg border border-gray-100 bg-white px-3 py-2">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-[#a16207]">{dish.category}</p>
                                                    <p className="mt-1 text-sm font-bold text-gray-900">{dish.name}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                <div>
                                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2 border-b border-gray-100 pb-2">Payment Schedule</h4>
                                    <div className="overflow-x-auto rounded-lg border border-[#720101]/10">
                                        <table className="staff-table">
                                            <thead>
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">Term</th>
                                                    <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500">Amount</th>
                                                    <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-500">Due Date</th>
                                                    <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-500">Status</th>
                                                    <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(eventDetailsModal.data?.payments || []).map(payment => (
                                                    <tr key={payment.id}>
                                                        <td className="px-4 py-3 font-semibold text-gray-900">{paymentLabel(payment.payment_type)}</td>
                                                        <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(payment.amount)}</td>
                                                        <td className="px-4 py-3 text-center text-gray-600">{formatDate(payment.due_date)}</td>
                                                        <td className="px-4 py-3 text-center text-gray-600">{staffPaymentStatus(payment.status, payment.due_date).label}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            {payment.status === 'Pending' || payment.status === 'Rejected' ? (
                                                                <button onClick={() => setEditPaymentModal({ isOpen: true, payment, booking: eventDetailsModal.data })} className="rounded-lg bg-[#fff7e8] px-3 py-2 text-xs font-black text-[#720101] transition-colors hover:bg-[#fff1d3]">Edit term</button>
                                                            ) : (
                                                                <span className="text-xs font-semibold text-gray-400">Locked</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {(eventDetailsModal.data?.payments || []).length === 0 && (
                                                    <tr>
                                                        <td colSpan="5" className="px-4 py-6 text-center text-sm text-gray-500">No payment schedule found.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                {eventDetailsModal.data?.preparation_tasks?.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2 border-b border-gray-100 pb-2">Preparation Tasks</h4>
                                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                            {eventDetailsModal.data.preparation_tasks.map(task => (
                                                <div key={task.id} className={`rounded-lg border px-4 py-3 ${task.status === 'Done' ? 'border-emerald-100 bg-emerald-50' : 'border-amber-100 bg-[#fffaf3]'}`}>
                                                    <p className="text-sm font-bold text-gray-900">{task.label}</p>
                                                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                                        {task.responsible_area || handoffResponsibleArea(task.department)} / {task.status}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                        </>
                                    );
                                })()}
                            </div>

                            <div className="px-5 py-3 border-t border-[#720101]/10 bg-white flex items-center justify-between gap-3">
                                <p className="text-xs font-bold text-slate-500">Payment terms can be edited here. Other actions stay in the current workspace.</p>
                                <button onClick={() => setEventDetailsModal({ open: false, data: null })} className="px-5 py-2 bg-[#720101] hover:bg-[#5a0101] text-white text-sm font-bold rounded-lg shadow-sm transition-colors">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {editPaymentModal.isOpen && (
                <Suspense fallback={null}>
                    <PaymentTermEditorModal
                        isOpen={editPaymentModal.isOpen}
                        onClose={() => setEditPaymentModal({ isOpen: false, payment: null, booking: null })}
                        booking={editPaymentModal.booking}
                        payment={editPaymentModal.payment}
                        onSuccess={() => {
                            setEditPaymentModal({ isOpen: false, payment: null, booking: null });
                            setEventDetailsModal({ open: false, data: null });
                            showToast('Payment terms updated');
                            fetchBookings();
                        }}
                    />
                </Suspense>
            )}

            {renderCatalogDrawer()}

            {/* Add New Menu Item Modal */}
            {menuItemModal.open && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fadeIn">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <svg className="w-5 h-5 text-[#720101]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuItemModal.mode === 'edit' ? 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' : 'M12 4v16m8-8H4'} /></svg>
                                {menuItemModal.mode === 'edit' ? 'Edit Menu Item' : 'Add New Menu Item'}
                            </h3>
                            <button onClick={() => setMenuItemModal({ open: false, mode: 'add', data: null })} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleMenuItemSubmit} className="p-6 space-y-5">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Dish Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={menuItemForm.name}
                                    onChange={e => setMenuItemForm({ ...menuItemForm, name: e.target.value })}
                                    placeholder="e.g. Garlic Butter Shrimp"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#720101]/10 focus:border-[#720101] outline-none transition-all text-sm"
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Category <span className="text-red-500">*</span></label>
                                <select
                                    value={menuItemForm.category}
                                    onChange={e => setMenuItemForm({ ...menuItemForm, category: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#720101]/10 focus:border-[#720101] outline-none transition-all text-sm bg-white capitalize"
                                >
                                    <option value="starter">Starter</option>
                                    <option value="main">Main</option>
                                    <option value="side">Side</option>
                                    <option value="dessert">Dessert</option>
                                    <option value="drink">Drink</option>
                                </select>
                            </div>

                            {/* Cost & Price Adj */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Cost Per Head (₱) <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={menuItemForm.cost_per_head}
                                        onChange={e => setMenuItemForm({ ...menuItemForm, cost_per_head: e.target.value })}
                                        placeholder="0"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#720101]/10 focus:border-[#720101] outline-none transition-all text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Price Adjustment (₱)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={menuItemForm.price_adj}
                                        onChange={e => setMenuItemForm({ ...menuItemForm, price_adj: e.target.value })}
                                        placeholder="0"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#720101]/10 focus:border-[#720101] outline-none transition-all text-sm"
                                    />
                                </div>
                            </div>

                            {/* Image Link */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Image Link</label>
                                <input
                                    type="url"
                                    value={menuItemForm.image}
                                    onChange={e => setMenuItemForm({ ...menuItemForm, image: e.target.value })}
                                    placeholder="https://images.unsplash.com/..."
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#720101]/10 focus:border-[#720101] outline-none transition-all text-sm"
                                />
                                <p className="text-xs text-gray-400 mt-1">Leave blank to use a standard menu image.</p>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Description</label>
                                <textarea
                                    rows="3"
                                    value={menuItemForm.description}
                                    onChange={e => setMenuItemForm({ ...menuItemForm, description: e.target.value })}
                                    placeholder="A brief description of the dish..."
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#720101]/10 focus:border-[#720101] outline-none transition-all text-sm resize-none"
                                />
                            </div>

                            {/* Best Seller Toggle */}
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={menuItemForm.is_best_seller}
                                    onChange={e => setMenuItemForm({ ...menuItemForm, is_best_seller: e.target.checked })}
                                    className="w-5 h-5 rounded border-gray-300 text-[#720101] focus:ring-[#720101]"
                                />
                                <span className="text-sm font-medium text-gray-700">Mark as Best Seller</span>
                            </label>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setMenuItemModal({ open: false, mode: 'add', data: null })}
                                    className="px-6 py-2.5 text-sm font-bold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={menuItemFormLoading}
                                    className="px-6 py-2.5 text-sm font-bold text-white bg-[#720101] rounded-xl hover:bg-[#5a0101] transition-colors shadow-md disabled:opacity-50"
                                >
                                    {menuItemFormLoading ? (menuItemModal.mode === 'edit' ? 'Saving...' : 'Adding...') : (menuItemModal.mode === 'edit' ? 'Save changes' : 'Create menu item')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmText={confirmDialog.confirmText}
                tone={confirmDialog.tone}
                busy={confirmDialog.busy}
                onCancel={closeConfirmDialog}
                onConfirm={confirmDialog.onConfirm}
            >
                {confirmDialog.showNotifyCustomer && (
                    <label className="flex items-start gap-3 rounded-xl border border-[#720101]/10 bg-white px-4 py-3 text-sm font-semibold text-slate-600">
                        <input
                            type="checkbox"
                            checked={confirmNotifyCustomer}
                            onChange={(event) => {
                                setConfirmNotifyCustomer(event.target.checked);
                                confirmNotifyCustomerRef.current = event.target.checked;
                            }}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-[#720101] focus:ring-[#720101]"
                        />
                        <span>
                            Notify customer by email
                            <span className="block text-xs font-medium text-slate-400">The account action still succeeds if email cannot be queued.</span>
                        </span>
                    </label>
                )}
            </ConfirmModal>

            {temporaryPasswordModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={closeTemporaryPasswordModal}></div>
                    <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
                        <div className="border-b border-amber-100 bg-[#fffaf3] px-6 py-5">
                            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#a56500]">Staff access</p>
                            <h3 className="mt-2 text-2xl font-black text-slate-950">Temporary password</h3>
                            <p className="mt-2 text-sm font-semibold text-slate-600">Copy this password now. It can be shown again only until it expires or the account owner changes it.</p>
                        </div>
                        <div className="space-y-4 px-6 py-5">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Account</p>
                                <p className="mt-1 text-sm font-black text-slate-950">{temporaryPasswordModal.username || 'Staff account'}</p>
                                {temporaryPasswordModal.email && <p className="text-xs font-semibold text-slate-500">{temporaryPasswordModal.email}</p>}
                            </div>
                            <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
                                <p className="text-xs font-black uppercase tracking-widest text-rose-700">Temporary password</p>
                                <div className="mt-2 break-all rounded-lg border border-rose-200 bg-white px-3 py-3 font-mono text-lg font-black text-slate-950">
                                    {temporaryPasswordModal.password}
                                </div>
                                {temporaryPasswordModal.expiresAt && (
                                    <p className="mt-2 text-xs font-semibold text-rose-700">Expires: {formatDateTime(temporaryPasswordModal.expiresAt)}</p>
                                )}
                            </div>
                            <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                                {temporaryPasswordModal.deliveryHint}
                            </p>
                        </div>
                        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end">
                            <button type="button" onClick={closeTemporaryPasswordModal} className="rounded-lg px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100">Close</button>
                            {temporaryPasswordModal.canRevealAgain && temporaryPasswordModal.userId && (
                                <button
                                    type="button"
                                    onClick={() => handleRevealTemporaryPassword({
                                        id: temporaryPasswordModal.userId,
                                        username: temporaryPasswordModal.username,
                                        email: temporaryPasswordModal.email,
                                    })}
                                    className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-2.5 text-sm font-black text-amber-900 hover:bg-amber-100"
                                >
                                    Show again until expiry
                                </button>
                            )}
                            <button type="button" onClick={copyTemporaryPassword} className="rounded-lg bg-[#8b0000] px-5 py-2.5 text-sm font-black text-white shadow-sm hover:bg-[#6f0000]">Copy password</button>
                        </div>
                    </div>
                </div>
            )}

            {expandedAnalyticsPanel && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
                    <div className="admin-chart-modal">
                        <header className="admin-chart-modal-head">
                            <div>
                                <p className="admin-kicker">Expanded analytics</p>
                                <h3>{expandedPanelMeta[expandedAnalyticsPanel]?.[0] || 'Analytics chart'}</h3>
                                <p>{businessSnapshot.label || 'Current timeframe'} · Larger view for easier reading.</p>
                            </div>
                            <button type="button" onClick={() => setExpandedAnalyticsPanel(null)} className="admin-mini-button inline-flex items-center gap-2">
                                <X className="h-4 w-4" />
                                Close
                            </button>
                        </header>
                        <div className="admin-chart-modal-body">
                            <div className="admin-chart-modal-figure">
                                {renderExpandedAnalyticsContent(expandedAnalyticsPanel) || <div className="admin-chart-empty">No chart data available for this view.</div>}
                            </div>
                            <aside className="admin-chart-modal-insight">
                                <InsightLine
                                    insight={expandedPanelMeta[expandedAnalyticsPanel]?.[1] || {
                                        headline: 'No interpretation available yet',
                                        meaning: 'Use the trend and filters to compare current performance while this chart waits for a dedicated insight rule.',
                                        recommended_action: 'Compare this chart with current bookings, payments, and handoff queues before acting.',
                                        severity: 'watch',
                                    }}
                                    compact={false}
                                />
                            </aside>
                        </div>
                    </div>
                </div>
            )}

            <AssistedBookingWizard
                isOpen={assistedBookingOpen}
                onClose={() => setAssistedBookingOpen(false)}
                onCreated={handleAssistedBookingCreated}
                onOpenBooking={(booking) => setEventDetailsModal({ open: true, data: booking })}
                toast={showToast}
            />

            {/* Toast */}
            {
                toast && (
                    <div className="pointer-events-none fixed bottom-5 right-5 z-50 animate-slideUp">
                        <div className="pointer-events-auto flex max-w-[360px] items-start gap-3 rounded-xl bg-[#fffaf3] px-4 py-3 text-sm shadow-[0_10px_30px_rgba(50,35,20,0.18)]">
                            <span className={`min-w-0 flex-1 font-semibold leading-5 ${toast.type === 'error' ? 'text-[#8b0000]' : 'text-[#374151]'}`}>{toast.message}</span>
                        </div>
                    </div>
                )
            }
        </StaffWorkspaceLayout>
    );
};

export default DashboardAdmin;
