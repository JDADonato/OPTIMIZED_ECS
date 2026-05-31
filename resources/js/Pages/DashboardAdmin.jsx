import React, { Suspense, lazy, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { router } from '@inertiajs/react';
import logoImg from '../../images/ECS_LOGO.png';
import { BarChart, Bar as RechartsBar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line as RechartsLine } from '../Components/charts/LazyRecharts';
import { CalendarDays, CheckCircle2, ChevronDown, ClipboardList, CreditCard, Filter, Loader2, Maximize2, Package, RefreshCw, Search, Users, X } from 'lucide-react';
import useCachedJson from '../hooks/useCachedJson';
import useSmartRefresh from '../hooks/useSmartRefresh';
import ConfirmModal from '../Components/common/ConfirmModal';
import SmartImage from '../Components/common/SmartImage';
import StaffSkeleton, { StaffWorkspaceSkeleton } from '../Components/staff/StaffSkeleton';
import StaffWorkspaceLayout from '../Layouts/StaffWorkspaceLayout';
import { AdminCommandStrip, AdminPageSurface, AdminResponsiveTable } from '../Components/admin/AdminSurface';
import StaffPageHeader from '../Components/staff/StaffPageHeader';
import StaffEmptyState from '../Components/staff/StaffEmptyState';
import StaffPagination from '../Components/staff/StaffPagination';
import { StaffCommandBar, StaffInlineInsight, StaffMetricStrip, StaffPrimaryAction, StaffStatusChip, StaffWorkTable } from '../Components/staff/StaffV2';
import EventHistoryPanel from '../Components/staff/EventHistoryPanel';
import NextActionPanel from '../Components/staff/NextActionPanel';
import RoleSettingsPanel from '../Components/staff/RoleSettingsPanel';
import AssistedBookingWizard from '../Components/marketing/AssistedBookingWizard';
import PasswordStrengthField, { PasswordMatchHint } from '../Components/auth/PasswordStrengthField';
import PasswordUpgradeBanner from '../Components/auth/PasswordUpgradeBanner';
import { getListData } from '../utils/apiResponses';
import csrfFetch from '../utils/csrf';
import { fetchSmartResource, getUserScopedCacheKey, readSmartCache } from '../utils/smartResource';
import { operationalChannelsForUser } from '../utils/liveChannels';
import { evaluatePassword } from '../utils/passwordPolicy';
import {
    ACCOUNTING_WORKSPACE_NAV_GROUPS,
    ADMIN_WORKSPACE_NAV_GROUPS,
    ADMIN_WORKSPACES,
    CUSTOMER_WORKSPACE_NAV_GROUPS,
    MARKETING_WORKSPACE_NAV_GROUPS,
    withNavCounts,
} from '../utils/staffWorkspaceNav';
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
import { bookingContactEmail, bookingContactName, bookingContactPhone, customerAccountName, customerAccountEmail, customerAccountPhone, hasDifferentBookingContact } from '../utils/customerIdentity';
import { paymentTypeLabel, staffPaymentStatus } from '../utils/statusLabels';

const AnnouncementManager = lazy(() => import('../Components/content/AnnouncementManager'));
const PaymentTermEditorModal = lazy(() => import('../Components/finance/PaymentTermEditorModal'));
const PreparationBoard = lazy(() => import('../Components/operations/PreparationBoard'));
const StaffMessaging = lazy(() => import('../Components/common/StaffMessaging'));
const FoodTastingQueue = lazy(() => import('../Components/operations/FoodTastingQueue'));

const paymentLabel = paymentTypeLabel;
const Bar = (props) => <RechartsBar animationDuration={650} {...props} />;
const Line = (props) => <RechartsLine animationDuration={650} {...props} />;
const isPlaceholderEmail = (email) => typeof email === 'string' && email.trim().toLowerCase().endsWith('@eloquente.invalid');
const displayEmail = (email, fallback = 'No email') => (email && !isPlaceholderEmail(email) ? email : fallback);

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

const MENU_CATEGORY_OPTIONS = [
    { value: 'all', label: 'All dish types' },
    { value: 'starter', label: 'Starters' },
    { value: 'main', label: 'Mains' },
    { value: 'side', label: 'Sides' },
    { value: 'dessert', label: 'Desserts' },
    { value: 'drink', label: 'Drinks' },
];

const ANALYTICS_PACKAGE_CATEGORY_OPTIONS = [
    { value: '', label: 'All package categories' },
    { value: 'premium', label: 'Wedding & Debut Packages' },
    { value: 'birthday', label: 'Birthday Packages' },
    { value: 'standard', label: 'Standard Event Packages' },
    { value: 'custom', label: 'Custom / Unassigned' },
];

const ANALYTICS_BOOKING_STATUS_OPTIONS = [
    { value: '', label: 'All booking statuses' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Confirmed', label: 'Confirmed' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Cancelled', label: 'Cancelled' },
];

const ANALYTICS_TIMEFRAME_OPTIONS = [
    { value: 'all', label: 'All time' },
    { value: '3m', label: 'Last 3 months' },
    { value: '6m', label: 'Last 6 months' },
    { value: '12m', label: 'Last 12 months' },
    { value: '24m', label: 'Last 24 months' },
    { value: 'ytd', label: 'Year to date' },
];

const TREND_MONTH_OPTIONS = [3, 6, 9, 12, 18, 24];
const PERFORMANCE_LIMIT_OPTIONS = [5, 8, 10, 15, 20];
const AVAILABILITY_EVENT_PAGE_SIZE = 6;
const HEATMAP_YEAR_OPTIONS = Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - 2 + index);
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
    package_category: '',
    booking_status: '',
};

const ADMIN_EMPLOYEES_URL = '/api/admin/employees?paginated=1&per_page=25';
const ADMIN_CUSTOMERS_URL = '/api/admin/customers?paginated=1&per_page=25';
const ADMIN_BOOKINGS_URL = '/api/admin/bookings?paginated=1&per_page=25';
const CUSTOMER_SUPPORT_TABS = ['customer-lookup', 'customer-dashboard', 'customer-menu', 'customer-payments', 'customer-history', 'customer-messages', 'customer-feedback', 'customer-announcements', 'customer-account-status'];
const ADMIN_FULL_SURFACE_TABS = ['bookings-intake', 'calendar', 'handoff', 'tastings', 'finance', 'messages-inquiries', 'public-content', 'availability', 'accounts', 'settings', 'system-audit', 'history', ...CUSTOMER_SUPPORT_TABS];
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
const ADMIN_SEARCH_ALIASES = {
    today: ['dashboard', 'overview', 'home', 'command', 'priority', 'urgent', 'owner'],
    'bookings-intake': ['bookings', 'booking', 'intake', 'reservations', 'approve', 'review', 'customer booking'],
    handoff: ['handoff', 'preparation', 'prep', 'readiness', 'tasks', 'operations'],
    tastings: ['tasting', 'tastings', 'food tasting', 'customer experience', 'sampling'],
    finance: ['finance', 'accounting', 'payments', 'refunds', 'ledger', 'money', 'billing'],
    'finance:payments': ['payment', 'payments', 'proofs', 'pending payments', 'overdue', 'exceptions'],
    'finance:refunds': ['refund', 'refunds', 'cancellations', 'provider reference', 'refundable'],
    accounts: ['accounts', 'users', 'people', 'access', 'passwords', 'customers', 'staff'],
    'accounts:staff': ['staff', 'employees', 'admin users', 'roles', 'temporary password', 'deactivate'],
    'accounts:customers': ['customers', 'clients', 'customer accounts', 'reactivation', 'booking history'],
    'messages-inquiries': ['messages', 'inquiries', 'chat', 'support', 'guest inquiries', 'communication'],
    calendar: ['calendar', 'schedule', 'events', 'dates', 'confirmed events'],
    availability: ['availability', 'slots', 'capacity', 'closed dates', 'date settings'],
    'public-content': ['public content', 'content', 'catalog', 'menu', 'packages', 'announcements', 'customer-facing'],
    'public-content:announcements': ['announcement', 'announcements', 'email', 'publish', 'scheduled updates'],
    'public-content:packages': ['package', 'packages', 'pricing', 'presets', 'catalog'],
    'public-content:eventTypes': ['event type', 'event types', 'event categories', 'booking flow'],
    'public-content:menuItems': ['menu', 'menu items', 'dish', 'dishes', 'food', 'custom items'],
    analytics: ['analytics', 'insights', 'charts', 'performance', 'trends', 'forecast'],
    reports: ['reports', 'report builder', 'exports', 'summaries', 'pdf'],
    'system-audit': ['system', 'audit', 'audits', 'activity', 'delivery', 'session', 'logs'],
    history: ['history', 'event history', 'completed events', 'notes', 'post-event'],
    settings: ['settings', 'configuration', 'preferences', 'notifications', 'business profile', 'payment rules'],
    profile: ['profile', 'my account', 'account details', 'password', 'contact details'],
};
const DEFAULT_WORKSPACE_TABS = {
    admin: 'today',
    customer: 'lookup',
    marketing: 'today',
    accounting: 'today',
};
const WORKSPACE_TAB_TO_INTERNAL_TAB = {
    admin: {
        today: 'today',
        accounts: 'accounts',
        analytics: 'analytics',
        reports: 'reports',
        'system-audit': 'system-audit',
        settings: 'settings',
        profile: 'profile',
    },
    customer: {
        lookup: 'customer-lookup',
        dashboard: 'customer-dashboard',
        menu: 'customer-menu',
        payments: 'customer-payments',
        history: 'customer-history',
        messages: 'customer-messages',
        feedback: 'customer-feedback',
        announcements: 'customer-announcements',
        'account-status': 'customer-account-status',
    },
    marketing: {
        today: 'marketing-today',
        bookings: 'bookings-intake',
        leads: 'messages-inquiries',
        tastings: 'tastings',
        calendar: 'calendar',
        handoff: 'handoff',
        messages: 'messages-inquiries',
        'public-content': 'public-content',
        availability: 'availability',
        history: 'history',
    },
    accounting: {
        today: 'accounting-today',
        payments: 'finance',
        reconciliation: 'finance',
        refunds: 'finance',
        ledger: 'finance',
        history: 'history',
    },
};
const WORKSPACE_TAB_ALIASES = {
    customer: {
        book: 'dashboard',
        'book-now': 'dashboard',
        details: 'dashboard',
        'event-details': 'dashboard',
    },
};
const LEGACY_TAB_DESTINATIONS = {
    today: { workspace: 'admin', tab: 'today' },
    dashboard: { workspace: 'admin', tab: 'today' },
    overview: { workspace: 'admin', tab: 'today' },
    accounts: { workspace: 'admin', tab: 'accounts' },
    'accounts:staff': { workspace: 'admin', tab: 'accounts', accountSegment: 'staff' },
    'accounts:customers': { workspace: 'admin', tab: 'accounts', accountSegment: 'customers' },
    analytics: { workspace: 'admin', tab: 'analytics' },
    reports: { workspace: 'admin', tab: 'reports' },
    'system-audit': { workspace: 'admin', tab: 'system-audit' },
    settings: { workspace: 'admin', tab: 'settings' },
    profile: { workspace: 'admin', tab: 'profile' },
    'bookings-intake': { workspace: 'marketing', tab: 'bookings' },
    bookings: { workspace: 'marketing', tab: 'bookings' },
    calendar: { workspace: 'marketing', tab: 'calendar' },
    handoff: { workspace: 'marketing', tab: 'handoff' },
    tastings: { workspace: 'marketing', tab: 'tastings' },
    tasting: { workspace: 'marketing', tab: 'tastings' },
    'messages-inquiries': { workspace: 'marketing', tab: 'messages' },
    messages: { workspace: 'marketing', tab: 'messages' },
    inquiries: { workspace: 'marketing', tab: 'leads' },
    'public-content': { workspace: 'marketing', tab: 'public-content' },
    'public-content:announcements': { workspace: 'marketing', tab: 'public-content', configTab: 'announcements' },
    'public-content:packages': { workspace: 'marketing', tab: 'public-content', configTab: 'packages' },
    'public-content:eventTypes': { workspace: 'marketing', tab: 'public-content', configTab: 'eventTypes' },
    'public-content:menuItems': { workspace: 'marketing', tab: 'public-content', configTab: 'menuItems' },
    availability: { workspace: 'marketing', tab: 'availability' },
    history: { workspace: 'marketing', tab: 'history' },
    finance: { workspace: 'accounting', tab: 'payments', financeSegment: 'payments' },
    accounting: { workspace: 'accounting', tab: 'payments', financeSegment: 'payments' },
    payments: { workspace: 'accounting', tab: 'payments', financeSegment: 'payments' },
    'finance:payments': { workspace: 'accounting', tab: 'payments', financeSegment: 'payments' },
    refunds: { workspace: 'accounting', tab: 'refunds', financeSegment: 'refunds' },
    'finance:refunds': { workspace: 'accounting', tab: 'refunds', financeSegment: 'refunds' },
    ledger: { workspace: 'accounting', tab: 'ledger', financeSegment: 'payments' },
    reconciliation: { workspace: 'accounting', tab: 'reconciliation', financeSegment: 'payments' },
};
const FINANCE_SEGMENT_BY_ACCOUNTING_TAB = {
    payments: 'payments',
    refunds: 'refunds',
    reconciliation: 'payments',
    ledger: 'payments',
    today: 'payments',
    history: 'payments',
};
const ADMIN_WORKSPACE_STORAGE_KEY = 'ecs:staff-workspace:admin-role-workspaces';

const normalizeWorkspace = (workspace) => (
    ADMIN_WORKSPACES.some((item) => item.id === workspace) ? workspace : 'admin'
);

const normalizeWorkspaceTab = (workspace, tab) => {
    const allowedTabs = WORKSPACE_TAB_TO_INTERNAL_TAB[workspace] || WORKSPACE_TAB_TO_INTERNAL_TAB.admin;
    const aliasedTab = WORKSPACE_TAB_ALIASES[workspace]?.[tab] || tab;
    return allowedTabs[aliasedTab] ? aliasedTab : DEFAULT_WORKSPACE_TABS[workspace];
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
const createAdminNotificationContext = (params = {}) => ({
    customerId: String(params.customer || params.customer_id || '').trim(),
    customerQuery: String(params.customerQuery || params.customerName || params.customerEmail || '').trim(),
    booking: String(params.booking || params.booking_id || '').trim(),
    conversation: String(params.conversation || params.conversation_id || '').trim(),
});
const readInitialAdminNotificationContext = () => {
    if (typeof window === 'undefined') return createAdminNotificationContext();
    return createAdminNotificationContext(Object.fromEntries(new URLSearchParams(window.location.search).entries()));
};
const hasAdminNotificationContext = (context) => Boolean(
    context.customerId || context.customerQuery || context.booking || context.conversation
);
const getAdminNotificationSearchText = (context) => (
    context.customerQuery || (context.booking ? formatBookingRef(context.booking) : '')
);

const DashboardAdmin = () => {
    const { user } = useAuth();
    const adminWorkspacePrefs = user?.profile_preferences?.staff_workspace?.admin || {};
    const adminDefaultDestination = LEGACY_TAB_DESTINATIONS[adminWorkspacePrefs.default_tab] || { workspace: 'admin', tab: 'today' };
    const readInitialWorkspaceSelection = () => {
        const defaults = {
            ...DEFAULT_WORKSPACE_TABS,
            admin: normalizeWorkspaceTab('admin', adminDefaultDestination.workspace === 'admin' ? adminDefaultDestination.tab : 'today'),
        };
        if (typeof window === 'undefined') {
            return { workspace: 'admin', tabs: defaults, customerId: '' };
        }

        const params = new URLSearchParams(window.location.search);
        const storedWorkspace = normalizeWorkspace(window.localStorage.getItem(`${ADMIN_WORKSPACE_STORAGE_KEY}:workspace`));
        let storedTabs = {};
        try {
            storedTabs = JSON.parse(window.localStorage.getItem(`${ADMIN_WORKSPACE_STORAGE_KEY}:tabs`) || '{}');
        } catch (error) {
            storedTabs = {};
        }

        const urlWorkspace = params.get('workspace');
        const urlTab = params.get('tab');
        const aliasedUrlTab = ADMIN_TAB_ALIASES[urlTab] || urlTab;
        const legacyDestination = LEGACY_TAB_DESTINATIONS[urlTab] || LEGACY_TAB_DESTINATIONS[aliasedUrlTab];
        const workspace = urlWorkspace
            ? normalizeWorkspace(urlWorkspace)
            : legacyDestination?.workspace || storedWorkspace;
        const tab = urlWorkspace
            ? normalizeWorkspaceTab(workspace, urlTab)
            : legacyDestination?.tab || normalizeWorkspaceTab(workspace, storedTabs[workspace]);

        return {
            workspace,
            tabs: {
                ...defaults,
                ...storedTabs,
                [workspace]: normalizeWorkspaceTab(workspace, tab),
            },
            customerId: params.get('customer') || '',
        };
    };
    const initialWorkspaceSelectionRef = useRef(null);
    if (!initialWorkspaceSelectionRef.current) {
        initialWorkspaceSelectionRef.current = readInitialWorkspaceSelection();
    }
    const initialNotificationContextRef = useRef(null);
    if (!initialNotificationContextRef.current) {
        initialNotificationContextRef.current = readInitialAdminNotificationContext();
    }
    const [activeWorkspace, setActiveWorkspace] = useState(initialWorkspaceSelectionRef.current.workspace);
    const [workspaceTabs, setWorkspaceTabs] = useState(initialWorkspaceSelectionRef.current.tabs);
    const [selectedCustomerId, setSelectedCustomerId] = useState(initialWorkspaceSelectionRef.current.customerId);
    const [notificationNavigationContext, setNotificationNavigationContext] = useState(initialNotificationContextRef.current);
    const activeWorkspaceTab = normalizeWorkspaceTab(activeWorkspace, workspaceTabs[activeWorkspace]);
    const activeTab = WORKSPACE_TAB_TO_INTERNAL_TAB[activeWorkspace]?.[activeWorkspaceTab] || 'today';
    const [adminTabSearch, setAdminTabSearch] = useState('');
    const [adminSearchOpen, setAdminSearchOpen] = useState(false);
    const [adminSearchFilterOpen, setAdminSearchFilterOpen] = useState(false);
    const [adminSearchFilters, setAdminSearchFilters] = useState({ type: 'all', workspace: 'all', scope: 'all' });
    const [adminBookingSearchMatches, setAdminBookingSearchMatches] = useState([]);
    const [adminBookingSearchLoading, setAdminBookingSearchLoading] = useState(false);
    const [adminStaffSearchMatches, setAdminStaffSearchMatches] = useState([]);
    const [adminStaffSearchLoading, setAdminStaffSearchLoading] = useState(false);
    const adminSearchInputRef = useRef(null);
    const adminSearchContainerRef = useRef(null);
    const liveChannels = useMemo(() => operationalChannelsForUser(user), [user?.id, user?.role]);
    const [profileForm, setProfileForm] = useState({
        username: user?.username || '',
        email: user?.email || '',
        phone: user?.phone || '',
        current_password: '',
        new_password: '',
        new_password_confirmation: '',
    });
    const profilePasswordEvaluation = useMemo(
        () => evaluatePassword(profileForm.new_password, { username: profileForm.username, email: profileForm.email }),
        [profileForm.new_password, profileForm.username, profileForm.email],
    );
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
    const empPasswordEvaluation = useMemo(
        () => evaluatePassword(empForm.password, { username: empForm.username, email: empForm.email }),
        [empForm.password, empForm.username, empForm.email],
    );
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
    const [financePaymentSearch, setFinancePaymentSearch] = useState('');
    const [financePaymentFilter, setFinancePaymentFilter] = useState('all');
    const [financePaymentSort, setFinancePaymentSort] = useState('priority');
    const [financePaymentPage, setFinancePaymentPage] = useState(1);
    const [refundSearch, setRefundSearch] = useState('');
    const [refundStatusFilter, setRefundStatusFilter] = useState('all');
    const [refundSort, setRefundSort] = useState('newest');
    const [refundPage, setRefundPage] = useState(1);
    const [messageRefreshToken, setMessageRefreshToken] = useState(0);
    const [targetConversationId, setTargetConversationId] = useState(initialNotificationContextRef.current.conversation);
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
    const [bookingAnalysisOpen, setBookingAnalysisOpen] = useState(false);
    const [analyticsSlowLoading, setAnalyticsSlowLoading] = useState(false);
    const [analyticsChartsAnimated, setAnalyticsChartsAnimated] = useState(true);
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
    const [peakSeasonFilters, setPeakSeasonFilters] = useState({
        year: 'all',
        status: '',
        event_type: '',
    });
    const [peakSeasonHeatmap, setPeakSeasonHeatmap] = useState(null);
    const [peakSeasonLoading, setPeakSeasonLoading] = useState(false);
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
    const [expandedAuditId, setExpandedAuditId] = useState(null);
    const [availabilityMonth, setAvailabilityMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [availabilityOverrides, setAvailabilityOverrides] = useState([]);
    const [availabilityEvents, setAvailabilityEvents] = useState([]);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);
    const [availabilitySaving, setAvailabilitySaving] = useState(false);
    const [availabilityDate, setAvailabilityDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [availabilityEventSearch, setAvailabilityEventSearch] = useState('');
    const [availabilityEventVisibleLimit, setAvailabilityEventVisibleLimit] = useState(AVAILABILITY_EVENT_PAGE_SIZE);
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
    const operationalAlerts = analytics?.operationalAlerts || analytics?.alerts || [];
    const topSellerData = analytics?.topSellers || [];
    const peakSeasonData = Array.isArray(peakSeasonHeatmap) ? peakSeasonHeatmap : (analytics?.peakSeasons || []);
    const salesFrequencyDistribution = analytics?.salesFrequencyDistribution || {};
    const salesFrequencyData = salesFrequencyDistribution.rows || [];
    const topSalesFrequency = salesFrequencyData[0] || null;
    const revenueForecast = analytics?.revenueRegression || analytics?.revenueForecast || {};
    const revenueForecastData = revenueForecast.rows || [];
    const revenueForecastSummary = revenueForecast.summary || {};
    const revenueRegressionHistoryMonths = Math.max(Number(analyticsFilters.trend_months || 12), 6);
    const revenueRegressionHorizon = Number(revenueForecast.horizon || 3);
    const paxDemandProjection = analytics?.demandMovingAverage || analytics?.paxDemandProjection || {};
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
    const peakSeasonEventTypeOptions = useMemo(() => {
        const optionMap = new Map();

        eventTypes.forEach((type) => {
            const value = type.slug || type.name || type.title;
            if (value) optionMap.set(value, type.name || type.title || type.slug || value);
        });

        bookings.forEach((booking) => {
            const value = booking.event_type;
            if (value && !optionMap.has(value)) optionMap.set(value, booking.event_display_name || booking.event_name || value);
        });

        return Array.from(optionMap, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
    }, [bookings, eventTypes]);
    const peakSeasonTotalEvents = peakSeasonData.reduce((total, item) => total + Number(item.events || item.count || 0), 0);
    const peakSeasonBusiestMonth = peakSeasonData.reduce((best, item) => (
        Number(item.events || item.count || 0) > Number(best?.events || best?.count || 0) ? item : best
    ), null);
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
    const [customerLookupQuery, setCustomerLookupQuery] = useState(initialNotificationContextRef.current.customerQuery);
    const [customerLookupFilters, setCustomerLookupFilters] = useState({ status: 'all', bookingActivity: 'all' });
    const [confirmNotifyCustomer, setConfirmNotifyCustomer] = useState(true);
    const confirmNotifyCustomerRef = useRef(true);
    const [bookingPage, setBookingPage] = useState(1);
    const [auditPage, setAuditPage] = useState(1);
    const rowsPerPage = 8;
    const smartCacheKey = (resourceKey) => getUserScopedCacheKey(user, resourceKey);
    const navigateToWorkspaceTab = useCallback((workspace, tab, options = {}) => {
        const normalizedWorkspace = normalizeWorkspace(workspace);
        const normalizedTab = normalizeWorkspaceTab(normalizedWorkspace, tab);

        if (!options.preserveNotificationContext) {
            setNotificationNavigationContext(createAdminNotificationContext());
            setTargetConversationId('');
        }

        setActiveWorkspace(normalizedWorkspace);
        setWorkspaceTabs((previous) => ({
            ...previous,
            [normalizedWorkspace]: normalizedTab,
        }));

        if (Object.prototype.hasOwnProperty.call(options, 'customerId')) {
            setSelectedCustomerId(options.customerId ? String(options.customerId) : '');
        }

        if (normalizedWorkspace === 'accounting') {
            setActiveFinanceSegment(options.financeSegment || FINANCE_SEGMENT_BY_ACCOUNTING_TAB[normalizedTab] || 'payments');
        }

        if (normalizedWorkspace === 'admin' && normalizedTab === 'accounts' && options.accountSegment) {
            setAccountSegment(options.accountSegment);
        }

        if (normalizedWorkspace === 'marketing' && normalizedTab === 'public-content' && options.configTab) {
            setActiveConfigTab(options.configTab);
        }
    }, []);
    const setActiveTab = useCallback((nextTab) => {
        const rawTab = String(nextTab || 'today');
        const aliasedTab = ADMIN_TAB_ALIASES[rawTab] || rawTab;
        const destination = LEGACY_TAB_DESTINATIONS[rawTab] || LEGACY_TAB_DESTINATIONS[aliasedTab];

        if (destination) {
            navigateToWorkspaceTab(destination.workspace, destination.tab, destination);
            return;
        }

        navigateToWorkspaceTab('admin', normalizeWorkspaceTab('admin', aliasedTab));
    }, [navigateToWorkspaceTab]);

    const applyAdminNotificationContext = useCallback((params, workspace, tab) => {
        const context = createAdminNotificationContext(params);
        if (!hasAdminNotificationContext(context)) return;

        const normalizedWorkspace = normalizeWorkspace(workspace || params.workspace);
        const normalizedTab = normalizeWorkspaceTab(normalizedWorkspace, tab || params.tab);
        const searchText = getAdminNotificationSearchText(context);

        setNotificationNavigationContext(context);

        if (context.customerId) {
            setSelectedCustomerId(context.customerId);
        }

        if (context.conversation) {
            setTargetConversationId(context.conversation);
            setMessageRefreshToken((value) => value + 1);
        }

        if (normalizedWorkspace === 'customer') {
            if (!context.customerId && searchText) {
                setCustomerLookupQuery(searchText);
            }
            return;
        }

        if (!searchText) return;

        if (normalizedWorkspace === 'marketing') {
            if (['bookings', 'handoff'].includes(normalizedTab)) {
                setBookingSearch(searchText);
            } else if (normalizedTab === 'calendar') {
                setAdminCalendarSearch(searchText);
            }
            return;
        }

        if (normalizedWorkspace === 'accounting') {
            if (normalizedTab === 'refunds') {
                setRefundSearch(searchText);
            } else if (['payments', 'reconciliation', 'ledger'].includes(normalizedTab)) {
                setFinancePaymentSearch(searchText);
            }
        }
    }, []);

    const applyAdminNavigationQueryParams = useCallback((params) => {
        const rawTab = params.tab;
        const context = createAdminNotificationContext(params);
        const preserveNotificationContext = hasAdminNotificationContext(context);

        if (params.workspace) {
            const workspace = normalizeWorkspace(params.workspace);
            const tab = normalizeWorkspaceTab(workspace, rawTab);
            navigateToWorkspaceTab(workspace, tab, {
                customerId: params.customer || '',
                financeSegment: params.financeSegment,
                accountSegment: params.accountSegment,
                configTab: params.configTab,
                preserveNotificationContext,
            });
            applyAdminNotificationContext(params, workspace, tab);
            return;
        }

        if (rawTab) {
            setActiveTab(rawTab);
            applyAdminNotificationContext(params, null, rawTab);
        }
    }, [applyAdminNotificationContext, navigateToWorkspaceTab, setActiveTab]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const handleNavigationQueryChange = (event) => {
            if (event.detail?.path && event.detail.path !== window.location.pathname) return;

            const params = event.detail?.params || Object.fromEntries(new URLSearchParams(event.detail?.search || window.location.search).entries());
            applyAdminNavigationQueryParams(params);
        };

        applyAdminNavigationQueryParams(Object.fromEntries(new URLSearchParams(window.location.search).entries()));
        window.addEventListener('ecs:navigation-query-change', handleNavigationQueryChange);
        window.addEventListener('popstate', handleNavigationQueryChange);
        return () => {
            window.removeEventListener('ecs:navigation-query-change', handleNavigationQueryChange);
            window.removeEventListener('popstate', handleNavigationQueryChange);
        };
    }, [applyAdminNavigationQueryParams]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        window.localStorage.setItem(`${ADMIN_WORKSPACE_STORAGE_KEY}:workspace`, activeWorkspace);
        window.localStorage.setItem(`${ADMIN_WORKSPACE_STORAGE_KEY}:tabs`, JSON.stringify(workspaceTabs));

        const url = new URL(window.location.href);
        url.searchParams.set('workspace', activeWorkspace);
        url.searchParams.set('tab', activeWorkspaceTab);
        if (activeWorkspace === 'customer' && selectedCustomerId) {
            url.searchParams.set('customer', selectedCustomerId);
        } else if (notificationNavigationContext.customerId) {
            url.searchParams.set('customer', notificationNavigationContext.customerId);
        } else {
            url.searchParams.delete('customer');
        }
        if (notificationNavigationContext.customerQuery) {
            url.searchParams.set('customerQuery', notificationNavigationContext.customerQuery);
        } else {
            url.searchParams.delete('customerQuery');
        }
        if (notificationNavigationContext.booking) {
            url.searchParams.set('booking', notificationNavigationContext.booking);
        } else {
            url.searchParams.delete('booking');
        }
        if (notificationNavigationContext.conversation) {
            url.searchParams.set('conversation', notificationNavigationContext.conversation);
        } else {
            url.searchParams.delete('conversation');
        }
        window.history.replaceState(window.history.state, '', url.toString());
    }, [activeWorkspace, activeWorkspaceTab, notificationNavigationContext, selectedCustomerId, workspaceTabs]);

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
        if (!bookingAnalysisOpen) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setBookingAnalysisOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [bookingAnalysisOpen]);

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
        if (profileForm.new_password) {
            const nextErrors = {};
            if (!profilePasswordEvaluation.valid) {
                nextErrors.new_password = 'Complete the password requirements before saving.';
            }
            if (profileForm.new_password !== profileForm.new_password_confirmation) {
                nextErrors.new_password_confirmation = 'Passwords do not match.';
            }
            if (Object.keys(nextErrors).length > 0) {
                setProfileErrors(nextErrors);
                showToast('Please review the password fields.', 'error');
                return;
            }
        }

        setProfileProcessing(true);
        router.put('/profile', profileForm, {
            preserveScroll: true,
            onSuccess: () => {
                setProfileForm(prev => ({ ...prev, current_password: '', new_password: '', new_password_confirmation: '' }));
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
        if (activeWorkspace === 'customer') {
            bustAdminCache(ADMIN_CUSTOMERS_URL, adminCustomersUrl('active'), adminCustomersUrl('deactivated'), adminCustomersUrl('all'), ADMIN_BOOKINGS_URL);
            fetchCustomers({ silent });
            fetchBookings({ silent });
        } else if (activeTab === 'accounts') {
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
        } else if (activeTab === 'bookings-intake' || activeTab === 'marketing-today') {
            bustAdminCache(ADMIN_BOOKINGS_URL);
            fetchBookings({ silent });
            fetchAnalyticsSummary({ silent });
        } else if (activeTab === 'finance' || activeTab === 'accounting-today') {
            bustAdminCache('/api/admin/refunds/queue');
            fetchBookings({ silent });
            fetchRefundQueue({ silent });
        } else if (activeTab === 'availability') {
            fetchAvailabilityOverrides({ silent });
        } else if (activeTab === 'system-audit') {
            bustAdminCache('/api/admin/audits?per_page=25');
            fetchAudits({ silent });
        }
    };

    const bookingStatusMeta = {
        pending: { tone: 'attention', label: 'Pending' },
        confirmed: { tone: 'success', label: 'Active' },
        completed: { tone: 'success', label: 'Completed' },
        cancelled: { tone: 'danger', label: 'Cancelled' },
        canceled: { tone: 'danger', label: 'Cancelled' },
        rejected: { tone: 'danger', label: 'Rejected' },
    };
    const bookingStatusStyles = {
        pending: 'bg-amber-100 text-amber-800 border-amber-200',
        confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        cancelled: 'bg-rose-100 text-rose-800 border-rose-200',
        canceled: 'bg-rose-100 text-rose-800 border-rose-200',
        rejected: 'bg-rose-100 text-rose-800 border-rose-200',
    };
    const workspaceNavSource = {
        admin: ADMIN_WORKSPACE_NAV_GROUPS,
        customer: CUSTOMER_WORKSPACE_NAV_GROUPS,
        marketing: MARKETING_WORKSPACE_NAV_GROUPS,
        accounting: ACCOUNTING_WORKSPACE_NAV_GROUPS,
    };
    const workspaceNavCounts = useMemo(() => {
        const pendingBookings = bookings.filter((booking) => normalizeStatus(booking.status) === 'pending').length;
        const confirmedBookings = bookings.filter((booking) => normalizeStatus(booking.status) === 'confirmed').length;
        const customerBookingCount = selectedCustomerId
            ? bookings.filter((booking) => String(booking.user_id) === String(selectedCustomerId)).length
            : 0;

        return {
            admin: {
                accounts: employees.length + customers.length,
                reports: reportTemplates.length,
            },
            customer: {
                lookup: customers.length,
                dashboard: customerBookingCount,
                payments: customerBookingCount,
                history: customerBookingCount,
            },
            marketing: {
                today: pendingBookings,
                bookings: pendingBookings,
                tastings: 0,
                calendar: confirmedBookings,
                handoff: confirmedBookings,
            },
            accounting: {
                today: pendingBookings + refundQueue.length,
                payments: pendingBookings,
                reconciliation: pendingBookings,
                refunds: refundQueue.length,
            },
        };
    }, [bookings, customers.length, employees.length, refundQueue.length, reportTemplates.length, selectedCustomerId]);
    const adminNavGroups = useMemo(() => (
        withNavCounts(workspaceNavSource[activeWorkspace] || ADMIN_WORKSPACE_NAV_GROUPS, workspaceNavCounts[activeWorkspace] || {})
    ), [activeWorkspace, workspaceNavCounts]);
    const adminActiveNavId = activeWorkspaceTab;
    const handleAdminNavigate = (nextId) => {
        const rawId = String(nextId || '');
        const activeWorkspaceTabs = WORKSPACE_TAB_TO_INTERNAL_TAB[activeWorkspace] || {};
        if (activeWorkspaceTabs[rawId]) {
            navigateToWorkspaceTab(activeWorkspace, rawId);
            return;
        }

        const legacyDestination = LEGACY_TAB_DESTINATIONS[rawId] || LEGACY_TAB_DESTINATIONS[ADMIN_TAB_ALIASES[rawId]];
        if (legacyDestination) {
            navigateToWorkspaceTab(legacyDestination.workspace, legacyDestination.tab, legacyDestination);
            return;
        }

        navigateToWorkspaceTab(activeWorkspace, rawId);
    };

    useEffect(() => {
        const query = adminTabSearch.trim();
        if (query.length < 2) {
            setAdminBookingSearchMatches([]);
            setAdminBookingSearchLoading(false);
            return undefined;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setAdminBookingSearchLoading(true);
            try {
                const params = new URLSearchParams({
                    paginated: '1',
                    per_page: '8',
                    include_history: '1',
                    search: query,
                });
                const response = await fetch(`/api/admin/bookings?${params.toString()}`, {
                    headers: { Accept: 'application/json' },
                    signal: controller.signal,
                });

                if (!response.ok) throw new Error('Could not search bookings');

                const data = await response.json();
                setAdminBookingSearchMatches(getListData(data));
            } catch (error) {
                if (error.name !== 'AbortError') {
                    setAdminBookingSearchMatches([]);
                }
            } finally {
                if (!controller.signal.aborted) setAdminBookingSearchLoading(false);
            }
        }, 220);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [adminTabSearch]);

    useEffect(() => {
        const query = adminTabSearch.trim();
        if (query.length < 2) {
            setAdminStaffSearchMatches([]);
            setAdminStaffSearchLoading(false);
            return undefined;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setAdminStaffSearchLoading(true);
            try {
                const params = new URLSearchParams({
                    paginated: '1',
                    per_page: '8',
                    search: query,
                });
                const response = await fetch(`/api/admin/employees?${params.toString()}`, {
                    headers: { Accept: 'application/json' },
                    signal: controller.signal,
                });

                if (!response.ok) throw new Error('Could not search staff accounts');

                const data = await response.json();
                setAdminStaffSearchMatches(getListData(data));
            } catch (error) {
                if (error.name !== 'AbortError') {
                    setAdminStaffSearchMatches([]);
                }
            } finally {
                if (!controller.signal.aborted) setAdminStaffSearchLoading(false);
            }
        }, 220);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [adminTabSearch]);

    const adminSearchEntries = useMemo(() => {
        const entries = [];

        ADMIN_WORKSPACES.forEach((workspace) => {
            const groups = workspaceNavSource[workspace.id] || [];
            groups.forEach((group) => {
                group.items.forEach((item) => {
                    const internalTab = WORKSPACE_TAB_TO_INTERNAL_TAB[workspace.id]?.[item.id] || item.id;
                    const parentPath = `${workspace.label} / ${group.label}`;
                    const aliases = [...(item.aliases || []), ...(ADMIN_SEARCH_ALIASES[internalTab] || [])];
                    entries.push({
                        id: `${workspace.id}:${item.id}`,
                        kind: 'page',
                        workspace: workspace.id,
                        tab: item.id,
                        label: item.label,
                        description: item.description || '',
                        path: parentPath,
                        nameText: [workspace.label, group.label, item.label, item.description, parentPath, ...aliases].filter(Boolean).join(' ').toLowerCase(),
                        contactText: '',
                        refText: '',
                        searchText: [workspace.label, group.label, item.label, item.description, parentPath, ...aliases].filter(Boolean).join(' ').toLowerCase(),
                    });
                });
            });
        });

        customers.slice(0, 60).forEach((customer) => {
            const label = customer.full_name || customer.username || `Customer #${customer.id}`;
            const contact = [displayEmail(customer.email, ''), customer.phone].filter(Boolean).join(' / ');
            entries.push({
                id: `customer:${customer.id}`,
                kind: 'customer',
                workspace: 'customer',
                tab: 'dashboard',
                customerId: customer.id,
                label,
                description: contact || 'Customer account',
                path: 'Customer / Customer Lookup',
                nameText: [label, customer.username, 'customer account dashboard'].filter(Boolean).join(' ').toLowerCase(),
                contactText: [customer.email, customer.phone, contact].filter(Boolean).join(' ').toLowerCase(),
                refText: '',
                searchText: [label, customer.username, customer.email, customer.phone, contact, 'customer client account dashboard'].filter(Boolean).join(' ').toLowerCase(),
            });
        });

        const indexedStaffIds = new Set();
        [...employees, ...adminStaffSearchMatches].forEach((employee) => {
            if (!employee?.id || indexedStaffIds.has(String(employee.id))) return;
            indexedStaffIds.add(String(employee.id));

            const label = employee.full_name || employee.username || `Staff #${employee.id}`;
            const email = displayEmail(employee.email, '');
            const contact = [email, employee.phone].filter(Boolean).join(' / ');
            const roleLabel = employee.role || 'Staff';
            const statusLabel = employee.account_status === 'deactivated'
                ? 'Deactivated'
                : employee.must_change_password
                    ? 'Password change needed'
                    : 'Active';

            entries.push({
                id: `staff:${employee.id}`,
                kind: 'staff',
                workspace: 'admin',
                tab: 'accounts',
                staffId: employee.id,
                staffQuery: label || employee.username || employee.email || employee.phone || '',
                label,
                description: [roleLabel, contact, statusLabel].filter(Boolean).join(' / '),
                path: 'Admin / Accounts',
                nameText: [label, employee.username, roleLabel, statusLabel, 'staff employee account admin accounts'].filter(Boolean).join(' ').toLowerCase(),
                contactText: [employee.email, employee.phone, contact].filter(Boolean).join(' ').toLowerCase(),
                refText: '',
                searchText: [
                    label,
                    employee.username,
                    employee.email,
                    employee.phone,
                    roleLabel,
                    statusLabel,
                    employee.account_status,
                    'staff employee account admin accounts users roles',
                ].filter(Boolean).join(' ').toLowerCase(),
            });
        });

        const indexedBookingIds = new Set();
        [...bookings, ...adminBookingSearchMatches].forEach((booking) => {
            if (!booking?.id || indexedBookingIds.has(String(booking.id))) return;
            indexedBookingIds.add(String(booking.id));

            const ref = formatBookingRef(booking.id);
            const contactName = bookingContactName(booking);
            const contactEmail = bookingContactEmail(booking);
            const contactPhone = bookingContactPhone(booking);
            const accountName = customerAccountName(booking);
            const accountEmail = customerAccountEmail(booking);
            const accountPhone = customerAccountPhone(booking);
            const contactLine = [ref, contactEmail || contactPhone].filter(Boolean).join(' / ');
            const description = hasDifferentBookingContact(booking) && accountName
                ? `${contactLine} / Account: ${accountName}`
                : contactLine;

            entries.push({
                id: `booking-contact:${booking.id}`,
                kind: 'booking',
                workspace: 'marketing',
                tab: 'bookings',
                bookingId: booking.id,
                customerId: booking.user_id,
                customerQuery: contactName || contactEmail || contactPhone || ref,
                label: contactName || ref,
                description: description || 'Booking contact',
                path: 'Marketing / Bookings',
                nameText: [contactName, accountName, booking.username, booking.event_name, booking.event_display_name, booking.event_type, 'booking contact'].filter(Boolean).join(' ').toLowerCase(),
                contactText: [contactEmail, contactPhone, accountEmail, accountPhone].filter(Boolean).join(' ').toLowerCase(),
                refText: [ref, booking.id ? `BK-${booking.id}` : '', booking.id ? `#BK-${booking.id}` : ''].filter(Boolean).join(' ').toLowerCase(),
                searchText: [
                    ref,
                    contactName,
                    contactEmail,
                    contactPhone,
                    accountName,
                    accountEmail,
                    accountPhone,
                    booking.username,
                    booking.event_name,
                    booking.event_display_name,
                    booking.event_type,
                    booking.venue_city,
                    'booking contact client customer booking reservations',
                ].filter(Boolean).join(' ').toLowerCase(),
            });
        });

        return entries;
    }, [adminBookingSearchMatches, adminStaffSearchMatches, bookings, customers, employees]);
    const adminSearchResults = useMemo(() => {
        const query = adminTabSearch.trim().toLowerCase();
        const filteredEntries = adminSearchEntries.filter((entry) => {
            if (adminSearchFilters.type !== 'all' && entry.kind !== adminSearchFilters.type) return false;
            if (adminSearchFilters.workspace !== 'all' && entry.workspace !== adminSearchFilters.workspace) return false;
            return true;
        });
        const getScopedSearchText = (entry) => {
            if (adminSearchFilters.scope === 'name') return entry.nameText || entry.searchText;
            if (adminSearchFilters.scope === 'contact') return entry.contactText || '';
            if (adminSearchFilters.scope === 'booking') return entry.refText || '';
            return entry.searchText;
        };

        if (!query) return filteredEntries.slice(0, 8);

        const terms = query.split(/\s+/).filter(Boolean);
        return filteredEntries
            .filter((entry) => terms.every((term) => getScopedSearchText(entry).includes(term)))
            .sort((a, b) => {
                const score = (entry) => {
                    const label = entry.label.toLowerCase();
                    const path = entry.path.toLowerCase();
                    const description = entry.description.toLowerCase();
                    const scopedText = getScopedSearchText(entry);
                    if (label === query) return 0;
                    if (label.includes(query)) return 1;
                    if (path.includes(query)) return 2;
                    if (description.includes(query)) return 3;
                    if (scopedText.includes(query)) return 4;
                    return 5;
                };

                return score(a) - score(b) || a.label.localeCompare(b.label);
            })
            .slice(0, 8);
    }, [adminSearchEntries, adminSearchFilters, adminTabSearch]);
    const showAdminSearchResults = adminSearchOpen || adminSearchFilterOpen || adminTabSearch.trim().length > 0;
    const adminSearchFilterCount = Object.values(adminSearchFilters).filter((value) => value !== 'all').length;
    const navigateToAdminSearchResult = (result) => {
        if (result.bookingId) {
            navigateToWorkspaceTab(result.workspace, result.tab, { preserveNotificationContext: true });
            applyAdminNotificationContext({
                workspace: result.workspace,
                tab: result.tab,
                booking: result.bookingId,
                customer: result.customerId || '',
                customerQuery: result.customerQuery || result.label,
            }, result.workspace, result.tab);
        } else if (result.customerId) {
            navigateToWorkspaceTab('customer', 'dashboard', { customerId: result.customerId });
        } else if (result.staffId) {
            navigateToWorkspaceTab('admin', 'accounts', { accountSegment: 'staff' });
            setEmployeeFilters({
                search: result.staffQuery || result.label || '',
                role: 'all',
                account_status: 'all',
                must_change_password: 'all',
            });
            setEmployeePage(1);
        } else {
            navigateToWorkspaceTab(result.workspace, result.tab);
        }
        setAdminTabSearch('');
        setAdminSearchOpen(false);
        setAdminSearchFilterOpen(false);
        adminSearchInputRef.current?.blur();
    };
    const handleAdminSearchKeyDown = (event) => {
        if (event.key === 'Escape') {
            setAdminSearchOpen(false);
            if (adminTabSearch) setAdminTabSearch('');
            return;
        }

        if (event.key === 'Enter' && adminSearchResults[0]) {
            event.preventDefault();
            navigateToAdminSearchResult(adminSearchResults[0]);
        }
    };
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

    const visibleFinancePaymentRows = useMemo(() => {
        const query = financePaymentSearch.trim().toLowerCase();
        const filteredRows = financePaymentRows.filter(({ booking, payment, statusLabel, queueLabel }) => {
            const matchesSearch = !query || [
                formatBookingRef(booking.id),
                bookingContactName(booking),
                bookingContactEmail(booking),
                bookingContactPhone(booking),
                customerAccountName(booking),
                customerAccountEmail(booking),
                customerAccountPhone(booking),
                eventDisplayName(booking),
                paymentLabel(payment.payment_type),
                statusLabel,
                queueLabel,
            ].some((value) => String(value || '').toLowerCase().includes(query));
            const matchesFilter = financePaymentFilter === 'all'
                || String(queueLabel || '').toLowerCase().replace(/\s+/g, '-') === financePaymentFilter;

            return matchesSearch && matchesFilter;
        });

        return [...filteredRows].sort((a, b) => {
            if (financePaymentSort === 'due') return a.dueTime - b.dueTime || a.priority - b.priority;
            if (financePaymentSort === 'amount') return Number(b.payment?.amount || 0) - Number(a.payment?.amount || 0);
            if (financePaymentSort === 'newest') return Number(b.booking?.id || 0) - Number(a.booking?.id || 0);
            return a.priority - b.priority || a.dueTime - b.dueTime || Number(b.booking?.id || 0) - Number(a.booking?.id || 0);
        });
    }, [financePaymentFilter, financePaymentRows, financePaymentSearch, financePaymentSort]);

    const financePaymentQueueStats = useMemo(() => (
        visibleFinancePaymentRows.reduce((stats, item) => {
            const queueLabel = String(item.queueLabel || '').toLowerCase();
            stats.amount += Number(item.payment?.amount || 0);
            stats.review += queueLabel === 'needs review' ? 1 : 0;
            stats.overdue += queueLabel === 'overdue' ? 1 : 0;
            stats.exceptions += queueLabel === 'exception' ? 1 : 0;
            return stats;
        }, { amount: 0, review: 0, overdue: 0, exceptions: 0 })
    ), [visibleFinancePaymentRows]);

    const visibleRefundRows = useMemo(() => {
        const query = refundSearch.trim().toLowerCase();
        const filteredRows = refundQueue.filter((item) => {
            const refundCase = item.refund_cases?.[0] || null;
            const status = String(item.refund_status || refundCase?.status || 'needs_review').toLowerCase();
            const needsRetry = refundCase?.next_actions?.includes('retry_provider_refund');
            const matchesSearch = !query || [
                formatBookingRef(item.booking_id),
                bookingContactName(item),
                bookingContactEmail(item),
                customerAccountName(item),
                customerAccountEmail(item),
                item.event_date,
                item.refund_status,
                refundCase?.provider_reference,
                refundCase?.status,
            ].some((value) => String(value || '').toLowerCase().includes(query));
            const matchesFilter = refundStatusFilter === 'all'
                || (refundStatusFilter === 'retry' && needsRetry)
                || (refundStatusFilter === 'needs_review' && !needsRetry && !['processed', 'refunded', 'completed'].includes(status))
                || status === refundStatusFilter;

            return matchesSearch && matchesFilter;
        });

        return [...filteredRows].sort((a, b) => {
            if (refundSort === 'event_date') return new Date(a.event_date || 0).getTime() - new Date(b.event_date || 0).getTime();
            if (refundSort === 'amount') return Number(b.total_paid || 0) - Number(a.total_paid || 0);
            return Number(b.booking_id || 0) - Number(a.booking_id || 0);
        });
    }, [refundQueue, refundSearch, refundSort, refundStatusFilter]);

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
                    bookingContactName(booking),
                    bookingContactEmail(booking),
                    bookingContactPhone(booking),
                    customerAccountName(booking),
                    customerAccountEmail(booking),
                    customerAccountPhone(booking),
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
    const openOperationalAlertQueue = useCallback((alert) => {
        switch (alert?.label) {
            case 'Pending bookings older than 48 hours':
            case 'Events within 7 days missing logistics':
                setActiveTab('bookings-intake');
                break;
            case 'Overdue unpaid payment milestones':
                setActiveFinanceSegment('payments');
                setActiveTab('finance');
                break;
            default:
                setActiveTab('analytics');
                break;
        }
    }, []);

    const adminNextActions = useMemo(() => {
        const failedAudits = audits.filter((audit) => Number(audit.status_code || 0) >= 400).length;
        const blockedStaff = employees.filter((employee) => employee.account_status === 'deactivated' || employee.must_change_password).length;
        const topAlertCount = visibleOperationalAlerts.reduce((sum, alert) => sum + Number(alert.count || 0), 0);
        const topOperationalAlert = [...visibleOperationalAlerts].sort((a, b) => Number(b.count || 0) - Number(a.count || 0))[0];

        return [
            bookingStats.pending > 0 && {
                id: 'booking-oversight',
                priority: 'action',
                title: 'Review booking oversight',
                description: `${bookingStats.pending} bookings are still awaiting review.`,
                badge: bookingStats.pending,
                primaryLabel: 'Open',
                tone: 'warn',
                onOpen: () => setActiveTab('bookings-intake'),
            },
            refundQueue.length > 0 && {
                id: 'refund-oversight',
                priority: 'urgent',
                title: 'Review refund cases',
                description: `${refundQueue.length} refund cases may need approval or processing.`,
                badge: refundQueue.length,
                primaryLabel: 'Open',
                tone: 'danger',
                onOpen: () => {
                    setActiveFinanceSegment('refunds');
                    setActiveTab('finance');
                },
            },
            blockedStaff > 0 && {
                id: 'people-accounts',
                priority: 'action',
                title: 'Check staff account access',
                description: `${blockedStaff} staff accounts need account-status or password attention.`,
                badge: blockedStaff,
                primaryLabel: 'Open',
                tone: 'warn',
                onOpen: () => {
                    setAccountSegment('staff');
                    setActiveTab('accounts');
                },
            },
            failedAudits > 0 && {
                id: 'system-activity',
                priority: 'urgent',
                title: 'Inspect activity exceptions',
                description: `${failedAudits} recent activity records ended with blocked or failed results.`,
                badge: failedAudits,
                primaryLabel: 'Open',
                tone: 'danger',
                onOpen: () => setActiveTab('system-audit'),
            },
            topAlertCount > 0 && {
                id: 'operational-alerts',
                priority: 'followup',
                title: topOperationalAlert?.label || 'Review operational alerts',
                description: `${topAlertCount} alert items are showing in operational queues.`,
                badge: topAlertCount,
                primaryLabel: 'Review',
                tone: 'warn',
                onOpen: () => openOperationalAlertQueue(topOperationalAlert),
            },
        ].filter(Boolean);
    }, [audits, bookingStats.pending, employees, openOperationalAlertQueue, refundQueue.length, visibleOperationalAlerts]);

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
                    bookingContactName(booking),
                    bookingContactEmail(booking),
                    bookingContactPhone(booking),
                    customerAccountName(booking),
                    customerAccountEmail(booking),
                    customerAccountPhone(booking),
                    booking.event_type,
                ].filter(Boolean).join(' ').toLowerCase();

                return searchable.includes(query);
            })
            .sort((a, b) => {
                if (bookingSort === 'az' || bookingSort === 'za') {
                    const left = String(bookingContactName(a)).toLowerCase();
                    const right = String(bookingContactName(b)).toLowerCase();
                    return bookingSort === 'az' ? left.localeCompare(right) : right.localeCompare(left);
                }

                const leftDate = new Date(a.created_at || a.event_date || 0).getTime();
                const rightDate = new Date(b.created_at || b.event_date || 0).getTime();
                return bookingSort === 'oldest' ? leftDate - rightDate : rightDate - leftDate;
            });
    }, [bookings, bookingSearch, bookingStatusFilter, bookingSourceFilter, bookingSort]);

    const getAuditMetadata = (audit) => (audit?.metadata && typeof audit.metadata === 'object' ? audit.metadata : {});
    const getAuditWorkspace = (audit) => {
        const metadata = getAuditMetadata(audit);
        if (audit.workspace || metadata.workspace) return audit.workspace || metadata.workspace;

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
        const metadata = getAuditMetadata(audit);
        if (audit.result_label || metadata.result) {
            const label = audit.result_label || metadata.result;
            if (label === 'Completed') return { label, className: 'bg-emerald-50 text-emerald-700' };
            if (label === 'Access blocked' || label === 'Not found') return { label, className: 'bg-amber-50 text-amber-700' };
            return { label, className: 'bg-red-50 text-red-700' };
        }

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
    const getAuditTargetLabel = (audit) => {
        const metadata = getAuditMetadata(audit);
        return audit.target_label || metadata.target_label || metadata.booking_ref || metadata.affected_user_label || null;
    };
    const getAuditTargetType = (audit) => {
        const metadata = getAuditMetadata(audit);
        return audit.target_type || metadata.target_type || null;
    };
    const formatAuditField = (field) => String(field || '')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
    const getAuditChangedFields = (audit) => {
        const metadata = getAuditMetadata(audit);
        const fields = audit.changed_fields || metadata.changed_fields || [];
        return Array.isArray(fields) ? fields.filter(Boolean) : [];
    };
    const getAuditSourceLabel = (audit) => {
        const metadata = getAuditMetadata(audit);
        const sourceText = `${metadata.route || ''} ${metadata.path || audit.path || ''}`.toLowerCase();

        if (sourceText.includes('profile')) return 'Profile settings';
        if (sourceText.includes('chat') || sourceText.includes('conversation') || sourceText.includes('message')) return 'Messages';
        if (sourceText.includes('payment')) return 'Payments';
        if (sourceText.includes('refund')) return 'Refunds';
        if (sourceText.includes('preparation') || sourceText.includes('handoff')) return 'Event handoff';
        if (sourceText.includes('calendar-availability') || sourceText.includes('availability')) return 'Availability calendar';
        if (sourceText.includes('booking')) return 'Bookings';
        if (sourceText.includes('menu')) return 'Menu';
        if (sourceText.includes('package')) return 'Packages';
        if (sourceText.includes('event-type')) return 'Event types';
        if (sourceText.includes('announcement')) return 'Announcements';
        if (sourceText.includes('audit')) return 'Audit trail';
        if (sourceText.includes('settings')) return 'Settings';
        if (sourceText.includes('login')) return 'Sign in';
        if (sourceText.includes('logout')) return 'Sign out';

        return getAuditWorkspace(audit);
    };
    const getAuditTargetDisplay = (audit) => {
        const label = getAuditTargetLabel(audit);
        const type = getAuditTargetType(audit);

        if (label) {
            return {
                primary: label,
                secondary: type ? formatAuditField(type) : 'Record',
            };
        }

        const source = getAuditSourceLabel(audit);

        return {
            primary: source || 'Activity record',
            secondary: type ? formatAuditField(type) : 'No specific record',
        };
    };
    const getAuditChangeSummary = (audit) => {
        const fields = getAuditChangedFields(audit);

        if (fields.length === 0) return 'No field changes';
        if (fields.length === 1) return formatAuditField(fields[0]);
        return `${fields.length} fields changed`;
    };
    const getAuditBrowserLabel = (audit) => {
        const agent = String(audit.user_agent || '').trim();

        if (!agent) return 'Not recorded';

        const browser = agent.includes('Edg/')
            ? 'Microsoft Edge'
            : agent.includes('Chrome/')
                ? 'Chrome'
                : agent.includes('Firefox/')
                    ? 'Firefox'
                    : agent.includes('Safari/')
                        ? 'Safari'
                        : 'Browser';
        const os = agent.includes('Windows')
            ? 'Windows'
            : agent.includes('Mac OS')
                ? 'macOS'
                : agent.includes('Android')
                    ? 'Android'
                    : agent.includes('iPhone') || agent.includes('iPad')
                        ? 'iOS'
                        : '';

        return os ? `${browser} on ${os}` : browser;
    };
    const getAuditSearchText = (audit) => {
        const metadata = getAuditMetadata(audit);
        return [
            audit.username,
            audit.role,
            audit.action,
            getAuditWorkspace(audit),
            getAuditResult(audit).label,
            getAuditTargetLabel(audit),
            getAuditTargetType(audit),
            metadata.booking_ref,
            metadata.booking_contact_name,
            metadata.customer_account_name,
            metadata.affected_user_label,
            metadata.route,
            metadata.path,
            ...getAuditChangedFields(audit),
            JSON.stringify(metadata),
        ].filter(Boolean).join(' ').toLowerCase();
    };
    const getAuditExtraDetailRows = (audit) => {
        const changedFields = getAuditChangedFields(audit);
        return [
            ['Information changed', changedFields.length > 0 ? changedFields.map(formatAuditField).join(', ') : 'No field changes recorded.'],
            ['Device', getAuditBrowserLabel(audit)],
            ['Network address', audit.ip_address || 'Not recorded'],
        ];
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

            return getAuditSearchText(audit).includes(query);
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
    const availabilityEventSearchTerm = availabilityEventSearch.trim().toLowerCase();
    const filteredAvailabilityEvents = useMemo(() => {
        if (!availabilityEventSearchTerm) return availabilityEvents;

        return availabilityEvents.filter((event) => [
            event.name,
            event.event_display_name,
            event.type,
            event.client,
            event.city,
            event.status,
            event.date,
            formatDate(event.date),
            formatTime(event.time),
            event.time,
            event.pax,
            event.id ? `BK-${event.id}` : '',
        ].some((value) => String(value || '').toLowerCase().includes(availabilityEventSearchTerm)));
    }, [availabilityEventSearchTerm, availabilityEvents]);
    const visibleAvailabilityEvents = filteredAvailabilityEvents.slice(0, availabilityEventVisibleLimit);
    const hasMoreAvailabilityEvents = filteredAvailabilityEvents.length > availabilityEventVisibleLimit;
    const availabilityEventCountLabel = availabilityEventSearchTerm
        ? `${filteredAvailabilityEvents.length} of ${monthlyAvailabilityEventCount}`
        : hasMoreAvailabilityEvents
            ? `${visibleAvailabilityEvents.length} of ${filteredAvailabilityEvents.length}`
            : `${filteredAvailabilityEvents.length} shown`;

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
    const selectedCustomer = useMemo(() => {
        if (!selectedCustomerId) return null;
        const directMatch = customers.find((customer) => String(customer.id) === String(selectedCustomerId));
        if (directMatch) return directMatch;

        const bookingMatch = bookings.find((booking) => String(booking.user_id) === String(selectedCustomerId));
        if (!bookingMatch) return null;

        return {
            id: selectedCustomerId,
            full_name: customerAccountName(bookingMatch),
            username: bookingMatch.username,
            email: customerAccountEmail(bookingMatch) || bookingContactEmail(bookingMatch),
            phone: customerAccountPhone(bookingMatch) || bookingContactPhone(bookingMatch),
            account_status: 'active',
        };
    }, [bookings, customers, selectedCustomerId]);
    const customerScopedBookings = useMemo(() => (
        selectedCustomerId
            ? bookings.filter((booking) => String(booking.user_id) === String(selectedCustomerId))
            : []
    ), [bookings, selectedCustomerId]);
    const customerActiveBookings = useMemo(() => (
        customerScopedBookings.filter((booking) => !['cancelled', 'completed'].includes(normalizeStatus(booking.status)))
    ), [customerScopedBookings]);
    const customerHistoryBookings = useMemo(() => (
        customerScopedBookings.filter((booking) => ['cancelled', 'completed'].includes(normalizeStatus(booking.status)))
    ), [customerScopedBookings]);
    const customerPayments = useMemo(() => (
        customerScopedBookings.flatMap((booking) => (
            (Array.isArray(booking.payments) ? booking.payments : []).map((payment) => ({ booking, payment }))
        ))
    ), [customerScopedBookings]);
    const customerLookupResults = useMemo(() => {
        const query = customerLookupQuery.trim().toLowerCase();

        return customers
            .filter((customer) => {
                if (customerLookupFilters.status === 'active') return customer.account_status !== 'deactivated';
                if (customerLookupFilters.status === 'deactivated') return customer.account_status === 'deactivated';
                return true;
            })
            .filter((customer) => {
                const bookingCount = Number(customer.bookings_count || 0);
                if (customerLookupFilters.bookingActivity === 'with_bookings') return bookingCount > 0;
                if (customerLookupFilters.bookingActivity === 'no_bookings') return bookingCount === 0;
                return true;
            })
            .filter((customer) => {
                if (!query) return true;

                return [
                    customer.full_name,
                    customer.username,
                    customer.email,
                    customer.phone,
                ].some((value) => String(value || '').toLowerCase().includes(query));
            })
            .slice(0, 12);
    }, [customerLookupFilters, customerLookupQuery, customers]);
    const selectCustomerForSupport = (customer, tab = 'dashboard') => {
        navigateToWorkspaceTab('customer', tab, { customerId: customer?.id || '' });
    };
    const handleAdminContextNavigate = useCallback((target = {}) => {
        const workspace = normalizeWorkspace(target.workspace);
        const tab = normalizeWorkspaceTab(workspace, target.tab);
        const customerId = target.customerId ? String(target.customerId) : '';
        const searchText = String(target.searchText || target.bookingRef || target.customerName || target.customerEmail || '').trim();

        if (workspace === 'marketing' && tab === 'bookings' && searchText) {
            setBookingSearch(searchText);
        }

        if (workspace === 'accounting' && searchText) {
            if (tab === 'refunds') {
                setRefundSearch(searchText);
            } else {
                setFinancePaymentSearch(searchText);
            }
        }

        navigateToWorkspaceTab(workspace, tab, {
            customerId,
            financeSegment: target.financeSegment || FINANCE_SEGMENT_BY_ACCOUNTING_TAB[tab],
        });
    }, [navigateToWorkspaceTab]);
    const roleBadgeClass = (role) => {
        if (role === 'Admin') return 'border-[#720101]/15 bg-[#720101]/5 text-[#720101]';
        if (role === 'Marketing') return 'border-purple-200 bg-purple-50 text-purple-800';
        return 'border-green-200 bg-green-50 text-green-800';
    };
    const paginatedBookings = paginate(visibleBookings, bookingPage, rowsPerPage);
    const paginatedFinancePaymentRows = paginate(visibleFinancePaymentRows, financePaymentPage, rowsPerPage);
    const paginatedRefundRows = paginate(visibleRefundRows, refundPage, rowsPerPage);
    const paginatedAudits = paginate(visibleAudits, auditPage, 12);

    const PaginationControls = ({ pageInfo, onPageChange, perPage = rowsPerPage }) => (
        <StaffPagination
            page={pageInfo.page}
            perPage={perPage}
            total={pageInfo.total}
            onPageChange={onPageChange}
        />
    );

    useEffect(() => {
        if (activeWorkspace === 'customer') {
            fetchCustomers();
            fetchBookings();
            if (activeWorkspaceTab === 'book' && (!packages.length || !eventTypes.length)) fetchPackages();
        } else if (activeTab === 'accounts') {
            fetchEmployees();
            fetchCustomers();
        } else if (activeTab === 'public-content') {
            fetchPricingOverrides();
            fetchCustomMenuItems();
            fetchPackages();
        } else if (activeTab === 'today') {
            if (!eventTypes.length) fetchPackages();
            fetchAnalyticsSummary();
        } else if (activeTab === 'analytics' || activeTab === 'reports') {
            if (!packages.length || !eventTypes.length) fetchPackages();
            fetchAnalytics();
            fetchReportBuilder();
            fetchReportPreview();
        } else if (activeTab === 'bookings-intake' || activeTab === 'marketing-today') {
            fetchBookings();
            fetchAnalyticsSummary();
        } else if (activeTab === 'finance' || activeTab === 'accounting-today') {
            fetchBookings();
            fetchRefundQueue();
        } else if (activeTab === 'calendar' || activeTab === 'handoff') {
            fetchBookings();
        } else if (activeTab === 'availability') {
            fetchAvailabilityOverrides();
        } else if (activeTab === 'system-audit') {
            fetchAudits();
        }
    }, [activeWorkspace, activeWorkspaceTab, activeTab, availabilityMonth, customerStatusFilter, employeeFilters, customerFilters]);

    useEffect(() => {
        if (activeTab === 'today') {
            fetchPeakSeasonHeatmap();
        }
    }, [activeTab, peakSeasonFilters]);

    useSmartRefresh({
        enabled: activeWorkspace === 'customer' || ['today', 'analytics', 'reports', 'bookings-intake', 'marketing-today', 'calendar', 'handoff', 'finance', 'accounting-today', 'accounts', 'public-content', 'availability', 'system-audit'].includes(activeTab),
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
        setFinancePaymentPage(1);
    }, [financePaymentSearch, financePaymentFilter, financePaymentSort]);

    useEffect(() => {
        setRefundPage(1);
    }, [refundSearch, refundStatusFilter, refundSort]);

    useEffect(() => {
        setAuditPage(1);
        setExpandedAuditId(null);
    }, [auditSearch, auditRoleFilter, auditActivityFilter, auditWorkspaceFilter, auditResultFilter]);

    useEffect(() => {
        setAvailabilityEventVisibleLimit(AVAILABILITY_EVENT_PAGE_SIZE);
    }, [availabilityEventSearch, availabilityMonth]);

    const fetchAvailabilityOverrides = async ({ silent = false } = {}) => {
        if (!silent) setAvailabilityLoading(true);
        try {
            const url = `/api/calendar-availability?month=${availabilityMonth}`;
            const result = await fetchSmartResource(url, {
                cacheKey: smartCacheKey(url),
                ttl: 30000,
            });
            const data = result.raw || result.data;
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
            bustAdminCache(`/api/calendar-availability?month=${availabilityMonth}`);
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
            bustAdminCache(`/api/calendar-availability?month=${availabilityMonth}`);
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
            const status = activeWorkspace === 'customer' ? 'all' : customerStatusFilter;
            const data = await fetchCachedJson(adminCustomersUrl(status, customerFilters), 60000);
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

    const restoreAnalyticsScroll = (scrollY) => {
        if (typeof window === 'undefined' || scrollY === null || scrollY === undefined) return;

        const restore = () => {
            if (window.scrollY < scrollY - 120) {
                window.scrollTo({ top: scrollY, left: window.scrollX, behavior: 'auto' });
            }
        };

        window.requestAnimationFrame(() => window.requestAnimationFrame(restore));
        window.setTimeout(restore, 120);
        window.setTimeout(restore, 420);
    };

    const currentScrollY = () => (typeof window === 'undefined' ? null : window.scrollY);

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
                    salesFrequencyDistribution: cached.data.salesFrequencyDistribution || current?.salesFrequencyDistribution || {},
                    revenueRegression: cached.data.revenueRegression || current?.revenueRegression || {},
                    demandMovingAverage: cached.data.demandMovingAverage || current?.demandMovingAverage || {},
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
                salesFrequencyDistribution: summary.salesFrequencyDistribution || current?.salesFrequencyDistribution || {},
                revenueRegression: summary.revenueRegression || current?.revenueRegression || {},
                demandMovingAverage: summary.demandMovingAverage || current?.demandMovingAverage || {},
                insights: summary.insights || current?.insights || {},
            }));
        } catch (error) {
            console.error(error);
            if (!silent) showToast('We could not load the latest data. Showing saved data if available.', 'error');
        } finally {
            if (!silent) setAnalyticsLoading(false);
        }
    };

    const fetchPeakSeasonHeatmap = async ({ silent = false, filters = peakSeasonFilters } = {}) => {
        if (!silent) setPeakSeasonLoading(true);
        try {
            const params = new URLSearchParams();

            if (filters.year && filters.year !== 'all') {
                params.set('date_from', `${filters.year}-01-01`);
                params.set('date_to', `${filters.year}-12-31`);
            }

            if (filters.status) params.set('booking_status', filters.status);
            if (filters.event_type) params.set('event_type', filters.event_type);

            const query = params.toString() ? `?${params.toString()}` : '';
            const result = await fetchSmartResource(`/api/admin/analytics/operations${query}`, {
                cacheKey: smartCacheKey(`/api/admin/analytics/operations${query}`),
                ttl: 60000,
            });
            const data = result.raw || result.data;
            setPeakSeasonHeatmap(data.operationsLoad || []);
        } catch (error) {
            console.error(error);
            if (!silent) showToast('Could not load the peak season heatmap filter.', 'error');
        } finally {
            if (!silent) setPeakSeasonLoading(false);
        }
    };

    const fetchAnalytics = async ({ silent = false, filters = analyticsFilters, preserveScrollY = null } = {}) => {
        if (!silent) setAnalyticsLoading(true);
        try {
            const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== ''));
            const query = params.toString() ? `?${params.toString()}` : '';
            const result = await fetchSmartResource(`/api/admin/analytics${query}`, {
                cacheKey: smartCacheKey(`/api/admin/analytics${query}`),
                ttl: 60000,
            });
            const data = result.raw || result.data;

            setAnalytics(data?.data || data || {});
        } catch (error) {
            console.error(error);
            if (!silent) showToast('We could not load the latest analytics. Showing saved data if available.', 'error');
        } finally {
            if (!silent) setAnalyticsLoading(false);
            restoreAnalyticsScroll(preserveScrollY);
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
        const scrollY = currentScrollY();
        setAnalyticsChartsAnimated(false);
        setActiveAnalyticsFilterPanel(current => current === panel ? null : panel);
        restoreAnalyticsScroll(scrollY);
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

    const analyticsFilterInputClass = 'mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none';
    const analyticsFilterLabelClass = 'text-[11px] font-black uppercase tracking-widest text-gray-400';

    const updateAnalyticsFilters = (patch) => {
        const scrollY = currentScrollY();
        const nextFilters = { ...analyticsFilters, ...patch };
        setAnalyticsChartsAnimated(true);
        setAnalyticsFilters(nextFilters);
        fetchAnalytics({ filters: nextFilters, silent: true, preserveScrollY: scrollY });
    };

    const updatePaymentRiskFilters = (patch) => {
        setAnalyticsChartsAnimated(true);
        setPaymentRiskFilters(current => ({ ...current, ...patch }));
    };

    const updatePackageViewFilters = (patch) => {
        setAnalyticsChartsAnimated(true);
        setPackageViewFilters(current => ({ ...current, ...patch }));
    };

    const updateMenuViewFilters = (patch) => {
        setAnalyticsChartsAnimated(true);
        setMenuViewFilters(current => ({ ...current, ...patch }));
    };

    const renderAnalyticsFilterPanel = (panel) => {
        if (!panel || activeAnalyticsFilterPanel !== panel) return null;

        const tray = (children, columns = 'sm:grid-cols-2') => (
            <div className="admin-analytics-filter-popover">
                <div className={`grid grid-cols-1 gap-3 ${columns}`}>
                    {children}
                </div>
            </div>
        );

        if (panel === 'snapshot') {
            return tray(
                <label className={analyticsFilterLabelClass}>
                    Snapshot timeframe
                    <select
                        value={analyticsFilters.snapshot_window}
                        onChange={(event) => updateAnalyticsFilters({ snapshot_window: event.target.value })}
                        className={analyticsFilterInputClass}
                    >
                        {SNAPSHOT_WINDOW_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                </label>,
                'sm:grid-cols-1'
            );
        }

        if (panel === 'revenueTrend') {
            return tray(
                <label className={analyticsFilterLabelClass}>
                    Trend window
                    <select
                        value={analyticsFilters.trend_months}
                        onChange={(event) => updateAnalyticsFilters({ trend_months: event.target.value })}
                        className={analyticsFilterInputClass}
                    >
                        {TREND_MONTH_OPTIONS.map(months => <option key={months} value={months}>Last {months} months</option>)}
                    </select>
                </label>,
            );
        }

        if (panel === 'dashboardPayment' || panel === 'paymentRisk') {
            return tray(
                <>
                    <label className={analyticsFilterLabelClass}>
                        Payment status
                        <select value={paymentRiskFilters.status} onChange={(event) => updatePaymentRiskFilters({ status: event.target.value })} className={analyticsFilterInputClass}>
                            <option value="all">All statuses</option>
                            {paymentStatusBreakdown.map(row => <option key={row.label} value={String(row.label || '').toLowerCase()}>{row.label}</option>)}
                        </select>
                    </label>
                    <label className={analyticsFilterLabelClass}>
                        Minimum aging balance
                        <input type="number" min="0" value={paymentRiskFilters.minBalance} onChange={(event) => updatePaymentRiskFilters({ minBalance: event.target.value })} placeholder="Show all" className={analyticsFilterInputClass} />
                    </label>
                </>
            );
        }

        if (panel === 'revenueForecast') {
            return tray(
                <>
                    <label className={analyticsFilterLabelClass}>
                        Period
                        <select value={analyticsFilters.revenue_forecast_period} onChange={(event) => updateAnalyticsFilters({ revenue_forecast_period: event.target.value })} className={analyticsFilterInputClass}>
                            {FORECAST_PERIOD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                    </label>
                    <label className={analyticsFilterLabelClass}>
                        Smoothing
                        <select value={analyticsFilters.revenue_sma_window} onChange={(event) => updateAnalyticsFilters({ revenue_sma_window: event.target.value })} className={analyticsFilterInputClass}>
                            {SMA_WINDOW_OPTIONS.map(value => <option key={value} value={value}>{value}-period SMA</option>)}
                        </select>
                    </label>
                    <label className={analyticsFilterLabelClass}>
                        Forecast
                        <select value={analyticsFilters.revenue_forecast_horizon} onChange={(event) => updateAnalyticsFilters({ revenue_forecast_horizon: event.target.value })} className={analyticsFilterInputClass}>
                            {FORECAST_HORIZON_OPTIONS.map(value => <option key={value} value={value}>{value} periods ahead</option>)}
                        </select>
                    </label>
                </>,
                'sm:grid-cols-3'
            );
        }

        if (panel === 'bookingPipeline') {
            return tray(
                <label className={analyticsFilterLabelClass}>
                    Booking status
                    <select value={analyticsFilters.booking_status || ''} onChange={(event) => updateAnalyticsFilters({ booking_status: event.target.value })} className={analyticsFilterInputClass}>
                        {ANALYTICS_BOOKING_STATUS_OPTIONS.map(option => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
                    </select>
                </label>,
            );
        }

        if (panel === 'salesFrequency') {
            return tray(
                <label className={analyticsFilterLabelClass}>
                    Package category
                    <select value={analyticsFilters.package_category || ''} onChange={(event) => updateAnalyticsFilters({ package_category: event.target.value })} className={analyticsFilterInputClass}>
                        {ANALYTICS_PACKAGE_CATEGORY_OPTIONS.map(option => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
                    </select>
                </label>,
            );
        }

        if (panel === 'conversionFunnel') {
            return tray(
                <label className={analyticsFilterLabelClass}>
                    Funnel timeframe
                    <select value={analyticsFilters.snapshot_window} onChange={(event) => updateAnalyticsFilters({ snapshot_window: event.target.value })} className={analyticsFilterInputClass}>
                        {ANALYTICS_TIMEFRAME_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                </label>,
            );
        }

        if (panel === 'packagePerformance') {
            return tray(
                <>
                    <label className={analyticsFilterLabelClass}>
                        Package category
                        <select value={analyticsFilters.package_category || ''} onChange={(event) => updateAnalyticsFilters({ package_category: event.target.value })} className={analyticsFilterInputClass}>
                            {ANALYTICS_PACKAGE_CATEGORY_OPTIONS.map(option => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
                        </select>
                    </label>
                    <label className={analyticsFilterLabelClass}>
                        Show
                        <select value={packageViewFilters.limit} onChange={(event) => updatePackageViewFilters({ limit: event.target.value })} className={analyticsFilterInputClass}>
                            {PERFORMANCE_LIMIT_OPTIONS.map(limit => <option key={limit} value={limit}>Top {limit}</option>)}
                        </select>
                    </label>
                    <label className={analyticsFilterLabelClass}>
                        Sort by
                        <select value={packageViewFilters.sort} onChange={(event) => updatePackageViewFilters({ sort: event.target.value })} className={analyticsFilterInputClass}>
                            <option value="revenue">Revenue</option>
                            <option value="bookings">Bookings</option>
                            <option value="name">Package name</option>
                        </select>
                    </label>
                    <label className={analyticsFilterLabelClass}>
                        Minimum bookings
                        <input type="number" min="0" value={packageViewFilters.minBookings} onChange={(event) => updatePackageViewFilters({ minBookings: event.target.value })} placeholder="All" className={analyticsFilterInputClass} />
                    </label>
                </>,
                'sm:grid-cols-2'
            );
        }

        if (panel === 'menuPerformance') {
            return tray(
                <>
                    <label className={analyticsFilterLabelClass}>
                        Dish type
                        <select value={menuViewFilters.category} onChange={(event) => updateMenuViewFilters({ category: event.target.value })} className={analyticsFilterInputClass}>
                            {MENU_CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                    </label>
                    <label className={analyticsFilterLabelClass}>
                        Show
                        <select value={menuViewFilters.limit} onChange={(event) => updateMenuViewFilters({ limit: event.target.value })} className={analyticsFilterInputClass}>
                            {PERFORMANCE_LIMIT_OPTIONS.map(limit => <option key={limit} value={limit}>Top {limit}</option>)}
                        </select>
                    </label>
                    <label className={analyticsFilterLabelClass}>
                        Sort by
                        <select value={menuViewFilters.sort} onChange={(event) => updateMenuViewFilters({ sort: event.target.value })} className={analyticsFilterInputClass}>
                            <option value="selections">Selections</option>
                            <option value="pax">Guests served</option>
                            <option value="name">Dish name</option>
                        </select>
                    </label>
                </>,
                'sm:grid-cols-3'
            );
        }

        if (panel === 'revenueRegression') {
            return tray(
                <label className={analyticsFilterLabelClass}>
                    Regression history
                    <select value={analyticsFilters.trend_months} onChange={(event) => updateAnalyticsFilters({ trend_months: event.target.value })} className={analyticsFilterInputClass}>
                        {[6, 9, 12, 18, 24].map(months => <option key={months} value={months}>{months} months history + 3 projected months</option>)}
                    </select>
                </label>,
            );
        }

        if (panel === 'paxForecast') {
            return tray(
                <>
                    <label className={analyticsFilterLabelClass}>
                        Forecast period
                        <select value={analyticsFilters.pax_projection_period} onChange={(event) => updateAnalyticsFilters({ pax_projection_period: event.target.value })} className={analyticsFilterInputClass}>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                        </select>
                    </label>
                    <label className={analyticsFilterLabelClass}>
                        Year
                        <select value={analyticsFilters.pax_projection_year} onChange={(event) => updateAnalyticsFilters({ pax_projection_year: event.target.value })} className={analyticsFilterInputClass}>
                            <option value="">All years</option>
                            {ANALYTICS_YEARS.map(year => <option key={year} value={year}>{year}</option>)}
                        </select>
                    </label>
                    <label className={analyticsFilterLabelClass}>
                        Quarter
                        <select value={analyticsFilters.pax_projection_quarter} onChange={(event) => updateAnalyticsFilters({ pax_projection_quarter: event.target.value })} className={analyticsFilterInputClass}>
                            <option value="">All quarters</option>
                            {[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}
                        </select>
                    </label>
                    <label className={analyticsFilterLabelClass}>
                        SMA window
                        <select value={analyticsFilters.pax_sma_window} onChange={(event) => updateAnalyticsFilters({ pax_sma_window: event.target.value })} className={analyticsFilterInputClass}>
                            {[2, 3, 4, 6].map(window => <option key={window} value={window}>{window} periods</option>)}
                        </select>
                    </label>
                    <label className={analyticsFilterLabelClass}>
                        Projection horizon
                        <select value={analyticsFilters.pax_projection_horizon} onChange={(event) => updateAnalyticsFilters({ pax_projection_horizon: event.target.value })} className={analyticsFilterInputClass}>
                            {[3, 6, 9, 12].map(horizon => <option key={horizon} value={horizon}>{horizon} periods</option>)}
                        </select>
                    </label>
                </>,
                'sm:grid-cols-3'
            );
        }

        return null;
    };

    const renderAnalyticsFilterControl = (panel, label = 'Filters') => (
        <div className="admin-dashboard-filter-anchor">
            {renderAnalyticsFilterButton(panel, label)}
            {renderAnalyticsFilterPanel(panel)}
        </div>
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

    const readableInsightText = (text) => {
        if (!text) return '';
        const trimmed = String(text).trim();
        if (!trimmed) return '';
        const withoutTrailingPeriod = trimmed.replace(/\.+$/, '');
        if (withoutTrailingPeriod === withoutTrailingPeriod.toUpperCase() && /[A-Z]/.test(withoutTrailingPeriod)) {
            const lowered = withoutTrailingPeriod.toLowerCase();
            return `${lowered.charAt(0).toUpperCase()}${lowered.slice(1)}.`;
        }
        return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
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

    const chartInsight = (headline, meaning, recommended_action = 'Use this chart together with the active queues before making decisions.', severity = 'watch') => ({
        headline,
        meaning,
        recommended_action,
        severity,
    });

    const ChartGuide = ({ x, y, items = [] }) => (
        <div className="admin-chart-guide">
            <div className="admin-chart-axis-guide">
                <span>X</span>
                <strong>{x}</strong>
            </div>
            <div className="admin-chart-axis-guide">
                <span>Y</span>
                <strong>{y}</strong>
            </div>
            {!!items.length && (
                <div className="admin-chart-legend" aria-label="Chart legend">
                    {items.map((item) => (
                        <span key={item.label}>
                        <i style={{ backgroundColor: item.dashed ? 'transparent' : item.color, borderColor: item.color, borderStyle: item.dashed ? 'dashed' : 'solid' }} />
                            {item.label}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );

    const dominantBookingCategory = topSalesFrequency?.label || 'Current booking mix';
    const dominantBookingPercentage = Number(topSalesFrequency?.percentage || 0);
    const bookingRevenueForecast = Number(revenueForecastSummary.nextForecast || 0);
    const bookingGuestBaseline = Number(paxDemandSummary.nextForecast || 0);
    const bookingSalesInsight = normalizeInsight(
        salesFrequencyDistribution.insight,
        `${dominantBookingCategory} leads verified package volume`
    ) || chartInsight(
        `${dominantBookingCategory} leads verified package volume`,
        `${dominantBookingCategory} represents ${dominantBookingPercentage.toFixed(1)}% of verified package volume in this view.`,
        'Use the leading category for campaign targeting and package recommendation defaults.',
        'watch'
    );
    const bookingRevenueInsight = normalizeInsight(
        revenueForecast.interpretation || revenueForecast.insight,
        'Revenue trajectory is ready'
    ) || chartInsight(
        'Revenue trajectory is ready',
        `The next projected revenue point is ${formatCurrency(bookingRevenueForecast)} based on the current regression model.`,
        'Review approvals and discounts against the expected revenue trajectory.',
        'watch'
    );
    const bookingGuestInsight = normalizeInsight(
        paxDemandProjection.interpretation || paxDemandProjection.insight,
        'Guest demand baseline is ready'
    ) || chartInsight(
        'Guest demand baseline is ready',
        `The smoothed moving average projects ${bookingGuestBaseline.toLocaleString()} guests for the next planning period.`,
        'Check staffing, ingredients, and supplier commitments against this baseline.',
        'watch'
    );
    const bookingDecisionSignals = [
        { label: 'verified volume', value: `${dominantBookingPercentage.toFixed(1)}%` },
        { label: 'forecast', value: formatCurrency(bookingRevenueForecast) },
        { label: 'guest baseline', value: bookingGuestBaseline.toLocaleString() },
    ];
    const bookingDecisionSupportNumbers = [
        ['Dominant category', dominantBookingCategory],
        ['Verified volume', `${dominantBookingPercentage.toFixed(1)}%`],
        ['Revenue forecast', formatCurrency(bookingRevenueForecast)],
        ['Revenue model', `${revenueForecastSummary.method || 'OLS linear regression'} / ${revenueForecastSummary.direction || 'upward'}`],
        ['Guest baseline', bookingGuestBaseline.toLocaleString()],
        ['Guest model', `${paxDemandSummary.method || 'SMA'} projected guests`],
    ];

    const AnalyticsPanel = ({ id, filterKey = null, kicker, title, description, insight, fallbackInsight = null, guide = null, actions, children, loading = false, className = '', chartHeight = 'h-64' }) => (
        <section className={`admin-panel admin-analytics-panel ${className}`}>
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
                    {renderAnalyticsFilterPanel(filterKey)}
                </div>
            </div>
            <div className="admin-analytics-panel-body">
                {loading && <LoadingFeedback label="Preparing analytics..." compact />}
                <div className={chartHeight}>{children}</div>
                {guide && <ChartGuide {...guide} />}
                <InsightLine insight={insight || fallbackInsight} compact={false} />
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

        if (panelId === 'sales-frequency') {
            return salesFrequencyData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesFrequencyData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                        <RechartsTooltip formatter={(value, name) => name === 'percentage' ? `${value}%` : value} />
                        <Bar dataKey="frequency" fill="#720101" radius={[6, 6, 0, 0]} name="Bookings" />
                        <Bar dataKey="percentage" fill="#f0aa0b" radius={[6, 6, 0, 0]} name="Share" />
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
                    <LineChart data={revenueForecastData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(value) => `PHP ${Math.round(value / 1000)}k`} />
                        <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                        <Line type="monotone" dataKey="cumulativeRevenue" stroke="#720101" strokeWidth={3} dot={{ r: 4 }} name="Cumulative actual" connectNulls={false} />
                        <Line type="monotone" dataKey="trendLine" stroke="#f0aa0b" strokeWidth={3} strokeDasharray="6 4" dot={{ r: 3 }} name="OLS trend" connectNulls />
                    </LineChart>
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
        'sales-frequency': ['Booked package mix', analyticsInsightItems.salesFrequency || salesFrequencyDistribution.insight],
        'conversion-funnel': ['Conversion funnel', analyticsInsightItems.conversion],
        'package-performance': ['Package performance', analyticsInsightItems.menu],
        'menu-performance': ['Menu performance', analyticsInsightItems.menu],
        'revenue-forecast': ['Revenue regression', revenueForecast.interpretation || analyticsInsightItems.forecast || normalizeInsight(revenueForecast.insight, 'Forecast gives planning context.')],
        'pax-forecast': ['Guest demand forecast', paxDemandProjection.interpretation || analyticsInsightItems.forecast || normalizeInsight(paxDemandProjection.insight, 'Demand forecast gives planning context.')],
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
                onClick: () => toggleAnalyticsFilterPanel('menuPerformance'),
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
                <section className="admin-panel overflow-visible">
                    <div className="flex flex-col gap-4 border-b border-gray-100 bg-[#fffaf3] p-6 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="admin-kicker">Insight workbench</p>
                            <h3 className="mt-1 text-2xl font-black text-gray-950">Understand the business without scrolling through every chart</h3>
                            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-gray-500">Start with the signals that need decisions, then drill into revenue, bookings, payments, menu demand, operations, and forecasts.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {renderAnalyticsFilterControl('snapshot', businessSnapshot.label || 'Timeframe')}
                            <button
                                type="button"
                                onClick={() => fetchAnalytics()}
                                disabled={analyticsLoading}
                                className="admin-icon-action admin-refresh-action"
                                aria-label={analyticsLoading ? 'Refreshing insights' : 'Refresh insights'}
                                title={analyticsLoading ? 'Refreshing insights' : 'Refresh insights'}
                            >
                                <RefreshCw className={`h-5 w-5 ${analyticsLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
                            </button>
                        </div>
                    </div>
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
                        filterKey="revenueTrend"
                        kicker="Revenue"
                        title="Revenue trend"
                        description="Verified collections over the selected window."
                        insight={analyticsInsightItems.revenue}
                        fallbackInsight={chartInsight('Revenue trend is ready.', 'Bars show verified collected revenue for each month in the active analytics window.', 'Use dips or spikes to plan payment follow-ups and purchasing timing.')}
                        guide={{ x: 'Month', y: 'Verified revenue' }}
                        loading={analyticsLoading && !!analytics}
                        actions={renderAnalyticsFilterButton('revenueTrend', `Last ${analyticsFilters.trend_months} months`)}
                    >
                        {revenueTrendData.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={revenueTrendData} margin={{ top: 12, right: 16, bottom: 4, left: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                    <YAxis width={70} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(value) => `PHP ${Math.round(value / 1000)}k`} />
                                    <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                                    <Bar dataKey="revenue" fill="#720101" radius={[6, 6, 0, 0]} name="Revenue" isAnimationActive={analyticsChartsAnimated} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="admin-chart-empty">No collected revenue for this window.</div>}
                    </AnalyticsPanel>

                    <AnalyticsPanel
                        id="payment-breakdown"
                        filterKey="dashboardPayment"
                        kicker="Finance"
                        title="Payment breakdown"
                        description="Shows payment exposure by current status."
                        insight={analyticsInsightItems.payments}
                        fallbackInsight={chartInsight('Payment breakdown is ready.', 'Bars compare outstanding and collected payment value by status.', 'Use the largest unpaid status as the first collection follow-up queue.')}
                        guide={{ x: 'Payment status', y: 'Payment amount' }}
                        loading={analyticsLoading && !!analytics}
                        actions={renderAnalyticsFilterButton('dashboardPayment', paymentRiskFilters.status === 'all' ? 'Payment status' : paymentRiskFilters.status)}
                    >
                        {visiblePaymentStatusBreakdown.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={visiblePaymentStatusBreakdown} margin={{ top: 12, right: 16, bottom: 4, left: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                    <YAxis width={70} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(value) => `PHP ${Math.round(value / 1000)}k`} />
                                    <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                                    <Bar dataKey="total" fill="#720101" radius={[6, 6, 0, 0]} name="Amount" isAnimationActive={analyticsChartsAnimated} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="admin-chart-empty">No payment rows for this filter.</div>}
                    </AnalyticsPanel>

                    <AnalyticsPanel
                        id="booking-pipeline"
                        filterKey="bookingPipeline"
                        kicker="Bookings"
                        title="Booking pipeline"
                        description="Counts requests and confirmed work by status."
                        insight={analyticsInsightItems.pipeline}
                        fallbackInsight={chartInsight('Booking pipeline is ready.', 'Bars show how many bookings currently sit in each operational status.', 'Use high pending counts as a signal to review intake and approvals.')}
                        guide={{ x: 'Booking status', y: 'Booking count' }}
                        loading={analyticsLoading && !!analytics}
                        actions={renderAnalyticsFilterButton('bookingPipeline', analyticsFilters.booking_status || 'Booking status')}
                    >
                        {bookingPipelineData.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={bookingPipelineData} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                    <RechartsTooltip />
                                    <Bar dataKey="count" fill="#720101" radius={[6, 6, 0, 0]} name="Bookings" isAnimationActive={analyticsChartsAnimated} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="admin-chart-empty">No booking pipeline data yet.</div>}
                    </AnalyticsPanel>

                    <AnalyticsPanel
                        id="sales-frequency"
                        filterKey="salesFrequency"
                        kicker="Descriptive sales"
                        title="Booked package mix"
                        description="Verified bookings grouped by the package categories configured in the system."
                        insight={analyticsInsightItems.salesFrequency || salesFrequencyDistribution.insight}
                        fallbackInsight={chartInsight('Booked package mix is ready.', 'Bars show how verified bookings are distributed across real package categories.', 'Use the leading category to tune package defaults and campaign focus.')}
                        guide={{ x: 'Package category', y: 'Verified bookings' }}
                        loading={analyticsLoading && !!analytics}
                        actions={renderAnalyticsFilterButton('salesFrequency', ANALYTICS_PACKAGE_CATEGORY_OPTIONS.find(option => option.value === (analyticsFilters.package_category || ''))?.label || 'Package category')}
                    >
                        {salesFrequencyData.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={salesFrequencyData} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                    <RechartsTooltip formatter={(value, name) => name === 'Share' ? `${value}%` : value} />
                                    <Bar dataKey="frequency" fill="#720101" radius={[6, 6, 0, 0]} name="Bookings" isAnimationActive={analyticsChartsAnimated} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="admin-chart-empty">No verified sales frequency data yet.</div>}
                    </AnalyticsPanel>

                    <AnalyticsPanel
                        id="conversion-funnel"
                        filterKey="conversionFunnel"
                        kicker="Conversion"
                        title="Booking completion funnel"
                        description="Tracks starts, submissions, payment movement, and feedback."
                        insight={analyticsInsightItems.conversion}
                        fallbackInsight={chartInsight('Booking funnel is ready.', 'Bars show the main conversion steps from booking activity through feedback capture.', 'Watch for the first major drop-off before adjusting customer follow-up.')}
                        guide={{ x: 'Funnel step', y: 'Record count' }}
                        loading={analyticsLoading && !!analytics}
                        actions={renderAnalyticsFilterButton('conversionFunnel', businessSnapshot.label || 'Timeframe')}
                    >
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                                { label: 'Starts', value: conversionFunnel.booking_starts || 0 },
                                { label: 'Bookings', value: conversionFunnel.booking_submissions || 0 },
                                { label: 'Payments', value: conversionFunnel.payment_confirmations || 0 },
                                { label: 'Feedback', value: conversionFunnel.feedback_submissions || 0 },
                            ]} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                <RechartsTooltip />
                                <Bar dataKey="value" fill="#720101" radius={[6, 6, 0, 0]} name="Events" isAnimationActive={analyticsChartsAnimated} />
                            </BarChart>
                        </ResponsiveContainer>
                    </AnalyticsPanel>

                    <AnalyticsPanel
                        id="package-performance"
                        filterKey="packagePerformance"
                        kicker="Menu demand"
                        title="Package performance"
                        description="Top package choices by revenue."
                        insight={analyticsInsightItems.menu}
                        fallbackInsight={chartInsight('Package performance is ready.', 'Bars rank packages by verified booking value.', 'Use the leading packages to guide recommendations and sales scripts.')}
                        guide={{ x: 'Verified revenue', y: 'Package' }}
                        loading={analyticsLoading && !!analytics}
                        actions={renderAnalyticsFilterButton('packagePerformance', `Top ${packageViewFilters.limit}`)}
                    >
                        {visiblePackagePerformanceData.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={visiblePackagePerformanceData} layout="vertical" margin={{ top: 12, left: 28, right: 20, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(value) => `PHP ${Math.round(value / 1000)}k`} />
                                    <YAxis type="category" dataKey="label" width={130} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#374151', fontWeight: 700 }} />
                                    <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                                    <Bar dataKey="revenue" fill="#720101" radius={[0, 6, 6, 0]} name="Revenue" isAnimationActive={analyticsChartsAnimated} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="admin-chart-empty">No package data for this filter.</div>}
                    </AnalyticsPanel>

                    <AnalyticsPanel
                        id="menu-performance"
                        filterKey="menuPerformance"
                        kicker="Kitchen signal"
                        title="Menu performance"
                        description="Most selected dishes from actual bookings."
                        insight={analyticsInsightItems.menu}
                        fallbackInsight={chartInsight('Menu performance is ready.', 'Bars rank dishes by the active menu filter.', 'Use high-demand dishes for purchasing and package menu defaults.')}
                        guide={{ x: menuViewFilters.sort === 'pax' ? 'Guests served' : 'Selections', y: 'Dish' }}
                        loading={analyticsLoading && !!analytics}
                        actions={renderAnalyticsFilterButton('menuPerformance', MENU_CATEGORY_OPTIONS.find(option => option.value === menuViewFilters.category)?.label || 'Dish type')}
                    >
                        {visibleMenuPerformanceData.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={visibleMenuPerformanceData} layout="vertical" margin={{ top: 12, left: 28, right: 20, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                    <YAxis type="category" dataKey="label" width={130} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#374151', fontWeight: 700 }} />
                                    <RechartsTooltip />
                                    <Bar dataKey={menuViewFilters.sort === 'pax' ? 'paxServed' : 'selections'} fill="#720101" radius={[0, 6, 6, 0]} name={menuViewFilters.sort === 'pax' ? 'Guests served' : 'Selections'} isAnimationActive={analyticsChartsAnimated} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="admin-chart-empty">No menu selections for this filter.</div>}
                    </AnalyticsPanel>

                    <AnalyticsPanel
                        id="revenue-forecast"
                        filterKey="revenueRegression"
                        kicker="Forecast"
                        title="Revenue regression"
                        description={`${revenueRegressionHistoryMonths}-month history with a ${revenueRegressionHorizon}-month projection.`}
                        insight={revenueForecast.interpretation || analyticsInsightItems.forecast || normalizeInsight(revenueForecast.insight, 'Forecast gives planning context.')}
                        fallbackInsight={chartInsight('Revenue regression is ready.', 'The line compares cumulative actual revenue with the OLS trend and projected path.', 'Use the next projected month to plan buffers before committing purchases.')}
                        guide={{ x: 'Month (history + projection)', y: 'Cumulative verified revenue', items: [{ label: 'Cumulative actual', color: '#720101' }, { label: 'OLS trend / projection', color: '#f0aa0b', dashed: true }] }}
                        loading={analyticsLoading && !!analytics}
                        className="admin-analytics-panel-wide"
                        chartHeight="h-72"
                        actions={renderAnalyticsFilterButton('revenueRegression', `${revenueRegressionHistoryMonths} mo history + ${revenueRegressionHorizon} mo projection`)}
                    >
                        {revenueForecastData.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={revenueForecastData} margin={{ top: 12, right: 20, bottom: 4, left: 14 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} />
                                    <YAxis width={76} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(value) => `PHP ${Math.round(value / 1000)}k`} />
                                    <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                                    <Line type="monotone" dataKey="cumulativeRevenue" stroke="#720101" strokeWidth={3} dot={{ r: 3 }} name="Cumulative actual" connectNulls={false} isAnimationActive={analyticsChartsAnimated} />
                                    <Line type="monotone" dataKey="trendLine" stroke="#f0aa0b" strokeWidth={3} strokeDasharray="6 4" dot={{ r: 3 }} name="OLS trend" connectNulls isAnimationActive={analyticsChartsAnimated} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : <div className="admin-chart-empty">No revenue regression data yet.</div>}
                    </AnalyticsPanel>

                    <AnalyticsPanel
                        id="pax-forecast"
                        filterKey="paxForecast"
                        kicker="Operations forecast"
                        title="Guest demand forecast"
                        description="Projected pax for staffing and preparation planning."
                        insight={paxDemandProjection.interpretation || analyticsInsightItems.forecast || normalizeInsight(paxDemandProjection.insight, 'Demand forecast gives planning context.')}
                        fallbackInsight={chartInsight('Guest demand forecast is ready.', 'Bars compare actual guest volume with simple moving-average demand forecasts.', 'Use the forecast to plan staffing, purchasing, and prep capacity.')}
                        guide={{ x: 'Period', y: 'Guest count', items: [{ label: 'Actual guests', color: '#720101' }, { label: 'SMA forecast', color: '#f0aa0b' }] }}
                        loading={analyticsLoading && !!analytics}
                        className="admin-analytics-panel-wide"
                        chartHeight="h-72"
                        actions={renderAnalyticsFilterButton('paxForecast', `${analyticsFilters.pax_projection_period} demand`)}
                    >
                        {paxDemandData.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={paxDemandData} margin={{ top: 12, right: 20, bottom: 4, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                    <RechartsTooltip />
                                    <Bar dataKey="pax" fill="#720101" radius={[6, 6, 0, 0]} name="Actual guests" isAnimationActive={analyticsChartsAnimated} />
                                    <Bar dataKey="forecast" fill="#f0aa0b" radius={[6, 6, 0, 0]} name="SMA forecast" isAnimationActive={analyticsChartsAnimated} />
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
                                    {renderAnalyticsFilterControl('revenueTrend', `Last ${analyticsFilters.trend_months} months`)}
                                </div>
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
                                    <button onClick={() => openOperationalAlertQueue(alert)} className="mt-3 text-xs font-black uppercase tracking-widest text-[#720101]">Open queue</button>
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
                            {renderAnalyticsFilterControl('packagePerformance', `Top ${packageViewFilters.limit}`)}
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
                            {renderAnalyticsFilterControl('menuPerformance', MENU_CATEGORY_OPTIONS.find(option => option.value === menuViewFilters.category)?.label || 'Dish type')}
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

    const renderDashboardFilterControl = (panel, label, children, columns = 'sm:grid-cols-2') => (
        <div className="admin-dashboard-filter-anchor">
            {renderDashboardFilterButton(panel, label)}
            {activeDashboardFilterPanel === panel && (
                <div className="admin-dashboard-filter-popover">
                    <div className={`grid grid-cols-1 gap-3 ${columns}`}>
                        {children}
                    </div>
                </div>
            )}
        </div>
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
            if (payload.password && !empPasswordEvaluation.valid) {
                setEmpFormErrors({ password: ['Complete the password requirements before saving.'] });
                showToast('Please review the password fields.', 'error');
                setEmpFormLoading(false);
                return;
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
            email: isPlaceholderEmail(customer.email) ? '' : customer.email || '',
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

    const renderCustomerBookingRows = (items, emptyTitle) => (
        items.length ? (
            <div className="admin-responsive-table">
                <table>
                    <thead>
                        <tr>
                            <th>Booking</th>
                            <th>Event Date</th>
                            <th>Status</th>
                            <th>Total</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((booking) => (
                            <tr key={booking.id}>
                                <td>
                                    <p className="font-black text-slate-950">{eventDisplayName(booking)}</p>
                                    <p className="text-xs font-bold text-slate-400">{formatBookingRef(booking.id)} / {booking.pax || 0} guests</p>
                                    {hasDifferentBookingContact(booking) && (
                                        <p className="text-xs font-bold text-amber-700">Booking contact: {bookingContactName(booking)}</p>
                                    )}
                                </td>
                                <td>{formatDate(booking.event_date)}</td>
                                <td>
                                    <StaffStatusChip tone={bookingStatusMeta[normalizeStatus(booking.status)]?.tone || 'neutral'}>
                                        {bookingStatusMeta[normalizeStatus(booking.status)]?.label || booking.status || 'Unknown'}
                                    </StaffStatusChip>
                                </td>
                                <td>{formatCurrency(getBookingTotal(booking))}</td>
                                <td>
                                    <button type="button" onClick={() => setEventDetailsModal({ open: true, data: booking })} className="admin-button-secondary px-3 py-2 text-xs font-black">
                                        Open details
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ) : (
            <StaffEmptyState title={emptyTitle} message="Customer-linked records will appear here when available." />
        )
    );

    const renderCustomerLookup = () => (
        <AdminPageSurface className="admin-customer-support-surface">
            <div className="admin-section-heading">
                <div>
                    <p className="admin-kicker">Customer module access</p>
                    <h3>Customer Lookup</h3>
                    <p>Select a customer to review their dashboard, bookings, payments, messages, and account status from the admin workspace.</p>
                </div>
            </div>
            <AdminCommandStrip>
                <div className="admin-search-field">
                    <Search className="h-4 w-4" aria-hidden="true" />
                    <input
                        value={customerLookupQuery}
                        onChange={(event) => setCustomerLookupQuery(event.target.value)}
                        placeholder="Search customers by name, email, username, or phone"
                    />
                </div>
                <label className="admin-lookup-filter">
                    <span>Status</span>
                    <select
                        value={customerLookupFilters.status}
                        onChange={(event) => setCustomerLookupFilters((previous) => ({ ...previous, status: event.target.value }))}
                    >
                        <option value="all">All statuses</option>
                        <option value="active">Active only</option>
                        <option value="deactivated">Deactivated</option>
                    </select>
                </label>
                <label className="admin-lookup-filter">
                    <span>Bookings</span>
                    <select
                        value={customerLookupFilters.bookingActivity}
                        onChange={(event) => setCustomerLookupFilters((previous) => ({ ...previous, bookingActivity: event.target.value }))}
                    >
                        <option value="all">All bookings</option>
                        <option value="with_bookings">With bookings</option>
                        <option value="no_bookings">No bookings</option>
                    </select>
                </label>
                <span className="admin-account-count-chip">{customerLookupResults.length} shown</span>
            </AdminCommandStrip>
            {customerLoading ? (
                <StaffSkeleton rows={6} label="Loading customer accounts" />
            ) : customerLookupResults.length ? (
                <div className="admin-responsive-table admin-customer-lookup-table">
                    <table>
                        <colgroup>
                            <col className="admin-customer-lookup-col-customer" />
                            <col className="admin-customer-lookup-col-contact" />
                            <col className="admin-customer-lookup-col-status" />
                            <col className="admin-customer-lookup-col-bookings" />
                            <col className="admin-customer-lookup-col-action" />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>Customer</th>
                                <th>Contact</th>
                                <th>Status</th>
                                <th>Bookings</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customerLookupResults.map((customer) => (
                                <tr key={customer.id}>
                                    <td>
                                        <p className="font-black text-slate-950">{customer.full_name || customer.username}</p>
                                        <p className="text-xs font-bold text-slate-400">@{customer.username || 'customer'}</p>
                                    </td>
                                    <td>
                                        <p>{displayEmail(customer.email)}</p>
                                        <p className="text-xs font-bold text-slate-400">{customer.phone || 'No phone'}</p>
                                    </td>
                                    <td>{customer.account_status === 'deactivated' ? 'Deactivated' : 'Active'}</td>
                                    <td>{Number(customer.bookings_count || 0).toLocaleString()}</td>
                                    <td>
                                        <button type="button" onClick={() => selectCustomerForSupport(customer)} className="admin-button-primary px-3 py-2 text-xs font-black">
                                            Select customer
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <StaffEmptyState title="No customer accounts found" message="Try a broader name, email, username, or phone search." />
            )}
        </AdminPageSurface>
    );

    const renderCustomerWorkspace = () => {
        if (activeWorkspaceTab === 'lookup' || !selectedCustomer) {
            return renderCustomerLookup();
        }

        const customerName = selectedCustomer.full_name || selectedCustomer.username || `Customer #${selectedCustomer.id}`;
        const accountActive = selectedCustomer.account_status !== 'deactivated';

        return (
            <div className="admin-customer-support-stack animate-fadeIn">
                <section className="admin-customer-context-strip">
                    <div>
                        <p className="admin-kicker">Selected customer</p>
                        <h3>{customerName}</h3>
                        <p>{displayEmail(selectedCustomer.email)} / {selectedCustomer.phone || 'No phone'}</p>
                    </div>
                    <div className="admin-customer-context-metrics">
                        <span><strong>{customerActiveBookings.length}</strong> Active</span>
                        <span><strong>{customerHistoryBookings.length}</strong> History</span>
                        <span><strong>{customerPayments.length}</strong> Payments</span>
                        <span className={accountActive ? 'is-active' : 'is-deactivated'}>{accountActive ? 'Active account' : 'Deactivated account'}</span>
                    </div>
                    <button type="button" onClick={() => navigateToWorkspaceTab('customer', 'lookup', { customerId: '' })} className="admin-button-secondary px-3 py-2 text-xs font-black">
                        Change customer
                    </button>
                </section>

                {activeWorkspaceTab === 'dashboard' && (
                    <AdminPageSurface>
                        <div className="admin-section-heading">
                            <div>
                                <p className="admin-kicker">Customer dashboard</p>
                                <h3>{customerName}</h3>
                                <p>Admin support view of this customer's active bookings, payments, and event progress.</p>
                            </div>
                            <button type="button" onClick={() => setAssistedBookingOpen(true)} className="admin-button-primary px-4 py-2.5 text-sm font-black">
                                Book Now on behalf of customer
                            </button>
                        </div>
                        <div className="admin-flat-strip">
                            <div className="admin-flat-strip-item"><strong>{customerScopedBookings.length}</strong><span>Total bookings</span></div>
                            <div className="admin-flat-strip-item"><strong>{customerActiveBookings.length}</strong><span>Active bookings</span></div>
                            <div className="admin-flat-strip-item"><strong>{customerPayments.length}</strong><span>Payments</span></div>
                            <div className="admin-flat-strip-item"><strong>{formatCurrency(customerScopedBookings.reduce((sum, booking) => sum + getBookingTotal(booking), 0))}</strong><span>Total exposure</span></div>
                        </div>
                        {renderCustomerBookingRows(customerActiveBookings, 'No active bookings for this customer')}
                    </AdminPageSurface>
                )}

                {activeWorkspaceTab === 'menu' && (
                    <AdminPageSurface>
                        <div className="admin-section-heading">
                            <div>
                                <p className="admin-kicker">Customer booking</p>
                                <h3>Menu</h3>
                                <p>Review selected menu data from the customer's active bookings.</p>
                            </div>
                        </div>
                        {renderCustomerBookingRows(customerActiveBookings.filter((booking) => getSelectedDishes(booking).length > 0), 'No menu selections recorded')}
                    </AdminPageSurface>
                )}

                {activeWorkspaceTab === 'payments' && (
                    <AdminPageSurface>
                        <div className="admin-section-heading">
                            <div>
                                <p className="admin-kicker">Customer finance</p>
                                <h3>Payments</h3>
                                <p>Review customer payment records. Checkout remains customer-facing; admin support can route the customer to payment.</p>
                            </div>
                        </div>
                        {customerPayments.length ? (
                            <div className="admin-responsive-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Booking</th>
                                            <th>Payment</th>
                                            <th>Due</th>
                                            <th>Status</th>
                                            <th>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {customerPayments.map(({ booking, payment }) => (
                                            <tr key={`${booking.id}-${payment.id}`}>
                                                <td>{formatBookingRef(booking.id)}</td>
                                                <td>{paymentLabel(payment.payment_type)}</td>
                                                <td>{formatDate(payment.due_date)}</td>
                                                <td>{staffPaymentStatus(payment.status, payment.due_date).label}</td>
                                                <td>{formatCurrency(payment.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <StaffEmptyState title="No payments found" message="Payment records will appear here after a customer booking creates payment terms." />
                        )}
                    </AdminPageSurface>
                )}

                {activeWorkspaceTab === 'history' && (
                    <AdminPageSurface>
                        <div className="admin-section-heading">
                            <div>
                                <p className="admin-kicker">Customer records</p>
                                <h3>History</h3>
                                <p>Completed and cancelled events connected to this customer.</p>
                            </div>
                        </div>
                        {renderCustomerBookingRows(customerHistoryBookings, 'No customer history found')}
                    </AdminPageSurface>
                )}

                {activeWorkspaceTab === 'messages' && (
                    <div className="admin-messages-page-surface admin-customer-messages-surface">
                        <Suspense fallback={<StaffSkeleton variant="panel" rows={6} label="Loading message desk" />}>
                            <StaffMessaging
                                variant="admin-oversight"
                                surfaceMode="admin-full"
                                memoryScope={`customer:${selectedCustomer.id}`}
                                customerId={selectedCustomer.id}
                                defaultAdminFilter="all-active"
                                refreshToken={messageRefreshToken}
                                targetConversationId={targetConversationId}
                                onMetricsChange={setAdminMessageMetrics}
                                onAdminContextNavigate={handleAdminContextNavigate}
                            />
                        </Suspense>
                    </div>
                )}

                {activeWorkspaceTab === 'feedback' && (
                    <AdminPageSurface>
                        <div className="admin-section-heading">
                            <div>
                                <p className="admin-kicker">Customer follow-up</p>
                                <h3>Feedback Request</h3>
                                <p>Feedback is reviewed through staff event history and post-event follow-up records.</p>
                            </div>
                        </div>
                        {renderCustomerBookingRows(customerHistoryBookings, 'No completed events ready for feedback review')}
                    </AdminPageSurface>
                )}

                {activeWorkspaceTab === 'announcements' && (
                    <AdminPageSurface>
                        <div className="admin-section-heading">
                            <div>
                                <p className="admin-kicker">Customer updates</p>
                                <h3>Announcements</h3>
                                <p>Open Public Content to review announcements visible to customers.</p>
                            </div>
                            <button type="button" onClick={() => navigateToWorkspaceTab('marketing', 'public-content', { configTab: 'announcements' })} className="admin-button-primary px-4 py-2.5 text-sm font-black">
                                Open announcements
                            </button>
                        </div>
                    </AdminPageSurface>
                )}

                {activeWorkspaceTab === 'account-status' && (
                    <AdminPageSurface>
                        <div className="admin-section-heading">
                            <div>
                                <p className="admin-kicker">Customer account</p>
                                <h3>Account Status</h3>
                                <p>Review customer access and account lifecycle actions.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => openCustomerModal(selectedCustomer)} className="admin-button-secondary px-3 py-2 text-xs font-black">
                                    Edit customer account
                                </button>
                                {accountActive ? (
                                    <button type="button" onClick={() => handleDeleteCustomer(selectedCustomer.id)} className="admin-button-danger px-3 py-2 text-xs font-black">
                                        Deactivate customer
                                    </button>
                                ) : (
                                    <button type="button" onClick={() => handleReactivateCustomer(selectedCustomer.id)} className="admin-button-primary px-3 py-2 text-xs font-black">
                                        Reactivate customer
                                    </button>
                                )}
                            </div>
                        </div>
                    </AdminPageSurface>
                )}
            </div>
        );
    };

    const renderWorkspaceOverview = (workspace) => (
        <AdminPageSurface className="admin-workspace-overview">
            <div className="admin-section-heading">
                <div>
                    <p className="admin-kicker">{workspace === 'marketing' ? 'Marketing workspace' : 'Accounting workspace'}</p>
                    <h3>Today</h3>
                    <p>{workspace === 'marketing'
                        ? 'Admin monitoring view for marketing queues and takeover-ready work.'
                        : 'Admin monitoring view for accounting queues and override-ready finance work.'}</p>
                </div>
            </div>
            {workspace === 'marketing' ? (
                <div className="admin-flat-strip">
                    <button type="button" onClick={() => navigateToWorkspaceTab('marketing', 'bookings')} className="admin-flat-strip-item admin-flat-strip-action"><strong>{bookingStats.pending}</strong><span>Bookings</span></button>
                    <button type="button" onClick={() => navigateToWorkspaceTab('marketing', 'calendar')} className="admin-flat-strip-item admin-flat-strip-action"><strong>{bookingStats.active}</strong><span>Calendar</span></button>
                    <button type="button" onClick={() => navigateToWorkspaceTab('marketing', 'messages')} className="admin-flat-strip-item admin-flat-strip-action"><strong>{adminMessageMetrics.open}</strong><span>Messages</span></button>
                    <button type="button" onClick={() => navigateToWorkspaceTab('marketing', 'handoff')} className="admin-flat-strip-item admin-flat-strip-action"><strong>{bookingStats.active}</strong><span>Event Handoff</span></button>
                </div>
            ) : (
                <div className="admin-flat-strip">
                    <button type="button" onClick={() => navigateToWorkspaceTab('accounting', 'payments')} className="admin-flat-strip-item admin-flat-strip-action"><strong>{financePaymentQueueStats.review}</strong><span>Payments</span></button>
                    <button type="button" onClick={() => navigateToWorkspaceTab('accounting', 'reconciliation')} className="admin-flat-strip-item admin-flat-strip-action"><strong>{financePaymentQueueStats.exceptions}</strong><span>Reconciliation</span></button>
                    <button type="button" onClick={() => navigateToWorkspaceTab('accounting', 'refunds')} className="admin-flat-strip-item admin-flat-strip-action"><strong>{refundQueue.length}</strong><span>Refunds</span></button>
                    <button type="button" onClick={() => navigateToWorkspaceTab('accounting', 'ledger')} className="admin-flat-strip-item admin-flat-strip-action"><strong>{financePaymentRows.length}</strong><span>Ledger & Receipts</span></button>
                </div>
            )}
        </AdminPageSurface>
    );

    if (analyticsLoading && activeTab === 'today' && !analytics?.summary) {
        return (
            <StaffWorkspaceSkeleton
                title="Admin Console"
                roleLabel="Owner operations"
                label="Preparing admin console"
                navGroups={[
                    { label: 'Daily Work', items: ['Command Center'] },
                    { label: 'Queues', items: ['Bookings & Intake', 'Handoff', 'Food Tastings', 'Finance', 'Accounts'] },
                    { label: 'Communication', items: ['Messages & Inquiries'] },
                    { label: 'Scheduling', items: ['Calendar', 'Availability'] },
                    { label: 'Customer Content', items: ['Announcements', 'Packages', 'Event Types', 'Menu Items'] },
                    { label: 'Insight & Governance', items: ['Analytics', 'Reports', 'System & Audit', 'Event History'] },
                    { label: 'Settings', items: ['Settings'] },
                ]}
            />
        );
    }

    return (
        <StaffWorkspaceLayout
            title="Admin Console"
            roleLabel="Owner operations"
            username={user?.username}
            active={adminActiveNavId}
            onNavigate={handleAdminNavigate}
            onLogout={handleLogout}
            brandLogo={logoImg}
            workspaceBadge="Admin"
            navGroups={adminNavGroups}
            roleKey="admin"
            workspaceClassName={`admin-page ${['messages-inquiries', 'customer-messages'].includes(activeTab) ? 'is-messages-workspace' : ''}`}
            hideSidebarBrand
            topBar={(
                <StaffPageHeader
                    notificationVariant="light"
                    primaryContent={(
                        <div className="admin-navbar-primary">
                            <button type="button" className="admin-navbar-brand" onClick={() => navigateToWorkspaceTab('admin', 'today')} aria-label="Open admin command center">
                                <img src={logoImg} alt="ECS" />
                                <span>Admin</span>
                            </button>
                            <div className="admin-workspace-switcher" role="tablist" aria-label="Admin workspaces">
                                {ADMIN_WORKSPACES.map((workspace) => (
                                    <button
                                        key={workspace.id}
                                        type="button"
                                        className={activeWorkspace === workspace.id ? 'is-active' : ''}
                                        onClick={() => navigateToWorkspaceTab(workspace.id, workspaceTabs[workspace.id] || DEFAULT_WORKSPACE_TABS[workspace.id])}
                                        role="tab"
                                        aria-selected={activeWorkspace === workspace.id}
                                        title={workspace.description}
                                    >
                                        {workspace.label}
                                    </button>
                                ))}
                            </div>
                            <div
                                ref={adminSearchContainerRef}
                                className="admin-header-search"
                                onBlur={() => window.setTimeout(() => {
                                    if (!adminSearchContainerRef.current?.contains(document.activeElement)) {
                                        setAdminSearchOpen(false);
                                        setAdminSearchFilterOpen(false);
                                    }
                                }, 120)}
                            >
                                <label className="sr-only" htmlFor="admin-tab-search">Search pages, customers, staff, or booking contacts</label>
                                <Search className="admin-header-search-icon" aria-hidden="true" />
                                <input
                                    ref={adminSearchInputRef}
                                    id="admin-tab-search"
                                    type="search"
                                    value={adminTabSearch}
                                    onFocus={() => setAdminSearchOpen(true)}
                                    onChange={(event) => {
                                        setAdminTabSearch(event.target.value);
                                        setAdminSearchOpen(true);
                                    }}
                                    onKeyDown={handleAdminSearchKeyDown}
                                    placeholder="Search pages, customers, staff, or booking contacts..."
                                    autoComplete="off"
                                />
                                {adminTabSearch && (
                                    <button
                                        type="button"
                                        className="admin-header-search-clear"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => {
                                            setAdminTabSearch('');
                                            setAdminSearchOpen(true);
                                            adminSearchInputRef.current?.focus();
                                        }}
                                        aria-label="Clear admin search"
                                    >
                                        <X aria-hidden="true" />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className={`admin-header-search-filter ${adminSearchFilterOpen || adminSearchFilterCount > 0 ? 'is-active' : ''}`}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => {
                                        setAdminSearchFilterOpen((open) => !open);
                                        setAdminSearchOpen(true);
                                        adminSearchInputRef.current?.focus();
                                    }}
                                    aria-label="Open search filters"
                                    aria-expanded={adminSearchFilterOpen}
                                >
                                    <Filter aria-hidden="true" />
                                    {adminSearchFilterCount > 0 && <span>{adminSearchFilterCount}</span>}
                                </button>
                                {adminSearchFilterOpen && (
                                    <div className="admin-header-search-filter-popover" role="dialog" aria-label="Search filters">
                                        <div className="admin-header-search-filter-heading">
                                            <strong>Search filters</strong>
                                            <button
                                                type="button"
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={() => setAdminSearchFilters({ type: 'all', workspace: 'all', scope: 'all' })}
                                            >
                                                Reset
                                            </button>
                                        </div>
                                        <label>
                                            <span>Show</span>
                                            <select
                                                value={adminSearchFilters.type}
                                                onChange={(event) => setAdminSearchFilters((filters) => ({ ...filters, type: event.target.value }))}
                                            >
                                                <option value="all">Everything</option>
                                                <option value="page">Pages</option>
                                                <option value="customer">Customer accounts</option>
                                                <option value="staff">Staff accounts</option>
                                                <option value="booking">Booking contacts</option>
                                            </select>
                                        </label>
                                        <label>
                                            <span>Workspace</span>
                                            <select
                                                value={adminSearchFilters.workspace}
                                                onChange={(event) => setAdminSearchFilters((filters) => ({ ...filters, workspace: event.target.value }))}
                                            >
                                                <option value="all">All workspaces</option>
                                                {ADMIN_WORKSPACES.map((workspace) => (
                                                    <option key={workspace.id} value={workspace.id}>{workspace.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label>
                                            <span>Search in</span>
                                            <select
                                                value={adminSearchFilters.scope}
                                                onChange={(event) => setAdminSearchFilters((filters) => ({ ...filters, scope: event.target.value }))}
                                            >
                                                <option value="all">All details</option>
                                                <option value="name">Names and page labels</option>
                                                <option value="contact">Email or phone</option>
                                                <option value="booking">Booking number</option>
                                            </select>
                                        </label>
                                    </div>
                                )}
                                {showAdminSearchResults && !adminSearchFilterOpen && (
                                    <div className="admin-header-search-results" role="listbox" aria-label="Admin search results">
                                        {adminSearchResults.length > 0 ? adminSearchResults.map((result) => (
                                            <button
                                                key={result.id}
                                                type="button"
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={() => navigateToAdminSearchResult(result)}
                                                className={`admin-header-search-result ${activeWorkspace === result.workspace && activeWorkspaceTab === result.tab ? 'is-active' : ''}`}
                                                role="option"
                                                aria-selected={activeWorkspace === result.workspace && activeWorkspaceTab === result.tab}
                                            >
                                                <span>
                                                    <strong>{result.label}</strong>
                                                    <small>{result.path}</small>
                                                </span>
                                                {result.description && <em>{result.description}</em>}
                                            </button>
                                        )) : adminBookingSearchLoading || adminStaffSearchLoading ? (
                                            <div className="admin-header-search-empty">Searching accounts and booking contacts...</div>
                                        ) : (
                                            <div className="admin-header-search-empty">No matching pages, customers, staff, or booking contacts found.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                />
            )}
        >
                <div className={ADMIN_FULL_SURFACE_TABS.includes(activeTab) ? `admin-full-surface-tab-shell ${['messages-inquiries', 'customer-messages'].includes(activeTab) ? 'admin-messages-tab-shell' : ''}` : 'space-y-5'}>
                    {activeWorkspace === 'customer' && renderCustomerWorkspace()}
                    {activeTab === 'marketing-today' && renderWorkspaceOverview('marketing')}
                    {activeTab === 'accounting-today' && renderWorkspaceOverview('accounting')}
                    {activeTab === 'today' && (
                        <div className="animate-fadeIn">
                            <div className="admin-command-center-stack">
                                <section className="admin-panel admin-today-command overflow-visible">
                                    <div className="admin-compact-command border-0 bg-[#fffaf3]">
                                        <div>
                                            <p className="admin-kicker">Quick actions</p>
                                            <p>Use shortcuts first, then scan the live metrics below.</p>
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
                                                {renderDashboardFilterControl(
                                                    'dashboardSnapshot',
                                                    businessSnapshot.label || 'Timeframe',
                                                    <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
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
                                                    </label>,
                                                    'sm:grid-cols-1'
                                                )}
                                                <button
                                                    onClick={() => fetchAnalytics()}
                                                    disabled={analyticsLoading}
                                                    className="admin-icon-action admin-refresh-action"
                                                    title={analyticsLoading ? 'Refreshing dashboard data' : 'Refresh dashboard data'}
                                                    aria-label={analyticsLoading ? 'Refreshing dashboard data' : 'Refresh dashboard data'}
                                                >
                                                    <RefreshCw className={`h-5 w-5 ${analyticsLoading ? 'animate-spin' : ''}`} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="admin-stat-strip admin-overview-strip" aria-label="Admin workspace overview">
                                        {[
                                            ['Bookings', bookingStats.total, 'Current booking records'],
                                            ['Customers', customers.length, 'Customer accounts'],
                                            ['Staff', employees.length, 'Staff accounts'],
                                            ['Refunds', refundQueue.length, 'Refund requests'],
                                        ].map(([label, value, hint]) => (
                                            <span key={label} className="admin-stat-chip admin-stat-chip-wide">
                                                <strong>{value}</strong>
                                                <em>{label}</em>
                                                <small>{hint}</small>
                                            </span>
                                        ))}
                                    </div>
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

                                <div className="admin-command-center-focus">
                                    <NextActionPanel
                                        eyebrow="Start here"
                                        title="Open the first item that needs a decision"
                                        description="Only active booking, refund, account, system, and operational exceptions appear here."
                                        actions={adminNextActions}
                                        emptyTitle="No admin actions waiting"
                                        emptyMessage="Booking, refund, account, and system exceptions will appear here."
                                    />
                                </div>

                                <StaffInlineInsight
                                    eyebrow="Decision support"
                                    title={`${topSalesFrequency?.label || 'Booking demand'} is the strongest planning signal right now`}
                                    signals={[
                                        { label: 'verified volume', value: `${Number(topSalesFrequency?.percentage || 0).toFixed(1)}%` },
                                        { label: 'forecast', value: formatCurrency(revenueForecastSummary.nextForecast || 0) },
                                        { label: 'guest baseline', value: Number(paxDemandSummary.nextForecast || 0).toLocaleString() },
                                    ]}
                                    actionLabel="Open analytics"
                                    onAction={() => setActiveTab('analytics')}
                                />

                                <PasswordUpgradeBanner user={user} variant="compact" className="admin-security-task" />

                                <div className="hidden">
                                <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                                    <section className="admin-panel p-6 xl:col-span-2">
                                        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <p className="admin-kicker">Financial pulse</p>
                                                <h3 className="mt-1 text-lg font-black text-gray-950">Collected Revenue Trend</h3>
                                                <p className="mt-1 text-sm font-semibold text-gray-500">Verified collections across the selected historical window.</p>
                                            </div>
                                            {renderDashboardFilterControl(
                                                'dashboardRevenue',
                                                `Last ${analyticsFilters.trend_months} months`,
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
                                                </label>,
                                                'sm:grid-cols-1'
                                            )}
                                        </div>
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
                                            {renderDashboardFilterControl(
                                                'dashboardAlerts',
                                                alertFilters.severity === 'all' ? 'Severity' : alertFilters.severity,
                                                <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                    Alert severity
                                                    <select value={alertFilters.severity} onChange={(e) => setAlertFilters({ ...alertFilters, severity: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none">
                                                        <option value="all">All severities</option>
                                                        <option value="danger">Danger</option>
                                                        <option value="warning">Warning</option>
                                                        <option value="success">Healthy</option>
                                                    </select>
                                                </label>,
                                                'sm:grid-cols-1'
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            {visibleOperationalAlerts.map((alert) => (
                                                <div key={alert.label} className={`rounded-xl border p-4 ${alert.severity === 'danger' ? 'border-red-200 bg-red-50' : alert.severity === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-emerald-100 bg-emerald-50'}`}>
                                                    <div className="flex items-start justify-between gap-4">
                                                        <p className="text-sm font-black text-gray-900">{alert.label}</p>
                                                        <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-gray-950 shadow-sm">{alert.count}</span>
                                                    </div>
                                                    <button onClick={() => openOperationalAlertQueue(alert)} className="mt-3 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-900">Open queue</button>
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
                                            {renderDashboardFilterControl(
                                                'dashboardPayment',
                                                paymentRiskFilters.status === 'all' ? 'Risk filters' : paymentRiskFilters.status,
                                                <>
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
                                                </>
                                            )}
                                        </div>
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
                                            {renderDashboardFilterControl(
                                                'dashboardWorkload',
                                                workloadFilters.status === 'all' ? 'Workload filters' : workloadFilters.status,
                                                <>
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
                                                </>
                                            )}
                                        </div>
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
                                            {renderDashboardFilterControl(
                                                'dashboardPackages',
                                                `Top ${packageViewFilters.limit}`,
                                                <>
                                                    <select value={packageViewFilters.limit} onChange={(e) => setPackageViewFilters({ ...packageViewFilters, limit: e.target.value })} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-800 outline-none">
                                                        {PERFORMANCE_LIMIT_OPTIONS.map(value => <option key={value} value={value}>Top {value} packages</option>)}
                                                    </select>
                                                    <select value={packageViewFilters.sort} onChange={(e) => setPackageViewFilters({ ...packageViewFilters, sort: e.target.value })} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-800 outline-none">
                                                        <option value="revenue">Revenue</option>
                                                        <option value="bookings">Bookings</option>
                                                        <option value="name">Package name</option>
                                                    </select>
                                                </>
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            {visiblePackagePerformanceData.slice(0, 5).map((pkg, index) => (
                                                <div key={`${pkg.label || pkg.name || 'package'}-${index}`}>
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
                                            {renderDashboardFilterControl(
                                                'dashboardMenu',
                                                MENU_CATEGORY_OPTIONS.find(option => option.value === menuViewFilters.category)?.label || 'Dish type',
                                                <>
                                                    <select value={menuViewFilters.category} onChange={(e) => setMenuViewFilters({ ...menuViewFilters, category: e.target.value })} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-800 outline-none">
                                                        {MENU_CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                    </select>
                                                    <select value={menuViewFilters.sort} onChange={(e) => setMenuViewFilters({ ...menuViewFilters, sort: e.target.value })} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-800 outline-none">
                                                        <option value="selections">Selections</option>
                                                        <option value="pax">Guests served</option>
                                                        <option value="name">Dish name</option>
                                                    </select>
                                                </>
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            {visibleMenuPerformanceData.slice(0, 6).map((dish, index) => (
                                                <div key={`${dish.label || 'dish'}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
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
                                        <div className="mb-5 flex items-start justify-between gap-3">
                                            <div>
                                                <p className="admin-kicker">Demand intensity</p>
                                                <h3 className="mt-1 text-lg font-black text-gray-950">Peak Season Heatmap</h3>
                                                <p className="mt-1 text-sm font-semibold text-gray-500">Monthly event load for planning purchasing and staffing.</p>
                                            </div>
                                            {renderDashboardFilterControl(
                                                'dashboardPeakSeason',
                                                peakSeasonFilters.year === 'all' ? 'All years' : peakSeasonFilters.year,
                                                <>
                                                    <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                        Year
                                                        <select
                                                            value={peakSeasonFilters.year}
                                                            onChange={(event) => setPeakSeasonFilters(current => ({ ...current, year: event.target.value }))}
                                                            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none"
                                                        >
                                                            <option value="all">All years</option>
                                                            {HEATMAP_YEAR_OPTIONS.map(year => <option key={year} value={year}>{year}</option>)}
                                                        </select>
                                                    </label>
                                                    <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                        Booking status
                                                        <select
                                                            value={peakSeasonFilters.status}
                                                            onChange={(event) => setPeakSeasonFilters(current => ({ ...current, status: event.target.value }))}
                                                            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none"
                                                        >
                                                            <option value="">Pending, confirmed, completed</option>
                                                            <option value="Pending">Pending</option>
                                                            <option value="Confirmed">Confirmed</option>
                                                            <option value="Completed">Completed</option>
                                                        </select>
                                                    </label>
                                                    <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                                                        Event type
                                                        <select
                                                            value={peakSeasonFilters.event_type}
                                                            onChange={(event) => setPeakSeasonFilters(current => ({ ...current, event_type: event.target.value }))}
                                                            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black normal-case tracking-normal text-gray-800 outline-none"
                                                        >
                                                            <option value="">All event types</option>
                                                            {peakSeasonEventTypeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                        </select>
                                                    </label>
                                                </>,
                                                'sm:grid-cols-3'
                                            )}
                                        </div>
                                        <div className="mb-4 grid grid-cols-2 gap-3">
                                            <div className="rounded-xl border border-gray-100 bg-[#fffaf3] p-3">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-[#9f6500]">Events shown</p>
                                                <p className="mt-1 text-xl font-black text-gray-950">{peakSeasonTotalEvents}</p>
                                            </div>
                                            <div className="rounded-xl border border-gray-100 bg-white p-3">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-[#9f6500]">Busiest month</p>
                                                <p className="mt-1 text-xl font-black text-gray-950">{peakSeasonBusiestMonth?.month || 'None'}</p>
                                            </div>
                                        </div>
                                        <div className={`grid grid-cols-3 gap-3 text-center text-xs sm:grid-cols-4 ${peakSeasonLoading ? 'opacity-60' : ''}`}>
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
                                    <button
                                        type="button"
                                        onClick={() => fetchAnalytics()}
                                        disabled={analyticsLoading}
                                        className="admin-icon-action admin-refresh-action"
                                        aria-label={analyticsLoading ? 'Refreshing analytics' : 'Refresh analytics'}
                                        title={analyticsLoading ? 'Refreshing analytics' : 'Refresh analytics'}
                                    >
                                        <RefreshCw className={`h-5 w-5 ${analyticsLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
                                    </button>
                                </div>
                                <div className="p-5">
                                    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                        <div>
                                            <h4 className="text-lg font-black text-gray-950">Business Snapshot</h4>
                                            <p className="mt-1 text-sm font-semibold text-gray-500">High-signal metrics for revenue, demand, bookings, and collection health.</p>
                                        </div>
                                        {renderAnalyticsFilterControl('snapshot', businessSnapshot.label || 'Timeframe')}
                                    </div>
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
                                                <h3 className="mt-1 text-xl font-black text-gray-950">Revenue Forecast Using OLS Regression</h3>
                                                <p className="mt-2 text-sm font-semibold leading-6 text-gray-500">Projects cumulative verified revenue with a deterministic linear trend line.</p>
                                            </div>
                                            {renderAnalyticsFilterControl('revenueForecast', 'Forecast filters')}
                                        </div>
                                    </div>
                                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        {[
                                            ['Next forecast', formatCurrency(revenueForecastSummary.nextForecast || 0)],
                                            ['Last actual', formatCurrency(revenueForecastSummary.lastActual || 0)],
                                            ['Movement', `${revenueForecastSummary.changePercent || 0}% ${revenueForecastSummary.direction === 'upward' ? 'increase' : 'decrease'}`],
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
                                                <LineChart data={revenueForecastData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(value) => `PHP ${Math.round(value / 1000)}k`} />
                                                    <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                                                    <Line type="monotone" dataKey="cumulativeRevenue" stroke="#720101" strokeWidth={3} dot={{ r: 3 }} name="Cumulative actual" connectNulls={false} />
                                                    <Line type="monotone" dataKey="trendLine" stroke="#f0aa0b" strokeWidth={3} strokeDasharray="6 4" dot={{ r: 3 }} name="OLS trend" connectNulls />
                                                </LineChart>
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
                                            {renderAnalyticsFilterControl('paxForecast', `${analyticsFilters.pax_projection_period} demand`)}
                                        </div>
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
                                        {renderAnalyticsFilterControl('revenueTrend', `Last ${analyticsFilters.trend_months} months`)}
                                    </div>
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
                                        {renderAnalyticsFilterControl('paymentRisk', paymentRiskFilters.status === 'all' ? 'Risk filters' : paymentRiskFilters.status)}
                                    </div>
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
                                            {renderAnalyticsFilterControl('packagePerformance', `Top ${packageViewFilters.limit}`)}
                                        </div>
                                    </div>
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
                                            {renderAnalyticsFilterControl('menuPerformance', MENU_CATEGORY_OPTIONS.find(option => option.value === menuViewFilters.category)?.label || 'Dish type')}
                                        </div>
                                    </div>
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
                                        {activeConfigTab !== 'announcements' && (
                                            <AdminCommandStrip className="admin-catalog-action-strip">
                                                {activeConfigTab === 'packages' && <button type="button" onClick={() => openPackageDrawer()} className="staff-button-primary">Create package</button>}
                                                {activeConfigTab === 'eventTypes' && <button type="button" onClick={() => openEventTypeDrawer()} className="staff-button-primary">Create event type</button>}
                                                {activeConfigTab === 'menuItems' && <button type="button" onClick={openMenuItemModal} className="staff-button-primary">Add menu item</button>}
                                            </AdminCommandStrip>
                                        )}

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
                                                                <th className="px-6 py-4 text-left">Price / Head</th>
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
                                                                    <td className="px-6 py-4 text-left font-bold text-gray-900">PHP {Number(pkg.base_price_per_head || 0).toLocaleString()}</td>
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
                                                                <th className="px-6 py-4 text-left">Current Price</th>
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
                                                                        <td className="px-6 py-4 text-left font-bold text-gray-900">PHP {Number(item.costPerHead || 0).toLocaleString()}</td>
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
                            <Suspense fallback={<StaffSkeleton variant="panel" rows={6} label="Loading message desk" />}>
                                <StaffMessaging
                                    variant="admin-oversight"
                                    surfaceMode="admin-full"
                                    refreshToken={messageRefreshToken}
                                    targetConversationId={targetConversationId}
                                    onMetricsChange={setAdminMessageMetrics}
                                    onAdminContextNavigate={handleAdminContextNavigate}
                                />
                            </Suspense>
                        </div>
                    )}
                    {activeTab === 'settings' && (
                        <AdminPageSurface className="admin-settings-surface admin-settings-tab-surface">
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
                                    <PasswordStrengthField
                                        id="admin-profile-new-password"
                                        name="new_password"
                                        label="New password"
                                        value={profileForm.new_password}
                                        username={profileForm.username}
                                        email={profileForm.email}
                                        placeholder="Leave blank to keep current"
                                        labelClassName="admin-field-label"
                                        fieldClassName="auth-field auth-field-compact mt-2"
                                        error={profileErrors.new_password}
                                        onChange={(value) => updateProfileField('new_password', value)}
                                    />
                                    <label className="admin-field-label md:col-span-2">
                                        Confirm new password
                                        <input type="password" value={profileForm.new_password_confirmation} onChange={(event) => updateProfileField('new_password_confirmation', event.target.value)} placeholder="Repeat new password" className="admin-input mt-2" />
                                        {profileErrors.new_password_confirmation && <span className="admin-field-error">{profileErrors.new_password_confirmation}</span>}
                                        <PasswordMatchHint
                                            password={profileForm.new_password}
                                            confirmation={profileForm.new_password_confirmation}
                                            touched={Boolean(profileForm.new_password_confirmation)}
                                        />
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
                                                <div className="admin-availability-event-panel">
                                                    <div className="admin-availability-event-tools">
                                                        <label className="admin-availability-event-search">
                                                            <Search aria-hidden="true" />
                                                            <input
                                                                type="search"
                                                                value={availabilityEventSearch}
                                                                onChange={(event) => setAvailabilityEventSearch(event.target.value)}
                                                                placeholder="Search events"
                                                                aria-label="Search booked events"
                                                            />
                                                        </label>
                                                        <span className="admin-availability-event-count">{availabilityEventCountLabel}</span>
                                                    </div>
                                                    {filteredAvailabilityEvents.length === 0 ? (
                                                        <p className="admin-availability-event-empty">No booked events match this search.</p>
                                                    ) : (
                                                        <div className="admin-availability-event-list">
                                                            {visibleAvailabilityEvents.map((event) => {
                                                                const eventType = event.type || 'Event';
                                                                const eventTime = formatTime(event.time) || 'Time to confirm';

                                                                return (
                                                                    <button key={event.id} type="button" onClick={() => selectAvailabilityDate(event.date)} className={`admin-availability-event-row ${availabilityDate === event.date ? 'is-active' : ''}`}>
                                                                        <span className="admin-availability-event-date">
                                                                            <strong>{formatDate(event.date)}</strong>
                                                                            <em>{eventTime}</em>
                                                                        </span>
                                                                        <span className="admin-availability-event-main">
                                                                            <strong>{event.name}</strong>
                                                                            <em>{event.client || 'Client'} / {Number(event.pax || 0).toLocaleString()} guests</em>
                                                                        </span>
                                                                        <span className="admin-availability-event-tags">
                                                                            <span>{eventType}</span>
                                                                            {event.city && <span>{event.city}</span>}
                                                                        </span>
                                                                    </button>
                                                                );
                                                            })}
                                                            {hasMoreAvailabilityEvents && (
                                                                <button
                                                                    type="button"
                                                                    className="admin-availability-load-more"
                                                                    onClick={() => setAvailabilityEventVisibleLimit((limit) => limit + AVAILABILITY_EVENT_PAGE_SIZE)}
                                                                >
                                                                    Show more events
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
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
                            <AdminPageSurface className="admin-accounts-surface">
                                <AdminCommandStrip className="admin-account-overview-strip">
                                    <div className="admin-stat-strip admin-account-stat-strip">
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
                                    <div className="admin-account-actions">
                                        {accountSegment === 'staff' && (
                                            <button onClick={() => openEmpModal('add')} className="admin-button-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-black">
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                Add staff account
                                            </button>
                                        )}
                                    </div>
                                </AdminCommandStrip>

                                <div className="admin-account-workspace">
                                    {accountSegment === 'staff' && <>
                                        <AdminCommandStrip className="admin-account-filter-strip admin-account-filter-strip-staff">
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

                                        <AdminResponsiveTable className="admin-account-table-wrap">
                                            {empLoading ? (
                                                <StaffSkeleton rows={6} label="Loading staff accounts" />
                                            ) : employees.length === 0 ? (
                                                <div className="p-12 text-center text-gray-500">No employee accounts found.</div>
                                            ) : (
                                                <table className="staff-table">
                                                    <colgroup>
                                                        <col className="admin-account-staff-col-name" />
                                                        <col className="admin-account-staff-col-email" />
                                                        <col className="admin-account-staff-col-role" />
                                                        <col className="admin-account-staff-col-status" />
                                                        <col className="admin-account-staff-col-created" />
                                                        <col className="admin-account-staff-col-action" />
                                                    </colgroup>
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
                                                                <td className="px-6 py-4">
                                                                    <div className="flex items-center">
                                                                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-white flex items-center justify-center text-[#720101] font-bold">
                                                                            {(emp.full_name || emp.username).charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <div className="ml-4">
                                                                            <div className="text-sm font-bold text-gray-900">{emp.full_name || emp.username}</div>
                                                                            <div className="text-xs text-gray-500">@{emp.username}{emp.phone ? ` / ${emp.phone}` : ' / No phone'}</div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="text-sm text-gray-700">{emp.email || <span className="text-gray-400 italic">No email</span>}</div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${roleBadgeClass(emp.role)}`}>
                                                                        {emp.role}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${emp.account_status === 'deactivated' ? 'bg-red-50 text-red-700 border-red-100' : emp.must_change_password ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-green-100 text-green-800 border-green-200'}`}>
                                                                        {emp.account_status === 'deactivated' ? 'Deactivated' : emp.must_change_password ? 'Password change needed' : 'Active'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="text-sm text-gray-500">{formatDate(emp.created_at)}</div>
                                                                </td>
                                                                <td className="account-action-cell px-6 py-4 text-right text-sm font-medium">
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
                                    </>}

                                    {accountSegment === 'customers' && <>
                                        <AdminCommandStrip className="admin-account-filter-strip admin-account-filter-strip-customers">
                                            <div className="admin-account-inline-tabs" aria-label="Customer account status filter">
                                                {[
                                                    { value: 'active', label: 'Active' },
                                                    { value: 'deactivated', label: 'Deactivated' },
                                                    { value: 'all', label: 'All' },
                                                ].map(option => (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => setCustomerStatusFilter(option.value)}
                                                        className={`admin-account-inline-tab ${customerStatusFilter === option.value ? 'is-active' : ''}`}
                                                    >
                                                        {option.label}
                                                    </button>
                                                ))}
                                            </div>
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
                                            <span className="admin-account-count-chip">{customers.length} shown</span>
                                        </AdminCommandStrip>

                                        <AdminResponsiveTable className="admin-account-table-wrap">
                                            {customerLoading ? (
                                                <StaffSkeleton rows={6} label="Loading customer accounts" />
                                            ) : customers.length === 0 ? (
                                                <div className="p-12 text-center text-gray-500">No customer accounts found.</div>
                                            ) : (
                                                <table className="staff-table">
                                                    <colgroup>
                                                        <col className="admin-account-customer-col-name" />
                                                        <col className="admin-account-customer-col-contact" />
                                                        <col className="admin-account-customer-col-bookings" />
                                                        <col className="admin-account-customer-col-created" />
                                                        <col className="admin-account-customer-col-action" />
                                                    </colgroup>
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
                                                                <td className="px-6 py-4">
                                                                    <div className="flex items-center">
                                                                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 font-bold">
                                                                            {(customer.username || customer.full_name || 'C').charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <div className="ml-4">
                                                                            <div className="text-sm font-bold text-gray-900">{customer.username || customer.full_name || 'Customer'}</div>
                                                                            {customerStatusFilter === 'all' && (
                                                                                <div className="mt-1 flex flex-wrap gap-1">
                                                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${customer.account_status === 'deactivated' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                                                                        {customer.account_status === 'deactivated' ? 'Deactivated' : 'Active'}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="text-sm text-gray-700">
                                                                        {displayEmail(customer.email, <span className="text-gray-400 italic">No email on file</span>)}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500 mt-1">{customer.phone || 'No phone'}</div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="text-sm font-bold text-gray-900">{customer.bookings_count || 0}</div>
                                                                    <div className="text-xs text-gray-500">Latest: {formatDate(customer.bookings_max_event_date)}</div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="text-sm text-gray-500">{formatDate(customer.created_at)}</div>
                                                                </td>
                                                                <td className="account-action-cell px-6 py-4 text-right text-sm font-medium">
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
                                    </>}
                                </div>
                            </AdminPageSurface>
                        )
                    }
                    {
                        activeTab === 'bookings-intake' && (
                            <AdminPageSurface>
                                <StaffMetricStrip
                                    className="admin-booking-command"
                                    metrics={[
                                        { label: 'Current', value: bookingStats.total },
                                        { label: 'Pending', value: bookingStats.pending, tone: bookingStats.pending > 0 ? 'attention' : 'neutral' },
                                        { label: 'Active', value: bookingStats.active, tone: 'success' },
                                        { label: 'Expected', value: formatCurrency(bookingStats.value) },
                                    ]}
                                    actions={(
                                        <StaffPrimaryAction onClick={() => setAssistedBookingOpen(true)}>
                                            Create booking
                                        </StaffPrimaryAction>
                                    )}
                                />

                                <StaffInlineInsight
                                    eyebrow="Decision support"
                                    title={`${dominantBookingCategory} leads verified volume`}
                                    signals={bookingDecisionSignals}
                                    onAction={() => setBookingAnalysisOpen(true)}
                                />

                                <StaffCommandBar>
                                    <div className="relative min-w-0 flex-1">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                                        <input
                                            type="search"
                                            value={bookingSearch}
                                            onChange={(e) => setBookingSearch(e.target.value)}
                                            placeholder="Search booking ref, client, email, phone, event type..."
                                            className="staff-control w-full pl-10"
                                        />
                                    </div>
                                    <div className="staff-v2-segmented">
                                        {['All', 'Pending', 'Active'].map((filter) => (
                                            <button
                                                key={filter}
                                                type="button"
                                                onClick={() => setBookingStatusFilter(filter)}
                                                className={bookingStatusFilter === filter ? 'is-active' : ''}
                                            >
                                                {filter}
                                            </button>
                                        ))}
                                    </div>
                                    <select
                                        value={bookingSort}
                                        onChange={(e) => setBookingSort(e.target.value)}
                                        className="staff-control"
                                    >
                                        <option value="latest">Latest to Oldest</option>
                                        <option value="oldest">Oldest to Latest</option>
                                        <option value="az">A-Z</option>
                                        <option value="za">Z-A</option>
                                    </select>
                                    <select
                                        value={bookingSourceFilter}
                                        onChange={(e) => setBookingSourceFilter(e.target.value)}
                                        className="staff-control"
                                    >
                                        <option value="all">All sources</option>
                                        <option value="customer">Customer submitted</option>
                                        <option value="assisted">Any assisted</option>
                                        <option value="marketing_assisted">Marketing assisted</option>
                                        <option value="admin_assisted">Admin assisted</option>
                                    </select>
                                </StaffCommandBar>

                                <StaffWorkTable className="admin-bookings-table-wrap">
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
                                                    <th>Booking contact</th>
                                                    <th>Event</th>
                                                    <th className="text-left">Total</th>
                                                    <th className="text-center">Status</th>
                                                    <th className="text-center">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginatedBookings.items.map(booking => {
                                                    const status = normalizeStatus(booking.status);
                                                    const statusMeta = bookingStatusMeta[status] || { tone: 'neutral', label: booking.status || 'Unassigned' };
                                                    const openBookingDetails = () => setEventDetailsModal({ open: true, data: booking });
                                                    return (
                                                    <tr
                                                        key={booking.id}
                                                        className="cursor-pointer transition-colors"
                                                        tabIndex={0}
                                                        aria-label={`Open details for ${formatBookingRef(booking.id)}`}
                                                        onClick={openBookingDetails}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter' || event.key === ' ') {
                                                                event.preventDefault();
                                                                openBookingDetails();
                                                            }
                                                        }}
                                                    >
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
                                                            <div className="admin-booking-value">{bookingContactName(booking)}</div>
                                                            <div className="admin-booking-muted admin-booking-truncate">{bookingContactEmail(booking) || 'No email'}</div>
                                                            <div className="admin-booking-muted">{bookingContactPhone(booking) || 'No phone'}</div>
                                                            {hasDifferentBookingContact(booking) && (
                                                                <div className="admin-booking-muted admin-booking-truncate">Customer account: {customerAccountName(booking)}</div>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <div className="admin-booking-value admin-booking-truncate">{eventDisplayName(booking)}</div>
                                                            <div className="admin-booking-date">{formatDate(booking.event_date)} / {formatTime(booking.event_time)}</div>
                                                            <div className="admin-booking-muted">{booking.event_type || 'Event'} / {booking.pax} guests</div>
                                                        </td>
                                                        <td className="text-left">
                                                            <div className="admin-booking-money">{formatCurrency(getBookingTotal(booking))}</div>
                                                            {Number(booking.discount_value || 0) > 0 && (
                                                                <div className="admin-booking-discount">
                                                                    Discounted
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="text-center">
                                                            <StaffStatusChip tone={statusMeta.tone} className="admin-booking-status">
                                                                {statusMeta.label}
                                                            </StaffStatusChip>
                                                        </td>
                                                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                                            <div className="admin-booking-actions">
                                                                <button
                                                                    type="button"
                                                                    onClick={openBookingDetails}
                                                                    className="admin-booking-action admin-booking-action-review"
                                                                >
                                                                    Review
                                                                </button>
                                                                {status === 'pending' && (
                                                                    <button
                                                                        type="button"
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
                                                                    type="button"
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
                                </StaffWorkTable>
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
                                                <th>Booking contact</th>
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
                                                    <td>
                                                        <div className="font-bold text-slate-800">{bookingContactName(booking)}</div>
                                                        {hasDifferentBookingContact(booking) && (
                                                            <div className="text-xs font-semibold text-slate-500">Account: {customerAccountName(booking)}</div>
                                                        )}
                                                    </td>
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
                                </AdminCommandStrip>

                                {activeFinanceSegment === 'payments' && <div className="admin-surface-grid overflow-hidden">
                                    <div className="flex flex-wrap items-center justify-end gap-2 border-b border-gray-100 px-4 py-3">
                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                            {[
                                                { label: 'Open', value: visibleFinancePaymentRows.length },
                                                { label: 'Review', value: financePaymentQueueStats.review },
                                                { label: 'Overdue', value: financePaymentQueueStats.overdue },
                                                { label: 'Amount', value: formatCurrency(financePaymentQueueStats.amount) },
                                            ].map((stat) => (
                                                <span key={stat.label} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#720101]/10 bg-[#fbf8f2] px-3 text-xs font-black text-slate-500">
                                                    <strong className="text-sm text-gray-950">{stat.value}</strong>
                                                    <em className="not-italic uppercase tracking-wider">{stat.label}</em>
                                                </span>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => { bustAdminCache(ADMIN_BOOKINGS_URL); fetchBookings(); }}
                                                className="admin-icon-action admin-refresh-action"
                                                aria-label="Refresh payments"
                                                title="Refresh payments"
                                            >
                                                <RefreshCw className="h-5 w-5" aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>

                                    <StaffCommandBar>
                                        <div className="relative min-w-0 flex-1">
                                            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                                            <input
                                                value={financePaymentSearch}
                                                onChange={(event) => setFinancePaymentSearch(event.target.value)}
                                                placeholder="Search booking, client, event, payment type, or status"
                                                className="staff-control w-full pl-12"
                                            />
                                        </div>
                                        <select
                                            value={financePaymentFilter}
                                            onChange={(event) => setFinancePaymentFilter(event.target.value)}
                                            className="staff-control"
                                        >
                                            <option value="all">All payment work</option>
                                            <option value="needs-review">Needs review</option>
                                            <option value="overdue">Overdue</option>
                                            <option value="exception">Exceptions</option>
                                        </select>
                                        <select
                                            value={financePaymentSort}
                                            onChange={(event) => setFinancePaymentSort(event.target.value)}
                                            className="staff-control"
                                        >
                                            <option value="priority">Priority first</option>
                                            <option value="due">Due date</option>
                                            <option value="amount">Highest amount</option>
                                            <option value="newest">Newest booking</option>
                                        </select>
                                    </StaffCommandBar>

                                    {bookingsLoading ? (
                                        <StaffSkeleton rows={5} label="Loading payment work" />
                                    ) : visibleFinancePaymentRows.length === 0 ? (
                                        <div className="flex items-center justify-center gap-3 px-5 py-6 text-center">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                                                <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                            <div className="text-left">
                                                <h3 className="text-base font-black text-gray-900">{financePaymentRows.length === 0 ? 'No payment items waiting' : 'No payment items match these filters'}</h3>
                                                <p className="mt-1 text-sm text-gray-500">{financePaymentRows.length === 0 ? 'Pending proofs and overdue terms will appear here.' : 'Try a broader search, status filter, or sort order.'}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <AdminResponsiveTable>
                                                <table className="staff-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Booking</th>
                                                            <th>Client</th>
                                                            <th>Payment</th>
                                                            <th className="text-left">Amount</th>
                                                            <th>Status</th>
                                                            <th className="text-right">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {paginatedFinancePaymentRows.items.map(({ booking, payment, statusLabel, queueLabel }) => (
                                                            <tr key={`${booking.id}-${payment.id}`} className="transition-colors hover:bg-[#fffaf3]">
                                                                <td>
                                                                    <div className="font-black text-gray-950">{formatBookingRef(booking.id)}</div>
                                                                    <div className="text-xs font-semibold text-slate-500">{eventDisplayName(booking)}</div>
                                                                </td>
                                                                <td>
                                                                    <div className="font-bold text-gray-900">{booking.client_full_name || booking.client_name || booking.username || 'Unnamed client'}</div>
                                                                    <div className="text-xs text-gray-500">{displayEmail(booking.client_email, booking.client_phone || 'No contact recorded')}</div>
                                                                </td>
                                                                <td>
                                                                    <div className="font-bold text-gray-900">{paymentLabel(payment.payment_type)}</div>
                                                                    <div className="text-xs font-semibold text-slate-500">Due {formatDate(payment.due_date)}</div>
                                                                </td>
                                                                <td className="text-left font-black text-gray-950">{formatCurrency(payment.amount)}</td>
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
                                            <PaginationControls pageInfo={paginatedFinancePaymentRows} onPageChange={setFinancePaymentPage} />
                                        </>
                                    )}
                                </div>}

                                {activeFinanceSegment === 'refunds' && <div className="admin-surface-grid overflow-hidden">
                                    <div className="flex flex-wrap items-center justify-end gap-2 border-b border-gray-100 px-4 py-3">
                                        <div className="flex flex-wrap items-center justify-end gap-2">
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
                                                className="admin-icon-action admin-refresh-action"
                                                aria-label="Refresh refunds"
                                                title="Refresh refunds"
                                            >
                                                <RefreshCw className="h-5 w-5" aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>

                                    <StaffCommandBar>
                                        <div className="relative min-w-0 flex-1">
                                            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                                            <input
                                                value={refundSearch}
                                                onChange={(event) => setRefundSearch(event.target.value)}
                                                placeholder="Search booking, client, email, event date, or provider reference"
                                                className="staff-control w-full pl-12"
                                            />
                                        </div>
                                        <select
                                            value={refundStatusFilter}
                                            onChange={(event) => setRefundStatusFilter(event.target.value)}
                                            className="staff-control"
                                        >
                                            <option value="all">All refund cases</option>
                                            <option value="needs_review">Needs review</option>
                                            <option value="retry">Provider retry</option>
                                            <option value="processed">Processed</option>
                                            <option value="refunded">Refunded</option>
                                        </select>
                                        <select
                                            value={refundSort}
                                            onChange={(event) => setRefundSort(event.target.value)}
                                            className="staff-control"
                                        >
                                            <option value="newest">Newest booking</option>
                                            <option value="event_date">Event date</option>
                                            <option value="amount">Highest paid</option>
                                        </select>
                                    </StaffCommandBar>

                                    {refundLoading ? (
                                        <StaffSkeleton rows={6} label="Loading refund queue" />
                                    ) : visibleRefundRows.length === 0 ? (
                                        <div className="flex items-center justify-center gap-3 px-5 py-6 text-center">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                                                <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                            <div className="text-left">
                                                <h3 className="text-base font-black text-gray-900">{refundQueue.length === 0 ? 'No refunds waiting' : 'No refund cases match these filters'}</h3>
                                                <p className="mt-1 text-sm text-gray-500">{refundQueue.length === 0 ? 'Cancelled bookings with verified payments will appear here.' : 'Try a broader search or refund status filter.'}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <AdminResponsiveTable>
                                                <table className="staff-table">
                                                    <thead>
                                                        <tr>
                                                            <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Booking</th>
                                                            <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Client</th>
                                                            <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Event Date</th>
                                                            <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Paid</th>
                                                            <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Refund</th>
                                                            <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {paginatedRefundRows.items.map((item) => {
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
                                                                        <div className="text-xs text-gray-500">{displayEmail(item.client_email)}</div>
                                                                    </td>
                                                                    <td className="px-6 py-4 text-sm font-bold text-gray-700">{formatDate(item.event_date)}</td>
                                                                    <td className="px-6 py-4 text-left text-sm font-black text-gray-900">{formatCurrency(totalPaid)}</td>
                                                                    <td className="px-6 py-4 text-left">
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
                                            <PaginationControls pageInfo={paginatedRefundRows} onPageChange={setRefundPage} />
                                        </>
                                    )}
                                </div>}
                            </AdminPageSurface>
                        )
                    }
                    {
                        activeTab === 'system-audit' && (
                            <AdminPageSurface>
                                <AdminCommandStrip>
                                    <div className="admin-audit-toolbar">
                                        <div className="relative flex-1">
                                            <svg className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                            <input value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} placeholder="Search actor, target, booking, customer, field, or workspace..." className="w-full border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm font-medium outline-none focus:border-[#720101] focus:ring-2 focus:ring-[#720101]/10" />
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
                                        <button
                                            type="button"
                                            onClick={() => { bustAdminCache('/api/admin/audits?per_page=25'); fetchAudits(); }}
                                            className="admin-icon-action admin-refresh-action"
                                            aria-label="Refresh logs"
                                            title="Refresh logs"
                                        >
                                            <RefreshCw className="h-5 w-5" aria-hidden="true" />
                                        </button>
                                    </div>
                                </AdminCommandStrip>

                                <div className="admin-surface-grid overflow-hidden">
                                    {auditLoading ? (
                                        <StaffSkeleton rows={7} label="Loading activity log" />
                                    ) : visibleAudits.length === 0 ? (
                                        <StaffEmptyState title="No activity matches these filters" message="Adjust the role, workspace, result, or activity type to review more staff activity." />
                                    ) : (
                                        <AdminResponsiveTable className="admin-audit-table-wrap">
                                            <table className="staff-table admin-audit-table">
                                                <colgroup>
                                                    <col className="admin-audit-col-time" />
                                                    <col className="admin-audit-col-actor" />
                                                    <col className="admin-audit-col-action" />
                                                    <col className="admin-audit-col-target" />
                                                    <col className="admin-audit-col-where" />
                                                    <col className="admin-audit-col-fields" />
                                                    <col className="admin-audit-col-result" />
                                                </colgroup>
                                                <thead>
                                                    <tr>
                                                        <th>Time</th>
                                                        <th>Actor</th>
                                                        <th>Action</th>
                                                        <th>Target</th>
                                                        <th>Where</th>
                                                        <th>Changed fields</th>
                                                        <th>Result</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {paginatedAudits.items.map((audit) => {
                                                        const result = getAuditResult(audit);
                                                        const metadata = getAuditMetadata(audit);
                                                        const changedFields = getAuditChangedFields(audit);
                                                        const target = getAuditTargetDisplay(audit);
                                                        const expanded = expandedAuditId === audit.id;

                                                        return (
                                                            <React.Fragment key={audit.id}>
                                                                <tr
                                                                    className={`admin-audit-row ${expanded ? 'is-expanded' : ''}`}
                                                                    tabIndex={0}
                                                                    role="button"
                                                                    aria-expanded={expanded}
                                                                    onClick={() => setExpandedAuditId(expanded ? null : audit.id)}
                                                                    onKeyDown={(event) => {
                                                                        if (event.key === 'Enter' || event.key === ' ') {
                                                                            event.preventDefault();
                                                                            setExpandedAuditId(expanded ? null : audit.id);
                                                                        }
                                                                    }}
                                                                >
                                                                    <td className="admin-audit-time">{formatDateTime(audit.created_at)}</td>
                                                                    <td className="admin-audit-actor">
                                                                        <div className="admin-audit-primary">{audit.username || 'Unknown'}</div>
                                                                        <div className="admin-audit-secondary">{audit.role || 'Staff'}</div>
                                                                    </td>
                                                                    <td className="admin-audit-action">
                                                                        <div className="admin-audit-action-inner">
                                                                            <div className="admin-audit-primary">{audit.action || 'Reviewed workspace activity'}</div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="admin-audit-target">
                                                                        <div className="admin-audit-primary">{target.primary}</div>
                                                                        <div className="admin-audit-secondary admin-audit-uppercase">{target.secondary}</div>
                                                                        {metadata.booking_contact_name && (
                                                                            <div className="admin-audit-muted">Booking contact: {metadata.booking_contact_name}</div>
                                                                        )}
                                                                        {metadata.customer_account_name && metadata.customer_account_name !== metadata.booking_contact_name && (
                                                                            <div className="admin-audit-muted">Customer account: {metadata.customer_account_name}</div>
                                                                        )}
                                                                    </td>
                                                                    <td className="admin-audit-where">
                                                                        <span className="admin-audit-pill">{getAuditWorkspace(audit)}</span>
                                                                    </td>
                                                                    <td className="admin-audit-fields">
                                                                        <span className={changedFields.length > 0 ? 'admin-audit-change-summary' : 'admin-audit-context-only'}>
                                                                            {getAuditChangeSummary(audit)}
                                                                        </span>
                                                                    </td>
                                                                    <td className="admin-audit-result">
                                                                        <span className={`admin-audit-result-pill ${result.className}`}>
                                                                            {result.label}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                                {expanded && (
                                                                    <tr className="admin-audit-expanded-row">
                                                                        <td colSpan="7">
                                                                            <div className="admin-audit-detail-panel">
                                                                                <div className="admin-audit-detail-list">
                                                                                    {getAuditExtraDetailRows(audit).map(([label, value]) => (
                                                                                        <div key={label} className="admin-audit-detail-item">
                                                                                            <span>{label}</span>
                                                                                            <strong>{String(value)}</strong>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </AdminResponsiveTable>
                                    )}
                                </div>
                                {!auditLoading && visibleAudits.length > 0 && (
                                    <PaginationControls pageInfo={paginatedAudits} onPageChange={setAuditPage} perPage={12} />
                                )}
                            </AdminPageSurface>
                        )
                    }
                </div>

            {/* Employee Add/Edit Modal */}
            {
                empModal.open && (
                    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
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
                                        <PasswordStrengthField
                                            id="account-modal-password"
                                            name="password"
                                            label="New password"
                                            value={empForm.password}
                                            username={empForm.username}
                                            email={empForm.email}
                                            placeholder="Leave blank to keep current"
                                            labelClassName="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide"
                                            fieldClassName="auth-field auth-field-compact"
                                            error={empFormErrors.password}
                                            onChange={(value) => setEmpForm({ ...empForm, password: value })}
                                        />
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
                    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
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
                    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
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
                                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">Amount</th>
                                                    <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-500">Due Date</th>
                                                    <th className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-500">Status</th>
                                                    <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(eventDetailsModal.data?.payments || []).map(payment => (
                                                    <tr key={payment.id}>
                                                        <td className="px-4 py-3 font-semibold text-gray-900">{paymentLabel(payment.payment_type)}</td>
                                                        <td className="px-4 py-3 text-left font-bold text-gray-900">{formatCurrency(payment.amount)}</td>
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
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[130] p-4">
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
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
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

            {bookingAnalysisOpen && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm">
                    <div className="admin-booking-analysis-modal">
                        <header className="admin-booking-analysis-head">
                            <div>
                                <p className="admin-kicker">Booking decision support</p>
                                <h3>Current booking queue analysis</h3>
                                <p>Quick context for approvals, discounts, and operational capacity.</p>
                            </div>
                            <button type="button" onClick={() => setBookingAnalysisOpen(false)} className="admin-mini-button inline-flex items-center gap-2">
                                <X className="h-4 w-4" />
                                Close
                            </button>
                        </header>
                        <div className="admin-booking-analysis-body">
                            <aside className="admin-booking-analysis-numbers">
                                <p className="admin-kicker">Supporting numbers</p>
                                <dl>
                                    {bookingDecisionSupportNumbers.map(([label, value]) => (
                                        <div key={label}>
                                            <dt>{label}</dt>
                                            <dd>{value}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </aside>
                            <div className="admin-booking-analysis-insights">
                                {[
                                    ['Signal', bookingSalesInsight],
                                    ['Revenue context', bookingRevenueInsight],
                                    ['Capacity context', bookingGuestInsight],
                                ].map(([label, insight]) => (
                                    <section key={label} className="admin-booking-analysis-section">
                                        <p className="admin-kicker">{label}</p>
                                        <h4>{insight.headline}</h4>
                                        <p>{readableInsightText(insight.meaning)}</p>
                                        {insight.recommended_action && (
                                            <div>
                                                <span>Recommended action</span>
                                                <strong>{readableInsightText(insight.recommended_action)}</strong>
                                            </div>
                                        )}
                                    </section>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {expandedAnalyticsPanel && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
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
