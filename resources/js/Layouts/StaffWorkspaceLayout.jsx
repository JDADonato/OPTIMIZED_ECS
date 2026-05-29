import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import useRealtimeStatus from '../hooks/useRealtimeStatus';
import { LiveSyncIndicator } from '../Components/common/LiveFeedback';

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const sidebarStorageKey = (roleLabel, title) => {
    const role = String(roleLabel || title || 'staff')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'staff';

    return `ecs:staff-sidebar:${role}:state`;
};

const workspacePreferenceStorageKey = (roleKey) => `ecs:staff-workspace:${roleKey || 'staff'}:preferences`;

const readWorkspacePreferences = (roleKey, authUser) => {
    const fromProfile = authUser?.profile_preferences?.staff_workspace?.[roleKey] || {};
    if (!canUseStorage()) return fromProfile;

    try {
        const stored = JSON.parse(window.localStorage.getItem(workspacePreferenceStorageKey(roleKey)) || '{}');
        return { ...fromProfile, ...stored };
    } catch (error) {
        return fromProfile;
    }
};

const StaffWorkspaceLayout = ({
    brand = 'Eloquente',
    title,
    roleLabel,
    username,
    profileHref = '/profile',
    navGroups = [],
    active,
    onNavigate,
    onLogout,
    children,
    roleKey = 'staff',
    workspaceClassName = '',
}) => {
    const { auth } = usePage().props;
    const { online, syncState } = useRealtimeStatus();
    const storageKey = useMemo(() => sidebarStorageKey(roleLabel, title), [roleLabel, title]);
    const [workspacePreferences, setWorkspacePreferences] = useState(() => readWorkspacePreferences(roleKey, auth?.user));
    const sidebarNavRef = useRef(null);
    const [sidebarState, setSidebarState] = useState(() => {
        const preferredState = workspacePreferences.sidebar_state === 'collapsed' ? 'collapsed' : 'expanded';
        if (!canUseStorage()) return 'expanded';
        const stored = window.localStorage.getItem(storageKey);
        return stored === 'collapsed' || stored === 'expanded' ? stored : preferredState;
    });
    const [hoverExpanded, setHoverExpanded] = useState(false);
    const isCollapsed = sidebarState === 'collapsed';
    const isPreviewOpen = isCollapsed && hoverExpanded;
    const syncVisibility = workspacePreferences.sync_feedback === 'detailed' ? 'always' : 'exceptions';
    const densityClass = workspacePreferences.density === 'compact' ? 'staff-density-compact' : 'staff-density-comfortable';

    const setSidebar = (nextState) => {
        setSidebarState(nextState);
        if (canUseStorage()) {
            window.localStorage.setItem(storageKey, nextState);
        }
    };

    useEffect(() => {
        setWorkspacePreferences(readWorkspacePreferences(roleKey, auth?.user));
    }, [roleKey, auth?.user?.profile_preferences]);

    useEffect(() => {
        if (!canUseStorage()) return undefined;

        const handlePreferenceChange = (event) => {
            if (event.detail?.roleKey !== roleKey) return;
            const nextPreferences = event.detail.preferences || {};
            setWorkspacePreferences(nextPreferences);
            if (nextPreferences.sidebar_state === 'collapsed' || nextPreferences.sidebar_state === 'expanded') {
                setSidebar(nextPreferences.sidebar_state);
            }
        };

        window.addEventListener('staff-workspace-preferences-changed', handlePreferenceChange);
        return () => window.removeEventListener('staff-workspace-preferences-changed', handlePreferenceChange);
    }, [roleKey, storageKey]);

    const ToggleIcon = isCollapsed ? ChevronRight : ChevronLeft;

    const handleSidebarWheel = (event) => {
        const nav = sidebarNavRef.current;
        if (!nav || event.deltaY === 0) return;

        event.preventDefault();
        const deltaMultiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? nav.clientHeight : 1;
        nav.scrollTop += event.deltaY * deltaMultiplier;
    };

    return (
        <div className={`staff-workspace ${workspaceClassName} ${densityClass} ${isCollapsed ? 'is-sidebar-collapsed' : 'is-sidebar-expanded'} ${isPreviewOpen ? 'is-sidebar-hover-expanded' : ''}`.trim()}>
            <aside
                className="staff-sidebar"
                onMouseEnter={() => isCollapsed && setHoverExpanded(true)}
                onMouseLeave={() => setHoverExpanded(false)}
                onWheel={handleSidebarWheel}
                aria-expanded={!isCollapsed || isPreviewOpen}
            >
                <div className="staff-sidebar-brand">
                    <div className="staff-sidebar-brand-copy">
                        <p>{brand}</p>
                        <h1>{title}</h1>
                    </div>
                </div>

                <nav ref={sidebarNavRef} className="staff-sidebar-nav custom-scrollbar">
                    {navGroups.map((group) => (
                        <section key={group.label} className="staff-sidebar-group">
                            <p>{group.label}</p>
                            {group.items.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => onNavigate(item.id)}
                                    className={`staff-sidebar-item ${active === item.id ? 'is-active' : ''}`}
                                    title={isCollapsed && !isPreviewOpen ? item.label : undefined}
                                    tabIndex={isCollapsed && !isPreviewOpen ? -1 : 0}
                                >
                                    <span className="staff-sidebar-item-main">
                                        <span className="staff-sidebar-item-label">{item.label}</span>
                                    </span>
                                    {item.count > 0 && <em>{item.count}</em>}
                                </button>
                            ))}
                        </section>
                    ))}
                </nav>

                <div className="staff-sidebar-user">
                    <div>
                        <p>{roleLabel}</p>
                        <strong>{username || 'Staff'}</strong>
                    </div>
                    <div className="staff-sidebar-user-actions">
                        {profileHref && <Link href={profileHref} tabIndex={isCollapsed && !isPreviewOpen ? -1 : 0}>Profile</Link>}
                        <button type="button" onClick={onLogout} tabIndex={isCollapsed && !isPreviewOpen ? -1 : 0}>Logout</button>
                    </div>
                </div>
            </aside>

            <button
                type="button"
                className="staff-sidebar-edge-toggle"
                onClick={() => setSidebar(isCollapsed ? 'expanded' : 'collapsed')}
                aria-label={isCollapsed ? 'Pin sidebar open' : 'Collapse sidebar'}
                title={isCollapsed ? 'Pin sidebar open' : 'Collapse sidebar'}
            >
                <ToggleIcon aria-hidden="true" />
            </button>

            <div className="staff-workspace-main">
                <main>
                    <div className="staff-global-sync-region">
                        <LiveSyncIndicator state={syncState} compact visibility={syncVisibility} />
                    </div>
                    {!online && (
                        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-bold text-amber-900 shadow-sm">
                            Connection is unstable. Viewing saved data; changes will sync when the connection returns.
                        </div>
                    )}
                    {children}
                </main>
            </div>
        </div>
    );
};

export default StaffWorkspaceLayout;
