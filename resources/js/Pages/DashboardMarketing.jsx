import React, { Suspense, lazy, useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { router } from '@inertiajs/react';
import FlashToast from '../Components/common/FlashToast';
import ConfirmModal from '../Components/common/ConfirmModal';
import PromptModal from '../Components/common/PromptModal';
import StaffPagination from '../Components/staff/StaffPagination';
import StaffWorkspaceLayout from '../Layouts/StaffWorkspaceLayout';
import StaffPageHeader from '../Components/staff/StaffPageHeader';
import StaffEmptyState from '../Components/staff/StaffEmptyState';
import EventHistoryPanel from '../Components/staff/EventHistoryPanel';
import EventDetailDrawer from '../Components/staff/EventDetailDrawer';
import NextActionPanel from '../Components/staff/NextActionPanel';
import RoleSettingsPanel from '../Components/staff/RoleSettingsPanel';
import StaffStatusBadge from '../Components/staff/StaffStatusBadge';
import StaffSkeleton, { StaffWorkspaceSkeleton } from '../Components/staff/StaffSkeleton';
import { StaffDecisionBrief, StaffOpsListRow, StaffOpsMetricStrip, StaffOpsPanel, StaffOpsSearchBar } from '../Components/staff/StaffOpsUI';
import { bookingStatusLabel, reviewStatusLabel } from '../utils/statusLabels';
import useSmartRefresh from '../hooks/useSmartRefresh';
import useStaffWorkspaceState from '../hooks/useStaffWorkspaceState';
import AssistedBookingWizard from '../Components/marketing/AssistedBookingWizard';
import { MARKETING_WORKSPACE_NAV_GROUPS, withNavCounts } from '../utils/staffWorkspaceNav';
import {
    formatDate,
    formatMoney,
    formatTime,
    getBookingValue,
    getDaysInMonth,
    getFirstDayOfMonth,
    titleCase,
} from '../utils/dashboardUtils';
import { bookingContactEmail, bookingContactName, bookingContactPhone, customerAccountEmail, customerAccountName, customerAccountPhone } from '../utils/customerIdentity';

const StaffMessaging = lazy(() => import('../Components/common/StaffMessaging'));
const AnnouncementManager = lazy(() => import('../Components/content/AnnouncementManager'));
const PreparationBoard = lazy(() => import('../Components/operations/PreparationBoard'));
const FoodTastingQueue = lazy(() => import('../Components/operations/FoodTastingQueue'));
import { getListData } from '../utils/apiResponses';
import csrfFetch from '../utils/csrf';
import { bustSmartCache, fetchSmartResource, getUserScopedCacheKey, readSmartCache } from '../utils/smartResource';
import { operationalChannelsForUser } from '../utils/liveChannels';

const PACKAGE_CATEGORY_OPTIONS = [
    { value: 'premium', label: 'Weddings & Debuts' },
    { value: 'birthday', label: 'Birthdays' },
    { value: 'standard', label: 'Standard Events' },
];

const SECURITY_OPTIONS = [
    { value: 'contingency', label: '10% Contingency' },
    { value: 'cash_bond', label: 'Php 1,500 Cash Bond' },
];

const MARKETING_BOOKINGS_URL = '/api/marketing/bookings';
const MARKETING_WORKSPACE_TABS = ['today', 'bookings', 'leads', 'tastings', 'calendar', 'handoff', 'messages', 'public-content', 'availability', 'settings', 'history'];
const MARKETING_TAB_ALIASES = {
    intake: 'bookings',
    inquiries: 'bookings',
    tasting: 'tastings',
    food: 'tastings',
    preparation: 'handoff',
    content: 'public-content',
    settings: 'settings',
    documents: 'calendar',
};
const BOOKING_BACKED_TABS = ['calendar', 'bookings'];
const ACTIVE_CALENDAR_STATUSES = ['pending', 'confirmed'];
const BOOKING_WORK_VIEWS = [
    { id: 'needs-action', label: 'Needs action' },
    { id: 'claim', label: 'Available to claim' },
    { id: 'mine', label: 'My bookings' },
    { id: 'transfers', label: 'Transfers to me' },
    { id: 'waiting', label: 'Waiting on customer' },
    { id: 'all', label: 'All active' },
];

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

const linesToText = (value) => Array.isArray(value) ? value.join('\n') : (value || '');
const getCategoryLabel = (value) => PACKAGE_CATEGORY_OPTIONS.find(option => option.value === value)?.label || value || 'Standard Events';
const getSecurityLabel = (value) => SECURITY_OPTIONS.find(option => option.value === value)?.label || value || 'Cash Bond';
const eventDisplayName = (booking) => booking?.event_display_name || booking?.event_name || booking?.event_type || booking?.package_name || (booking?.id ? `Booking #${booking.id}` : 'Eloquente event');
const isActiveCalendarBooking = (booking) => (
    Boolean(booking?.event_date) && ACTIVE_CALENDAR_STATUSES.includes(String(booking.status || '').toLowerCase())
);
const normalizeCalendarEvent = (event) => ({
    id: event.id,
    event_date: event.date,
    event_time: event.time,
    event_name: event.name,
    event_type: event.type || event.name,
    client_full_name: event.client,
    pax: event.pax,
    status: event.status === 'Reserved' ? 'Confirmed' : event.status,
    venue_city: event.city,
    owner: event.owner,
    assigned_to: event.assigned_to,
    owner_id: event.owner_id ?? event.assigned_to,
    owner_name: event.owner_name ?? event.owner,
    assigned_name: event.owner_name ?? event.owner,
    can_claim: event.can_claim,
    can_edit: event.can_edit,
    total_cost: event.total_cost,
    totalCost: event.totalCost,
    budget: event.budget,
    selected_menu: event.selected_menu,
    payment_state: event.payment_state,
    preparation_state: event.preparation_state,
});
const formatMonthLabel = (value) => {
    if (!value) return 'Selected month';
    const [year, month] = value.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};
const shiftMonthValue = (value, offset) => {
    const [year, month] = value.split('-').map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const DashboardMarketing = () => {
    const { user } = useAuth();
    const toast = useToast();
    const marketingWorkspacePrefs = user?.profile_preferences?.staff_workspace?.marketing || {};
    const marketingDefaultTab = MARKETING_WORKSPACE_TABS.includes(marketingWorkspacePrefs.default_tab) ? marketingWorkspacePrefs.default_tab : 'today';
    const [bookings, setBookings] = useState([]);
    const [bookingsScope, setBookingsScope] = useState(null);
    const [calendarBookings, setCalendarBookings] = useState([]);
    const [calendarLoading, setCalendarLoading] = useState(false);
    const [calendarView, setCalendarView] = useState(marketingWorkspacePrefs.calendar_view || 'month');
    const [calendarFilters, setCalendarFilters] = useState({ search: '', status: '', event_type: '', city: '' });
    const bookingRequestRef = useRef(0);
    const calendarRequestRef = useRef(0);
    const [marketingRemoteSummary, setMarketingRemoteSummary] = useState(null);
    const [loading, setLoading] = useState(() => !readSmartCache(getUserScopedCacheKey(user, 'marketing:bookings:page')));
    const [activeTab, setActiveTab] = useStaffWorkspaceState({
        storageKey: 'ecs:staff-workspace:marketing',
        defaultTab: marketingDefaultTab,
        allowedTabs: MARKETING_WORKSPACE_TABS,
        tabAliases: MARKETING_TAB_ALIASES,
    });
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [menuItems, setMenuItems] = useState([]);
    const [packages, setPackages] = useState([]);
    const [eventTypes, setEventTypes] = useState([]);
    const [eventTypeForm, setEventTypeForm] = useState(emptyEventTypeForm());
    const [editingEventTypeId, setEditingEventTypeId] = useState(null);
    const [activeMenuCategory, setActiveMenuCategory] = useState('starter');
    const [activeConfigTab, setActiveConfigTab] = useState('packages');
    const [catalogDrawer, setCatalogDrawer] = useState(null);
    const [packageForm, setPackageForm] = useState(emptyPackageForm());
    const [editingPackageId, setEditingPackageId] = useState(null);
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [updatingBookingIds, setUpdatingBookingIds] = useState({});
    const [claimingBookingIds, setClaimingBookingIds] = useState({});
    const [inquirySearch, setInquirySearch] = useState('');
    const [inquiryStatusFilter, setInquiryStatusFilter] = useState('all');
    const [bookingReviewView, setBookingReviewView] = useState('needs-action');
    const [inquirySort, setInquirySort] = useState('newest');
    const [inquiryDateFrom, setInquiryDateFrom] = useState('');
    const [inquiryDateTo, setInquiryDateTo] = useState('');
    const [inquiryPage, setInquiryPage] = useState(1);
    const [inquiryPerPage, setInquiryPerPage] = useState(25);
    const [availabilityMonth, setAvailabilityMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [availabilityOverrides, setAvailabilityOverrides] = useState([]);
    const [availabilityDate, setAvailabilityDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [availabilityForm, setAvailabilityForm] = useState({ is_locked: false, remaining_events: '', remaining_pax: '', note: '' });
    const [availabilityLoading, setAvailabilityLoading] = useState(false);
    const [availabilitySaving, setAvailabilitySaving] = useState(false);
    const [clarificationPrompt, setClarificationPrompt] = useState({ isOpen: false, bookingId: null });
    const [deleteEventTypeConfirm, setDeleteEventTypeConfirm] = useState({ isOpen: false, eventType: null });
    const [leadData, setLeadData] = useState({ data: [], meta: { current_page: 1, per_page: 15, total: 0, last_page: 1 }, summary: { open: 0, new: 0, resolved: 0 } });
    const [leadLoading, setLeadLoading] = useState(false);
    const [leadFilters, setLeadFilters] = useState({ search: '', status: '', concern_type: '', date_from: '', date_to: '', page: 1, per_page: 15 });
    const [selectedLead, setSelectedLead] = useState(null);
    const [leadSaving, setLeadSaving] = useState(false);
    const [feedbackSummary, setFeedbackSummary] = useState({ followUps: 0, testimonials: 0, recent: [] });
    const [bookingTransferStaff, setBookingTransferStaff] = useState([]);
    const [showBookingTransfer, setShowBookingTransfer] = useState(false);
    const [showAssistedBooking, setShowAssistedBooking] = useState(false);

    // PDF Export State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportMode, setExportMode] = useState('month'); // 'month' or 'range'
    const [exportMonthStart, setExportMonthStart] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [exportMonthEnd, setExportMonthEnd] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [exportDateStart, setExportDateStart] = useState('');
    const [exportDateEnd, setExportDateEnd] = useState('');
    const selectedMonthKey = useMemo(() => (
        `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`
    ), [selectedMonth]);
    const smartCacheKey = (resourceKey) => getUserScopedCacheKey(user, resourceKey);
    const liveChannels = useMemo(() => operationalChannelsForUser(user), [user?.id, user?.role]);

    useEffect(() => {
        setInquiryPage(1);
    }, [inquirySearch, inquiryStatusFilter, bookingReviewView, inquirySort, inquiryDateFrom, inquiryDateTo, inquiryPerPage]);

    useEffect(() => {
        if (activeTab === 'today') {
            fetchMarketingSummary();
            fetchBookings({ scope: 'page' });
            const backgroundTimer = window.setTimeout(() => {
                fetchContactLeads({ silent: true });
                fetchFeedbackSummary();
            }, 150);
            return () => window.clearTimeout(backgroundTimer);
        } else if (activeTab === 'public-content') {
            fetchMarketingSettings();
        } else if (activeTab === 'availability') {
            fetchAvailabilityOverrides();
        } else if (activeTab === 'leads') {
            fetchContactLeads();
        } else if (activeTab === 'bookings' && bookingsScope !== 'all') {
            fetchBookings({ scope: 'all' });
        } else if (BOOKING_BACKED_TABS.includes(activeTab) && bookings.length === 0) {
            fetchBookings({ scope: 'page' });
        } else {
            setLoading(false);
        }

        return undefined;
    }, [activeTab, availabilityMonth, bookingsScope]);

    useEffect(() => {
        if (activeTab !== 'calendar') return;
        fetchCalendarBookings();
    }, [activeTab, selectedMonthKey, calendarFilters]);

    useEffect(() => {
        if (activeTab !== 'leads') return;
        const timer = window.setTimeout(() => fetchContactLeads(), 250);
        return () => window.clearTimeout(timer);
    }, [leadFilters, activeTab]);

    useSmartRefresh({
        enabled: ['today', 'public-content', 'availability', ...BOOKING_BACKED_TABS].includes(activeTab),
        interval: activeTab === 'public-content' ? 120000 : 90000,
        idleAfter: 180000,
        channels: liveChannels,
        resources: ['bookings', 'contact_inquiries', 'food_tastings', 'feedback', 'announcements', 'catalog', 'availability'],
        refresh: ({ silent = false } = {}) => {
            if (activeTab === 'today') {
                fetchMarketingSummary({ silent });
                fetchBookings({ silent, scope: 'page' });
                fetchFeedbackSummary();
            } else if (activeTab === 'public-content') {
                fetchMarketingSettings();
            } else if (activeTab === 'availability') {
                fetchAvailabilityOverrides({ silent });
            } else if (activeTab === 'calendar') {
                fetchCalendarBookings({ silent });
            } else if (activeTab === 'bookings') {
                fetchBookings({ silent, scope: 'all' });
            } else if (BOOKING_BACKED_TABS.includes(activeTab)) {
                fetchBookings({ silent, scope: 'page' });
            }
        },
    });

    const fetchBookings = async ({ silent = false, scope = 'page', force = false } = {}) => {
        const requestId = bookingRequestRef.current + 1;
        bookingRequestRef.current = requestId;
        try {
            const params = scope === 'all' ? '' : '?paginated=1&per_page=25';
            const cacheKey = smartCacheKey(`marketing:bookings:${scope}`);
            const cached = readSmartCache(cacheKey);
            if (cached?.data && bookings.length === 0) {
                setBookings(getListData(cached.data));
                setBookingsScope(scope);
                setLoading(false);
            }
            const result = await fetchSmartResource(`${MARKETING_BOOKINGS_URL}${params}`, {
                cacheKey,
                ttl: 30000,
                force,
            });
            const data = result.raw || result.data;
            if (requestId === bookingRequestRef.current) {
                setBookings(getListData(data));
                setBookingsScope(scope);
            }
        } catch (error) {
            console.error("Error fetching bookings:", error);
        } finally {
            if (requestId === bookingRequestRef.current && !silent) setLoading(false);
        }
    };

    const fetchCalendarBookings = async ({ silent = false } = {}) => {
        const requestId = calendarRequestRef.current + 1;
        calendarRequestRef.current = requestId;
        if (!silent) setCalendarLoading(true);
        try {
            const params = new URLSearchParams({ month: selectedMonthKey });
            Object.entries(calendarFilters).forEach(([key, value]) => {
                if (value) params.set(key, value);
            });
            const cacheKey = smartCacheKey(`marketing:calendar:${params.toString()}`);
            const cached = readSmartCache(cacheKey);
            if (cached?.data && calendarBookings.length === 0) {
                const cachedData = cached.data;
                setCalendarBookings(Array.isArray(cachedData.events) ? cachedData.events.map(normalizeCalendarEvent) : []);
                setLoading(false);
            }
            const result = await fetchSmartResource(`/api/calendar-availability?${params.toString()}`, {
                cacheKey,
                ttl: 30000,
            });
            const data = result.raw || result.data;
            if (requestId === calendarRequestRef.current) {
                setCalendarBookings(Array.isArray(data.events) ? data.events.map(normalizeCalendarEvent) : []);
            }
        } catch (error) {
            console.error('Error fetching calendar bookings:', error);
            if (!silent) toast.error('Could not load calendar events.');
        } finally {
            if (requestId === calendarRequestRef.current) {
                if (!silent) setCalendarLoading(false);
                setLoading(false);
            }
        }
    };

    const fetchMarketingSummary = async ({ silent = false } = {}) => {
        try {
            const cacheKey = smartCacheKey('marketing:summary');
            const cached = readSmartCache(cacheKey);
            if (cached?.data && !marketingRemoteSummary) {
                setMarketingRemoteSummary(cached.data);
            }
            const result = await fetchSmartResource('/api/marketing/summary', {
                cacheKey,
                ttl: 30000,
            });
            setMarketingRemoteSummary(result.raw || result.data);
        } catch (error) {
            console.error('Error fetching marketing summary:', error);
            if (!silent) toast.error('Could not load today summary.');
        }
    };

    const fetchFeedbackSummary = async () => {
        try {
            const url = '/api/marketing/feedback-responses?follow_up_only=1&paginated=1&per_page=50';
            const result = await fetchSmartResource(url, {
                cacheKey: smartCacheKey('marketing:feedback-summary'),
                ttl: 30000,
            });
            const rows = result.raw || result.data;
            const list = Array.isArray(rows) ? rows : (rows.data || []);
            setFeedbackSummary({
                followUps: list.length,
                testimonials: list.filter((item) => item.testimonial_status === 'Candidate').length,
                recent: list.slice(0, 3),
            });
        } catch (error) {
            console.error('Error fetching feedback summary:', error);
        }
    };

    const fetchContactLeads = async ({ silent = false } = {}) => {
        if (!silent) setLeadLoading(true);
        try {
            const params = new URLSearchParams();
            Object.entries(leadFilters).forEach(([key, value]) => {
                if (value !== '' && value !== null && value !== undefined) params.set(key, value);
            });
            const url = `/api/marketing/contact-inquiries?${params.toString()}`;
            const result = await fetchSmartResource(url, {
                cacheKey: smartCacheKey(`marketing:contact-leads:${params.toString()}`),
                ttl: 15000,
            });
            setLeadData(result.raw || result.data);
        } catch (error) {
            console.error(error);
            if (!silent) toast.error('Could not load guest inquiries.');
        } finally {
            if (!silent) setLeadLoading(false);
        }
    };

    const updateLeadFilter = (field, value) => {
        setLeadFilters((current) => ({ ...current, [field]: value, page: field === 'page' ? value : 1 }));
    };

    const updateLead = async (id, changes) => {
        setLeadSaving(true);
        try {
            const response = await fetch(`/api/marketing/contact-inquiries/${id}`, {
                method: 'PATCH',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify(changes),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || 'Lead update failed');
            setSelectedLead(payload.inquiry);
            fetchContactLeads({ silent: true });
            toast.success('Lead updated.');
        } catch (error) {
            console.error(error);
            toast.error(error.message || 'Could not update this lead.');
        } finally {
            setLeadSaving(false);
        }
    };

    const handleLogout = () => {
        router.post('/logout');
    };

    const fetchAvailabilityOverrides = async ({ silent = false } = {}) => {
        if (!silent) setAvailabilityLoading(true);
        try {
            const url = `/api/calendar-availability?month=${availabilityMonth}`;
            const result = await fetchSmartResource(url, {
                cacheKey: smartCacheKey(`marketing:availability:${availabilityMonth}`),
                ttl: 30000,
            });
            const data = result.raw || result.data;
            setAvailabilityOverrides(getListData(data));
        } catch (error) {
            console.error(error);
            toast.error('Could not load availability controls.');
        } finally {
            if (!silent) setAvailabilityLoading(false);
            if (!silent) setLoading(false);
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
            setAvailabilityForm({ is_locked: Boolean(data.isLocked), remaining_events: data.remainingEvents ?? '', remaining_pax: data.remainingPax ?? '', note: '' });
        } catch (error) {
            console.error(error);
        }
    };

    const saveAvailabilityOverride = async (event) => {
        event.preventDefault();
        setAvailabilitySaving(true);
        try {
            const response = await fetch(`/api/calendar-availability/${availabilityDate}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    is_locked: availabilityForm.is_locked,
                    remaining_events: availabilityForm.remaining_events === '' ? null : Number(availabilityForm.remaining_events),
                    remaining_pax: availabilityForm.remaining_pax === '' ? null : Number(availabilityForm.remaining_pax),
                    note: availabilityForm.note,
                }),
            });
            if (!response.ok) throw new Error('Save failed');
            toast.success('Availability updated.');
            bustSmartCache(smartCacheKey(`marketing:availability:${availabilityMonth}`));
            fetchAvailabilityOverrides({ silent: true });
        } catch (error) {
            console.error(error);
            toast.error('Could not save availability override.');
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
            toast.success('Availability override cleared.');
            bustSmartCache(smartCacheKey(`marketing:availability:${availabilityMonth}`));
            fetchAvailabilityOverrides({ silent: true });
        } catch (error) {
            console.error(error);
            toast.error('Could not clear availability override.');
        } finally {
            setAvailabilitySaving(false);
        }
    };

    const updateStatus = async (id, newStatus) => {
        if (updatingBookingIds[id]) return; // prevent double-click
        setUpdatingBookingIds(prev => ({ ...prev, [id]: newStatus }));

        // Optimistic update: remove from pending list immediately
        setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));

        try {
            const response = await csrfFetch(`/api/marketing/bookings/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                const data = await response.json().catch(() => ({}));
                if (data.booking) mergeUpdatedBooking(data.booking);
                const label = newStatus === 'Confirmed' ? 'approved' : 'declined';
                toast.success(`Booking #${id} has been ${label} successfully.`);
                fetchBookings({ scope: activeTab === 'bookings' ? 'all' : 'page', force: true }); // sync with server in background
            } else {
                const data = await response.json().catch(() => ({}));
                if (data.booking) mergeUpdatedBooking(data.booking);
                // Revert on failure
                setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'Pending' } : b));
                toast.error(data.error || 'Failed to update booking status. Please try again.');
            }
        } catch (error) {
            console.error('Error updating status:', error);
            setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'Pending' } : b));
            toast.error('We could not update the booking. Please check your connection.');
        } finally {
            setUpdatingBookingIds(prev => { const n = { ...prev }; delete n[id]; return n; });
        }
    };

    const mergeUpdatedBooking = (updatedBooking) => {
        if (!updatedBooking?.id) return;
        bustSmartCache(smartCacheKey('marketing:bookings:page'), smartCacheKey('marketing:bookings:all'));
        setBookings(prev => prev.map(item => item.id === updatedBooking.id ? { ...item, ...updatedBooking } : item));
        setCalendarBookings(prev => prev.map(item => item.id === updatedBooking.id ? { ...item, ...updatedBooking } : item));
        setSelectedBooking(prev => prev?.id === updatedBooking.id ? { ...prev, ...updatedBooking } : prev);
    };

    const addCreatedBooking = (createdBooking) => {
        if (!createdBooking?.id) return;
        bustSmartCache(smartCacheKey('marketing:bookings:page'), smartCacheKey('marketing:bookings:all'));
        setBookings(prev => [createdBooking, ...prev.filter(item => item.id !== createdBooking.id)]);
        setCalendarBookings(prev => isActiveCalendarBooking(createdBooking)
            ? [createdBooking, ...prev.filter(item => item.id !== createdBooking.id)]
            : prev);
        setBookingsScope(prev => prev || 'all');
    };

    const openAssistedBookingModal = () => {
        setShowAssistedBooking(true);
    };

    const assignBooking = async (id) => {
        if (claimingBookingIds[id]) return;
        setClaimingBookingIds(prev => ({ ...prev, [id]: true }));
        try {
            const response = await csrfFetch(`/api/marketing/bookings/${id}/claim`, {
                method: 'POST',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Claim failed');
            mergeUpdatedBooking(data.booking);
            toast.success(data.message || 'Booking claimed.');
        } catch (error) {
            console.error(error);
            toast.error(error.message || 'We could not claim this booking right now.');
        } finally {
            setClaimingBookingIds(prev => { const next = { ...prev }; delete next[id]; return next; });
        }
    };

    const fetchBookingTransferStaff = async () => {
        try {
            const response = await fetch('/api/chat/staff/available', { headers: { Accept: 'application/json' } });
            if (response.ok) setBookingTransferStaff(await response.json());
        } catch (error) {
            console.error(error);
        }
    };

    const transferBooking = async (id, staffId) => {
        if (!staffId) return;
        try {
            const response = await csrfFetch(`/api/marketing/bookings/${id}/transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_staff_id: staffId }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Transfer failed');
            mergeUpdatedBooking(data.booking);
            setShowBookingTransfer(false);
            toast.success(data.message || 'Transfer request sent.');
        } catch (error) {
            console.error(error);
            toast.error(error.message || 'Could not transfer booking owner.');
        }
    };

    const respondToTransfer = async (id, action) => {
        try {
            const response = await csrfFetch(`/api/marketing/bookings/${id}/transfer/${action}`, {
                method: 'POST',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Transfer response failed');
            mergeUpdatedBooking(data.booking);
            toast.success(data.message || (action === 'accept' ? 'Booking transfer accepted.' : 'Booking transfer declined.'));
        } catch (error) {
            console.error(error);
            toast.error(error.message || 'Could not update this transfer request.');
        }
    };

    const releaseBooking = async (id) => {
        try {
            const response = await csrfFetch(`/api/marketing/bookings/${id}/release`, {
                method: 'POST',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Release failed');
            mergeUpdatedBooking(data.booking);
            toast.success('Booking released to the unassigned queue.');
        } catch (error) {
            console.error(error);
            toast.error(error.message || 'Could not release booking.');
        }
    };

    const requestClarification = (id) => {
        setClarificationPrompt({ isOpen: true, bookingId: id });
    };

    const submitClarificationRequest = async (message) => {
        const id = clarificationPrompt.bookingId;
        if (!id) return;
        try {
            const response = await csrfFetch(`/api/marketing/bookings/${id}/clarification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Request failed');
            mergeUpdatedBooking(data.booking);
            setClarificationPrompt({ isOpen: false, bookingId: null });
            toast.success('Request sent to the customer dashboard.');
        } catch (error) {
            console.error(error);
            toast.error(error.message || 'We could not send the request right now.');
        }
    };

    const toggleReviewTask = async (bookingId, task) => {
        const nextStatus = task.status === 'Done' ? 'Pending' : 'Done';
        try {
            const response = await csrfFetch(`/api/marketing/bookings/${bookingId}/review-tasks/${task.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: nextStatus }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Checklist update failed');
            mergeUpdatedBooking(data.booking);
        } catch (error) {
            console.error(error);
            toast.error(error.message || 'We could not update the checklist.');
        }
    };

    const updateLiveStatus = async (id, newLiveStatus) => {
        try {
            // Session auth - no token needed
            const response = await csrfFetch(`/api/marketing/bookings/${id}/livestatus`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ live_status: newLiveStatus })
            });

            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                // Update local state to reflect change immediately without closing modal
                if (data.booking) mergeUpdatedBooking(data.booking);
                else setSelectedBooking({ ...selectedBooking, live_status: newLiveStatus });
                toast.success(`Live status set to ${newLiveStatus}.`);
                fetchBookings({ scope: activeTab === 'bookings' ? 'all' : 'page', force: true }); // Refresh background data
            } else {
                if (data.booking) mergeUpdatedBooking(data.booking);
                toast.error(data.error || 'Could not update live status.');
            }
        } catch (error) {
            console.error("Error updating live status:", error);
            toast.error('Could not update live status. Please check your connection.');
        }
    };

    const fetchMarketingSettings = async () => {
        try {
            const [menuData, packageData, eventData] = await Promise.all([
                fetchSmartResource('/api/settings/menu-items', {
                    cacheKey: smartCacheKey('marketing:settings:menu-items'),
                    ttl: 60000,
                }),
                fetchSmartResource('/api/packages?per_page=100', {
                    cacheKey: smartCacheKey('marketing:settings:packages'),
                    ttl: 60000,
                }),
                fetchSmartResource('/api/settings/event-types', {
                    cacheKey: smartCacheKey('marketing:settings:event-types'),
                    ttl: 60000,
                }),
            ]);
            setMenuItems(menuData.raw || menuData.data || []);
            const packagePayload = packageData.raw || packageData.data;
            setPackages(packagePayload.data || packagePayload);
            const eventPayload = eventData.raw || eventData.data;
            const types = eventPayload.data || eventPayload;
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
            console.error('Error fetching marketing settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const bustMarketingSettingsCache = () => {
        bustSmartCache(
            smartCacheKey('marketing:settings:menu-items'),
            smartCacheKey('marketing:settings:packages'),
            smartCacheKey('marketing:settings:event-types')
        );
    };

    const handleDishPricingUpdate = async (item, cost, adj) => {
        setSettingsSaving(true);
        try {
            const response = await csrfFetch(`/api/settings/menu-items/${item.id}/pricing`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cost_per_head: cost, price_adj: adj }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || data.message || 'Could not update dish pricing.');
            toast.success(data.message || 'Dish pricing updated.');
            bustMarketingSettingsCache();
            fetchMarketingSettings();
        } catch (error) {
            console.error('Error updating dish pricing:', error);
            toast.error(error.message || 'Could not update dish pricing.');
        } finally {
            setSettingsSaving(false);
        }
    };

    const handlePackageSubmit = async (e) => {
        e.preventDefault();
        setSettingsSaving(true);
        try {
            const response = await csrfFetch(editingPackageId ? `/api/settings/packages/${editingPackageId}` : '/api/settings/packages', {
                method: editingPackageId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(packageForm),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || data.message || 'Could not save package.');
            toast.success(data.message || (editingPackageId ? 'Package updated.' : 'Package created.'));
            setEditingPackageId(null);
            setPackageForm(emptyPackageForm(eventTypes[0]?.slug || ''));
            setCatalogDrawer(null);
            bustMarketingSettingsCache();
            fetchMarketingSettings();
        } catch (error) {
            console.error('Error creating package:', error);
            toast.error(error.message || 'Could not save package.');
        } finally {
            setSettingsSaving(false);
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
        setSettingsSaving(true);
        try {
            const url = editingEventTypeId ? `/api/settings/event-types/${editingEventTypeId}` : '/api/settings/event-types';
            const response = await csrfFetch(url, {
                method: editingEventTypeId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventTypeForm),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || data.message || 'Could not save event type.');
            toast.success(data.message || (editingEventTypeId ? 'Event type updated.' : 'Event type created.'));
            resetEventTypeForm();
            setCatalogDrawer(null);
            bustMarketingSettingsCache();
            fetchMarketingSettings();
        } catch (error) {
            console.error('Error saving event type:', error);
            toast.error(error.message || 'Could not save event type.');
        } finally {
            setSettingsSaving(false);
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

    const handleDeleteEventType = async (eventType) => {
        setDeleteEventTypeConfirm({ isOpen: true, eventType });
    };

    const confirmDeleteEventType = async () => {
        const eventType = deleteEventTypeConfirm.eventType;
        if (!eventType) return;
        setSettingsSaving(true);
        try {
            const response = await csrfFetch(`/api/settings/event-types/${eventType.id}`, { method: 'DELETE' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || data.message || 'Could not archive event type.');
            toast.success(data.message || 'Event type archived.');
            setDeleteEventTypeConfirm({ isOpen: false, eventType: null });
            bustMarketingSettingsCache();
            fetchMarketingSettings();
        } catch (error) {
            console.error('Error deleting event type:', error);
            toast.error(error.message || 'Could not archive event type.');
        } finally {
            setSettingsSaving(false);
        }
    };

    const getCalendarEventLabel = (booking) => {
        const time = formatTime(booking.event_time);
        const eventType = titleCase(booking.event_type || booking.package_type || booking.type) || 'Event';
        const client = bookingContactName(booking) || 'Unnamed contact';
        return `${time} / ${eventType} / ${client}`;
    };

    const getCompactClientName = (booking) => {
        const name = bookingContactName(booking) || 'Booking contact';
        const parts = String(name).trim().split(/\s+/);
        return parts.length > 1 ? parts[parts.length - 1] : name;
    };

    const getCalendarEventPrimary = (booking) => (
        titleCase(booking.event_type || booking.package_type || booking.type) || `Booking #${booking.id}`
    );

    const getCalendarEventSecondary = (booking) => {
        const pax = booking.pax ? ` · ${booking.pax} guests` : '';
        return `${formatTime(booking.event_time)} · ${getCompactClientName(booking)}${pax}`;
    };

    const getCalendarEventTitle = (booking) => {
        const parts = [
            `Booking #${booking.id}`,
            getCalendarEventLabel(booking),
            booking.pax ? `${booking.pax} guests` : null,
            booking.status ? `Status: ${booking.status}` : null,
        ].filter(Boolean);
        return parts.join('\n');
    };

    const [selectedBooking, setSelectedBooking] = useState(null);
    const canEditBooking = (booking) => Boolean(booking?.can_edit ?? (user?.role === 'Admin' || (booking?.assigned_to && Number(booking.assigned_to) === Number(user?.id))));
    const canClaimBooking = (booking) => Boolean(booking?.can_claim ?? !booking?.assigned_to);

    const marketingBookingIndexes = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const byDate = new Map();
        const pending = [];
        let confirmed = 0;
        let monthEvents = 0;
        let upcoming = 0;
        let pipeline = 0;
        const calendarSource = activeTab === 'calendar' ? calendarBookings : bookings;

        calendarSource.forEach((booking) => {
            const showOnCalendar = isActiveCalendarBooking(booking);

            if (booking.event_date) {
                const dateKey = booking.event_date.substring(0, 10);
                if (showOnCalendar) {
                    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
                    byDate.get(dateKey).push(booking);
                    if (booking.event_date.substring(0, 7) === selectedMonthKey) monthEvents += 1;
                }
            }
        });

        bookings.forEach((booking) => {
            if (booking.status === 'Pending') {
                pending.push(booking);
                pipeline += getBookingValue(booking);
            }
            if (booking.status === 'Confirmed') confirmed += 1;

            if (!booking.event_date || !['Pending', 'Confirmed'].includes(booking.status)) return;
            const eventDate = new Date(booking.event_date);
            eventDate.setHours(0, 0, 0, 0);
            if (eventDate >= now && ['Pending', 'Confirmed'].includes(booking.status)) upcoming += 1;
        });

        return {
            byDate,
            pending: pending.length,
            confirmed,
            monthEvents,
            upcoming,
            pipeline,
        };
    }, [activeTab, bookings, calendarBookings, selectedMonthKey]);

    const dashboardSummary = marketingRemoteSummary ? {
        ...marketingBookingIndexes,
        pending: marketingRemoteSummary.pending ?? marketingBookingIndexes.pending,
        monthEvents: activeTab === 'calendar' ? marketingBookingIndexes.monthEvents : (marketingRemoteSummary.this_month ?? marketingBookingIndexes.monthEvents),
        upcoming: marketingRemoteSummary.upcoming ?? marketingBookingIndexes.upcoming,
        pipeline: marketingRemoteSummary.pipeline ?? marketingBookingIndexes.pipeline,
    } : marketingBookingIndexes;

    const tabMeta = {
        today: 'Today',
        bookings: 'Bookings',
        leads: 'Guest Inquiries',
        tastings: 'Food Tastings',
        calendar: 'Calendar',
        availability: 'Availability',
        handoff: 'Event Handoff',
        messages: 'Messages',
        history: 'Event History',
        'public-content': 'Public Content',
        settings: 'Settings',
    };

        const marketingSummary = useMemo(() => {
            const pending = bookings.filter(b => !['Completed', 'completed', 'Cancelled', 'cancelled'].includes(b.status) && (b.status === 'Pending' || ['Submitted', 'Under Review', 'Needs Customer Details', 'Clarification Received'].includes(b.review_status)));
            const needsDetails = pending.filter(b => String(b.review_status || '').toLowerCase() === 'needs customer details' || b.clarification_request);
            const upcoming = bookings.filter(b => b.event_date && b.status === 'Confirmed');
            const now = new Date();
        const nextSeven = new Date();
        nextSeven.setDate(now.getDate() + 7);
        const urgent = pending.filter(b => {
            if (!b.event_date) return false;
            const date = new Date(b.event_date);
            return date >= now && date <= nextSeven;
        });

        return {
            pending: marketingRemoteSummary?.pending ?? pending.length,
            needsDetails: marketingRemoteSummary?.needs_details ?? needsDetails.length,
            upcoming: marketingRemoteSummary?.upcoming ?? upcoming.length,
            urgent: marketingRemoteSummary?.urgent ?? urgent.length,
            pipeline: marketingRemoteSummary?.pipeline ?? pending.reduce((sum, b) => sum + getBookingValue(b), 0),
            pendingRows: pending,
            upcomingRows: upcoming,
            urgentRows: urgent,
        };
    }, [bookings, marketingRemoteSummary]);

    const marketingNextActions = useMemo(() => ([
        {
            id: 'booking-intake',
            priority: marketingSummary.pending > 0 ? 'action' : 'info',
            title: 'Review submitted bookings',
            description: marketingSummary.pending > 0 ? `${marketingSummary.pending} bookings are waiting for ownership or review.` : 'No submitted bookings are waiting right now.',
            badge: marketingSummary.pending,
            primaryLabel: 'Open',
            tone: marketingSummary.pending > 0 ? 'warn' : 'good',
            onOpen: () => { setBookingReviewView('needs-action'); setActiveTab('bookings'); },
        },
        {
            id: 'needs-details',
            priority: marketingSummary.needsDetails > 0 ? 'urgent' : 'info',
            title: 'Customer details needed',
            description: marketingSummary.needsDetails > 0 ? `${marketingSummary.needsDetails} bookings are blocked by missing or clarified information.` : 'No customer detail requests are blocking work.',
            badge: marketingSummary.needsDetails,
            primaryLabel: 'Open',
            tone: marketingSummary.needsDetails > 0 ? 'danger' : 'good',
            onOpen: () => { setBookingReviewView('waiting'); setActiveTab('bookings'); },
        },
        {
            id: 'guest-inquiries',
            priority: (leadData.summary?.open || 0) > 0 ? 'followup' : 'info',
            title: 'Triage guest inquiries',
            description: (leadData.summary?.open || 0) > 0 ? `${leadData.summary.open} contact-form messages need assignment or follow-up.` : 'No guest inquiries are waiting.',
            badge: leadData.summary?.open || 0,
            primaryLabel: 'Open',
            tone: (leadData.summary?.open || 0) > 0 ? 'warn' : 'good',
            onOpen: () => setActiveTab('leads'),
        },
        {
            id: 'upcoming-handoffs',
            priority: marketingSummary.upcoming > 0 ? 'followup' : 'info',
            title: 'Prepare upcoming events',
            description: marketingSummary.upcoming > 0 ? `${marketingSummary.upcoming} approved events need preparation visibility.` : 'No upcoming approved events need handoff yet.',
            badge: marketingSummary.upcoming,
            primaryLabel: 'Open',
            tone: marketingSummary.upcoming > 0 ? 'warn' : 'good',
            onOpen: () => setActiveTab('handoff'),
        },
        {
            id: 'messages',
            priority: 'action',
            title: 'Customer messages',
            description: 'Open the shared inbox to claim, answer, transfer, or resolve customer conversations.',
            badge: 'Inbox',
            primaryLabel: 'Open',
            tone: 'muted',
            onOpen: () => setActiveTab('messages'),
        },
        {
            id: 'feedback-followups',
            priority: feedbackSummary.followUps > 0 ? 'followup' : 'info',
            title: 'Post-event feedback',
            description: feedbackSummary.followUps > 0 ? `${feedbackSummary.followUps} completed events need feedback follow-up or testimonial review.` : 'No feedback follow-ups are waiting.',
            badge: feedbackSummary.followUps,
            primaryLabel: 'Open',
            tone: feedbackSummary.followUps > 0 ? 'warn' : 'good',
            onOpen: () => setActiveTab('history'),
        },
    ]), [feedbackSummary.followUps, leadData.summary?.open, marketingSummary.needsDetails, marketingSummary.pending, marketingSummary.upcoming]);

    const renderToday = () => {
        const transferRows = bookings.filter(booking => booking.can_accept_transfer);
        const waitingRows = bookings.filter(booking => String(booking.review_status || '').toLowerCase() === 'clarification received' || booking.clarification_response);
        const urgentRows = [...transferRows, ...waitingRows, ...marketingSummary.urgentRows]
            .filter((booking, index, list) => list.findIndex(item => item.id === booking.id) === index)
            .slice(0, 5);
        const unclaimedRows = marketingSummary.pendingRows.filter(booking => !booking.assigned_to).slice(0, 5);
        const ownedRows = marketingSummary.pendingRows.filter(booking => Number(booking.owner_id ?? booking.assigned_to) === Number(user?.id)).slice(0, 5);
        const handoffRows = marketingSummary.upcomingRows.slice(0, 5);

        const openBookingsView = (view) => {
            setBookingReviewView(view);
            setActiveTab('bookings');
        };

        const WorkSection = ({ kicker, title, emptyTitle, emptyMessage, rows, actionLabel, onAction, tone = 'neutral', delay = '' }) => (
            <StaffOpsPanel
                eyebrow={kicker}
                title={title}
                actionLabel={actionLabel || 'Open'}
                onAction={onAction}
                tone={tone}
                delay={delay}
            >
                {rows.length === 0 ? (
                    <StaffEmptyState title={emptyTitle} message={emptyMessage} />
                ) : (
                    <div className="staff-ops-workspace">
                        {rows.map((booking) => {
                            const status = bookingStatusLabel(booking.status);
                            return (
                                <StaffOpsListRow
                                    key={booking.id}
                                    eyebrow={`Booking #${booking.id}`}
                                    title={eventDisplayName(booking)}
                                    detail={`${formatDate(booking.event_date)} / ${booking.pax || 0} guests / ${bookingContactName(booking)}`}
                                    tone={tone === 'danger' ? 'danger' : status.tone === 'warning' ? 'warning' : 'neutral'}
                                    status={<StaffStatusBadge tone={tone === 'danger' ? 'danger' : status.tone === 'success' ? 'good' : status.tone === 'warning' ? 'warn' : 'muted'}>{status.label}</StaffStatusBadge>}
                                    actionLabel="Open brief"
                                    onClick={() => setSelectedBooking(booking)}
                                />
                            );
                        })}
                    </div>
                )}
            </StaffOpsPanel>
        );

        return (
            <div className="staff-ops-workspace">
                <StaffOpsMetricStrip
                    metrics={[
                        {
                            label: 'Booking reviews',
                            value: marketingSummary.pending,
                            description: `${marketingSummary.needsDetails} waiting on customer details`,
                            actionLabel: 'Open bookings',
                            onAction: () => openBookingsView('needs-action'),
                            tone: marketingSummary.pending > 0 ? 'warning' : 'neutral',
                        },
                        {
                            label: 'Urgent work',
                            value: urgentRows.length,
                            description: 'Transfers, replies, and near-date blockers',
                            actionLabel: 'Review now',
                            onAction: () => openBookingsView('needs-action'),
                            tone: urgentRows.length > 0 ? 'danger' : 'neutral',
                        },
                        {
                            label: 'Handoff',
                            value: marketingSummary.upcoming,
                            description: 'Confirmed events moving to operations',
                            actionLabel: 'Open handoff',
                            onAction: () => setActiveTab('handoff'),
                        },
                        {
                            label: 'Follow-ups',
                            value: (leadData.summary?.open || 0) + (feedbackSummary.followUps || 0),
                            description: 'Guest inquiries and feedback follow-ups',
                            actionLabel: 'Open leads',
                            onAction: () => setActiveTab('leads'),
                        },
                    ]}
                />
                <StaffOpsPanel
                    eyebrow="Walk-in and phone support"
                    title="Create booking for customer"
                    description="Link an existing customer or create a walk-in client account while preparing the booking."
                    actionLabel="Create booking"
                    onAction={openAssistedBookingModal}
                />
                <StaffDecisionBrief
                    source="Marketing read"
                    finding={urgentRows.length > 0 ? 'Marketing has work that can block event progress.' : 'Marketing queues are under control.'}
                    signal={urgentRows.length > 0 ? `${urgentRows.length} transfer, reply, or near-event item needs attention before the queue moves smoothly.` : 'No urgent transfer, reply, or near-event blockers are currently waiting.'}
                    nextMove={urgentRows.length > 0 ? 'Open needs action and clear the oldest customer-facing blocker first.' : 'Keep reviewing new booking submissions and follow-ups as they arrive.'}
                    tone={urgentRows.length > 0 ? 'danger' : 'neutral'}
                />
                <NextActionPanel
                    title="Marketing work needing action"
                    actions={marketingNextActions}
                    emptyTitle="No Marketing actions waiting"
                    emptyMessage="Claim requests, customer replies, guest inquiries, and feedback follow-ups will appear here."
                />
                <div className="staff-ops-grid-three">
                    <WorkSection
                        kicker="Urgent"
                        title="Transfers, replies, and near events"
                        emptyTitle="No urgent blockers"
                        emptyMessage="Transfers, customer replies, and near-date blockers will appear here."
                        rows={urgentRows}
                        actionLabel="Open needs action"
                        onAction={() => openBookingsView('needs-action')}
                        tone="danger"
                        delay="rv-d1"
                    />
                    <WorkSection
                        kicker="Booking intake"
                        title="Available and owned reviews"
                        emptyTitle="No booking intake waiting"
                        emptyMessage="New submissions and owned reviews are clear."
                        rows={[...unclaimedRows, ...ownedRows].slice(0, 6)}
                        actionLabel="Open bookings"
                        onAction={() => openBookingsView('needs-action')}
                        tone="warning"
                        delay="rv-d2"
                    />
                    <WorkSection
                        kicker="Upcoming handoff"
                        title="Confirmed events to coordinate"
                        emptyTitle="No upcoming approved events"
                        emptyMessage="Confirmed events will appear here for handoff follow-up."
                        rows={handoffRows}
                        actionLabel="Open handoff"
                        onAction={() => setActiveTab('handoff')}
                        delay="rv-d3"
                    />
                </div>
                <StaffOpsPanel eyebrow="Follow-up" title="Leads, messages, and feedback" delay="rv-d1">
                    <StaffOpsMetricStrip
                        metrics={[
                            { label: 'Guest inquiries', value: leadData.summary?.open || 0, actionLabel: 'Open leads', onAction: () => setActiveTab('leads') },
                            { label: 'Messages', value: 'Inbox', actionLabel: 'Open messages', onAction: () => setActiveTab('messages') },
                            { label: 'Feedback', value: feedbackSummary.followUps || 0, actionLabel: 'Review history', onAction: () => setActiveTab('history') },
                            { label: 'Tastings', value: 'Queue', actionLabel: 'Open tastings', onAction: () => setActiveTab('tastings') },
                        ]}
                    />
                </StaffOpsPanel>
            </div>
        );
    };

    const renderCalendar = () => {
        const daysInMonth = getDaysInMonth(selectedMonth);
        const firstDay = getFirstDayOfMonth(selectedMonth);
        const days = [];

        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="marketing-calendar-cell marketing-calendar-cell-empty"></div>);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayBookings = marketingBookingIndexes.byDate.get(dateStr) || [];

            days.push(
                <div key={day} className="marketing-calendar-cell custom-scrollbar">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-black text-slate-700">{day}</span>
                        {dayBookings.length > 0 && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">{dayBookings.length}</span>}
                    </div>
                    {dayBookings.map(booking => (
                        <div
                            key={booking.id}
                            className={`marketing-event-chip mb-1 cursor-pointer rounded-lg px-2 py-1 text-[11px] font-bold transition-transform hover:-translate-y-0.5 ${booking.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' :
                                booking.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                                    'bg-slate-100 text-slate-700'
                                }`}
                            title={getCalendarEventTitle(booking)}
                            onClick={() => setSelectedBooking(booking)}
                        >
                            <span className="marketing-event-primary">{getCalendarEventPrimary(booking)}</span>
                            <span className="marketing-event-secondary">{getCalendarEventSecondary(booking)}</span>
                        </div>
                    ))}
                </div>
            );
        }

        return days;
    };

    const renderCalendarList = () => (
        <div className="overflow-hidden rounded-2xl border border-amber-100 bg-white">
            <table className="min-w-full divide-y divide-amber-100 text-sm">
                <thead className="bg-[#fffaf3]">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Event</th>
                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Guests</th>
                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Venue</th>
                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Owner</th>
                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Readiness</th>
                        <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-slate-500">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-amber-50">
                    {calendarBookings.map((booking) => (
                        <tr key={booking.id} className="cursor-pointer hover:bg-[#fffaf3]" onClick={() => setSelectedBooking(booking)}>
                            <td className="px-4 py-3 font-bold text-slate-700">{formatDate(booking.event_date)} {formatTime(booking.event_time)}</td>
                            <td className="px-4 py-3">
                                <div className="font-black text-slate-950">{eventDisplayName(booking)}</div>
                                <div className="text-xs font-bold text-slate-500">{bookingContactName(booking)}</div>
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-600">{booking.pax || 0}</td>
                            <td className="px-4 py-3 font-bold text-slate-600">{booking.venue_city || 'Venue pending'}</td>
                            <td className="px-4 py-3 font-bold text-slate-600">{booking.owner || 'Unassigned'}</td>
                            <td className="px-4 py-3 text-xs font-bold text-slate-500">
                                <div>{booking.preparation_state || 'No tasks yet'}</div>
                                <div>{booking.payment_state || 'Payments pending'}</div>
                            </td>
                            <td className="px-4 py-3 text-right">
                                {(() => {
                                    const status = bookingStatusLabel(booking.status);
                                    return <StaffStatusBadge tone={status.tone === 'success' ? 'good' : status.tone === 'danger' ? 'danger' : status.tone === 'warning' ? 'warn' : 'muted'}>{status.label}</StaffStatusBadge>;
                                })()}
                            </td>
                        </tr>
                    ))}
                    {calendarBookings.length === 0 && (
                        <tr><td colSpan="7" className="px-4 py-10"><StaffEmptyState title="No calendar events found" message="No events match this date range or filter." /></td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );

    const renderBookingModal = () => {
        if (!selectedBooking) return null;
        const isApproved = selectedBooking.status === 'Confirmed';
        const reviewStatus = selectedBooking.review_status || (selectedBooking.status === 'Pending' ? 'Submitted' : selectedBooking.status);
        const reviewStatusInfo = reviewStatusLabel(reviewStatus);
        const canEdit = canEditBooking(selectedBooking);
        const isClaiming = Boolean(claimingBookingIds[selectedBooking.id]);
        const canClaim = canClaimBooking(selectedBooking) && !isClaiming;
        const pendingTransferToMe = Boolean(selectedBooking.can_accept_transfer);
        const hasPendingTransfer = Boolean(selectedBooking.transfer_requested_to);

        return (
            <EventDetailDrawer
                isOpen={Boolean(selectedBooking)}
                booking={selectedBooking}
                role="marketing"
                currentUser={user}
                title="Event brief"
                onClose={() => setSelectedBooking(null)}
                footer={<button onClick={() => setSelectedBooking(null)} className="staff-button-primary">Done</button>}
                actionSlot={(
                    <>
                        {pendingTransferToMe && (
                            <>
                                <button onClick={() => respondToTransfer(selectedBooking.id, 'accept')} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100">
                                    Accept transfer
                                </button>
                                <button onClick={() => respondToTransfer(selectedBooking.id, 'decline')} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100">
                                    Decline
                                </button>
                            </>
                        )}
                        {(canClaim || isClaiming) && (
                            <button
                                disabled={isClaiming}
                                onClick={() => assignBooking(selectedBooking.id)}
                                className={`rounded-lg border border-[#720101]/15 bg-white px-3 py-2 text-xs font-black text-[#720101] hover:bg-[#720101]/5${isClaiming ? ' cursor-not-allowed opacity-60' : ''}`}
                            >
                                {isClaiming ? 'Claiming...' : 'Claim booking'}
                            </button>
                        )}
                        {selectedBooking.assigned_to && (canEdit || user?.role === 'Admin') && (
                            <div className="relative">
                                <button onClick={() => { setShowBookingTransfer(!showBookingTransfer); if (!showBookingTransfer) fetchBookingTransferStaff(); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">
                                    Transfer owner
                                </button>
                                {showBookingTransfer && (
                                    <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
                                        {bookingTransferStaff.length === 0 ? (
                                            <p className="px-3 py-2 text-xs font-bold text-slate-400">No Marketing staff available</p>
                                        ) : bookingTransferStaff.map(staff => (
                                            <button key={staff.id} onClick={() => transferBooking(selectedBooking.id, staff.id)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50">
                                                <span>{staff.username}</span>
                                                <span className="text-[10px] text-slate-400">{staff.role}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {selectedBooking.assigned_to && canEdit && !['Completed'].includes(selectedBooking.status) && (
                            <button onClick={() => releaseBooking(selectedBooking.id)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">
                                Unclaim booking
                            </button>
                        )}
                        {canEdit && (
                            <button onClick={() => requestClarification(selectedBooking.id)} className="rounded-lg border border-[#f0aa0b]/40 bg-[#fff7e8] px-3 py-2 text-xs font-black text-[#9f6500] hover:bg-[#fff0cf]">
                                Request details
                            </button>
                        )}
                        {canEdit && selectedBooking.status === 'Pending' && (
                            <>
                                <button onClick={() => updateStatus(selectedBooking.id, 'Confirmed')} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100">
                                    Approve
                                </button>
                                <button onClick={() => updateStatus(selectedBooking.id, 'Cancelled')} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100">
                                    Reject
                                </button>
                            </>
                        )}
                        {selectedBooking.status === 'Confirmed' && (
                            <a href={`/documents/bookings/${selectedBooking.id}/preparation.pdf`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">
                                Prep list PDF
                            </a>
                        )}
                        <button onClick={() => setActiveTab('messages')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">
                            Open messages
                        </button>
                    </>
                )}
            >
                        <div className="rounded-xl border border-[#720101]/10 bg-[#fffaf3] p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="marketing-kicker">Review workflow</p>
                                    <h4 className="mt-1 text-lg font-black text-slate-950">{reviewStatusInfo.label}</h4>
                                    <p className="mt-1 text-sm font-semibold text-slate-500">
                                        Owner: {selectedBooking.owner_name || selectedBooking.assigned_name || 'Unassigned'}
                                    </p>
                                    {hasPendingTransfer && (
                                        <p className="mt-2 text-xs font-bold text-[#9f6500]">
                                            Transfer requested to {selectedBooking.transfer_requested_to_name || 'another Marketing staff member'}.
                                        </p>
                                    )}
                                    {!canEdit && (
                                        <p className="mt-2 text-xs font-bold text-amber-700">
                                            {pendingTransferToMe ? 'Accept this transfer to become the owner.' : canClaim ? 'Claim this booking to take action.' : 'Owned by another staff member. Actions are locked until ownership is transferred.'}
                                        </p>
                                    )}
                                </div>
                            </div>
                            {selectedBooking.clarification_request && (
                                <div className="mt-4 rounded-lg border border-[#f0aa0b]/30 bg-white p-3">
                                    <p className="text-[11px] font-black uppercase tracking-widest text-[#9f6500]">Customer details requested</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-700">{selectedBooking.clarification_request}</p>
                                    <p className="mt-3 text-[11px] font-black uppercase tracking-widest text-slate-400">Customer response</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-700">{selectedBooking.clarification_response || 'Waiting for customer response.'}</p>
                                </div>
                            )}
                            {Array.isArray(selectedBooking.review_tasks) && selectedBooking.review_tasks.length > 0 && (
                                <div className="mt-4 border-t border-[#720101]/10 pt-4">
                                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Review checklist</p>
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                        {selectedBooking.review_tasks.filter(task => task.task_type === 'review').map(task => (
                                            <button
                                                key={task.id}
                                                disabled={!canEdit}
                                                onClick={() => toggleReviewTask(selectedBooking.id, task)}
                                                className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-xs font-bold transition ${task.status === 'Done' ? 'border-green-200 bg-green-50 text-green-800' : 'border-slate-200 bg-white text-slate-600 hover:border-[#720101]/20'} ${!canEdit ? 'cursor-not-allowed opacity-50' : ''}`}
                                            >
                                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${task.status === 'Done' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                    {task.status === 'Done' ? 'OK' : ''}
                                                </span>
                                                {task.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {isApproved && (
                            <div>
                                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2 flex items-center gap-1">
                                    <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Live Status Tracking
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {['Not Started', 'On the Way', 'Preparing', 'Serving', 'Completed'].map(status => {
                                        const isActive = selectedBooking.live_status === status || (!selectedBooking.live_status && status === 'Not Started');
                                        return (
                                            <button
                                                key={status}
                                                disabled={!canEdit}
                                                onClick={() => updateLiveStatus(selectedBooking.id, status)}
                                                className={`px-4 py-2 text-xs font-bold rounded-full border transition-colors ${isActive ? 'bg-[#720101] text-white border-[#720101] shadow-sm' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'} ${!canEdit ? 'cursor-not-allowed opacity-50' : ''}`}
                                            >
                                                {status}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
            </EventDetailDrawer>
        );
    };
    // ---- PDF Export Functions ----
    const getExportDateRange = () => {
        if (exportMode === 'range') {
            return { start: exportDateStart, end: exportDateEnd };
        } else {
            // Month range
            const [startYear, startMonth] = exportMonthStart.split('-').map(Number);
            const [endYear, endMonth] = exportMonthEnd.split('-').map(Number);
            const start = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
            const lastDay = new Date(endYear, endMonth, 0).getDate();
            const end = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            return { start, end };
        }
    };

    const exportCalendarPDF = () => {
        const { start, end } = getExportDateRange();

        if (!start || !end || start > end) {
            toast.warning('Please select a valid date range.');
            return;
        }

        const params = new URLSearchParams({ start, end });
        window.location.href = `/documents/calendar.pdf?${params.toString()}`;
        setShowExportModal(false);
    };

    const renderExportModal = () => {
        if (!showExportModal) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowExportModal(false)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="px-6 py-4 bg-[#720101]">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white">Download calendar PDF</h3>
                            <button onClick={() => setShowExportModal(false)} className="text-white hover:text-gray-200 text-2xl leading-none">&times;</button>
                        </div>
                        <p className="text-sm text-white opacity-80">Select the range to include</p>
                    </div>

                    <div className="px-6 py-5 space-y-4">
                        {/* Toggle Mode */}
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={() => setExportMode('month')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${exportMode === 'month' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}
                            >
                                Month Range
                            </button>
                            <button
                                onClick={() => setExportMode('range')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${exportMode === 'range' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}
                            >
                                Date Range
                            </button>
                        </div>

                        {exportMode === 'month' ? (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">From Month</label>
                                    <input
                                        type="month"
                                        value={exportMonthStart}
                                        onChange={e => setExportMonthStart(e.target.value)}
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">To Month</label>
                                    <input
                                        type="month"
                                        value={exportMonthEnd}
                                        onChange={e => setExportMonthEnd(e.target.value)}
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">From Date</label>
                                    <input
                                        type="date"
                                        value={exportDateStart}
                                        onChange={e => setExportDateStart(e.target.value)}
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">To Date</label>
                                    <input
                                        type="date"
                                        value={exportDateEnd}
                                        onChange={e => setExportDateEnd(e.target.value)}
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-700"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="px-6 py-4 bg-gray-50 border-t flex space-x-3">
                        <button
                            onClick={() => setShowExportModal(false)}
                            className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={exportCalendarPDF}
                            className="flex-1 bg-[#720101] text-white py-2.5 rounded-lg font-medium hover:bg-[#5a0101] transition-colors flex items-center justify-center"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            Download PDF
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderAvailability = () => {
        const selectedDateSetting = availabilityOverrides.find(item => item.date === availabilityDate);
        const moveAvailabilityMonth = (offset) => {
            const nextMonth = shiftMonthValue(availabilityMonth, offset);
            setAvailabilityMonth(nextMonth);
            selectAvailabilityDate(`${nextMonth}-01`);
        };

        return (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <form onSubmit={saveAvailabilityOverride} className="staff-work-surface p-6">
                    <div className="mb-6">
                        <div>
                            <p className="marketing-kicker">Selected date</p>
                            <h3 className="mt-1 text-xl font-black text-slate-950">Control daily availability</h3>
                            <p className="staff-section-copy">Set whether this date can still accept bookings and guests.</p>
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Date</span>
                            <input type="date" value={availabilityDate} onChange={(event) => selectAvailabilityDate(event.target.value)} className="staff-control mt-2" />
                        </label>
                        <label className="block">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Booking status</span>
                            <span className="staff-control mt-2 flex items-center gap-3 border-red-100 bg-red-50/60 px-4">
                                <input type="checkbox" checked={availabilityForm.is_locked} onChange={(event) => setAvailabilityForm(prev => ({ ...prev, is_locked: event.target.checked }))} className="h-4 w-4" />
                                <span className="text-sm font-black text-red-800">Stop bookings for this date</span>
                            </span>
                        </label>
                        <label className="block">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Remaining event slots</span>
                            <input type="number" min="0" value={availabilityForm.remaining_events} onChange={(event) => setAvailabilityForm(prev => ({ ...prev, remaining_events: event.target.value }))} className="staff-control mt-2" />
                        </label>
                        <label className="block">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Remaining guests</span>
                            <input type="number" min="0" value={availabilityForm.remaining_pax} onChange={(event) => setAvailabilityForm(prev => ({ ...prev, remaining_pax: event.target.value }))} className="staff-control mt-2" />
                        </label>
                    </div>
                    <label className="mt-4 block">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Staff note</span>
                        <textarea rows={4} value={availabilityForm.note} onChange={(event) => setAvailabilityForm(prev => ({ ...prev, note: event.target.value }))} className="staff-control mt-2 min-h-32" placeholder="Reason for closing the date or changing capacity" />
                    </label>
                    <div className="mt-6 flex flex-wrap justify-end gap-3">
                        <button type="button" onClick={clearAvailabilityOverride} disabled={availabilitySaving || !selectedDateSetting} className="staff-button-secondary">Clear date change</button>
                        <button type="submit" disabled={availabilitySaving} className="staff-button-primary">{availabilitySaving ? 'Saving...' : 'Save date settings'}</button>
                    </div>
                </form>

                <aside className="staff-work-surface p-5">
                    <div className="mb-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Date changes</h3>
                                <p className="mt-1 text-sm font-bold text-slate-500">{formatMonthLabel(availabilityMonth)}</p>
                            </div>
                            <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-black text-primary-700">{availabilityOverrides.length}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => moveAvailabilityMonth(-1)} className="staff-button-secondary px-3 py-2 text-xs">Previous month</button>
                            <button type="button" onClick={() => moveAvailabilityMonth(1)} className="staff-button-secondary px-3 py-2 text-xs">Next month</button>
                        </div>
                    </div>
                    {availabilityLoading ? (
                        <StaffSkeleton variant="panel" rows={3} className="p-0" label="Loading date changes" />
                    ) : availabilityOverrides.length === 0 ? (
                        <p className="rounded-xl bg-[#fbf8f2] p-4 text-sm font-bold text-slate-500">No date changes for this month.</p>
                    ) : (
                        <div className="space-y-3">
                            {availabilityOverrides.map((item) => (
                                <button key={item.id} type="button" onClick={() => selectAvailabilityDate(item.date)} className={`w-full rounded-xl border p-4 text-left transition ${availabilityDate === item.date ? 'border-primary-300 bg-primary-50' : 'border-slate-100 bg-[#fbf8f2] hover:bg-white'}`}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-black text-slate-950">{formatDate(item.date)}</span>
                                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${item.is_locked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{item.is_locked ? 'Closed' : 'Limited'}</span>
                                    </div>
                                    <p className="mt-2 text-xs font-bold text-slate-500">{item.remainingEvents} event slots / {Number(item.remainingPax || 0).toLocaleString()} guests remaining</p>
                                    {item.note && <p className="mt-2 text-xs font-semibold text-slate-400">{item.note}</p>}
                                </button>
                            ))}
                        </div>
                    )}
                </aside>
            </div>
        );
    };

    const concernLabels = {
        general: 'General',
        planning: 'Planning',
        availability: 'Availability',
        menu: 'Menu',
        pricing: 'Pricing',
        tasting: 'Tasting',
        active_booking: 'Active booking',
    };

    const renderPublicLeads = () => (
        <div className="space-y-4">
            <div className="marketing-panel staff-filter-bar">
                <input value={leadFilters.search} onChange={(event) => updateLeadFilter('search', event.target.value)} placeholder="Search name, email, phone, subject, or message" className="staff-control" />
                <select value={leadFilters.status} onChange={(event) => updateLeadFilter('status', event.target.value)} className="staff-control">
                    <option value="">All statuses</option>
                    {['New', 'Contacted', 'In Review', 'Follow Up', 'Resolved', 'Closed', 'Archived', 'Spam'].map(status => <option key={status} value={status}>{status}</option>)}
                </select>
                <select value={leadFilters.concern_type} onChange={(event) => updateLeadFilter('concern_type', event.target.value)} className="staff-control">
                    <option value="">All concerns</option>
                    {Object.entries(concernLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input type="date" value={leadFilters.date_from} onChange={(event) => updateLeadFilter('date_from', event.target.value)} className="staff-control" />
                <input type="date" value={leadFilters.date_to} onChange={(event) => updateLeadFilter('date_to', event.target.value)} className="staff-control" />
            </div>

            <div className="marketing-panel overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                         <thead className="border-b border-amber-100 bg-[#fffaf3] text-xs font-black uppercase tracking-widest text-slate-500">
                             <tr>
                                <th className="px-5 py-4">Guest</th>
                                 <th className="px-5 py-4">Concern</th>
                                <th className="px-5 py-4">Event</th>
                                <th className="px-5 py-4">Status</th>
                                <th className="px-5 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                         <tbody className="divide-y divide-amber-100/70">
                             {leadLoading ? (
                                <tr><td colSpan="5"><StaffSkeleton rows={5} label="Loading guest inquiries" /></td></tr>
                            ) : leadData.data.length === 0 ? (
                                <tr><td colSpan="5" className="px-5 py-10"><StaffEmptyState title="No guest inquiries found" message="Questions from the Contact page will appear here." /></td></tr>
                             ) : leadData.data.map((lead) => (
                                <tr key={lead.id} className="hover:bg-[#fffaf3]">
                                    <td className="px-5 py-4">
                                        <p className="font-black text-slate-950">{lead.full_name}</p>
                                        <p className="mt-1 text-xs font-semibold text-slate-500">{lead.email}{lead.phone ? ` / ${lead.phone}` : ''}</p>
                                        {lead.duplicate_user && <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-amber-700">{lead.duplicate_user.is_deactivated ? 'Matches deactivated customer' : 'Matches customer'}</p>}
                                        <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-400">{lead.subject}</p>
                                    </td>
                                    <td className="px-5 py-4"><StaffStatusBadge tone="muted">{concernLabels[lead.concern_type] || 'General'}</StaffStatusBadge></td>
                                    <td className="px-5 py-4 text-sm font-bold text-slate-600">
                                        <p>{lead.event_type || 'Not specified'}</p>
                                        <p className="mt-1 text-xs text-slate-400">{lead.event_date ? formatDate(lead.event_date) : 'No date'}{lead.pax ? ` / ${lead.pax} guests` : ''}</p>
                                    </td>
                                    <td className="px-5 py-4"><StaffStatusBadge tone={lead.status === 'Resolved' || lead.status === 'Closed' ? 'good' : lead.status === 'New' ? 'warn' : 'muted'}>{lead.status}</StaffStatusBadge></td>
                                    <td className="px-5 py-4 text-right">
                                        <button type="button" onClick={() => setSelectedLead(lead)} className="rounded-lg bg-[#720101] px-4 py-2 text-xs font-black text-white">Review</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <StaffPagination page={leadData.meta.current_page} perPage={leadData.meta.per_page} total={leadData.meta.total} onPageChange={(page) => updateLeadFilter('page', page)} onPerPageChange={(perPage) => updateLeadFilter('per_page', perPage)} />
            </div>

            {selectedLead && (
                <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-sm" onClick={() => setSelectedLead(null)}>
                     <aside className="custom-scrollbar h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                         <div className="flex items-start justify-between gap-4">
                             <div>
                                <p className="marketing-kicker">Guest inquiry</p>
                                 <h3 className="mt-2 text-2xl font-black text-slate-950">{selectedLead.full_name}</h3>
                                <p className="mt-1 text-sm font-bold text-slate-500">{selectedLead.email}{selectedLead.phone ? ` / ${selectedLead.phone}` : ''}</p>
                            </div>
                            <button type="button" onClick={() => setSelectedLead(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-black text-slate-500">Close</button>
                        </div>
                        <div className="mt-6 grid gap-3 sm:grid-cols-2">
                            <select value={selectedLead.status || 'New'} disabled={leadSaving} onChange={(event) => updateLead(selectedLead.id, { status: event.target.value })} className="staff-control">
                                {['New', 'Contacted', 'In Review', 'Follow Up', 'Resolved', 'Closed', 'Archived', 'Spam'].map(status => <option key={status}>{status}</option>)}
                            </select>
                            <button type="button" disabled={leadSaving} onClick={() => updateLead(selectedLead.id, { assigned_to: user?.id, status: selectedLead.status === 'New' ? 'In Review' : selectedLead.status })} className="rounded-lg bg-[#720101] px-4 py-3 text-sm font-black text-white disabled:opacity-60">Assign to me</button>
                        </div>
                        <div className="mt-6 rounded-2xl border border-amber-100 bg-[#fffaf3] p-5">
                            <p className="text-xs font-black uppercase tracking-widest text-[#9f6500]">{concernLabels[selectedLead.concern_type] || 'General'} / {selectedLead.event_type || 'No event type'}</p>
                            <h4 className="mt-2 text-lg font-black text-slate-950">{selectedLead.subject}</h4>
                            <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-6 text-slate-600">{selectedLead.message}</p>
                            <p className="mt-4 text-xs font-bold text-slate-400">{selectedLead.event_date ? formatDate(selectedLead.event_date) : 'No event date'}{selectedLead.pax ? ` / ${selectedLead.pax} guests` : ''}</p>
                        </div>
                        <label className="mt-6 block">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Staff notes</span>
                            <textarea rows={6} value={selectedLead.staff_notes || ''} onChange={(event) => setSelectedLead((current) => ({ ...current, staff_notes: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold" />
                        </label>
                        <div className="mt-4 flex justify-end gap-3">
                            <button type="button" disabled={leadSaving} onClick={() => updateLead(selectedLead.id, { staff_notes: selectedLead.staff_notes || '' })} className="rounded-lg border border-[#720101]/20 bg-white px-4 py-3 text-sm font-black text-[#720101] disabled:opacity-60">Save notes</button>
                            <button type="button" disabled={leadSaving} onClick={() => updateLead(selectedLead.id, { status: 'Resolved', staff_notes: selectedLead.staff_notes || '' })} className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60">Mark resolved</button>
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );

    const renderBookings = () => {
        const reviewableBookings = bookings.filter(b => (
            !['Completed', 'completed', 'Cancelled', 'cancelled'].includes(b.status)
            && (b.status === 'Pending' || ['Submitted', 'Under Review', 'Needs Customer Details', 'Clarification Received'].includes(b.review_status))
        ));
        const reviewCounts = reviewableBookings.reduce((counts, booking) => {
            const ownedByMe = Number(booking.owner_id ?? booking.assigned_to) === Number(user?.id);
            const waitingOnCustomer = String(booking.review_status || '').toLowerCase() === 'needs customer details' || Boolean(booking.clarification_request && !booking.clarification_response);
            const customerResponded = String(booking.review_status || '').toLowerCase() === 'clarification received' || Boolean(booking.clarification_response);
            if (!booking.assigned_to) counts.claim += 1;
            if (ownedByMe) counts.mine += 1;
            if (booking.can_accept_transfer) counts.transfers += 1;
            if (waitingOnCustomer) counts.waiting += 1;
            if (!booking.assigned_to || booking.can_accept_transfer || (ownedByMe && customerResponded) || (ownedByMe && !waitingOnCustomer)) counts['needs-action'] += 1;
            counts.all += 1;
            return counts;
        }, { 'needs-action': 0, claim: 0, mine: 0, transfers: 0, waiting: 0, all: 0 });
        const pendingTransferBookings = reviewableBookings.filter(booking => booking.can_accept_transfer);
        const viewBookings = reviewableBookings.filter((booking) => {
            const ownedByMe = Number(booking.owner_id ?? booking.assigned_to) === Number(user?.id);
            const waitingOnCustomer = String(booking.review_status || '').toLowerCase() === 'needs customer details' || Boolean(booking.clarification_request && !booking.clarification_response);
            const customerResponded = String(booking.review_status || '').toLowerCase() === 'clarification received' || Boolean(booking.clarification_response);
            if (bookingReviewView === 'needs-action') return !booking.assigned_to || booking.can_accept_transfer || (ownedByMe && customerResponded) || (ownedByMe && !waitingOnCustomer);
            if (bookingReviewView === 'claim') return !booking.assigned_to;
            if (bookingReviewView === 'mine') return ownedByMe;
            if (bookingReviewView === 'transfers') return booking.can_accept_transfer;
            if (bookingReviewView === 'waiting') return waitingOnCustomer;
            return true;
        });
        const pendingBookings = viewBookings
            .filter((booking) => {
                const query = inquirySearch.trim().toLowerCase();
                const reviewStatus = String(booking.review_status || booking.status || '').toLowerCase();
                const eventTime = booking.event_date ? new Date(booking.event_date).getTime() : 0;
                const fromTime = inquiryDateFrom ? new Date(inquiryDateFrom).getTime() : null;
                const toTime = inquiryDateTo ? new Date(inquiryDateTo).getTime() : null;

                if (inquiryStatusFilter !== 'all' && reviewStatus !== inquiryStatusFilter) return false;
                if (fromTime !== null && eventTime < fromTime) return false;
                if (toTime !== null && eventTime > toTime) return false;
                if (!query) return true;

                return [
                    `booking #${booking.id}`,
                    String(booking.id),
                    booking.event_name,
                    booking.event_type,
                    bookingContactName(booking),
                    bookingContactEmail(booking),
                    bookingContactPhone(booking),
                    customerAccountName(booking),
                    customerAccountEmail(booking),
                    customerAccountPhone(booking),
                    booking.venue_city,
                    booking.assigned_name,
                ].filter(Boolean).join(' ').toLowerCase().includes(query);
            })
            .sort((a, b) => {
                if (inquirySort === 'az' || inquirySort === 'za') {
                    const left = eventDisplayName(a).toLowerCase();
                    const right = eventDisplayName(b).toLowerCase();
                    return inquirySort === 'az' ? left.localeCompare(right) : right.localeCompare(left);
                }
                const leftDate = new Date(inquirySort === 'oldest' || inquirySort === 'newest' ? (a.created_at || a.event_date) : a.event_date || 0).getTime();
                const rightDate = new Date(inquirySort === 'oldest' || inquirySort === 'newest' ? (b.created_at || b.event_date) : b.event_date || 0).getTime();
                return inquirySort === 'oldest' || inquirySort === 'eventDateAsc' ? leftDate - rightDate : rightDate - leftDate;
            });
        const pagedPendingBookings = pendingBookings.slice((inquiryPage - 1) * inquiryPerPage, inquiryPage * inquiryPerPage);
        return (
            <div className="staff-ops-workspace">
                <StaffOpsPanel
                    eyebrow="Assisted intake"
                    title="Booking for a walk-in, call, or direct customer?"
                    description="Create the customer account and booking together so payments, chat, receipts, and feedback still work."
                    actionLabel="Create booking"
                    onAction={openAssistedBookingModal}
                />
                <div className="marketing-panel flex flex-wrap gap-2 p-2">
                    {BOOKING_WORK_VIEWS.map(option => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => setBookingReviewView(option.id)}
                            className={`rounded-lg px-4 py-2 text-sm font-black transition-colors ${bookingReviewView === option.id ? 'bg-[#8b0000] text-white' : 'bg-white text-slate-600 hover:bg-[#fffaf3]'}`}
                        >
                            {option.label}
                            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${bookingReviewView === option.id ? 'bg-white/20 text-white' : 'bg-[#fff7e8] text-[#9f6500]'}`}>
                                {reviewCounts[option.id]}
                            </span>
                        </button>
                    ))}
                </div>
                {pendingTransferBookings.length > 0 && (
                    <div className="marketing-panel border border-[#f0aa0b]/30 bg-[#fff7e8] p-4">
                        <p className="text-xs font-black uppercase tracking-widest text-[#9f6500]">Transfer request</p>
                        <div className="mt-3 grid gap-3">
                            {pendingTransferBookings.map(booking => (
                                <div key={booking.id} className="flex flex-col gap-3 rounded-xl bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="font-black text-slate-950">Booking #{booking.id} - {eventDisplayName(booking)}</p>
                                        <p className="mt-1 text-sm font-semibold text-slate-500">
                                            {booking.transfer_requested_by_name || booking.owner_name || 'A Marketing staff member'} wants to transfer this booking to you.
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => respondToTransfer(booking.id, 'accept')} className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 hover:bg-emerald-100">
                                            Accept
                                        </button>
                                        <button type="button" onClick={() => respondToTransfer(booking.id, 'decline')} className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-black text-rose-700 hover:bg-rose-100">
                                            Decline
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <StaffOpsSearchBar
                    value={inquirySearch}
                    onChange={(event) => setInquirySearch(event.target.value)}
                    placeholder="Search booking, customer, phone, or city"
                >
                    <select value={inquiryStatusFilter} onChange={(event) => setInquiryStatusFilter(event.target.value)} className="staff-control">
                        <option value="all">All statuses</option>
                        <option value="submitted">Submitted</option>
                        <option value="under review">Under Review</option>
                        <option value="needs customer details">Needs Customer Details</option>
                        <option value="clarification received">Clarification Received</option>
                    </select>
                    <select value={inquirySort} onChange={(event) => setInquirySort(event.target.value)} className="staff-control">
                        <option value="eventDateAsc">Event date ascending</option>
                        <option value="eventDateDesc">Event date descending</option>
                        <option value="newest">Newest</option>
                        <option value="oldest">Oldest</option>
                        <option value="az">A-Z</option>
                        <option value="za">Z-A</option>
                    </select>
                    <input type="date" value={inquiryDateFrom} onChange={(event) => setInquiryDateFrom(event.target.value)} className="staff-control" />
                    <input type="date" value={inquiryDateTo} onChange={(event) => setInquiryDateTo(event.target.value)} className="staff-control" />
                </StaffOpsSearchBar>

                {(
                    <div className="marketing-panel overflow-hidden">
                        <ul className="divide-y divide-amber-100/70">
                            {pendingBookings.length === 0 ? <li className="p-8 text-gray-500 text-center">No bookings match this view.</li> : null}
                            {pagedPendingBookings.map(booking => {
                                const isClaiming = Boolean(claimingBookingIds[booking.id]);
                                const canEdit = canEditBooking(booking);
                                const canClaim = canClaimBooking(booking) && !isClaiming;
                                const pendingTransferToMe = Boolean(booking.can_accept_transfer);
                                const hasPendingTransfer = Boolean(booking.transfer_requested_to);
                                const isClaimQueue = bookingReviewView === 'claim';
                                return (
                                <li key={booking.id} onClick={() => setSelectedBooking(booking)} className="block cursor-pointer transition-colors hover:bg-[#fffaf3]">
                                    <div className="px-6 py-5">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-bold text-primary-700 truncate">
                                                Booking #{booking.id} - {eventDisplayName(booking)}
                                            </p>
                                            <div className="ml-2 flex-shrink-0 flex">
                                                <p className="inline-flex rounded-md bg-yellow-100 px-3 py-1 text-xs font-bold leading-5 text-yellow-800">
                                                    {booking.review_status || booking.status}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                                            <span>Owner: {booking.owner_name || booking.assigned_name || 'Unassigned'}</span>
                                            {hasPendingTransfer && <span className="text-[#9f6500]">Transfer requested to {booking.transfer_requested_to_name || 'Marketing staff'}</span>}
                                            {!canEdit && <span className="text-amber-700">{pendingTransferToMe ? 'Accept this transfer to take ownership' : canClaim ? 'Claim this booking to take action' : 'Owned by another staff member'}</span>}
                                            {booking.clarification_request && (
                                                <span className="text-[#9f6500]">
                                                    {booking.clarification_response ? 'Customer responded' : 'Waiting for customer details'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-3 sm:flex sm:justify-between items-center">
                                            <div className="sm:flex gap-6">
                                                <p className="flex items-center text-sm text-gray-600">
                                                    <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                    {formatDate(booking.event_date)}
                                                </p>
                                                <p className="flex items-center text-sm text-gray-600">
                                                    <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                    {booking.pax} guests
                                                </p>
                                                <p className="flex items-center text-sm text-gray-600">
                                                    <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    PHP {formatMoney(booking.totalCost ?? booking.total_cost ?? booking.budget)}
                                                </p>
                                            </div>
                                            <div className="mt-4 flex items-center text-sm sm:mt-0 space-x-3">
                                                {(canClaim || isClaiming) && (
                                                    <button
                                                        disabled={isClaiming}
                                                        onClick={(e) => { e.stopPropagation(); assignBooking(booking.id); }}
                                                        className={`inline-flex items-center gap-1.5 rounded-lg border border-[#720101]/15 bg-white px-4 py-1.5 font-bold text-[#720101] transition-colors hover:bg-[#720101]/5${isClaiming ? ' cursor-not-allowed opacity-60' : ''}`}
                                                    >
                                                        {isClaiming ? 'Claiming...' : 'Claim booking'}
                                                    </button>
                                                )}
                                                {pendingTransferToMe && (
                                                    <>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); respondToTransfer(booking.id, 'accept'); }}
                                                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-1.5 font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                                                        >
                                                            Accept transfer
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); respondToTransfer(booking.id, 'decline'); }}
                                                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-1.5 font-bold text-rose-700 transition-colors hover:bg-rose-100"
                                                        >
                                                            Decline
                                                        </button>
                                                    </>
                                                )}
                                                {canEdit && booking.assigned_to && !['Completed'].includes(booking.status) && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); releaseBooking(booking.id); }}
                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-1.5 font-bold text-slate-600 transition-colors hover:bg-slate-50"
                                                    >
                                                        Unclaim
                                                    </button>
                                                )}
                                                {canEdit && !isClaimQueue && (
                                                    <>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); requestClarification(booking.id); }}
                                                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#f0aa0b]/40 bg-[#fff7e8] px-4 py-1.5 font-bold text-[#9f6500] transition-colors hover:bg-[#fff0cf]"
                                                        >
                                                            {user?.role === 'Admin' && !booking.assigned_to ? 'Override details' : 'Ask details'}
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); updateStatus(booking.id, 'Confirmed'); }}
                                                            disabled={!!updatingBookingIds[booking.id]}
                                                            className={`inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-1.5 font-bold text-emerald-700 transition-colors hover:bg-emerald-100${updatingBookingIds[booking.id] ? ' opacity-60 cursor-not-allowed' : ''}`}
                                                        >
                                                            {updatingBookingIds[booking.id] === 'Confirmed' ? (
                                                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                                            ) : (
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                            )}
                                                            {user?.role === 'Admin' && !booking.assigned_to ? 'Override approve' : 'Approve'}
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); updateStatus(booking.id, 'Cancelled'); }}
                                                            disabled={!!updatingBookingIds[booking.id]}
                                                            className={`inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-1.5 font-bold text-rose-700 transition-colors hover:bg-rose-100${updatingBookingIds[booking.id] ? ' opacity-60 cursor-not-allowed' : ''}`}
                                                        >
                                                            {updatingBookingIds[booking.id] === 'Cancelled' ? (
                                                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                                            ) : (
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                            )}
                                                            {user?.role === 'Admin' && !booking.assigned_to ? 'Override reject' : 'Reject'}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            );})}
                        </ul>
                        <StaffPagination page={inquiryPage} perPage={inquiryPerPage} total={pendingBookings.length} onPageChange={setInquiryPage} onPerPageChange={setInquiryPerPage} />
                    </div>
                )}
            </div>
        );
    };

    const renderPublicContent = () => {
        const categories = ['starter', 'main', 'side', 'dessert', 'drink'];
        const visibleItems = menuItems.filter(item => item.category === activeMenuCategory);
        const catalogMeta = {
            announcements: {
                title: 'Announcements',
                text: 'Publish homepage and customer-dashboard updates without mixing them into booking work.',
                action: null,
            },
            packages: {
                title: 'Packages',
                text: 'Manage package presets, pricing, connected event types, and customer-facing details.',
                action: editingPackageId ? 'Edit package' : 'Create package',
            },
            eventTypes: {
                title: 'Event Types',
                text: 'Manage the event categories used by booking flows and package presets.',
                action: editingEventTypeId ? 'Edit event type' : 'Create event type',
            },
            menuItems: {
                title: 'Menu Items',
                text: 'Review menu items by category and update pricing values quickly.',
                action: null,
            },
            preview: {
                title: 'Customer Preview',
                text: 'Open public customer-facing screens to review content changes before customers see them.',
                action: null,
            },
        };
        const activeCatalogMeta = catalogMeta[activeConfigTab] || catalogMeta.packages;
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
        const eventTypeLabel = (slug) => eventTypes.find(type => type.slug === slug)?.label || titleCase(slug);
        const packageEventTypeLabels = (pkg) => [...new Set(pkg.event_type_slugs?.length ? pkg.event_type_slugs : [pkg.type])]
            .filter(Boolean)
            .map(eventTypeLabel);
        const togglePackageEventType = (slug) => {
            const current = packageForm.event_type_slugs || [];
            const next = current.includes(slug) ? current.filter(item => item !== slug) : [...current, slug];
            setPackageForm({ ...packageForm, event_type_slugs: next });
        };

        return (
            <>
            <div className="marketing-panel overflow-hidden">
                <div className="staff-catalog-head">
                    <div>
                        <p className="marketing-kicker">Catalog setup</p>
                        <h3 className="staff-section-title">{activeCatalogMeta.title}</h3>
                        <p className="staff-section-copy">{activeCatalogMeta.text}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <a href={activeConfigTab === 'announcements' ? '/preview/menu' : activeConfigTab === 'packages' ? '/preview/packages' : '/preview/menu'} target="_blank" rel="noreferrer" className="staff-button-secondary">Preview as customer</a>
                        {activeConfigTab === 'packages' && (
                            <button type="button" onClick={() => openPackageDrawer()} className="staff-button-primary">Create package</button>
                        )}
                        {activeConfigTab === 'eventTypes' && (
                            <button type="button" onClick={() => openEventTypeDrawer()} className="staff-button-primary">Create event type</button>
                        )}
                    </div>
                </div>
                <div className="staff-catalog-tabs">
                    <nav className="flex gap-2 overflow-x-auto">
                        {[
                            ['announcements', 'Announcements'],
                            ['packages', 'Packages'],
                            ['eventTypes', 'Event Types'],
                            ['menuItems', 'Menu Items'],
                            ['preview', 'Customer Preview'],
                        ].map(([key, label]) => (
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
                    <div className="p-4">
                        <Suspense fallback={<StaffSkeleton variant="panel" rows={3} label="Loading announcements" />}>
                            <AnnouncementManager user={user} />
                        </Suspense>
                    </div>
                )}

                {activeConfigTab === 'preview' && (
                    <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
                        {[
                            ['Menu', '/preview/menu'],
                            ['Packages', '/preview/packages'],
                            ['Booking flow', '/preview/book'],
                            ['Public homepage', '/'],
                        ].map(([label, href]) => (
                            <a key={href} href={href} target="_blank" rel="noreferrer" className="rounded-xl border border-amber-100 bg-white p-4 text-sm font-black text-slate-700 hover:bg-[#fffaf3]">
                                Preview {label}
                                <span className="mt-2 block text-xs font-bold text-slate-400">Opens in a new tab</span>
                            </a>
                        ))}
                    </div>
                )}

                {activeConfigTab === 'packages' && (
                    <div className="divide-y divide-amber-100/70">
                        {packages.map(pkg => {
                            const labels = packageEventTypeLabels(pkg);
                            return (
                                <article key={pkg.id} className="grid gap-4 px-6 py-5 transition-colors hover:bg-[#fffaf3] lg:grid-cols-[minmax(220px,1.1fr)_minmax(260px,1.25fr)_minmax(160px,0.75fr)_auto] lg:items-center">
                                    <div>
                                        <p className="text-base font-black text-slate-950">{pkg.name}</p>
                                        <p className="mt-1 text-sm font-semibold text-slate-500">{pkg.description || 'No description yet.'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Shown for</p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {labels.map(label => (
                                                <span key={label} className="rounded-full border border-amber-100 bg-white px-3 py-1 text-xs font-black text-slate-600">
                                                    {label}
                                                </span>
                                            ))}
                                        </div>
                                        <p className="mt-2 text-xs font-semibold text-slate-400">
                                            Catalog group: {getCategoryLabel(pkg.package_category)}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 rounded-xl border border-amber-100 bg-white px-4 py-3 lg:grid-cols-1">
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Per guest</p>
                                            <p className="text-lg font-black text-slate-950">PHP {Number(pkg.base_price_per_head || 0).toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Minimum</p>
                                            <p className="text-lg font-black text-slate-950">{pkg.minimum_pax || 1} guest{Number(pkg.minimum_pax || 1) === 1 ? '' : 's'}</p>
                                        </div>
                                    </div>
                                    <div className="flex justify-end">
                                        <button type="button" onClick={() => openPackageDrawer(pkg)} className="staff-row-action">Edit</button>
                                    </div>
                                </article>
                            );
                        })}
                        {packages.length === 0 && (
                            <div className="p-8 text-center text-sm font-semibold text-slate-500">No packages have been created yet.</div>
                        )}
                    </div>
                )}

                {activeConfigTab === 'eventTypes' && (
                    <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                        {eventTypes.map(type => (
                            <article key={type.id} className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-lg font-black text-slate-950">{type.label}</p>
                                        <p className="mt-1 text-xs font-black uppercase tracking-widest text-slate-400">{type.slug}</p>
                                    </div>
                                    <span className="rounded-full bg-[#fff7e8] px-3 py-1 text-xs font-black text-[#9f6500]">
                                        {getCategoryLabel(type.package_category)}
                                    </span>
                                </div>
                                <p className="mt-4 min-h-12 text-sm font-semibold leading-relaxed text-slate-500">{type.description || 'No customer-facing description yet.'}</p>
                                <div className="mt-4 rounded-xl bg-[#fbf8f2] px-4 py-3">
                                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Security term</p>
                                    <p className="mt-1 text-sm font-black text-slate-700">{type.security_label || getSecurityLabel(type.security_type)}</p>
                                </div>
                                <div className="mt-5 flex justify-end gap-2">
                                    <button type="button" onClick={() => openEventTypeDrawer(type)} className="staff-row-action">Edit</button>
                                    <button type="button" onClick={() => handleDeleteEventType(type)} className="staff-row-action staff-row-action-danger">Archive</button>
                                </div>
                            </article>
                        ))}
                        {eventTypes.length === 0 && (
                            <div className="rounded-xl border border-amber-100 bg-white p-8 text-center text-sm font-semibold text-slate-500 md:col-span-2 xl:col-span-3">No event types have been created yet.</div>
                        )}
                    </div>
                )}

                {activeConfigTab === 'menuItems' && (
                    <div>
                        <div className="border-b border-gray-100 p-6">
                            <nav className="flex gap-2 overflow-x-auto">
                                {categories.map(category => (
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
                                        <th className="px-6 py-4 text-right">Cost / Head</th>
                                        <th className="px-6 py-4 text-right">Per-head adjustment</th>
                                        <th className="px-6 py-4 text-right">Final / Head</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {visibleItems.map(item => (
                                        <tr key={item.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900">{item.name}</div>
                                                <div className="text-xs text-gray-500">{item.description || 'No description'}</div>
                                            </td>
                                            <td className="px-6 py-4 capitalize text-gray-600">{item.category}</td>
                                            <td className="px-6 py-4 text-right"><input id={`marketing_cost_${item.id}`} type="number" defaultValue={item.cost_per_head} className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-right text-sm font-bold outline-none focus:ring-2 focus:ring-primary-100" /></td>
                                            <td className="px-6 py-4 text-right">
                                                <input id={`marketing_adj_${item.id}`} type="number" defaultValue={item.price_adj || 0} className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-right text-sm font-bold outline-none focus:ring-2 focus:ring-primary-100" />
                                                <p className="mt-1 text-[11px] font-semibold text-gray-400">Added per guest during customer recalculation.</p>
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-gray-900">{formatMoney(Number(item.cost_per_head || 0) + Number(item.price_adj || 0))}</td>
                                            <td className="px-6 py-4 text-right"><button onClick={() => handleDishPricingUpdate(item, document.getElementById(`marketing_cost_${item.id}`).value, document.getElementById(`marketing_adj_${item.id}`).value)} disabled={settingsSaving} className="rounded-lg bg-[#720101] px-3 py-2 text-xs font-bold text-white hover:bg-[#5a0101] disabled:opacity-60">Save</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {visibleItems.length === 0 && <div className="p-8 text-center text-sm text-gray-500">No menu items in this category.</div>}
                        </div>
                    </div>
                )}
            </div>

            {catalogDrawer && (
                <div className="staff-drawer-backdrop" role="dialog" aria-modal="true">
                    <form onSubmit={catalogDrawer === 'package' ? handlePackageSubmit : handleEventTypeSubmit} className="staff-catalog-drawer">
                        <header className="staff-drawer-header">
                            <div>
                                <p className="marketing-kicker">{catalogDrawer === 'package' ? 'Package editor' : 'Event type editor'}</p>
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
                            <button type="submit" disabled={settingsSaving} className="staff-button-primary">
                                {settingsSaving ? 'Saving...' : catalogDrawer === 'package' ? (editingPackageId ? 'Save package' : 'Create package') : (editingEventTypeId ? 'Save event type' : 'Create event type')}
                            </button>
                        </footer>
                    </form>
                </div>
            )}

            {false && <>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Preset Packages by Event Type</h3>
                        <p className="text-xs text-gray-500 mt-1">Create reusable package presets for client booking flows.</p>
                    </div>
                    <form onSubmit={handlePackageSubmit} className="p-6 grid grid-cols-1 md:grid-cols-6 gap-4">
                        <input required value={packageForm.name} onChange={e => setPackageForm({ ...packageForm, name: e.target.value })} placeholder="Package name" className="md:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                        <select required value={packageForm.type} onChange={e => setPackageForm({ ...packageForm, type: e.target.value })} className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100">
                            {eventTypes.map(type => <option key={type.id} value={type.slug}>{type.label}</option>)}
                        </select>
                        <input required type="number" min="0" value={packageForm.base_price_per_head} onChange={e => setPackageForm({ ...packageForm, base_price_per_head: e.target.value })} placeholder="Price / head" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                        <input required type="number" min="1" value={packageForm.minimum_pax} onChange={e => setPackageForm({ ...packageForm, minimum_pax: e.target.value })} placeholder="Min pax" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                        <button disabled={settingsSaving} className="rounded-lg bg-primary-600 px-4 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-60">{settingsSaving ? 'Saving...' : 'Create'}</button>
                        <textarea value={packageForm.description} onChange={e => setPackageForm({ ...packageForm, description: e.target.value })} placeholder="Description" className="md:col-span-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                        <textarea value={packageForm.inclusions} onChange={e => setPackageForm({ ...packageForm, inclusions: e.target.value })} placeholder="Inclusions, one per line" className="md:col-span-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                    </form>
                    <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                        {packages.map(pkg => (
                            <div key={pkg.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                                <p className="text-xs font-black uppercase text-primary-600">{pkg.type}</p>
                                <h4 className="mt-1 font-bold text-gray-900">{pkg.name}</h4>
                                <p className="text-sm text-gray-600">PHP {Number(pkg.base_price_per_head || 0).toLocaleString()} / head · min {pkg.minimum_pax} pax</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Event Types</h3>
                        <p className="text-xs text-gray-500 mt-1">Create, edit, or delete the event categories used by package presets.</p>
                    </div>
                    <form onSubmit={handleEventTypeSubmit} className="p-6 grid grid-cols-1 md:grid-cols-6 gap-4">
                        <input required value={eventTypeForm.label} onChange={e => setEventTypeForm({ ...eventTypeForm, label: e.target.value })} placeholder="Event type name" className="md:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                        <input value={eventTypeForm.slug} onChange={e => setEventTypeForm({ ...eventTypeForm, slug: e.target.value })} placeholder="Short name (optional)" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                        <input value={eventTypeForm.icon} onChange={e => setEventTypeForm({ ...eventTypeForm, icon: e.target.value })} placeholder="Icon name" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                        <input value={eventTypeForm.image} onChange={e => setEventTypeForm({ ...eventTypeForm, image: e.target.value })} placeholder="Image link" className="md:col-span-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                        <textarea value={eventTypeForm.description} onChange={e => setEventTypeForm({ ...eventTypeForm, description: e.target.value })} placeholder="Description" className="md:col-span-4 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-100" />
                        <div className="md:col-span-2 flex gap-2">
                            {editingEventTypeId && <button type="button" onClick={resetEventTypeForm} className="flex-1 rounded-lg border border-gray-200 px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50">Cancel</button>}
                            <button disabled={settingsSaving} className="flex-1 rounded-lg bg-primary-600 px-4 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-60">{settingsSaving ? 'Saving...' : editingEventTypeId ? 'Save type' : 'Create event type'}</button>
                        </div>
                    </form>
                    <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                        {eventTypes.map(type => (
                            <div key={type.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                                <p className="text-xs font-black uppercase text-primary-600">{type.slug}</p>
                                <h4 className="mt-1 font-bold text-gray-900">{type.label}</h4>
                                <p className="text-sm text-gray-600 line-clamp-2">{type.description || 'No description'}</p>
                                <div className="mt-3 flex gap-2">
                                    <button onClick={() => startEditingEventType(type)} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-gray-700 border border-gray-200 hover:bg-gray-50">Edit</button>
                                    <button onClick={() => handleDeleteEventType(type)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100">Archive</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Dish Pricing</h3>
                    </div>
                    <div className="border-b border-gray-100 px-6 pt-2">
                        <nav className="-mb-px flex space-x-8 overflow-x-auto">
                            {categories.map(category => (
                                <button key={category} onClick={() => setActiveMenuCategory(category)} className={`whitespace-nowrap py-3 px-1 border-b-2 font-bold text-sm capitalize transition-colors ${activeMenuCategory === category ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                                    {category}
                                </button>
                            ))}
                        </nav>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {visibleItems.map(item => (
                            <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <h4 className="font-bold text-gray-900">{item.name}</h4>
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    <input id={`marketing_cost_${item.id}`} type="number" defaultValue={item.cost_per_head} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold" />
                                    <input id={`marketing_adj_${item.id}`} type="number" defaultValue={item.price_adj || 0} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold" />
                                </div>
                                <button onClick={() => handleDishPricingUpdate(item, document.getElementById(`marketing_cost_${item.id}`).value, document.getElementById(`marketing_adj_${item.id}`).value)} disabled={settingsSaving} className="mt-3 w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-60">Save pricing</button>
                            </div>
                        ))}
                    </div>
                </div>
            </>}
            </>
        );
    };

    if (loading) return (
        <StaffWorkspaceSkeleton
            title="Marketing Workspace"
            roleLabel="Marketing team"
            label="Preparing marketing workspace"
            navGroups={[
                { label: 'Daily work', items: ['Today', 'Bookings', 'Guest Inquiries', 'Calendar', 'Event Handoff', 'Messages'] },
                { label: 'Operations', items: ['Public Content', 'Availability', 'Settings', 'Event History'] },
            ]}
        />
    );

    return (
        <StaffWorkspaceLayout
            title="Marketing Workspace"
            roleLabel="Marketing team"
            username={user?.username}
            active={activeTab}
            onNavigate={setActiveTab}
            onLogout={handleLogout}
            roleKey="marketing"
            navGroups={withNavCounts(MARKETING_WORKSPACE_NAV_GROUPS, {
                today: marketingSummary.pending + marketingSummary.needsDetails,
                bookings: dashboardSummary.pending,
                leads: leadData.summary?.open || 0,
                calendar: dashboardSummary.monthEvents,
                handoff: marketingSummary.upcoming,
            })}
        >
                <StaffPageHeader
                    eyebrow={activeTab === 'today' ? 'Today' : 'Marketing workflow'}
                    title={activeTab === 'today' ? 'Booking workbench' : tabMeta[activeTab]}
                    metrics={[
                        { label: 'Upcoming', value: dashboardSummary.upcoming },
                        { label: 'Pending', value: dashboardSummary.pending },
                        { label: 'This Month', value: dashboardSummary.monthEvents },
                        { label: 'Pipeline', value: `PHP ${formatMoney(dashboardSummary.pipeline)}` },
                    ]}
                />

                {activeTab === 'today' && renderToday()}

                {activeTab === 'calendar' && (
                    <div className="marketing-panel p-5 lg:p-6">
                        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                                    {selectedMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                                </h2>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                                    {['month', 'list'].map((view) => (
                                        <button key={view} type="button" onClick={() => setCalendarView(view)} className={`rounded-md px-3 py-1.5 text-xs font-black uppercase tracking-widest ${calendarView === view ? 'bg-[#720101] text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                                            {view}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setShowExportModal(true)}
                                    className="marketing-primary-btn flex items-center px-4 py-2 text-sm"
                                >
                                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    Download PDF
                                </button>
                                <button
                                    onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                                >
                                    Prev
                                </button>
                                <button
                                    onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                        <div className="mb-4 grid gap-3 lg:grid-cols-4">
                            <input value={calendarFilters.search} onChange={(event) => setCalendarFilters(prev => ({ ...prev, search: event.target.value }))} placeholder="Search client, event, or city" className="staff-control" />
                            <select value={calendarFilters.status} onChange={(event) => setCalendarFilters(prev => ({ ...prev, status: event.target.value }))} className="staff-control">
                                <option value="">All statuses</option>
                                <option value="Pending">Pending</option>
                                <option value="Confirmed">Confirmed</option>
                                <option value="Completed">Completed</option>
                            </select>
                            <input value={calendarFilters.event_type} onChange={(event) => setCalendarFilters(prev => ({ ...prev, event_type: event.target.value }))} placeholder="Event type" className="staff-control" />
                            <input value={calendarFilters.city} onChange={(event) => setCalendarFilters(prev => ({ ...prev, city: event.target.value }))} placeholder="City / venue" className="staff-control" />
                        </div>
                        {calendarView === 'month' ? (
                            <div className="grid grid-cols-7 overflow-hidden rounded-2xl border border-amber-100 bg-amber-100/70">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                    <div key={day} className="bg-[#fffaf3] py-3 text-center text-xs font-black uppercase tracking-wide text-slate-500">
                                        {day}
                                    </div>
                                ))}
                                {renderCalendar()}
                            </div>
                        ) : renderCalendarList()}
                        {calendarLoading ? (
                            <p className="mt-4 rounded-xl bg-[#fffaf3] p-4 text-sm font-bold text-slate-500">Loading calendar events...</p>
                        ) : dashboardSummary.monthEvents === 0 ? (
                            <p className="mt-4 rounded-xl bg-[#fffaf3] p-4 text-sm font-bold text-slate-500">No scheduled marketing events for this month.</p>
                        ) : null}
                    </div>
                )}

                {activeTab === 'bookings' && renderBookings()}
                {activeTab === 'leads' && renderPublicLeads()}
                {activeTab === 'tastings' && (
                    <Suspense fallback={<StaffSkeleton variant="panel" rows={4} label="Loading food tasting queue" />}>
                        <FoodTastingQueue onToast={(message, type) => type === 'error' ? toast.error(message) : toast.success(message)} />
                    </Suspense>
                )}
                {activeTab === 'availability' && renderAvailability()}
                {activeTab === 'handoff' && (
                    <Suspense fallback={<StaffSkeleton variant="panel" rows={3} label="Loading preparation board" />}>
                        <PreparationBoard />
                    </Suspense>
                )}
                {activeTab === 'public-content' && renderPublicContent()}
                {activeTab === 'settings' && (
                    <RoleSettingsPanel role="marketing" onNavigate={setActiveTab} />
                )}
                {activeTab === 'history' && (
                    <EventHistoryPanel role="marketing" onToast={(message, type) => type === 'error' ? toast.error(message) : toast.success(message)} />
                )}
                {activeTab === 'messages' && (
                    <Suspense fallback={<StaffSkeleton variant="panel" rows={3} label="Loading messages" />}>
                        <StaffMessaging />
                    </Suspense>
                )}
            {renderBookingModal()}
            <AssistedBookingWizard
                isOpen={showAssistedBooking}
                onClose={() => setShowAssistedBooking(false)}
                onCreated={(data) => {
                    addCreatedBooking(data.booking);
                    fetchMarketingSummary({ silent: true });
                }}
                onOpenBooking={(booking) => {
                    if (!booking?.id) return;
                    setSelectedBooking(booking);
                    setShowAssistedBooking(false);
                    setActiveTab('bookings');
                }}
                toast={toast}
            />
            {renderExportModal()}
            <PromptModal
                isOpen={clarificationPrompt.isOpen}
                title="Request customer details"
                message="Tell the customer exactly what the team needs before this booking can move forward."
                label="Details needed"
                placeholder="Example: Please confirm the final venue access time and updated headcount."
                minLength={5}
                confirmText="Send Request"
                onCancel={() => setClarificationPrompt({ isOpen: false, bookingId: null })}
                onConfirm={submitClarificationRequest}
            />
            <ConfirmModal
                isOpen={deleteEventTypeConfirm.isOpen}
                title={`Archive ${deleteEventTypeConfirm.eventType?.label || 'event type'}?`}
                message="This hides the event type from future customer booking choices while preserving historical bookings, packages, and reports."
                confirmText="Archive"
                tone="danger"
                onCancel={() => setDeleteEventTypeConfirm({ isOpen: false, eventType: null })}
                onConfirm={confirmDeleteEventType}
                busy={settingsSaving}
            />
            <FlashToast />
        </StaffWorkspaceLayout>
    );
};

export default DashboardMarketing;
