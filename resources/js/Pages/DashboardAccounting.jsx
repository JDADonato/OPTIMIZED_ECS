import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { router } from '@inertiajs/react';
import ReceiptModal from '../Components/common/ReceiptModal';
import ConfirmModal from '../Components/common/ConfirmModal';
import PromptModal from '../Components/common/PromptModal';
import PaymentTermEditorModal from '../Components/finance/PaymentTermEditorModal';
import useDebouncedValue from '../hooks/useDebouncedValue';
import useSmartRefresh from '../hooks/useSmartRefresh';
import useStaffWorkspaceState from '../hooks/useStaffWorkspaceState';
import { getListData, getPaginationMeta } from '../utils/apiResponses';
import StaffPagination from '../Components/staff/StaffPagination';
import StaffWorkspaceLayout from '../Layouts/StaffWorkspaceLayout';
import StaffPageHeader from '../Components/staff/StaffPageHeader';
import StaffEmptyState from '../Components/staff/StaffEmptyState';
import EventHistoryPanel from '../Components/staff/EventHistoryPanel';
import EventDetailDrawer from '../Components/staff/EventDetailDrawer';
import NextActionPanel from '../Components/staff/NextActionPanel';
import StaffStatusBadge from '../Components/staff/StaffStatusBadge';
import RoleSettingsPanel from '../Components/staff/RoleSettingsPanel';
import StaffSkeleton, { StaffWorkspaceSkeleton } from '../Components/staff/StaffSkeleton';
import { staffPaymentStatus } from '../utils/statusLabels';
import csrfFetch from '../utils/csrf';
import { clearSmartCacheForPrefix, fetchSmartResource, getUserScopedCacheKey, readSmartCache } from '../utils/smartResource';
import { operationalChannelsForUser } from '../utils/liveChannels';

const PAYMENT_TYPE_LABELS = {
    Reservation: { label: 'Reservation Fee', pct: '10%', icon: 'R' },
    DownPayment: { label: 'Down Payment', pct: '70%', icon: 'D' },
    Final: { label: 'Final Payment', pct: '20%', icon: 'F' },
};

const eventDisplayName = (booking) => booking?.event_display_name || booking?.event_name || booking?.event_type || booking?.package_name || (booking?.id ? `Booking #${booking.id}` : 'Eloquente event');
const ACCOUNTING_WORKSPACE_TABS = ['today', 'payments', 'reconciliation', 'refunds', 'ledger', 'settings', 'history'];
const ACCOUNTING_TAB_ALIASES = {
    bookings: 'payments',
    exceptions: 'reconciliation',
    settings: 'settings',
};

const readInitialAccountingSegment = () => {
    if (typeof window === 'undefined') return 'needs_verification';
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') === 'reconciliation' ? 'exceptions' : 'needs_verification';
};

const DashboardAccounting = () => {
    const { user, logout } = useAuth();
    const accountingWorkspacePrefs = user?.profile_preferences?.staff_workspace?.accounting || {};
    const accountingDefaultTab = ACCOUNTING_WORKSPACE_TABS.includes(accountingWorkspacePrefs.default_tab) ? accountingWorkspacePrefs.default_tab : 'today';
    const [activeTab, setActiveTab] = useStaffWorkspaceState({
        storageKey: 'ecs:staff-workspace:accounting',
        defaultTab: accountingDefaultTab,
        allowedTabs: ACCOUNTING_WORKSPACE_TABS,
        tabAliases: ACCOUNTING_TAB_ALIASES,
    });
    const [paymentSegment, setPaymentSegment] = useState(() => accountingWorkspacePrefs.payment_segment || readInitialAccountingSegment());
    const [refundSegment, setRefundSegment] = useState(accountingWorkspacePrefs.refund_segment || 'needs_review');
    const [bookings, setBookings] = useState([]);
    const [accountingSummary, setAccountingSummary] = useState(null);
    const [ledgerPayments, setLedgerPayments] = useState([]);
    const [reconciliationItems, setReconciliationItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [expandedBooking, setExpandedBooking] = useState(null);
    const [receiptModal, setReceiptModal] = useState({ isOpen: false, payment: null, booking: null });
    const [editPaymentModal, setEditPaymentModal] = useState({ isOpen: false, payment: null, booking: null });
    const [refundConfirm, setRefundConfirm] = useState({ isOpen: false, bookingId: null, refundAmount: 0, action: 'process', refundCaseId: null });
    const [refundActionPrompt, setRefundActionPrompt] = useState({ isOpen: false, bookingId: null, refundCaseId: null, action: '', title: '', message: '', busy: false });
    const [refundProcessing, setRefundProcessing] = useState(false);
    const [remindingPaymentId, setRemindingPaymentId] = useState(null);
    const [selectedFinanceBooking, setSelectedFinanceBooking] = useState(null);

    // Refund Management State
    const [refundQueue, setRefundQueue] = useState([]);

    const [ledgerFilter, setLedgerFilter] = useState({ status: 'Verified', startDate: '', endDate: '', clientSearch: '', packageFilter: 'All', method: 'All', payment_type: 'All' });
    const [ledgerPage, setLedgerPage] = useState(1);
    const [ledgerPerPage, setLedgerPerPage] = useState(25);
    const [reconciliationSearch, setReconciliationSearch] = useState('');
    const [reconciliationTypeFilter, setReconciliationTypeFilter] = useState('all');
    const [reconciliationPage, setReconciliationPage] = useState(1);
    const [reconciliationPerPage, setReconciliationPerPage] = useState(25);
    const [refundSearch, setRefundSearch] = useState('');
    const [refundPage, setRefundPage] = useState(1);
    const [refundPerPage, setRefundPerPage] = useState(25);
    const [bookingSearchQuery, setBookingSearchQuery] = useState('');
    const [bookingSortOrder, setBookingSortOrder] = useState('eventDateSoonest');
    const [bookingPaymentFilter, setBookingPaymentFilter] = useState('all');
    const [bookingPage, setBookingPage] = useState(1);
    const [bookingPagination, setBookingPagination] = useState(null);
    const debouncedBookingSearchQuery = useDebouncedValue(bookingSearchQuery, 250);
    const smartCacheKey = (resourceKey) => getUserScopedCacheKey(user, resourceKey);
    const liveChannels = useMemo(() => operationalChannelsForUser(user), [user?.id, user?.role]);

    useEffect(() => {
        if (activeTab === 'today') {
            fetchAccountingSummary();
            fetchBookings({ silent: true });
            fetchReconciliation({ silent: true });
            fetchRefundQueue({ silent: true });
            fetchLedger({ silent: true });
        } else if (activeTab === 'payments') {
            fetchBookings();
            fetchReconciliation({ silent: true });
        } else if (activeTab === 'ledger') {
            fetchLedger();
        } else if (activeTab === 'reconciliation') {
            fetchReconciliation();
        } else if (activeTab === 'refunds') {
            fetchRefundQueue();
        }
    }, [activeTab, ledgerFilter, bookingPage, debouncedBookingSearchQuery, bookingSortOrder, bookingPaymentFilter, paymentSegment]);

    useEffect(() => {
        setBookingPage(1);
    }, [debouncedBookingSearchQuery, bookingSortOrder, bookingPaymentFilter]);

    useEffect(() => {
        setLedgerPage(1);
    }, [ledgerFilter, ledgerPerPage]);

    useEffect(() => {
        setReconciliationPage(1);
    }, [reconciliationSearch, reconciliationTypeFilter, reconciliationPerPage]);

    useEffect(() => {
        setRefundPage(1);
    }, [refundSearch, refundPerPage]);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    useSmartRefresh({
        enabled: true,
        interval: activeTab === 'ledger' ? 120000 : 90000,
        idleAfter: 180000,
        channels: liveChannels,
        resources: ['finance', 'bookings', 'payments', 'refunds'],
        refresh: ({ silent = false } = {}) => {
            if (activeTab === 'payments') {
                fetchBookings({ silent });
                fetchReconciliation({ silent: true });
            } else if (activeTab === 'today') {
                fetchAccountingSummary({ silent });
                fetchBookings({ silent: true });
                fetchReconciliation({ silent: true });
                fetchRefundQueue({ silent: true });
            } else if (activeTab === 'ledger') {
                fetchLedger({ silent });
            } else if (activeTab === 'refunds') {
                fetchRefundQueue({ silent });
            }
        },
    });

    const fetchBookings = async ({ silent = false, force = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            // Session auth - no token needed
            const query = new URLSearchParams({
                page: bookingPage,
                per_page: 25,
                search: debouncedBookingSearchQuery,
                sort: bookingSortOrder,
                payment_status: bookingPaymentFilter,
                finance_segment: paymentSegment,
            }).toString();
            const cacheKey = smartCacheKey(`accounting:bookings:${query}`);
            const cached = readSmartCache(cacheKey);
            if (cached?.data && bookings.length === 0) {
                setBookings(getListData(cached.data));
                setBookingPagination(getPaginationMeta(cached.data));
                setLoading(false);
            }
            const result = await fetchSmartResource('/api/accounting/bookings?' + query, {
                cacheKey,
                ttl: 30000,
                force,
            });
            const data = result.raw || result.data;
            setBookings(getListData(data));
            setBookingPagination(getPaginationMeta(data));
        } catch (error) {
            console.error("Error fetching bookings:", error);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const fetchLedger = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            // Session auth - no token needed
            const query = new URLSearchParams(ledgerFilter).toString();
            const res = await fetch('/api/accounting/ledger?' + query, {
                headers: { }
            });
            const data = await res.json();
            setLedgerPayments(getListData(data));
        } catch (error) {
            console.error("Error fetching ledger:", error);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const fetchReconciliation = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            const res = await fetch('/api/accounting/reconciliation?exceptions_only=1', {
                headers: { }
            });
            const data = await res.json();
            setReconciliationItems(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching reconciliation:", error);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleVerify = async (id, action) => {
        try {
            // Session auth - no token needed
            const res = await csrfFetch('/api/accounting/payments/' + id + '/verify', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: action })
            });
            if (res.ok) {
                clearSmartCacheForPrefix(smartCacheKey('accounting:bookings:'));
                fetchBookings({ force: true });
                fetchLedger({ silent: true });
                fetchReconciliation({ silent: true });
                fetchRefundQueue({ silent: true });
                setToast({
                    message: 'Payment ' + (action === 'Verify' ? 'Verified' : 'Rejected') + ' successfully!',
                    type: action === 'Verify' ? 'success' : 'error'
                });
            }
        } catch (error) {
            console.error("Error verifying payment:", error);
            setToast({ message: 'Failed to process payment. Please try again.', type: 'error' });
        }
    };

    const handleLogout = () => {
        router.post('/logout');
    };

    const getStatusBadge = (status, dueDate) => {
        const displayStatus = staffPaymentStatus(status, dueDate);
        const classes = {
            success: 'bg-green-100 text-green-800',
            warning: 'bg-yellow-100 text-yellow-800',
            danger: 'bg-red-100 text-red-800',
            neutral: 'bg-slate-100 text-slate-600',
        };

        return { cls: classes[displayStatus.tone] || classes.neutral, text: displayStatus.label };
    };

    const fetchAccountingSummary = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            const cacheKey = smartCacheKey('accounting:summary');
            const cached = readSmartCache(cacheKey);
            if (cached?.data && !accountingSummary) {
                setAccountingSummary(cached.data);
                setLoading(false);
            }
            const result = await fetchSmartResource('/api/accounting/summary', {
                cacheKey,
                ttl: 30000,
            });
            setAccountingSummary(result.raw || result.data);
        } catch (error) {
            console.error('Error fetching accounting summary:', error);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    // Count both manually-verified and PayMongo-auto-paid payments as "paid"
    const isPaidStatus = (status) => status === 'Verified' || status === 'Paid';

    const toMoneyNumber = (value) => Number(String(value ?? 0).replace(/,/g, '')) || 0;

    const formatAccountingDate = (value, fallback = 'No event date') => {
        if (!value) return fallback;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const getBookingProgress = (payments) => {
        const paymentList = payments || [];
        var verified = paymentList.filter(function (p) { return isPaidStatus(p.status); }).length;
        return { verified: verified, total: paymentList.length };
    };

    const handleSendReminder = async (paymentId) => {
        if (remindingPaymentId === paymentId) return; // prevent double-click
        setRemindingPaymentId(paymentId);
        try {
            const res = await csrfFetch(`/api/accounting/remind/${paymentId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
                setToast({ message: data.message || 'Reminder sent to client successfully!', type: 'success' });
            } else {
                setToast({ message: data.error || 'Failed to send reminder.', type: 'error' });
            }
        } catch (error) {
            console.error('Error sending reminder:', error);
            setToast({ message: 'We could not send the reminder. Please try again.', type: 'error' });
        } finally {
            setRemindingPaymentId(null);
        }
    };

    const fetchRefundQueue = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            // Session auth - no token needed
            const res = await fetch('/api/accounting/refunds/queue', {
                headers: { }
            });
            const data = await res.json();
            setRefundQueue(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching refund queue:", error);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const openRefundConfirm = (bookingId, refundAmount) => {
        setRefundConfirm({ isOpen: true, bookingId, refundAmount, action: 'process', refundCaseId: null });
    };

    const openRefundRetryConfirm = (item, refundAmount) => {
        const refundCase = item.refund_cases?.[0] || null;
        setRefundConfirm({
            isOpen: true,
            bookingId: item.booking_id,
            refundAmount,
            action: 'retry_provider_refund',
            refundCaseId: refundCase?.id || null,
        });
    };

    const handleProcessRefund = async () => {
        const bookingId = refundConfirm.bookingId;
        if (!bookingId || refundProcessing) return;
        setRefundProcessing(true);
        try {
            // Session auth - no token needed
            const isRetry = refundConfirm.action === 'retry_provider_refund';
            const res = await csrfFetch(isRetry ? `/api/accounting/refund/${bookingId}/retry_provider_refund` : `/api/accounting/refund/${bookingId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: isRetry ? JSON.stringify({ refund_case_id: refundConfirm.refundCaseId }) : undefined,
            });

            const data = await res.json().catch(() => null);

            if (res.ok) {
                setToast({ message: data?.message || 'Refund processed successfully!', type: 'success' });
                setRefundConfirm({ isOpen: false, bookingId: null, refundAmount: 0, action: 'process', refundCaseId: null });
                clearSmartCacheForPrefix(smartCacheKey('accounting:'));
                fetchRefundQueue();
                fetchBookings({ silent: true, force: true });
                fetchLedger({ silent: true });
            } else {
                let errorMsg = 'Failed to process refund.';
                if (data && data.details && data.details.length > 0) {
                    errorMsg = data.details[0]; // Show the specific PayMongo error
                } else if (data && data.error) {
                    errorMsg = data.error;
                }
                setToast({ message: errorMsg, type: 'error' });
            }
        } catch (error) {
            console.error("Error processing refund:", error);
            setToast({ message: 'Error processing refund.', type: 'error' });
        } finally {
            setRefundProcessing(false);
        }
    };

    const dashboardSummary = useMemo(() => {
        const allBookingPayments = bookings.flatMap((booking) => booking.payments || []);
        const pendingPayments = allBookingPayments.filter((payment) => payment.status === 'Pending');
        const collected = ledgerPayments
            .filter((payment) => isPaidStatus(payment.status))
            .reduce((sum, payment) => sum + toMoneyNumber(payment.amount), 0);
        const overdue = pendingPayments.filter((payment) => payment.due_date && new Date(payment.due_date) < new Date());

        const localSummary = {
            bookings: bookings.length,
            pending: pendingPayments.length,
            overdue: overdue.length,
            refunds: refundQueue.length,
            exceptions: reconciliationItems.length,
            collected,
        };

        return accountingSummary ? { ...localSummary, ...accountingSummary } : localSummary;
    }, [bookings, ledgerPayments, refundQueue, reconciliationItems, accountingSummary]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueSoonLimit = new Date(today);
    dueSoonLimit.setDate(dueSoonLimit.getDate() + 7);

    const paymentMatchesSegment = (booking, segment = paymentSegment) => {
        const payments = booking.payments || [];
        if (segment === 'all_active') return true;
        if (segment === 'needs_verification') return payments.some((payment) => payment.status === 'Pending');
        if (segment === 'overdue') {
            return payments.some((payment) => payment.status === 'Pending' && payment.due_date && new Date(payment.due_date) < today);
        }
        if (segment === 'upcoming') {
            return payments.some((payment) => {
                if (payment.status !== 'Pending' || !payment.due_date) return false;
                const due = new Date(payment.due_date);
                return due >= today && due <= dueSoonLimit;
            });
        }
        return true;
    };

    const openRefundActionPrompt = (item, action) => {
        const firstCase = item.refund_cases?.[0] || null;
        const labels = {
            mark_manually_refunded: ['Mark manually refunded?', 'Describe the manual refund reference or settlement details.'],
            mark_forfeited: ['Mark as forfeited?', 'Explain why the paid amount is non-refundable.'],
            close_no_refund_due: ['Close with no refund due?', 'Explain why no refund is due for this case.'],
            reopen_manual_review: ['Reopen manual review?', 'Add context for why this refund case needs review again.'],
        };
        const [title, message] = labels[action] || ['Update refund case', 'Add a note for the refund audit trail.'];
        setRefundActionPrompt({ isOpen: true, bookingId: item.booking_id, refundCaseId: firstCase?.id || null, action, title, message, busy: false });
    };

    const submitRefundAction = async (notes) => {
        const { bookingId, refundCaseId, action } = refundActionPrompt;
        if (!bookingId || !action) return;
        setRefundActionPrompt(prev => ({ ...prev, busy: true }));
        try {
            const res = await csrfFetch(`/api/accounting/refund/${bookingId}/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refund_case_id: refundCaseId, notes }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Could not update refund case.');
            setToast({ message: data.message || 'Refund case updated.', type: 'success' });
            setRefundActionPrompt({ isOpen: false, bookingId: null, refundCaseId: null, action: '', title: '', message: '', busy: false });
            clearSmartCacheForPrefix(smartCacheKey('accounting:'));
            fetchRefundQueue();
            fetchBookings({ silent: true, force: true });
            fetchLedger({ silent: true });
        } catch (error) {
            setToast({ message: error.message || 'Could not update refund case.', type: 'error' });
            setRefundActionPrompt(prev => ({ ...prev, busy: false }));
        }
    };

    const paymentQueueCounts = useMemo(() => {
        const pending = bookings.filter((booking) => paymentMatchesSegment(booking, 'needs_verification')).length;
        const overdue = bookings.filter((booking) => paymentMatchesSegment(booking, 'overdue')).length;
        const upcoming = bookings.filter((booking) => paymentMatchesSegment(booking, 'upcoming')).length;

        return {
            needs_verification: accountingSummary?.needs_verification ?? accountingSummary?.pending ?? pending,
            overdue: accountingSummary?.overdue ?? overdue,
            exceptions: reconciliationItems.length,
            upcoming: accountingSummary?.due_soon ?? upcoming,
            all_active: accountingSummary?.bookings ?? bookings.length,
        };
    }, [bookings, reconciliationItems.length, accountingSummary]);

    const tabMeta = {
        today: 'Today',
        payments: 'Payments',
        reconciliation: 'Reconciliation',
        ledger: 'Ledger & Receipts',
        refunds: 'Refunds',
        settings: 'Settings',
        history: 'Event History',
    };

    const financeNextActions = useMemo(() => ([
        {
            id: 'verify-payments',
            priority: dashboardSummary.pending > 0 ? 'action' : 'info',
            title: 'Verify customer payments',
            description: dashboardSummary.pending > 0 ? `${dashboardSummary.pending} payment records need review.` : 'No payments are waiting for verification.',
            badge: dashboardSummary.pending,
            primaryLabel: 'Open',
            tone: dashboardSummary.pending > 0 ? 'warn' : 'good',
            onOpen: () => {
                setPaymentSegment('needs_verification');
                setActiveTab('payments');
            },
        },
        {
            id: 'overdue-balances',
            priority: dashboardSummary.overdue > 0 ? 'urgent' : 'info',
            title: 'Follow up overdue balances',
            description: dashboardSummary.overdue > 0 ? `${dashboardSummary.overdue} balances are past due.` : 'No overdue balances today.',
            badge: dashboardSummary.overdue,
            primaryLabel: 'Open',
            tone: dashboardSummary.overdue > 0 ? 'danger' : 'good',
            onOpen: () => {
                setPaymentSegment('overdue');
                setActiveTab('payments');
            },
        },
        {
            id: 'payment-exceptions',
            priority: dashboardSummary.exceptions > 0 ? 'urgent' : 'info',
            title: 'Resolve payment issues',
            description: dashboardSummary.exceptions > 0 ? `${dashboardSummary.exceptions} payment records need attention.` : 'Online and staff payment records are aligned.',
            badge: dashboardSummary.exceptions,
            primaryLabel: 'Open',
            tone: dashboardSummary.exceptions > 0 ? 'danger' : 'good',
            onOpen: () => {
                setPaymentSegment('exceptions');
                setActiveTab('payments');
            },
        },
        {
            id: 'refund-queue',
            priority: dashboardSummary.refunds > 0 ? 'followup' : 'info',
            title: 'Process refund cases',
            description: dashboardSummary.refunds > 0 ? `${dashboardSummary.refunds} refund cases are waiting.` : 'No refund cases are waiting.',
            badge: dashboardSummary.refunds,
            primaryLabel: 'Open',
            tone: dashboardSummary.refunds > 0 ? 'warn' : 'good',
            onOpen: () => setActiveTab('refunds'),
        },
    ]), [dashboardSummary.exceptions, dashboardSummary.overdue, dashboardSummary.pending, dashboardSummary.refunds]);

    const todayQueues = useMemo(() => {
        const pendingBookings = bookings.filter((booking) => paymentMatchesSegment(booking, 'needs_verification')).slice(0, 4);
        const overdueBookings = bookings.filter((booking) => paymentMatchesSegment(booking, 'overdue')).slice(0, 4);
        const upcomingBookings = bookings.filter((booking) => paymentMatchesSegment(booking, 'upcoming')).slice(0, 4);

        return {
            urgent: [...reconciliationItems.slice(0, 3), ...overdueBookings].slice(0, 5),
            pendingBookings,
            upcomingBookings,
            refunds: refundQueue.slice(0, 4),
        };
    }, [bookings, reconciliationItems, refundQueue]);

    const exceptionLabels = {
        checkout_started_unpaid: 'Customer started checkout but did not pay',
        provider_paid_not_local: 'Online payment needs staff review',
        pending_past_due: 'Payment is past due',
        missing_paymongo_payment_id_for_refund: 'Refund needs original payment reference',
        webhook_mismatch: 'Online payment details do not match',
    };

    const getReconciliationAction = (item) => {
        const exceptions = item.exceptions || [];

        if (exceptions.includes('provider_paid_not_local')) {
            return {
                label: 'Verify payment',
                detail: 'Online payment exists. Confirm it, then mark the record paid.',
                tone: 'primary',
                onClick: () => handleVerify(item.id, 'Verify'),
            };
        }

        if (exceptions.includes('checkout_started_unpaid') || exceptions.includes('pending_past_due')) {
            return {
                label: remindingPaymentId === item.id ? 'Sending...' : 'Send reminder',
                detail: 'Customer has not completed this payment.',
                tone: 'warn',
                disabled: remindingPaymentId === item.id,
                onClick: () => handleSendReminder(item.id),
            };
        }

        if (exceptions.includes('missing_paymongo_payment_id_for_refund')) {
            return {
                label: 'Open refunds',
                detail: 'Refund processing needs the original payment reference.',
                tone: 'danger',
                onClick: () => setActiveTab('refunds'),
            };
        }

        return {
            label: 'Review ledger',
            detail: 'Compare the payment record against online payment details.',
            tone: 'muted',
            onClick: () => {
                setPaymentSegment('exceptions');
                setActiveTab('payments');
            },
        };
    };

    const paginate = (items, pageNumber, pageSize) => {
        const start = (pageNumber - 1) * pageSize;
        return items.slice(start, start + pageSize);
    };

    const filteredReconciliationItems = useMemo(() => {
        const needle = reconciliationSearch.trim().toLowerCase();

        return reconciliationItems.filter((item) => {
            const exceptions = item.exceptions || [];
            const haystack = [
                item.id,
                item.booking_id,
                item.client_full_name,
                item.payment_type,
                item.status,
                item.paymongo_checkout_session_id,
                item.paymongo_payment_id,
                item.paymongo_reference_number,
            ].join(' ').toLowerCase();

            if (needle && !haystack.includes(needle)) return false;
            if (reconciliationTypeFilter !== 'all' && !exceptions.includes(reconciliationTypeFilter)) return false;

            return true;
        });
    }, [reconciliationItems, reconciliationSearch, reconciliationTypeFilter]);

    const pagedReconciliationItems = useMemo(() => {
        return paginate(filteredReconciliationItems, reconciliationPage, reconciliationPerPage);
    }, [filteredReconciliationItems, reconciliationPage, reconciliationPerPage]);

    const filteredRefundQueue = useMemo(() => {
        const needle = refundSearch.trim().toLowerCase();
        return refundQueue.filter((item) => {
            const status = String(item.refund_status || '').toLowerCase();
            const matchesSegment = refundSegment === 'completed'
                ? ['reviewed', 'refunded', 'completed'].some((value) => status.includes(value))
                : refundSegment === 'manual'
                    ? status.includes('manual') || status.includes('failed')
                    : refundSegment === 'provider'
                        ? status.includes('progress') || status.includes('approved') || status.includes('processing')
                        : !['reviewed', 'refunded', 'completed'].some((value) => status.includes(value));

            if (!matchesSegment) return false;
            if (!needle) return true;

            return [
            item.booking_id,
            item.client_full_name,
            item.client_email,
            item.event_date,
            ].join(' ').toLowerCase().includes(needle);
        });
    }, [refundQueue, refundSearch, refundSegment]);

    const refundSegments = [
        { id: 'needs_review', label: 'Needs review' },
        { id: 'provider', label: 'Provider refund' },
        { id: 'manual', label: 'Manual handling' },
        { id: 'completed', label: 'Completed' },
    ];

    const pagedRefundQueue = useMemo(() => {
        return paginate(filteredRefundQueue, refundPage, refundPerPage);
    }, [filteredRefundQueue, refundPage, refundPerPage]);

    const renderPaymentActions = (payment, booking) => {
        const statusInfo = staffPaymentStatus(payment.status, payment.due_date);
        const isPending = payment.status === 'Pending';

        if (isPending) {
            return (
                <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={() => handleVerify(payment.id, 'Verify')} className="staff-button-primary px-3 py-2 text-xs">Verify</button>
                    <button type="button" onClick={() => handleVerify(payment.id, 'Reject')} className="staff-button-danger px-3 py-2 text-xs">Reject</button>
                    <button
                        type="button"
                        onClick={() => handleSendReminder(payment.id)}
                        disabled={remindingPaymentId === payment.id}
                        className="staff-button-secondary px-3 py-2 text-xs"
                    >
                        {remindingPaymentId === payment.id ? 'Sending...' : 'Remind'}
                    </button>
                </div>
            );
        }

        if (isPaidStatus(payment.status)) {
            return (
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <StaffStatusBadge tone={statusInfo.tone === 'success' ? 'good' : 'muted'}>{statusInfo.label}</StaffStatusBadge>
                    <button type="button" onClick={() => setReceiptModal({ isOpen: true, payment, booking })} className="staff-row-action">Receipt</button>
                </div>
            );
        }

        return <span className="text-xs font-bold text-slate-400">No action</span>;
    };

    const renderVerificationDrawer = () => {
        if (!selectedFinanceBooking) return null;

        const booking = selectedFinanceBooking;
        const totalCost = toMoneyNumber(booking.totalCost);
        const paidAmount = (booking.payments || [])
            .filter((payment) => isPaidStatus(payment.status))
            .reduce((sum, payment) => sum + toMoneyNumber(payment.amount), 0);
        const remainingBalance = Math.max(totalCost - paidAmount, 0);

        return (
            <EventDetailDrawer
                isOpen={Boolean(selectedFinanceBooking)}
                booking={booking}
                role="accounting"
                eyebrow="Payment review"
                title={`Booking #${booking.id}`}
                onClose={() => setSelectedFinanceBooking(null)}
                footer={(
                    <div className="flex w-full flex-wrap items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={() => setEditPaymentModal({ isOpen: true, payment: booking.payments?.[0] || null, booking })}
                            className="staff-button-secondary"
                        >
                            Edit payment terms
                        </button>
                        <button type="button" onClick={() => setSelectedFinanceBooking(null)} className="staff-button-primary">Done</button>
                    </div>
                )}
            >
                <div className="grid gap-3 sm:grid-cols-3">
                        <section className="staff-detail-card">
                            <p className="staff-detail-label">Total</p>
                            <p className="staff-detail-value">{'P' + totalCost.toLocaleString()}</p>
                        </section>
                        <section className="staff-detail-card">
                            <p className="staff-detail-label">Paid</p>
                            <p className="staff-detail-value text-emerald-700">{'P' + paidAmount.toLocaleString()}</p>
                        </section>
                        <section className="staff-detail-card">
                            <p className="staff-detail-label">Balance</p>
                            <p className={`staff-detail-value ${remainingBalance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{'P' + remainingBalance.toLocaleString()}</p>
                        </section>
                </div>
                    <section className="staff-detail-card">
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <p className="staff-detail-label">Payment schedule</p>
                                <p className="staff-section-copy">Verify submitted payments, send reminders, or inspect receipts.</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="staff-table">
                                <thead>
                                    <tr>
                                        <th>Tier</th>
                                        <th className="text-right">Amount</th>
                                        <th>Due</th>
                                        <th>Status</th>
                                        <th className="text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(booking.payments || []).map((payment) => {
                                        const typeInfo = PAYMENT_TYPE_LABELS[payment.payment_type] || { label: payment.payment_type, pct: '', icon: '-' };
                                        const statusInfo = staffPaymentStatus(payment.status, payment.due_date);
                                        return (
                                            <tr key={payment.id}>
                                                <td>
                                                    <p className="font-black text-slate-950">{typeInfo.label}</p>
                                                    <p className="text-xs font-bold text-slate-400">{typeInfo.pct} of total</p>
                                                </td>
                                                <td className="text-right font-black text-slate-950">{'P' + toMoneyNumber(payment.amount).toLocaleString()}</td>
                                                <td>{formatAccountingDate(payment.due_date, '-')}</td>
                                                <td><StaffStatusBadge tone={statusInfo.tone === 'success' ? 'good' : statusInfo.tone === 'danger' ? 'danger' : 'warn'}>{statusInfo.label}</StaffStatusBadge></td>
                                                <td className="text-right">{renderPaymentActions(payment, booking)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
            </EventDetailDrawer>
        );
    };

    const paymentSegments = [
        { id: 'needs_verification', label: 'Needs verification', count: paymentQueueCounts.needs_verification },
        { id: 'overdue', label: 'Overdue', count: paymentQueueCounts.overdue },
        { id: 'exceptions', label: 'Exceptions', count: paymentQueueCounts.exceptions },
        { id: 'upcoming', label: 'Upcoming due', count: paymentQueueCounts.upcoming },
        { id: 'all_active', label: 'All active', count: paymentQueueCounts.all_active },
    ];

    const renderPaymentExceptions = () => (
        <div className="space-y-4">
            <div className="staff-filter-bar">
                <input
                    value={reconciliationSearch}
                    onChange={(event) => setReconciliationSearch(event.target.value)}
                    className="staff-control"
                    placeholder="Search booking, customer, or payment reference"
                />
                <select value={reconciliationTypeFilter} onChange={(event) => setReconciliationTypeFilter(event.target.value)} className="staff-control">
                    <option value="all">All issue types</option>
                    {Object.entries(exceptionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
            </div>
            {loading && reconciliationItems.length === 0 ? (
                <StaffSkeleton variant="panel" rows={3} label="Loading payment exceptions" />
            ) : filteredReconciliationItems.length === 0 ? (
                <StaffEmptyState title="No payment exceptions" message="Online checkout, due dates, and staff payment records are aligned." />
            ) : (
                <>
                    <div className="staff-table-wrap custom-scrollbar">
                        <table className="staff-table">
                            <thead>
                                <tr>
                                    <th>Payment</th>
                                    <th>Customer</th>
                                    <th>Provider references</th>
                                    <th>Issue</th>
                                    <th className="text-right">Next action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedReconciliationItems.map((item) => {
                                    const nextAction = getReconciliationAction(item);

                                    return (
                                        <tr key={item.id}>
                                            <td>
                                                <p className="font-black text-slate-950">Payment #{item.id}</p>
                                                <p className="text-xs font-bold text-slate-400">Booking #{item.booking_id} / {item.payment_type || 'Payment'} / {item.status}</p>
                                            </td>
                                            <td>
                                                <p className="font-black text-slate-950">{item.client_full_name || 'Customer'}</p>
                                                <p className="text-xs font-bold text-slate-400">{formatAccountingDate(item.event_date)}</p>
                                            </td>
                                            <td>
                                                <div className="space-y-1 text-xs font-semibold text-slate-500">
                                                    <p>Checkout: <span className="font-mono text-slate-800">{item.paymongo_checkout_session_id || '-'}</span></p>
                                                    <p>Payment: <span className="font-mono text-slate-800">{item.paymongo_payment_id || '-'}</span></p>
                                                    <p>Customer ref: <span className="font-mono text-slate-800">{item.paymongo_reference_number || '-'}</span></p>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex flex-wrap gap-2">
                                                    {(item.exceptions || []).map((exception) => (
                                                        <StaffStatusBadge key={exception} tone="danger">{exceptionLabels[exception] || exception}</StaffStatusBadge>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="text-right">
                                                <div className="staff-recon-action">
                                                    <p>{nextAction.detail}</p>
                                                    <button
                                                        type="button"
                                                        disabled={nextAction.disabled}
                                                        onClick={nextAction.onClick}
                                                        className={`staff-row-action ${nextAction.tone === 'primary' ? 'staff-row-action-primary' : ''} ${nextAction.tone === 'danger' ? 'staff-row-action-danger' : ''} ${nextAction.disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                    >
                                                        {nextAction.label}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <StaffPagination page={reconciliationPage} perPage={reconciliationPerPage} total={filteredReconciliationItems.length} onPageChange={setReconciliationPage} onPerPageChange={setReconciliationPerPage} />
                </>
            )}
        </div>
    );

    const renderPaymentsWorkspace = () => {
        const visibleBookings = paymentSegment === 'exceptions'
            ? []
            : bookings.filter((booking) => paymentMatchesSegment(booking));

        return (
        <div className="staff-work-surface">
            <div className="staff-surface-head">
                <div>
                    <p className="marketing-kicker">Payments workspace</p>
                    <h3 className="mt-1 text-lg font-black text-slate-950">Finance actions and payment records</h3>
                    <p className="staff-section-copy">Verify payments, chase overdue balances, resolve provider issues, and open receipts from one place.</p>
                </div>
                {loading && <StaffStatusBadge tone="muted">Loading</StaffStatusBadge>}
            </div>
            <div className="staff-tab-strip">
                {paymentSegments.map((segment) => (
                    <button
                        key={segment.id}
                        type="button"
                        onClick={() => setPaymentSegment(segment.id)}
                        className={`staff-tab-pill ${paymentSegment === segment.id ? 'is-active' : ''}`}
                    >
                        {segment.label}
                        {Number(segment.count || 0) > 0 && <span>{segment.count}</span>}
                    </button>
                ))}
            </div>
            <div className="staff-filter-bar">
                <input
                    type="text"
                    placeholder="Search client or booking number"
                    value={bookingSearchQuery}
                    onChange={(e) => setBookingSearchQuery(e.target.value)}
                    className="staff-control"
                />
                <select value={bookingSortOrder} onChange={(e) => setBookingSortOrder(e.target.value)} className="staff-control">
                    <option value="eventDateSoonest">Event date soonest</option>
                    <option value="eventDateLatest">Event date latest</option>
                    <option value="bookingNewest">Booking newest</option>
                    <option value="bookingOldest">Booking oldest</option>
                    <option value="clientAZ">Client A-Z</option>
                    <option value="clientZA">Client Z-A</option>
                </select>
                <select value={bookingPaymentFilter} onChange={(e) => setBookingPaymentFilter(e.target.value)} className="staff-control">
                    <option value="all">All payments</option>
                    <option value="pending">Pending</option>
                    <option value="complete">Complete</option>
                </select>
            </div>
            {paymentSegment === 'exceptions' ? renderPaymentExceptions() : loading && visibleBookings.length === 0 ? (
                <StaffSkeleton rows={6} />
            ) : visibleBookings.length === 0 ? (
                <StaffEmptyState title="No payment records found" message="Try another segment or clear filters to see active finance records." />
            ) : (
                <div className="staff-table-wrap">
                    <table className="staff-table">
                        <thead>
                            <tr>
                                <th>Booking</th>
                                <th>Client</th>
                                <th>Event</th>
                                <th className="text-right">Total</th>
                                <th className="text-right">Paid</th>
                                <th>Status</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleBookings.map((booking) => {
                                const progress = getBookingProgress(booking.payments);
                                const totalCost = toMoneyNumber(booking.totalCost);
                                const paidAmount = (booking.payments || [])
                                    .filter((payment) => isPaidStatus(payment.status))
                                    .reduce((sum, payment) => sum + toMoneyNumber(payment.amount), 0);
                                const hasPending = (booking.payments || []).some((payment) => payment.status === 'Pending');
                                return (
                                    <tr key={booking.id}>
                                        <td className="font-black text-[#720101]">#{booking.id}</td>
                                        <td>
                                            <p className="font-black text-slate-950">{eventDisplayName(booking)}</p>
                                            <p className="text-xs font-semibold text-slate-500">{booking.client_full_name || booking.username || 'Customer'}</p>
                                            <p className="text-xs font-bold text-slate-400">{booking.client_email || booking.client_phone || 'No contact info'}</p>
                                        </td>
                                        <td>{formatAccountingDate(booking.event_date)} / {booking.pax || 0} guests</td>
                                        <td className="text-right font-black text-slate-950">{'P' + totalCost.toLocaleString()}</td>
                                        <td className="text-right font-black text-emerald-700">{'P' + paidAmount.toLocaleString()}</td>
                                        <td><StaffStatusBadge tone={hasPending ? 'warn' : 'good'}>{progress.verified}/{progress.total} verified</StaffStatusBadge></td>
                                        <td className="text-right">
                                            <button type="button" onClick={() => setSelectedFinanceBooking(booking)} className="staff-row-action">Open</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            {bookingPagination && bookingPagination.lastPage > 1 && (
                <StaffPagination
                    page={bookingPagination.currentPage}
                    perPage={25}
                    total={bookingPagination.total}
                    onPageChange={setBookingPage}
                />
            )}
            {renderVerificationDrawer()}
        </div>
        );
    };

    if (loading && activeTab === 'today' && !accountingSummary) {
        return (
            <StaffWorkspaceSkeleton
                title="Accounting Workspace"
                roleLabel="Finance team"
                label="Preparing accounting workspace"
                navGroups={[
                    { label: 'Daily work', items: ['Today', 'Payments', 'Refunds', 'Ledger & Receipts', 'Settings', 'Event History'] },
                ]}
                rows={5}
            />
        );
    }

    return (
        <StaffWorkspaceLayout
            title="Accounting Workspace"
            roleLabel="Finance team"
            username={user && user.username}
            active={activeTab}
            onNavigate={setActiveTab}
            onLogout={handleLogout}
            roleKey="accounting"
            navGroups={[
                {
                    label: 'Daily work',
                    items: [
                        { id: 'today', label: 'Today', count: dashboardSummary.pending + dashboardSummary.overdue + dashboardSummary.exceptions + dashboardSummary.refunds },
                        { id: 'payments', label: 'Payments', count: dashboardSummary.pending + dashboardSummary.overdue + dashboardSummary.exceptions },
                        { id: 'reconciliation', label: 'Reconciliation', count: dashboardSummary.exceptions },
                        { id: 'refunds', label: 'Refunds', count: dashboardSummary.refunds },
                        { id: 'ledger', label: 'Ledger & Receipts' },
                        { id: 'settings', label: 'Settings' },
                        { id: 'history', label: 'Event History' },
                    ],
                },
            ]}
        >
                <StaffPageHeader
                    eyebrow={activeTab === 'today' ? 'Today' : 'Finance workflow'}
                    title={activeTab === 'today' ? 'Payment control desk' : tabMeta[activeTab]}
                    metrics={[
                        { label: 'Bookings', value: dashboardSummary.bookings },
                        { label: 'Pending', value: dashboardSummary.pending },
                        { label: 'Overdue', value: dashboardSummary.overdue },
                        { label: 'Issues', value: dashboardSummary.exceptions },
                        { label: 'Refunds', value: dashboardSummary.refunds },
                    ]}
                />

                {activeTab === 'today' && (
                    <div className="staff-today-grid">
                        <NextActionPanel
                            title="Finance actions"
                            actions={financeNextActions}
                            emptyTitle="No finance actions waiting"
                            emptyMessage="Payment reviews, overdue balances, refunds, and reconciliation issues will appear here."
                        />
                        <section className="staff-work-surface">
                            <div className="staff-surface-head">
                                <div>
                                    <p className="marketing-kicker">Finance priority desk</p>
                                    <h3 className="mt-1 text-lg font-black text-slate-950">Work that needs Accounting today</h3>
                                </div>
                                {(reconciliationItems.length > 0 || todayQueues.pendingBookings.length > 0) && (
                                    <button type="button" onClick={() => { setPaymentSegment('exceptions'); setActiveTab('payments'); }} className="staff-row-action">
                                        Open payments
                                    </button>
                                )}
                            </div>
                            {todayQueues.urgent.length === 0 && todayQueues.pendingBookings.length === 0 && todayQueues.upcomingBookings.length === 0 && todayQueues.refunds.length === 0 ? (
                                <StaffEmptyState title="No finance work waiting" message="Payment reviews, overdue balances, refund cases, and provider issues will appear here." />
                            ) : (
                                <div className="grid gap-4">
                                    {[
                                        ['Urgent', todayQueues.urgent, 'exceptions'],
                                        ['Payment verification', todayQueues.pendingBookings, 'needs_verification'],
                                        ['Due soon', todayQueues.upcomingBookings, 'upcoming'],
                                        ['Follow-up', todayQueues.refunds, 'refunds'],
                                    ].map(([label, items, target]) => (
                                        <div key={label} className="rounded-xl border border-[#720101]/10 bg-white p-4">
                                            <div className="mb-3 flex items-center justify-between">
                                                <h4 className="text-sm font-black uppercase tracking-widest text-slate-500">{label}</h4>
                                                <StaffStatusBadge tone={items.length > 0 ? (label === 'Urgent' ? 'danger' : 'warn') : 'good'}>{items.length}</StaffStatusBadge>
                                            </div>
                                            {items.length === 0 ? (
                                                <p className="text-sm font-semibold text-slate-400">Nothing waiting here.</p>
                                            ) : (
                                                <div className="staff-provider-list">
                                                    {items.slice(0, 3).map((item) => {
                                                        const isRefund = target === 'refunds';
                                                        const isException = Boolean(item.exceptions);
                                                        const itemKey = `${label}-${item.id || item.booking_id}`;
                                                        const title = isException ? `Payment #${item.id}` : eventDisplayName(item);
                                                        const detail = isRefund
                                                            ? `Booking #${item.booking_id} / ${formatAccountingDate(item.event_date)}`
                                                            : isException
                                                                ? `Booking #${item.booking_id} / ${formatAccountingDate(item.event_date)}`
                                                                : `${formatAccountingDate(item.event_date)} / ${(item.payments || []).length} payment terms`;

                                                        return (
                                                            <button
                                                                key={itemKey}
                                                                type="button"
                                                                onClick={() => {
                                                                    if (isRefund) {
                                                                        setActiveTab('refunds');
                                                                    } else {
                                                                        setPaymentSegment(target);
                                                                        setActiveTab('payments');
                                                                    }
                                                                }}
                                                                className="staff-provider-item"
                                                            >
                                                                <div className="staff-provider-main">
                                                                    <span className="staff-item-kicker">{label}</span>
                                                                    <h3>{title}</h3>
                                                                    <p>{detail}</p>
                                                                </div>
                                                                {isException && (
                                                                    <div className="staff-provider-tags">
                                                                        {(item.exceptions || []).slice(0, 2).map((exception) => (
                                                                            <span key={exception}>{exceptionLabels[exception] || exception}</span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {activeTab === 'payments' && renderPaymentsWorkspace()}

                {false && activeTab === 'bookings' && (
                    <div className="marketing-panel p-5 lg:p-6">
                        {loading ? (
                            <StaffSkeleton rows={6} label="Loading payment records" />
                        ) : bookings.length === 0 ? (
                            <div className="p-6 text-center text-slate-500">No bookings found.</div>
                        ) : (
                            <div>
                                <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
                                    <div className="flex-1 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                        <div className="relative w-full max-w-md">
                                            <input 
                                                type="text" 
                                                placeholder="Search by client name or ID..." 
                                                value={bookingSearchQuery}
                                                onChange={(e) => setBookingSearchQuery(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 border border-[#720101]/10 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#720101]/20 focus:border-[#720101]/30 text-sm text-slate-700"
                                            />
                                            <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        </div>
                                        <select
                                            value={bookingSortOrder}
                                            onChange={(e) => setBookingSortOrder(e.target.value)}
                                            className="w-full sm:w-auto border border-[#720101]/10 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#720101]/20 focus:border-[#720101]/30 text-sm bg-white text-slate-700"
                                        >
                                            <option value="eventDateSoonest">Event Date (Soonest First)</option>
                                            <option value="eventDateLatest">Event Date (Latest First)</option>
                                            <option value="bookingNewest">Booking Date (Newest First)</option>
                                            <option value="bookingOldest">Booking Date (Oldest First)</option>
                                            <option value="clientAZ">Client Name (A-Z)</option>
                                            <option value="clientZA">Client Name (Z-A)</option>
                                        </select>
                                        <select
                                            value={bookingPaymentFilter}
                                            onChange={(e) => setBookingPaymentFilter(e.target.value)}
                                            className="w-full sm:w-auto border border-[#720101]/10 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#720101]/20 focus:border-[#720101]/30 text-sm bg-white text-slate-700"
                                        >
                                            <option value="all">All Payments</option>
                                            <option value="pending">Pending</option>
                                            <option value="complete">Complete</option>
                                        </select>
                                    </div>
                                </div>
                                {(() => {
                                    const filteredBookings = bookings;

                                    if (filteredBookings.length === 0) {
                                        return <div className="p-12 text-center text-slate-500 bg-[#fffaf3] border border-amber-100 rounded-xl">No bookings match your search.</div>;
                                    }

                                    return (
                                        <div className="space-y-3">
                                            {filteredBookings.map(function (booking) {
                                        var progress = getBookingProgress(booking.payments);
                                        var isExpanded = expandedBooking === booking.id;
                                        var totalCost = toMoneyNumber(booking.totalCost);
                                        var paidAmount = (booking.payments || [])
                                            .filter(function (p) { return isPaidStatus(p.status); })
                                            .reduce(function (sum, p) { return sum + toMoneyNumber(p.amount); }, 0);
                                        var remainingBalance = Math.max(totalCost - paidAmount, 0);

                                        return (
                                            <div key={booking.id} className="bg-white rounded-xl border border-[#720101]/10 overflow-hidden hover:border-[#720101]/20 transition-colors">
                                                <div
                                                    className="px-5 py-4 cursor-pointer hover:bg-[#fffaf3] transition-colors"
                                                    onClick={() => setExpandedBooking(isExpanded ? null : booking.id)}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <div className="min-w-[5.4rem] rounded-lg border border-[#720101]/10 bg-[#fffaf3] px-3 py-2">
                                                                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Booking</p>
                                                                <p className="text-sm font-black text-[#720101]">{'#' + booking.id}</p>
                                                            </div>
                                                            <div>
                                                                <h3 className="font-bold text-slate-950">
                                                                    {booking.client_full_name || booking.username}
                                                                </h3>
                                                                <p className="text-sm text-slate-500">
                                                                    {formatAccountingDate(booking.event_date)} / {booking.pax || 0} guests
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-6">
                                                            <div className="text-right">
                                                                <p className="text-xs text-slate-400 uppercase tracking-wider">Total Cost</p>
                                                                <p className="text-lg font-black text-slate-950">{'P' + totalCost.toLocaleString()}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xs text-slate-400 uppercase tracking-wider">Payments</p>
                                                                <p className="text-sm font-semibold">
                                                                    <span className="text-emerald-700">{progress.verified}</span>
                                                                    <span className="text-slate-400">{'/' + progress.total}</span>
                                                                    <span className="text-slate-400 text-xs ml-1">verified</span>
                                                                </p>
                                                            </div>
                                                            <svg
                                                                className={'w-5 h-5 text-slate-400 transition-transform duration-200' + (isExpanded ? ' rotate-180' : '')}
                                                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                                            >
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 w-full bg-amber-50 rounded-full h-2">
                                                        <div
                                                            className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                                                            style={{ width: (totalCost > 0 ? (paidAmount / totalCost) * 100 : 0) + '%' }}
                                                        ></div>
                                                    </div>
                                                    <div className="flex justify-between mt-1 text-xs text-slate-400">
                                                        <span>{'Paid: P' + paidAmount.toLocaleString()}</span>
                                                        <span>{'Balance: P' + remainingBalance.toLocaleString()}</span>
                                                    </div>
                                                </div>

                                                {isExpanded && (
                                                    <div className="border-t border-[#720101]/10 px-6 py-4 bg-[#fffaf3] animate-fadeIn">
                                                        <div className="mb-4 flex flex-wrap gap-4 text-sm text-slate-600">
                                                            {booking.client_email && (
                                                                <span className="flex items-center gap-1">
                                                                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                                    {booking.client_email}
                                                                </span>
                                                            )}
                                                            {booking.client_phone && (
                                                                <span className="flex items-center gap-1">
                                                                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                                    {booking.client_phone}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-sm">
                                                                <thead>
                                                                    <tr className="text-xs uppercase text-slate-400 border-b border-amber-100">
                                                                        <th className="text-left py-2 pr-4">Payment Tier</th>
                                                                        <th className="text-right py-2 px-4">Amount</th>
                                                                        <th className="text-center py-2 px-4">Due Date</th>
                                                                        <th className="text-center py-2 px-4">Status</th>
                                                                        <th className="text-right py-2 pl-4">Actions</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {booking.payments.map(function (payment) {
                                                                        var typeInfo = PAYMENT_TYPE_LABELS[payment.payment_type] || { label: payment.payment_type, pct: '', icon: '-' };
                                                                        var badge = getStatusBadge(payment.status, payment.due_date);

                                                                        return (
                                                                            <tr key={payment.id} className="border-b border-amber-100/70 last:border-b-0">
                                                                                <td className="py-3 pr-4">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#720101]/10 text-sm font-bold text-[#720101]">{typeInfo.icon}</span>
                                                                                        <div>
                                                                                            <p className="font-bold text-slate-950">{typeInfo.label}</p>
                                                                                            <p className="text-xs text-slate-400">{typeInfo.pct + ' of total'}</p>
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="text-right py-3 px-4">
                                                                                    <span className="font-bold text-slate-950">{'P' + (payment.amount ? payment.amount.toLocaleString() : '0')}</span>
                                                                                </td>
                                                                                <td className="text-center py-3 px-4">
                                                                                    <span className="text-slate-600">{formatAccountingDate(payment.due_date, '-')}</span>
                                                                                </td>
                                                                                <td className="text-center py-3 px-4">
                                                                                    <span className={'staff-status ' + badge.cls}>
                                                                                        {badge.text}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="text-right py-3 pl-4">
                                                                                    {payment.status === 'Pending' ? (
                                                                                        <div className="flex justify-end gap-2">
                                                                                            <button
                                                                                                onClick={function (e) { e.stopPropagation(); handleVerify(payment.id, 'Verify'); }}
                                                                                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-sm transition-colors"
                                                                                            >
                                                                                                Verify
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={function (e) { e.stopPropagation(); handleVerify(payment.id, 'Reject'); }}
                                                                                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-sm transition-colors"
                                                                                            >
                                                                                                Reject
                                                                                            </button>
                                                                                            {(payment.status === 'Pending' || new Date(payment.due_date) < new Date()) && (
                                                                                                <button
                                                                                                    onClick={function (e) { e.stopPropagation(); handleSendReminder(payment.id); }}
                                                                                                    disabled={remindingPaymentId === payment.id}
                                                                                                    className={"bg-amber-500 hover:bg-amber-600 text-slate-950 px-3 py-1 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1" + (remindingPaymentId === payment.id ? ' opacity-75 cursor-not-allowed' : '')}
                                                                                                >
                                                                                                    {remindingPaymentId === payment.id ? (
                                                                                                        <>
                                                                                                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                                                                                            Sending...
                                                                                                        </>
                                                                                                    ) : (
                                                                                                        <>
                                                                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                                                                                            Remind
                                                                                                        </>
                                                                                                    )}
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    ) : isPaidStatus(payment.status) ? (
                                                                                        <div className="flex justify-end items-center gap-3">
                                                                                            <span className="text-emerald-700 text-xs font-bold">{staffPaymentStatus(payment.status, payment.due_date).label}</span>
                                                                                            <button
                                                                                                onClick={function (e) { e.stopPropagation(); setReceiptModal({ isOpen: true, payment: payment, booking: booking }); }}
                                                                                                className="text-[#720101] hover:text-[#4d0101] text-xs font-bold underline flex items-center gap-1"
                                                                                            >
                                                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                                                                Receipt
                                                                                            </button>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <span className="text-slate-400 text-xs">-</span>
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>

                                                        <div className="mt-4 pt-3 border-t border-amber-100 flex justify-between items-center">
                                                            <div className="flex items-center gap-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditPaymentModal({ isOpen: true, payment: booking.payments?.[0] || null, booking })}
                                                                    className="bg-[#720101]/10 hover:bg-[#720101]/15 text-[#720101] px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 uppercase tracking-wide"
                                                                >
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                                    Edit term
                                                                </button>
                                                                <div className="text-xs font-bold text-slate-400">
                                                                    {'#' + booking.id + ' / ' + booking.status}
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-6 text-sm">
                                                                <div>
                                                                    <span className="text-slate-400">Paid: </span>
                                                                    <span className="font-semibold text-emerald-700">{'P' + paidAmount.toLocaleString()}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-slate-400">Remaining: </span>
                                                                    <span className={'font-semibold ' + (remainingBalance > 0 ? 'text-red-600' : 'text-emerald-700')}>
                                                                        {'P' + remainingBalance.toLocaleString()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                            })}
                                        </div>
                                    );
                                })()}
                                {bookingPagination && bookingPagination.lastPage > 1 && (
                                    <div className="mt-6 flex flex-col gap-3 border-t border-amber-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-sm font-medium text-slate-500">
                                            Showing {bookingPagination.from || 0}-{bookingPagination.to || 0} of {bookingPagination.total || 0} bookings
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                disabled={bookingPagination.currentPage <= 1}
                                                onClick={() => setBookingPage((page) => Math.max(page - 1, 1))}
                                                className="rounded-lg border border-[#720101]/10 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition-colors hover:text-[#720101] disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                Previous
                                            </button>
                                            <span className="rounded-lg bg-[#fffaf3] px-3 py-2 text-sm font-black text-[#720101]">
                                                {bookingPagination.currentPage} / {bookingPagination.lastPage}
                                            </span>
                                            <button
                                                type="button"
                                                disabled={bookingPagination.currentPage >= bookingPagination.lastPage}
                                                onClick={() => setBookingPage((page) => Math.min(page + 1, bookingPagination.lastPage))}
                                                className="rounded-lg border border-[#720101]/10 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition-colors hover:text-[#720101] disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'ledger' && (
                    <div>
                        <div className="marketing-panel staff-filter-bar mb-4">
                            <div className="flex flex-col flex-1 min-w-[200px]">
                                <label className="text-xs font-black uppercase text-slate-500 mb-1">Search Client</label>
                                <input
                                    type="text"
                                    placeholder="Search by name..."
                                    value={ledgerFilter.clientSearch || ''}
                                    onChange={function (e) { setLedgerFilter(Object.assign({}, ledgerFilter, { clientSearch: e.target.value })); }}
                                    className="staff-control"
                                />
                            </div>
                            <div className="flex flex-col min-w-[150px]">
                                <label className="text-xs font-black uppercase text-slate-500 mb-1">Package</label>
                                <select
                                    value={ledgerFilter.packageFilter || 'All'}
                                    onChange={function (e) { setLedgerFilter(Object.assign({}, ledgerFilter, { packageFilter: e.target.value })); }}
                                    className="staff-control"
                                >
                                    <option value="All">All Packages</option>
                                    <option value="standard">Standard</option>
                                    <option value="deluxe">Deluxe</option>
                                    <option value="premium">Premium</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs font-black uppercase text-slate-500 mb-1">Status</label>
                                <select
                                    value={ledgerFilter.status}
                                    onChange={function (e) { setLedgerFilter(Object.assign({}, ledgerFilter, { status: e.target.value })); }}
                                    className="staff-control"
                                >
                                    <option value="All">All</option>
                                    <option value="Verified">Verified</option>
                                    <option value="Paid">Paid</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Rejected">Rejected</option>
                                    <option value="Refunded">Refunded</option>
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs font-black uppercase text-slate-500 mb-1">Payment Type</label>
                                <select
                                    value={ledgerFilter.payment_type || 'All'}
                                    onChange={function (e) { setLedgerFilter(Object.assign({}, ledgerFilter, { payment_type: e.target.value })); }}
                                    className="staff-control"
                                >
                                    <option value="All">All types</option>
                                    <option value="Reservation">Reservation</option>
                                    <option value="DownPayment">Down Payment</option>
                                    <option value="Final">Final Payment</option>
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs font-black uppercase text-slate-500 mb-1">Method</label>
                                <select
                                    value={ledgerFilter.method || 'All'}
                                    onChange={function (e) { setLedgerFilter(Object.assign({}, ledgerFilter, { method: e.target.value })); }}
                                    className="staff-control"
                                >
                                    <option value="All">All methods</option>
                                    <option value="PayMongo">PayMongo</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Manual">Manual</option>
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs font-black uppercase text-slate-500 mb-1">Start Date</label>
                                <input
                                    type="date"
                                    value={ledgerFilter.startDate}
                                    onChange={function (e) { setLedgerFilter(Object.assign({}, ledgerFilter, { startDate: e.target.value })); }}
                                    className="staff-control"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs font-black uppercase text-slate-500 mb-1">End Date</label>
                                <input
                                    type="date"
                                    value={ledgerFilter.endDate}
                                    onChange={function (e) { setLedgerFilter(Object.assign({}, ledgerFilter, { endDate: e.target.value })); }}
                                    className="staff-control"
                                />
                            </div>
                        </div>

                        <div className="marketing-panel overflow-hidden p-5">
                            {loading ? (
                                <StaffSkeleton rows={6} label="Loading transactions" />
                            ) : (() => {
                                const filteredLedgerPayments = ledgerPayments.filter(p => {
                                    if (ledgerFilter.clientSearch && !((p.client_full_name || p.username || '').toLowerCase().includes(ledgerFilter.clientSearch.toLowerCase()))) return false;
                                    if (ledgerFilter.packageFilter && ledgerFilter.packageFilter !== 'All' && p.package_id !== ledgerFilter.packageFilter) return false;
                                    return true;
                                });

                                if (filteredLedgerPayments.length === 0) {
                                    return <div className="p-6 text-center text-slate-500">No records found matching filters.</div>;
                                }

                                const grouped = {};
                                filteredLedgerPayments.forEach(p => {
                                    if (!grouped[p.booking_id]) {
                                        grouped[p.booking_id] = {
                                            id: p.booking_id,
                                            client_full_name: p.client_full_name || p.username,
                                            package_id: p.package_id,
                                            event_date: p.event_date,
                                            payments: []
                                        };
                                    }
                                    grouped[p.booking_id].payments.push(p);
                                });
                                const groupedArray = Object.values(grouped);
                                const pagedGroupedArray = paginate(groupedArray, ledgerPage, ledgerPerPage);

                                return (
                                    <>
                                    <div className="space-y-4">
                                        {pagedGroupedArray.map(booking => (
                                            <div key={booking.id} className="bg-white border border-[#720101]/10 rounded-xl overflow-hidden hover:border-[#720101]/20 transition-colors">
                                                <div className="bg-[#fffaf3] px-6 py-4 border-b border-amber-100 flex flex-wrap justify-between items-center gap-4">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-slate-950">{booking.client_full_name}</h3>
                                                        <p className="text-sm text-slate-500 mt-1">
                                                            Booking #{booking.id} <span className="mx-2">/</span>
                                                            <span className="font-medium">{booking.package_id ? booking.package_id.charAt(0).toUpperCase() + booking.package_id.slice(1) : 'Custom'} Package</span>
                                                        </p>
                                                    </div>
                                                    <div className="text-right bg-white px-4 py-2 rounded-xl border border-amber-100 shadow-sm">
                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Event Date</p>
                                                        <p className="text-sm font-semibold text-slate-800">
                                                            {booking.event_date ? new Date(booking.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-white border-b border-amber-100">
                                                            <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                                <th className="text-left py-4 px-6">Payment Type</th>
                                                                <th className="text-right py-4 px-6">Amount</th>
                                                                <th className="text-center py-4 px-6">Due Date</th>
                                                                <th className="text-center py-4 px-6">Status</th>
                                                                <th className="text-right py-4 px-6">Receipt</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-amber-50 bg-white">
                                                            {booking.payments.map(p => {
                                                                var badge = getStatusBadge(p.status, p.due_date);
                                                                var typeInfo = PAYMENT_TYPE_LABELS[p.payment_type] || { label: p.payment_type || 'Legacy', icon: '-' };
                                                                return (
                                                                    <tr key={p.id} className="hover:bg-[#fffaf3] transition-colors">
                                                                        <td className="py-4 px-6">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#720101]/10 text-xs font-bold text-[#720101] ring-1 ring-[#720101]/10">
                                                                                    {typeInfo.icon}
                                                                                </div>
                                                                                <span className="font-bold text-slate-950">{typeInfo.label}</span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="py-4 px-6 text-right font-bold text-slate-950">
                                                                            {'P' + (p.amount ? p.amount.toLocaleString() : '0')}
                                                                        </td>
                                                                        <td className="py-4 px-6 text-center text-slate-600 font-medium">
                                                                            {p.due_date ? new Date(p.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                                                                        </td>
                                                                        <td className="py-4 px-6 text-center">
                                                                            <span className={'staff-status ' + badge.cls}>
                                                                                {badge.text}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-4 px-6 text-right">
                                                                            {isPaidStatus(p.status) ? (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setReceiptModal({ isOpen: true, payment: p, booking })}
                                                                                    className="staff-row-action"
                                                                                >
                                                                                    Receipt
                                                                                </button>
                                                                            ) : (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => { setPaymentSegment('overdue'); setActiveTab('payments'); }}
                                                                                    className="staff-row-action"
                                                                                >
                                                                                    Review
                                                                                </button>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <StaffPagination page={ledgerPage} perPage={ledgerPerPage} total={groupedArray.length} onPageChange={setLedgerPage} onPerPageChange={setLedgerPerPage} />
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                )}

                {activeTab === 'reconciliation' && (
                    <div className="marketing-panel overflow-hidden">
                        <div className="staff-filter-bar">
                            <input
                                value={reconciliationSearch}
                                onChange={(event) => setReconciliationSearch(event.target.value)}
                                className="staff-control"
                                placeholder="Search booking, customer, or payment reference"
                            />
                            <select value={reconciliationTypeFilter} onChange={(event) => setReconciliationTypeFilter(event.target.value)} className="staff-control">
                                <option value="all">All issue types</option>
                                {Object.entries(exceptionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                        </div>
                        {loading ? (
                            <StaffSkeleton variant="panel" rows={3} label="Loading payment issues" />
                        ) : filteredReconciliationItems.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center">
                                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-4">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <h3 className="text-lg font-bold text-slate-950">No payment issues</h3>
                                <p className="text-slate-500 mt-1 max-w-sm">Online checkout and staff payment records are currently aligned.</p>
                            </div>
                        ) : (
                            <>
                            <div className="staff-table-wrap custom-scrollbar">
                                <table className="staff-table">
                                    <thead>
                                        <tr>
                                            <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Payment</th>
                                            <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Customer</th>
                                            <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Payment References</th>
                                            <th className="px-6 py-4 text-center font-bold text-slate-500 uppercase tracking-wider text-xs">Online Update</th>
                                            <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Issue</th>
                                            <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase tracking-wider text-xs">Next Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedReconciliationItems.map((item) => {
                                            const nextAction = getReconciliationAction(item);

                                            return (
                                            <tr key={item.id} className="border-b border-amber-50 hover:bg-[#fffaf3] transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-950">#{item.id} / Booking #{item.booking_id}</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">{item.payment_type || 'Payment'} / {item.status}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-950">{item.client_full_name || 'Customer'}</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">{formatAccountingDate(item.event_date)}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-1 text-xs font-semibold text-slate-500">
                                                        <div>Checkout ref: <span className="font-mono text-slate-800">{item.paymongo_checkout_session_id || '-'}</span></div>
                                                        <div>Payment ref: <span className="font-mono text-slate-800">{item.paymongo_payment_id || '-'}</span></div>
                                                        <div>Customer ref: <span className="font-mono text-slate-800">{item.paymongo_reference_number || '-'}</span></div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`staff-status ${item.webhook_received ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                                        {item.webhook_received ? 'Received' : 'Waiting'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-2">
                                                        {(item.exceptions || []).map((exception) => (
                                                            <span key={exception} className="staff-status bg-red-50 text-red-700 ring-1 ring-red-100">
                                                                {exceptionLabels[exception] || exception}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="staff-recon-action">
                                                        <p>{nextAction.detail}</p>
                                                        <button
                                                            type="button"
                                                            disabled={nextAction.disabled}
                                                            onClick={nextAction.onClick}
                                                            className={`staff-row-action ${nextAction.tone === 'primary' ? 'staff-row-action-primary' : ''} ${nextAction.tone === 'danger' ? 'staff-row-action-danger' : ''} ${nextAction.disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                        >
                                                            {nextAction.label}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <StaffPagination page={reconciliationPage} perPage={reconciliationPerPage} total={filteredReconciliationItems.length} onPageChange={setReconciliationPage} onPerPageChange={setReconciliationPerPage} />
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'refunds' && (
                    <div className="marketing-panel overflow-hidden">
                        <div className="staff-surface-head p-5 pb-0">
                            <div>
                                <p className="marketing-kicker">Refunds</p>
                                <h3 className="mt-1 text-lg font-black text-slate-950">Refund review and processing</h3>
                                <p className="staff-section-copy">Review refundable amounts, provider references, manual cases, and completed refund work.</p>
                            </div>
                        </div>
                        <div className="staff-tab-strip mx-5 mt-4">
                            {refundSegments.map((segment) => (
                                <button
                                    key={segment.id}
                                    type="button"
                                    onClick={() => setRefundSegment(segment.id)}
                                    className={`staff-tab-pill ${refundSegment === segment.id ? 'is-active' : ''}`}
                                >
                                    {segment.label}
                                </button>
                            ))}
                        </div>
                        <div className="staff-filter-bar">
                            <input
                                value={refundSearch}
                                onChange={(event) => setRefundSearch(event.target.value)}
                                className="staff-control"
                                placeholder="Search booking, customer, or email"
                            />
                        </div>
                        {loading ? (
                            <StaffSkeleton rows={5} label="Loading refund queue" />
                        ) : filteredRefundQueue.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center">
                                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-4">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <h3 className="text-lg font-bold text-slate-950">Queue is Empty</h3>
                                <p className="text-slate-500 mt-1 max-w-sm">There are currently no cancelled bookings with un-refunded payments.</p>
                            </div>
                        ) : (
                            <>
                            <div className="staff-table-wrap custom-scrollbar">
                                <table className="staff-table">
                                    <thead>
                                        <tr>
                                            <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider text-xs w-20">Booking No.</th>
                                            <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider text-xs">Client Name</th>
                                            <th className="px-6 py-4 text-center font-bold text-slate-500 uppercase tracking-wider text-xs">Event Date</th>
                                            <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase tracking-wider text-xs hidden md:table-cell">Total Paid</th>
                                            <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase tracking-wider text-xs">Refund Amount (minus 10%)</th>
                                            <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase tracking-wider text-xs">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedRefundQueue.map((item) => {
                                            // Deduct 10% penalty for late cancellation
                                            const penalty = item.total_paid * 0.10;
                                            const refundAmount = item.total_paid - penalty;
                                            const canRetryProvider = item.refund_cases?.[0]?.next_actions?.includes('retry_provider_refund');

                                            return (
                                                <tr key={item.booking_id} className="border-b border-amber-50 hover:bg-[#fffaf3] transition-colors">
                                                    <td className="px-6 py-4 text-left font-bold text-slate-950">#{item.booking_id}</td>
                                                    <td className="px-6 py-4 text-left">
                                                        <div className="font-bold text-slate-950">{item.client_full_name}</div>
                                                        <div className="text-xs text-slate-500 mt-0.5">{item.client_email}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-slate-600 font-medium whitespace-nowrap">{formatAccountingDate(item.event_date)}</td>
                                                    <td className="px-6 py-4 text-right hidden md:table-cell text-slate-500 line-through">
                                                        PHP {item.total_paid ? item.total_paid.toLocaleString() : '0'}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-bold text-[#720101]">
                                                        PHP {refundAmount > 0 ? refundAmount.toLocaleString() : '0'}
                                                        <div className="text-[10px] text-slate-400 font-normal mt-1">(PHP {penalty.toLocaleString()} fee deducted)</div>
                                                        <div className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-500">{item.refund_status || 'Needs Review'}</div>
                                                        {item.refund_cases?.[0]?.notes && <div className="mt-1 max-w-[14rem] text-right text-[10px] font-semibold text-slate-400">{item.refund_cases[0].notes}</div>}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex flex-wrap justify-end gap-2">
                                                            <button
                                                                onClick={() => canRetryProvider ? openRefundRetryConfirm(item, refundAmount) : openRefundConfirm(item.booking_id, refundAmount)}
                                                                className="marketing-primary-btn px-4 py-2 text-sm whitespace-nowrap"
                                                            >
                                                                {canRetryProvider ? 'Retry Provider' : 'Process Refund'}
                                                            </button>
                                                            {item.refund_cases?.length > 0 && (
                                                                <>
                                                                    <button type="button" onClick={() => openRefundActionPrompt(item, 'mark_manually_refunded')} className="staff-row-action text-xs">Manual</button>
                                                                    <button type="button" onClick={() => openRefundActionPrompt(item, 'mark_forfeited')} className="staff-row-action text-xs">Forfeit</button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <StaffPagination page={refundPage} perPage={refundPerPage} total={filteredRefundQueue.length} onPageChange={setRefundPage} onPerPageChange={setRefundPerPage} />
                            </>
                        )}
                    </div>
                )}
                {activeTab === 'history' && (
                    <EventHistoryPanel role="accounting" onToast={(message, type) => setToast({ message, type })} />
                )}
                {activeTab === 'settings' && (
                    <RoleSettingsPanel role="accounting" onNavigate={setActiveTab} />
                )}
            {/* Receipt Modal */}
            <ReceiptModal
                isOpen={receiptModal.isOpen}
                onClose={() => setReceiptModal({ isOpen: false, payment: null, booking: null })}
                payment={receiptModal.payment}
                booking={receiptModal.booking}
            />

            {/* Payment Term Editor Modal */}
            <PaymentTermEditorModal
                isOpen={editPaymentModal.isOpen}
                onClose={() => setEditPaymentModal({ isOpen: false, payment: null, booking: null })}
                booking={editPaymentModal.booking}
                payment={editPaymentModal.payment}
                onSuccess={() => {
                    setEditPaymentModal({ isOpen: false, payment: null, booking: null });
                    setToast({ message: 'Payment terms updated successfully!', type: 'success' });
                    clearSmartCacheForPrefix(smartCacheKey('accounting:'));
                    fetchBookings({ force: true }); // Refresh data
                }}
            />

            <ConfirmModal
                isOpen={refundConfirm.isOpen}
                title={`${refundConfirm.action === 'retry_provider_refund' ? 'Retry provider refund' : 'Process refund'} for booking #${refundConfirm.bookingId || ''}?`}
                message={refundConfirm.action === 'retry_provider_refund'
                    ? `Accounting will retry the PayMongo refund for ${'P' + Number(refundConfirm.refundAmount || 0).toLocaleString()} and keep the case in review if the provider fails again.`
                    : `Accounting will create a refund case, retain the non-refundable reservation fee, and refund ${'P' + Number(refundConfirm.refundAmount || 0).toLocaleString()} where payment references are available.`}
                confirmText={refundConfirm.action === 'retry_provider_refund' ? 'Retry Refund' : 'Process Refund'}
                tone="danger"
                busy={refundProcessing}
                onCancel={() => setRefundConfirm({ isOpen: false, bookingId: null, refundAmount: 0, action: 'process', refundCaseId: null })}
                onConfirm={handleProcessRefund}
            />
            <PromptModal
                isOpen={refundActionPrompt.isOpen}
                title={refundActionPrompt.title}
                message={refundActionPrompt.message}
                label="Refund note"
                placeholder="Add provider reference, settlement details, or policy reason."
                minLength={5}
                confirmText="Save"
                busy={refundActionPrompt.busy}
                onCancel={() => setRefundActionPrompt({ isOpen: false, bookingId: null, refundCaseId: null, action: '', title: '', message: '', busy: false })}
                onConfirm={submitRefundAction}
            />

            {toast && (
                <div className="pointer-events-none fixed bottom-5 right-5 z-50 animate-slideUp">
                    <div className="pointer-events-auto flex max-w-[360px] items-start gap-3 rounded-xl bg-[#fffaf3] px-4 py-3 text-sm shadow-[0_10px_30px_rgba(50,35,20,0.18)]">
                        <span className={'min-w-0 flex-1 font-semibold leading-5 ' + (toast.type === 'error' ? 'text-[#8b0000]' : 'text-[#374151]')}>{toast.message}</span>
                        <button onClick={function () { setToast(null); }} className="-mr-1 rounded-md p-1 text-[#8a6a46] transition hover:bg-[#f5eadb] hover:text-[#720101]">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            )}
        </StaffWorkspaceLayout>
    );
};

export default DashboardAccounting;
