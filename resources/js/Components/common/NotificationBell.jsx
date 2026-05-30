import React, { useState, useEffect, useMemo, useRef } from 'react';
import { usePage } from '@inertiajs/react';
import useLiveResource from '../../hooks/useLiveResource';
import csrfFetch from '../../utils/csrf';
import { operationalChannelsForUser } from '../../utils/liveChannels';
import { LiveSyncIndicator, SoftRefreshBoundary } from './LiveFeedback';

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
    const [notificationPreferences, setNotificationPreferences] = useState(auth?.user?.notification_preferences || {});
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [soundSaving, setSoundSaving] = useState(false);
    const [soundMessage, setSoundMessage] = useState('');
    const [bellPulse, setBellPulse] = useState(false);
    const dropdownRef = useRef(null);
    const previousUnreadRef = useRef(0);
    const soundReadyRef = useRef(false);
    const lastSoundAtRef = useRef(0);
    const liveChannels = useMemo(() => operationalChannelsForUser(auth?.user), [auth?.user?.id, auth?.user?.role]);
    const soundEnabled = !notificationPreferences.quiet_mode && (
        notificationPreferences.sound_enabled ||
        notificationPreferences.notification_sounds ||
        notificationPreferences.message_sounds ||
        notificationPreferences.booking_update_sounds ||
        notificationPreferences.payment_update_sounds ||
        notificationPreferences.staff_update_sounds
    );
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

    // Close dropdown on outside click
    useEffect(() => {
        setNotificationPreferences(auth?.user?.notification_preferences || {});
    }, [auth?.user?.notification_preferences]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        const unlockSound = () => {
            soundReadyRef.current = true;
            window.removeEventListener('pointerdown', unlockSound);
            window.removeEventListener('keydown', unlockSound);
        };
        window.addEventListener('pointerdown', unlockSound, { once: true });
        window.addEventListener('keydown', unlockSound, { once: true });

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('pointerdown', unlockSound);
            window.removeEventListener('keydown', unlockSound);
        };
    }, []);

    const pulseBell = () => {
        setBellPulse(true);
        window.setTimeout(() => setBellPulse(false), 1200);
    };

    const playNotificationSound = ({ force = false } = {}) => {
        if (!force && (!soundEnabled || !soundReadyRef.current)) return false;
        if (!force && Date.now() - lastSoundAtRef.current < 8000) return false;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return false;
            const ctx = new AudioContext();
            const gain = ctx.createGain();
            gain.gain.value = 0.035;
            gain.connect(ctx.destination);

            [440, 660].forEach((frequency, index) => {
                const oscillator = ctx.createOscillator();
                oscillator.type = 'sine';
                oscillator.frequency.value = frequency;
                oscillator.connect(gain);
                oscillator.start(ctx.currentTime + index * 0.08);
                oscillator.stop(ctx.currentTime + index * 0.08 + 0.12);
            });

            lastSoundAtRef.current = Date.now();
            window.setTimeout(() => ctx.close(), 500);
            return true;
        } catch (e) {
            // Browser audio can fail if the user has not interacted yet.
            return false;
        }
    };

    const enableNotificationSound = async () => {
        if (!auth?.user) return;

        soundReadyRef.current = true;
        setSoundSaving(true);
        setSoundMessage('');

        const nextPreferences = {
            ...notificationPreferences,
            quiet_mode: false,
            sound_enabled: true,
        };

        try {
            const response = await csrfFetch('/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: auth.user.full_name || '',
                    username: auth.user.username || '',
                    email: auth.user.email || '',
                    phone: auth.user.phone || '',
                    preferred_contact_method: auth.user.preferred_contact_method || 'email',
                    notification_preferences: nextPreferences,
                    profile_preferences: auth.user.profile_preferences || {},
                }),
            });

            if (!response.ok) {
                throw new Error('Could not save notification sound preference.');
            }

            setNotificationPreferences(nextPreferences);
            const played = playNotificationSound({ force: true });
            if (!played) pulseBell();
            setSoundMessage('Notification sounds enabled.');
        } catch (error) {
            setSoundMessage(error.message || 'Could not enable notification sounds.');
            pulseBell();
        } finally {
            setSoundSaving(false);
        }
    };

    useEffect(() => {
        if (!unreadResource.data) return;
        const nextCount = unreadResource.data.count || 0;
        if (previousUnreadRef.current > 0 && nextCount > previousUnreadRef.current) {
            const played = playNotificationSound();
            if (!played) pulseBell();
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
            notificationsResource.refetch({ silent: Boolean(notifications.length), force: true, reason: 'open' });
        }
        setIsOpen(!isOpen);
    };

    const markAsRead = async (id) => {
        try {
            await csrfFetch(`/api/notifications/${id}/read`, { method: 'PUT' });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
            unreadResource.refetch({ silent: true, force: true, reason: 'mutation' });
        } catch (e) {
            console.error('Failed to mark as read');
        }
    };

    const markAllAsRead = async () => {
        try {
            await csrfFetch('/api/notifications/read-all', { method: 'PUT' });
            setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
            setUnreadCount(0);
            unreadResource.refetch({ silent: true, force: true, reason: 'mutation' });
            notificationsResource.refetch({ silent: true, force: true, reason: 'mutation' });
        } catch (e) {
            console.error('Failed to mark all as read');
        }
    };

    const removeNotification = async (id) => {
        const target = notifications.find(notification => notification.id === id);

        try {
            const res = await csrfFetch(`/api/notifications/${id}`, { method: 'DELETE' });
            if (!res.ok) return;

            setNotifications(prev => prev.filter(notification => notification.id !== id));
            if (target && !target.read_at) {
                setUnreadCount(prev => Math.max(0, prev - 1));
                unreadResource.refetch({ silent: true, force: true, reason: 'mutation' });
            }
        } catch (e) {
            console.error('Failed to remove notification');
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'booking_live_status':
                return (
                    <div className="w-7 h-7 rounded-lg bg-[#fff7e8] ring-1 ring-[#f0aa0b]/25 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-[#9f6500]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" /></svg>
                    </div>
                );
            case 'booking_confirmed':
                return (
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                );
            case 'booking_cancelled':
                return (
                    <div className="w-7 h-7 rounded-lg bg-red-50 ring-1 ring-red-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </div>
                );
            case 'payment_approved':
                return (
                    <div className="w-7 h-7 rounded-lg bg-[#fff7e8] ring-1 ring-[#f0aa0b]/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-[#9f6500]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1" /></svg>
                    </div>
                );
            case 'new_booking':
                return (
                    <div className="w-7 h-7 rounded-lg bg-[#720101]/5 ring-1 ring-[#720101]/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-[#720101]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                );
            default:
                return (
                    <div className="w-7 h-7 rounded-lg bg-slate-50 ring-1 ring-slate-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    </div>
                );
        }
    };

    const groupedNotifications = useMemo(() => {
        const groups = [
            { id: 'urgent', label: 'Urgent', items: [] },
            { id: 'action', label: 'Needs action', items: [] },
            { id: 'info', label: 'Updates', items: [] },
        ];

        notifications.forEach((notification) => {
            const priority = notification.priority || 'info';
            const group = groups.find((item) => item.id === priority) || groups[2];
            group.items.push(notification);
        });

        return groups.filter((group) => group.items.length > 0);
    }, [notifications]);

    const isLight = variant === 'light';
    const dropdownClass = placement === 'fixed-right'
        ? 'fixed right-3 top-16 w-[min(21rem,calc(100vw-1.25rem))]'
        : 'absolute right-0 mt-2 w-[min(21rem,calc(100vw-1.25rem))]';
    const notificationHeaderException = ['loading', 'error', 'reconnecting', 'stale', 'offline'].includes(notificationsResource.syncState)
        || (notificationsResource.loading && notifications.length === 0);

    return (
        <div className="relative flex-shrink-0" ref={dropdownRef}>
            {/* Bell button */}
            <button
                onClick={handleToggle}
                className={`relative rounded-full p-2 transition-colors ${bellPulse ? 'notification-bell-pulse' : ''} ${isLight ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-[#720101]/5 hover:text-[#720101]'}`}
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
                <div className={`${dropdownClass} overflow-hidden rounded-2xl border border-[#720101]/10 bg-white shadow-2xl shadow-slate-950/15 ring-1 ring-black/5 z-50`} style={{ animation: 'fadeIn .2s ease' }}>
                    {/* Header */}
                    <div className="flex items-center justify-between gap-3 border-b border-[#720101]/10 bg-[#fffaf3] px-3 py-2.5">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#9f6500]">Updates</p>
                            <h3 className="mt-0.5 text-sm font-black text-slate-950">Notifications</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <LiveSyncIndicator
                                state={notificationsResource.syncState}
                                refreshing={notificationsResource.refreshing}
                                lastSyncedAt={notificationsResource.lastSyncedAt}
                                error={notificationsResource.error}
                                onRetry={notificationsResource.refetch}
                                compact
                                visibility="exceptions"
                            />
                            {!notificationHeaderException && unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="rounded-full border border-[#720101]/10 bg-white px-2.5 py-1 text-[11px] font-black text-[#720101] transition-colors hover:bg-[#720101] hover:text-white"
                                >
                                    Mark read
                                </button>
                            )}
                            {!notificationHeaderException && !soundEnabled && (
                                <button
                                    type="button"
                                    onClick={enableNotificationSound}
                                    disabled={soundSaving}
                                    className="rounded-full border border-[#720101]/10 bg-white px-2.5 py-1 text-[11px] font-black text-[#720101] transition-colors hover:bg-[#720101] hover:text-white disabled:opacity-60"
                                >
                                    {soundSaving ? '...' : 'Sound'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Notification list */}
                    <SoftRefreshBoundary
                        loading={notificationsResource.loading}
                        refreshing={notificationsResource.refreshing}
                        hasData={notifications.length > 0}
                        className="custom-scrollbar max-h-[min(24rem,calc(100vh-7rem))] overflow-y-auto bg-white p-1.5"
                    >
                        {notificationsResource.loading && notifications.length === 0 ? (
                            <div className="p-5 text-center">
                                <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-[#720101] border-t-transparent"></div>
                                <p className="text-xs font-bold text-slate-400">Loading updates...</p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-5 text-center">
                                <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff7e8] text-[#9f6500]">
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                </div>
                                <p className="text-sm font-black text-slate-700">No notifications yet</p>
                                <p className="mt-1 text-xs font-semibold text-slate-400">New updates will appear here.</p>
                            </div>
                        ) : (
                            groupedNotifications.map((group) => (
                                <div key={group.id} className="mb-1.5">
                                    <p className="px-2 pb-1 pt-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">{group.label}</p>
                                    {group.items.map(notification => (
                                        <div
                                            key={notification.id}
                                            onClick={() => !notification.read_at && markAsRead(notification.id)}
                                            className={`mb-1 flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${!notification.read_at ? 'bg-[#fff7e8] hover:bg-[#fff1d3]' : 'hover:bg-slate-50'}`}
                                        >
                                            {getIcon(notification.type)}
                                            <div className="flex-1 min-w-0">
                                                <p className={`break-words text-[13px] leading-5 ${!notification.read_at ? 'font-bold text-slate-950' : 'font-semibold text-slate-600'}`}>
                                                    {notification.message}
                                                </p>
                                                <p className="mt-1 text-[11px] font-bold text-slate-400">
                                                    {notification.category ? `${notification.category} / ` : ''}{notification.time_ago}
                                                </p>
                                            </div>
                                            {notification.read_at ? (
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        removeNotification(notification.id);
                                                    }}
                                                    className="mt-0.5 rounded-full p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600"
                                                    aria-label="Remove notification"
                                                    title="Remove notification"
                                                >
                                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            ) : (
                                                <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-[#720101]"></div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ))
                        )}
                    </SoftRefreshBoundary>
                    {soundMessage && <p className="border-t border-[#720101]/10 px-3 py-2 text-[11px] font-bold text-slate-500">{soundMessage}</p>}
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
