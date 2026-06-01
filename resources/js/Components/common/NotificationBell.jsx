import React, { useState, useEffect, useMemo, useRef } from 'react';
import { router, usePage } from '@inertiajs/react';
import useLiveResource from '../../hooks/useLiveResource';
import csrfFetch from '../../utils/csrf';
import { operationalChannelsForUser } from '../../utils/liveChannels';
import { LiveSyncIndicator, SoftRefreshBoundary } from './LiveFeedback';

const NOTIFICATION_TIME_GROUPS = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'this-week', label: 'This Week' },
    { id: 'this-month', label: 'This Month' },
    { id: 'older', label: 'Older' },
];
const NAVIGATION_QUERY_CHANGE_EVENT = 'ecs:navigation-query-change';

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const startOfWeek = (date) => {
    const start = startOfDay(date);
    const day = start.getDay();
    const distanceFromMonday = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - distanceFromMonday);
    return start;
};

const getNotificationTimeGroup = (createdAt) => {
    const createdDate = new Date(createdAt);
    if (Number.isNaN(createdDate.getTime())) return 'older';

    const now = new Date();
    const createdDay = startOfDay(createdDate);
    const today = startOfDay(now);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (createdDay.getTime() === today.getTime()) return 'today';
    if (createdDay.getTime() === yesterday.getTime()) return 'yesterday';
    if (createdDay >= startOfWeek(now)) return 'this-week';
    if (createdDay >= new Date(now.getFullYear(), now.getMonth(), 1)) return 'this-month';
    return 'older';
};

const toTitleLabel = (value, fallback = 'Notification') => {
    const text = String(value || '').replace(/[_-]+/g, ' ').trim();
    if (!text) return fallback;
    return text.replace(/\w\S*/g, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
};

const appendQueryParams = (href, params = {}) => {
    if (typeof window === 'undefined') return href;

    const url = new URL(href || '/', window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            url.searchParams.set(key, String(value));
        }
    });
    return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : url.toString();
};

const isSpecificActionUrl = (actionUrl) => {
    if (!actionUrl || typeof window === 'undefined') return false;

    try {
        const url = new URL(actionUrl, window.location.origin);
        const genericDashboards = new Set(['/dashboard/admin', '/dashboard/marketing', '/dashboard/accounting', '/dashboard/client']);
        if (!genericDashboards.has(url.pathname)) return true;
        return ['tab', 'workspace', 'booking', 'conversation', 'customer', 'customerQuery', 'target'].some(key => url.searchParams.has(key)) || Boolean(url.hash);
    } catch (e) {
        return false;
    }
};

const notificationText = (notification) => [
    notification.type,
    notification.category,
    notification.target_type,
    notification.title,
    notification.message,
].filter(Boolean).join(' ').toLowerCase();

const hasAnySignal = (text, signals) => signals.some(signal => text.includes(signal));

const getNotificationCustomerQuery = (notification) => (
    notification.customer_name
    || notification.customer_email
    || notification.customer_phone
    || ''
);

const getNotificationRouteParams = (notification, { includeCustomer = false } = {}) => {
    const bookingId = notification.booking_id || (notification.target_type === 'booking' ? notification.target_id : null);
    const conversationId = notification.conversation_id || (notification.target_type === 'conversation' ? notification.target_id : null);
    const params = {};

    if (bookingId) params.booking = bookingId;
    if (conversationId) params.conversation = conversationId;

    if (includeCustomer) {
        const customerQuery = getNotificationCustomerQuery(notification);
        if (notification.customer_id) params.customer = notification.customer_id;
        if (customerQuery) params.customerQuery = customerQuery;
    }

    return params;
};

const STAFF_DASHBOARD_PATHS = new Set(['/dashboard/admin', '/dashboard/marketing', '/dashboard/accounting']);

const buildRoleDashboardHref = (role, tab, extraParams = {}) => {
    const normalizedRole = String(role || '').toLowerCase();
    if (normalizedRole === 'admin') {
        const workspace = extraParams.workspace || 'admin';
        const params = { workspace, tab, ...extraParams };
        delete params.workspace;
        return appendQueryParams('/dashboard/admin', { workspace, ...params });
    }
    if (normalizedRole === 'marketing') return appendQueryParams('/dashboard/marketing', { tab, ...extraParams });
    if (normalizedRole === 'accounting') return appendQueryParams('/dashboard/accounting', { tab, ...extraParams });
    return appendQueryParams('/dashboard/client', { tab, ...extraParams });
};

const appendStaffNotificationContext = (href, notification, user) => {
    if (typeof window === 'undefined') return href;
    if (!['admin', 'marketing', 'accounting'].includes(String(user?.role || '').toLowerCase())) return href;

    const url = new URL(href, window.location.origin);
    if (!STAFF_DASHBOARD_PATHS.has(url.pathname)) return href;

    return appendQueryParams(href, getNotificationRouteParams(notification, { includeCustomer: true }));
};

const inferNotificationDestination = (notification, user) => {
    if (isSpecificActionUrl(notification.action_url)) {
        return appendStaffNotificationContext(appendQueryParams(notification.action_url), notification, user);
    }

    const role = String(user?.role || '').toLowerCase();
    const text = notificationText(notification);
    const bookingId = notification.booking_id || (notification.target_type === 'booking' ? notification.target_id : null);
    const conversationId = notification.conversation_id || (notification.target_type === 'conversation' ? notification.target_id : null);
    const commonParams = getNotificationRouteParams(notification);
    const adminContextParams = getNotificationRouteParams(notification, { includeCustomer: true });
    const staffContextParams = ['admin', 'marketing', 'accounting'].includes(role)
        ? getNotificationRouteParams(notification, { includeCustomer: true })
        : commonParams;
    const isRefund = hasAnySignal(text, ['refund', 'cancel']);
    const isPayment = hasAnySignal(text, ['payment', 'finance', 'receipt', 'paid', 'verified', 'balance']);
    const isMessage = hasAnySignal(text, ['chat', 'message', 'inquiry', 'conversation']);
    const isMenu = hasAnySignal(text, ['menu', 'dish', 'pricing update']);
    const isAnnouncement = hasAnySignal(text, ['announcement']);
    const isFeedback = hasAnySignal(text, ['feedback', 'review']);
    const isAvailability = hasAnySignal(text, ['availability', 'calendar']);
    const isTasting = hasAnySignal(text, ['tasting']);
    const isLead = hasAnySignal(text, ['lead', 'guest inquiry', 'contact']);
    const isCompleted = hasAnySignal(text, ['completed']);
    const isApproved = hasAnySignal(text, ['confirmed', 'approved']);

    if (role === 'admin') {
        if (isRefund) return buildRoleDashboardHref('admin', 'refunds', { workspace: 'accounting', ...adminContextParams });
        if (isPayment) return buildRoleDashboardHref('admin', 'payments', { workspace: 'accounting', ...adminContextParams });
        if (isMessage || isLead) return buildRoleDashboardHref('admin', 'messages', { workspace: 'marketing', ...adminContextParams });
        if (isTasting) return buildRoleDashboardHref('admin', 'tastings', { workspace: 'marketing', ...adminContextParams });
        if (isAvailability) return buildRoleDashboardHref('admin', 'availability', { workspace: 'marketing', ...adminContextParams });
        if (isMenu) return buildRoleDashboardHref('admin', 'bookings', { workspace: 'marketing', ...adminContextParams });
        if (isAnnouncement) return buildRoleDashboardHref('admin', 'announcements', { workspace: 'customer', ...adminContextParams });
        if (notification.customer_id && !bookingId && !conversationId) {
            return buildRoleDashboardHref('admin', 'dashboard', { workspace: 'customer', ...adminContextParams });
        }
        return buildRoleDashboardHref('admin', bookingId ? 'bookings' : 'today', { workspace: bookingId ? 'marketing' : 'admin', ...adminContextParams });
    }

    if (role === 'marketing') {
        if (isLead) return buildRoleDashboardHref('marketing', 'leads', staffContextParams);
        if (isMessage) return buildRoleDashboardHref('marketing', 'messages', staffContextParams);
        if (isTasting) return buildRoleDashboardHref('marketing', 'tastings', staffContextParams);
        if (isAvailability) return buildRoleDashboardHref('marketing', 'availability', staffContextParams);
        if (isAnnouncement) return buildRoleDashboardHref('marketing', 'public-content', staffContextParams);
        return buildRoleDashboardHref('marketing', bookingId ? 'bookings' : 'today', staffContextParams);
    }

    if (role === 'accounting') {
        if (isRefund) return buildRoleDashboardHref('accounting', 'refunds', staffContextParams);
        if (hasAnySignal(text, ['reconciliation', 'failed', 'exception', 'overdue'])) {
            return buildRoleDashboardHref('accounting', 'reconciliation', staffContextParams);
        }
        return buildRoleDashboardHref('accounting', isPayment || bookingId || isMenu ? 'payments' : 'today', staffContextParams);
    }

    if (isMessage) return appendQueryParams('/dashboard/client', { chat: 'open', ...commonParams });
    if (isPayment || isApproved) return buildRoleDashboardHref('client', 'payments', commonParams);
    if (isMenu) return buildRoleDashboardHref('client', 'menu', commonParams);
    if (isFeedback) return appendQueryParams('/dashboard/client', { target: 'feedback-request-panel', ...commonParams });
    if (isAnnouncement) return appendQueryParams('/dashboard/client', { target: 'customer-announcements', ...commonParams });
    if (isCompleted) return buildRoleDashboardHref('client', 'history', commonParams);
    return buildRoleDashboardHref('client', bookingId ? 'details' : 'dashboard', commonParams);
};

const getNotificationTitle = (notification) => (
    notification.title
    || (notification.type ? toTitleLabel(notification.type) : toTitleLabel(notification.category, 'Notification'))
);

const formatNotificationBookingRef = (bookingId) => {
    const value = String(bookingId || '').trim();
    if (!value) return '';
    return value.toUpperCase().startsWith('BK-') ? `#${value.toUpperCase()}` : `#BK-${value}`;
};

const getNotificationMetaItems = (notification) => [
    notification.category ? toTitleLabel(notification.category, 'Update') : null,
    notification.staff_name ? `From ${notification.staff_name}` : null,
    notification.customer_name || null,
    notification.booking_id ? formatNotificationBookingRef(notification.booking_id) : null,
    notification.conversation_id ? `Conversation #${notification.conversation_id}` : null,
    notification.target_type && !notification.booking_id ? toTitleLabel(notification.target_type) : null,
    notification.time_ago,
].filter(Boolean);

/**
 * NotificationBell — displays a bell icon with an unread badge.
 * Refreshes unread count only while the page is visible and active.
 * Clicking opens a dropdown panel with recent notifications.
 *
 * Props:
 *   - variant: 'light' (for dark backgrounds like navbar) or 'dark' (for light backgrounds)
 *   - placement: 'inline' or 'fixed-right'
 */
const NotificationBell = ({ variant = 'light', placement = 'inline' }) => {
    const { auth } = usePage().props;
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('new');
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [bellPulse, setBellPulse] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [markAllProcessing, setMarkAllProcessing] = useState(false);
    const [deleteReadProcessing, setDeleteReadProcessing] = useState(false);
    const [removingNotificationIds, setRemovingNotificationIds] = useState(() => new Set());
    const dropdownRef = useRef(null);
    const previousUnreadRef = useRef(0);
    const liveChannels = useMemo(() => operationalChannelsForUser(auth?.user), [auth?.user?.id, auth?.user?.role]);
    const unreadResource = useLiveResource('/api/notifications/unread-count', {
        cacheKey: 'notifications:unread-count',
        channels: liveChannels,
        resources: ['notifications', 'bookings', 'finance', 'chat', 'announcements'],
        interval: 30000,
        select: (payload) => payload,
    });
    const notificationsResource = useLiveResource('/api/notifications?paginated=1&per_page=50', {
        cacheKey: 'notifications:list',
        channels: liveChannels,
        resources: ['notifications', 'bookings', 'finance', 'chat', 'announcements'],
        interval: 30000,
        enabled: isOpen,
        select: (payload) => Array.isArray(payload) ? payload : (payload?.data || []),
    });

    const pulseBell = () => {
        setBellPulse(true);
        window.setTimeout(() => setBellPulse(false), 1200);
    };

    const closeNotifications = () => {
        if (!isOpen || isClosing) return;
        setIsClosing(true);
        window.setTimeout(() => {
            setIsOpen(false);
            setIsClosing(false);
        }, 160);
    };

    const waitForNotificationExit = () => new Promise(resolve => window.setTimeout(resolve, 180));

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                closeNotifications();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, isClosing]);

    useEffect(() => {
        if (!unreadResource.data) return;
        const nextCount = unreadResource.data.count || 0;
        if (previousUnreadRef.current > 0 && nextCount > previousUnreadRef.current) {
            pulseBell();
        }
        previousUnreadRef.current = nextCount;
        setUnreadCount(nextCount);
    }, [unreadResource.data?.count]);

    useEffect(() => {
        if (Array.isArray(notificationsResource.data)) {
            setNotifications(notificationsResource.data);
        }
    }, [notificationsResource.data]);

    const handleToggle = () => {
        if (!isOpen) {
            setIsClosing(false);
            setActiveTab('new');
            setIsOpen(true);
            notificationsResource.refetch({ silent: Boolean(notifications.length), force: true, reason: 'open' });
            return;
        }
        closeNotifications();
    };

    const markAllAsRead = async () => {
        if (markAllProcessing) return;

        const readAt = new Date().toISOString();
        setMarkAllProcessing(true);
        try {
            const res = await csrfFetch('/api/notifications/read-all', { method: 'PUT' });
            if (!res.ok) return;

            setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || readAt })));
            setUnreadCount(0);
            setActiveTab('read');
            unreadResource.refetch({ silent: true, force: true, reason: 'mutation' });
            notificationsResource.refetch({ silent: true, force: true, reason: 'mutation' });
        } catch (e) {
            console.error('Failed to mark all as read');
        } finally {
            setMarkAllProcessing(false);
        }
    };

    const deleteAllRead = async () => {
        if (deleteReadProcessing) return;

        const readIds = notifications
            .filter(notification => notification.read_at)
            .map(notification => notification.id);
        if (readIds.length === 0) return;

        setDeleteReadProcessing(true);
        setRemovingNotificationIds(prev => new Set([...prev, ...readIds]));
        try {
            await waitForNotificationExit();
            setNotifications(prev => prev.filter(notification => !notification.read_at));

            const res = await csrfFetch('/api/notifications/read', { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete read notifications failed');

            notificationsResource.refetch({ silent: true, force: true, reason: 'mutation' });
        } catch (e) {
            console.error('Failed to delete read notifications');
            notificationsResource.refetch({ silent: false, force: true, reason: 'mutation-error' });
        } finally {
            setRemovingNotificationIds(prev => {
                const next = new Set(prev);
                readIds.forEach(id => next.delete(id));
                return next;
            });
            setDeleteReadProcessing(false);
        }
    };

    const removeNotification = async (id) => {
        const target = notifications.find(notification => notification.id === id);
        if (!target?.read_at || removingNotificationIds.has(id)) return;

        setRemovingNotificationIds(prev => new Set(prev).add(id));
        try {
            await waitForNotificationExit();
            setNotifications(prev => prev.filter(notification => notification.id !== id));

            const res = await csrfFetch(`/api/notifications/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Remove notification failed');

            notificationsResource.refetch({ silent: true, force: true, reason: 'mutation' });
        } catch (e) {
            console.error('Failed to remove notification');
            notificationsResource.refetch({ silent: false, force: true, reason: 'mutation-error' });
        } finally {
            setRemovingNotificationIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'booking_live_status':
                return (
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-[#9f6500]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" /></svg>
                    </div>
                );
            case 'booking_confirmed':
                return (
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                );
            case 'booking_cancelled':
                return (
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </div>
                );
            case 'payment_approved':
                return (
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-[#9f6500]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1" /></svg>
                    </div>
                );
            case 'new_booking':
                return (
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-[#720101]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                );
            default:
                return (
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    </div>
                );
        }
    };

    const newNotifications = useMemo(
        () => notifications.filter(notification => !notification.read_at),
        [notifications],
    );
    const readNotifications = useMemo(
        () => notifications.filter(notification => notification.read_at),
        [notifications],
    );
    const activeNotifications = activeTab === 'read' ? readNotifications : newNotifications;

    const timeGroupedNotifications = useMemo(() => {
        const groups = NOTIFICATION_TIME_GROUPS.map(group => ({ ...group, items: [] }));

        activeNotifications.forEach((notification) => {
            const groupId = getNotificationTimeGroup(notification.created_at);
            const group = groups.find(item => item.id === groupId) || groups[groups.length - 1];
            group.items.push(notification);
        });

        return groups.filter((group) => group.items.length > 0);
    }, [activeNotifications]);

    const isLight = variant === 'light';
    const dropdownClass = placement === 'fixed-right'
        ? 'fixed right-3 top-16 w-[min(21rem,calc(100vw-1.25rem))]'
        : 'absolute right-0 mt-2 w-[min(21rem,calc(100vw-1.25rem))]';
    const readCount = readNotifications.length;
    const localUnreadCount = newNotifications.length;
    const displayedUnreadCount = Math.max(unreadCount, localUnreadCount);
    const hasUnreadNotifications = displayedUnreadCount > 0;
    const initialListLoading = notificationsResource.loading && notifications.length === 0;
    const activeActionIsNew = activeTab === 'new';
    const activeActionLabel = activeActionIsNew
        ? (markAllProcessing ? 'Marking...' : 'Mark all as read')
        : (deleteReadProcessing ? 'Deleting...' : 'Delete read');
    const activeActionDisabled = activeActionIsNew
        ? markAllProcessing || initialListLoading || !hasUnreadNotifications
        : deleteReadProcessing || initialListLoading || readCount === 0;
    const emptyState = activeActionIsNew
        ? {
            title: 'No new notifications',
            description: 'You are all caught up.',
        }
        : {
            title: 'No read notifications',
            description: 'Marked notifications will collect here.',
        };

    const openNotificationDestination = (notification) => {
        const href = inferNotificationDestination(notification, auth?.user);
        if (!href || typeof window === 'undefined') return;

        const targetUrl = new URL(href, window.location.origin);
        closeNotifications();

        if (targetUrl.origin !== window.location.origin) {
            window.location.assign(targetUrl.toString());
            return;
        }

        const targetHref = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
        const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;

        if (targetUrl.pathname !== window.location.pathname) {
            router.visit(targetHref);
            return;
        }

        if (targetHref === currentHref) {
            window.history.replaceState(window.history.state, '', targetHref);
        } else {
            window.history.pushState(window.history.state, '', targetHref);
        }

        window.dispatchEvent(new CustomEvent(NAVIGATION_QUERY_CHANGE_EVENT, {
            detail: {
                path: targetUrl.pathname,
                search: targetUrl.search,
                hash: targetUrl.hash,
                params: Object.fromEntries(targetUrl.searchParams.entries()),
            },
        }));
    };

    const handleNotificationKeyDown = (event, notification) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openNotificationDestination(notification);
    };

    return (
        <div className="relative flex-shrink-0" ref={dropdownRef}>
            {/* Bell button */}
            <button
                onClick={handleToggle}
                className={`relative inline-flex h-9 w-9 items-center justify-center p-1 transition-colors ${bellPulse ? 'notification-bell-pulse' : ''} ${isLight ? 'text-white/80 hover:text-white' : 'text-slate-500 hover:text-[#720101]'}`}
                id="notification-bell"
                aria-label="Open notifications"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#f0aa0b] px-1 text-[10px] font-black text-[#1a1a1a] shadow-sm ring-2 ring-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {isOpen && (
                <div className={`${dropdownClass} notification-dropdown-panel ${isClosing ? 'is-closing' : 'is-open'} overflow-hidden rounded-2xl border border-[#720101]/10 bg-white shadow-2xl shadow-slate-950/15 ring-1 ring-black/5 z-50`}>
                    {/* Header */}
                    <div className="border-b border-[#720101]/10 bg-[#fffaf3]">
                        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#9f6500]">Updates</p>
                                <h3 className="mt-0.5 text-sm font-black text-slate-950">Notifications</h3>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <LiveSyncIndicator
                                    state={notificationsResource.syncState}
                                    refreshing={notificationsResource.refreshing}
                                    lastSyncedAt={notificationsResource.lastSyncedAt}
                                    error={notificationsResource.error}
                                    onRetry={notificationsResource.refetch}
                                    compact
                                    visibility={notificationsResource.refreshing ? 'always' : 'exceptions'}
                                />
                                <button
                                    type="button"
                                    onClick={activeActionIsNew ? markAllAsRead : deleteAllRead}
                                    disabled={activeActionDisabled}
                                    className="rounded-full border border-[#720101]/10 bg-white px-2.5 py-1 text-[11px] font-black text-[#720101] transition-colors hover:bg-[#720101] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {activeActionLabel}
                                </button>
                                <button
                                    type="button"
                                    onClick={closeNotifications}
                                    className="p-1 text-slate-400 transition-colors hover:text-[#720101]"
                                    aria-label="Close notifications"
                                    title="Close notifications"
                                >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 px-3 pb-2">
                            {[
                                { id: 'new', label: 'New', count: displayedUnreadCount },
                                { id: 'read', label: 'Read', count: readCount },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center justify-center gap-2 border-b-2 px-3 py-2 text-xs font-black transition-colors ${activeTab === tab.id ? 'border-[#720101] text-[#720101]' : 'border-transparent text-slate-500 hover:text-[#720101]'}`}
                                >
                                    <span>{tab.label}</span>
                                    <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-[10px] ${activeTab === tab.id ? 'bg-[#720101] text-white' : 'bg-white text-slate-500'}`}>
                                        {tab.count > 99 ? '99+' : tab.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Notification list */}
                    <SoftRefreshBoundary
                        loading={notificationsResource.loading}
                        refreshing={notificationsResource.refreshing}
                        hasData={notifications.length > 0}
                        showRefreshBar={false}
                        className="custom-scrollbar max-h-[min(24rem,calc(100vh-7rem))] overflow-y-auto bg-white p-1.5"
                    >
                        {initialListLoading ? (
                            <div className="p-5 text-center">
                                <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-[#720101] border-t-transparent"></div>
                                <p className="text-xs font-bold text-slate-400">Loading updates...</p>
                            </div>
                        ) : activeNotifications.length === 0 ? (
                            <div className="p-5 text-center">
                                <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff7e8] text-[#9f6500]">
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                </div>
                                <p className="text-sm font-black text-slate-700">{emptyState.title}</p>
                                <p className="mt-1 text-xs font-semibold text-slate-400">{emptyState.description}</p>
                            </div>
                        ) : (
                            timeGroupedNotifications.map((group) => (
                                <div key={group.id} className="mb-2">
                                    <p className="px-2 pb-1.5 pt-2 text-[9px] font-black uppercase tracking-widest text-slate-500">{group.label}</p>
                                    {group.items.map((notification, index) => {
                                        const destination = inferNotificationDestination(notification, auth?.user);
                                        const metaItems = getNotificationMetaItems(notification);
                                        const title = getNotificationTitle(notification);

                                        return (
                                            <div
                                                key={notification.id}
                                                role={destination ? 'button' : undefined}
                                                tabIndex={destination ? 0 : undefined}
                                                onClick={() => destination && openNotificationDestination(notification)}
                                                onKeyDown={(event) => destination && handleNotificationKeyDown(event, notification)}
                                                className={`flex items-start gap-2.5 px-2.5 py-2.5 transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-[#720101]/20 ${destination ? 'cursor-pointer' : ''} ${index > 0 ? 'border-t border-black/[.14]' : ''} ${removingNotificationIds.has(notification.id) ? '-translate-y-1 scale-[.98] opacity-0' : 'translate-y-0 scale-100 opacity-100'} ${!notification.read_at ? 'bg-[#fff7e8] hover:bg-[#fff1d8]' : 'hover:bg-slate-50'}`}
                                            >
                                                {getIcon(notification.type)}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className="truncate text-[10px] font-black uppercase tracking-widest text-[#720101]">{title}</p>
                                                        {destination && <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-400">Open</span>}
                                                    </div>
                                                    <p className={`mt-1 break-words text-[13px] leading-5 ${!notification.read_at ? 'font-bold text-slate-950' : 'font-semibold text-slate-600'}`}>
                                                        {notification.message}
                                                    </p>
                                                    {notification.message_preview && (
                                                        <p className="mt-1 break-words text-[12px] font-semibold leading-5 text-slate-500">
                                                            {notification.message_preview}
                                                        </p>
                                                    )}
                                                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                                        {metaItems.map(item => (
                                                            <span key={item} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">
                                                                {item}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                {notification.read_at ? (
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            removeNotification(notification.id);
                                                        }}
                                                        disabled={removingNotificationIds.has(notification.id)}
                                                        className="mt-0.5 p-1 text-slate-300 transition-colors hover:text-red-600 disabled:pointer-events-none"
                                                        aria-label="Remove read notification"
                                                        title="Remove read notification"
                                                    >
                                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                ) : (
                                                    <span className="mt-1 rounded-full bg-[#720101] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                                                        Unread
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </SoftRefreshBoundary>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
