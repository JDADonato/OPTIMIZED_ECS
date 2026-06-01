import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import useRealtimeStatus from '../hooks/useRealtimeStatus';
import { LiveSyncIndicator } from '../Components/common/LiveFeedback';
import StaffWorkspaceTopNav from '../Components/staff/StaffWorkspaceTopNav';

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
    brandLogo = null,
    workspaceBadge = null,
    topNav = null,
    hideSidebarBrand = false,
    navGroups = [],
    active,
    onNavigate,
    children,
    roleKey = 'staff',
    workspaceClassName = '',
}) => {
    const { auth } = usePage().props;
    const { online, syncState } = useRealtimeStatus();
    const storageKey = useMemo(() => sidebarStorageKey(roleLabel, title), [roleLabel, title]);
    const openGroupsStorageKey = useMemo(() => `${storageKey}:open-groups`, [storageKey]);
    const [workspacePreferences, setWorkspacePreferences] = useState(() => readWorkspacePreferences(roleKey, auth?.user));
    const sidebarRef = useRef(null);
    const sidebarNavRef = useRef(null);
    const [sidebarState, setSidebarState] = useState(() => {
        const preferredState = workspacePreferences.sidebar_state === 'collapsed' ? 'collapsed' : 'expanded';
        if (!canUseStorage()) return 'expanded';
        const stored = window.localStorage.getItem(storageKey);
        return stored === 'collapsed' || stored === 'expanded' ? stored : preferredState;
    });
    const [openNavParents, setOpenNavParents] = useState(() => {
        if (!canUseStorage()) return {};

        try {
            return JSON.parse(window.localStorage.getItem(openGroupsStorageKey) || '{}');
        } catch (error) {
            return {};
        }
    });
    const [hoverExpanded, setHoverExpanded] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const isCollapsed = sidebarState === 'collapsed';
    const isPreviewOpen = isCollapsed && hoverExpanded;
    const shouldHideNavFocus = isCollapsed && !isPreviewOpen;
    const hasTopNav = Boolean(topNav);
    const shouldShowSidebarBrand = !hasTopNav && !hideSidebarBrand;
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

    const activeParentIds = useMemo(() => (
        navGroups.flatMap((group) => (
            group.items
                .filter((item) => Array.isArray(item.children) && item.children.some((child) => child.id === active))
                .map((item) => item.id)
        ))
    ), [navGroups, active]);

    useEffect(() => {
        if (activeParentIds.length === 0) return;

        setOpenNavParents((previous) => {
            let changed = false;
            const next = { ...previous };

            activeParentIds.forEach((parentId) => {
                if (!next[parentId]) {
                    next[parentId] = true;
                    changed = true;
                }
            });

            if (changed && canUseStorage()) {
                window.localStorage.setItem(openGroupsStorageKey, JSON.stringify(next));
            }

            return changed ? next : previous;
        });
    }, [activeParentIds, openGroupsStorageKey]);

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

    useEffect(() => {
        if (!isMobileSidebarOpen || typeof window === 'undefined') return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setIsMobileSidebarOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isMobileSidebarOpen]);

    const ToggleIcon = isCollapsed ? ChevronRight : ChevronLeft;

    const toggleNavParent = (itemId) => {
        setOpenNavParents((previous) => {
            const next = { ...previous, [itemId]: !previous[itemId] };

            if (canUseStorage()) {
                window.localStorage.setItem(openGroupsStorageKey, JSON.stringify(next));
            }

            return next;
        });
    };

    const handleNavigate = (itemId) => {
        onNavigate?.(itemId);
        setIsMobileSidebarOpen(false);
    };

    useEffect(() => {
        const sidebar = sidebarRef.current;
        if (!sidebar) return undefined;

        const handleSidebarWheel = (event) => {
            const nav = sidebarNavRef.current;
            if (!nav || event.deltaY === 0) return;

            event.preventDefault();
            const deltaMultiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? nav.clientHeight : 1;
            nav.scrollTop += event.deltaY * deltaMultiplier;
        };

        sidebar.addEventListener('wheel', handleSidebarWheel, { passive: false });
        return () => sidebar.removeEventListener('wheel', handleSidebarWheel);
    }, []);

    const sidebarTitleFor = (item) => (
        shouldHideNavFocus
            ? [item.label, item.description].filter(Boolean).join(' - ')
            : undefined
    );
    const renderSidebarTooltip = (item) => (
        item.description ? (
            <span className="staff-sidebar-tooltip" role="tooltip">
                <strong>{item.label}</strong>
                <span>{item.description}</span>
            </span>
        ) : null
    );

    return (
        <div className={`staff-workspace ${workspaceClassName} ${hasTopNav ? 'has-workspace-topnav' : ''} ${isMobileSidebarOpen ? 'is-mobile-sidebar-open' : ''} ${densityClass} ${isCollapsed ? 'is-sidebar-collapsed' : 'is-sidebar-expanded'} ${isPreviewOpen ? 'is-sidebar-hover-expanded' : ''}`.trim()}>
            {hasTopNav && (
                <div className="staff-workspace-topnav">
                    <StaffWorkspaceTopNav
                        {...topNav}
                        menuOpen={isMobileSidebarOpen}
                        onMenuToggle={() => setIsMobileSidebarOpen((open) => !open)}
                    />
                </div>
            )}
            {hasTopNav && isMobileSidebarOpen && (
                <button
                    type="button"
                    className="staff-sidebar-overlay"
                    onClick={() => setIsMobileSidebarOpen(false)}
                    aria-label="Close staff navigation"
                />
            )}
            <aside
                ref={sidebarRef}
                className="staff-sidebar"
                onMouseEnter={() => isCollapsed && setHoverExpanded(true)}
                onMouseLeave={() => setHoverExpanded(false)}
                aria-expanded={!isCollapsed || isPreviewOpen}
            >
                {shouldShowSidebarBrand && (
                    <div className="staff-sidebar-brand">
                        <div className="staff-sidebar-brand-copy">
                            <div className="staff-sidebar-brand-row">
                                {brandLogo ? (
                                    <img src={brandLogo} alt={brand} className="staff-sidebar-brand-logo" />
                                ) : (
                                    <p>{brand}</p>
                                )}
                                {workspaceBadge && <span className="staff-sidebar-workspace-badge">{workspaceBadge}</span>}
                            </div>
                            {!workspaceBadge && <h1>{title}</h1>}
                        </div>
                    </div>
                )}

                <nav ref={sidebarNavRef} className="staff-sidebar-nav custom-scrollbar">
                    {navGroups.map((group) => (
                        <section key={group.label} className="staff-sidebar-group">
                            <p>{group.label}</p>
                            {group.items.map((item) => {
                                const hasChildren = Array.isArray(item.children) && item.children.length > 0;
                                const childIsActive = hasChildren && item.children.some((child) => child.id === active);
                                const isOpen = hasChildren && Boolean(openNavParents[item.id]);
                                const itemCount = Number(item.count || 0);

                                if (hasChildren) {
                                    return (
                                        <div key={item.id} className={`staff-sidebar-parent-group ${isOpen ? 'is-open' : ''}`}>
                                            <button
                                                type="button"
                                                onClick={() => toggleNavParent(item.id)}
                                                className={`staff-sidebar-item staff-sidebar-parent ${childIsActive ? 'has-active-child' : ''} ${isOpen ? 'is-open' : ''}`}
                                                title={sidebarTitleFor(item)}
                                                tabIndex={shouldHideNavFocus ? -1 : 0}
                                                aria-expanded={isOpen}
                                            >
                                                <span className="staff-sidebar-item-main">
                                                    <span className="staff-sidebar-item-label">{item.label}</span>
                                                </span>
                                                <span className="staff-sidebar-parent-meta">
                                                    {itemCount > 0 && <em>{itemCount}</em>}
                                                    <ChevronDown className="staff-sidebar-parent-chevron" aria-hidden="true" />
                                                </span>
                                                {renderSidebarTooltip(item)}
                                            </button>
                                            <div className="staff-sidebar-subnav" hidden={!isOpen}>
                                                {item.children.map((child) => (
                                                    <button
                                                        key={child.id}
                                                        type="button"
                                                        onClick={() => handleNavigate(child.id)}
                                                        className={`staff-sidebar-subitem ${active === child.id ? 'is-active' : ''}`}
                                                        title={sidebarTitleFor(child)}
                                                        tabIndex={shouldHideNavFocus ? -1 : 0}
                                                    >
                                                        <span>{child.label}</span>
                                                        {child.count > 0 && <em>{child.count}</em>}
                                                        {renderSidebarTooltip(child)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => handleNavigate(item.id)}
                                        className={`staff-sidebar-item ${active === item.id ? 'is-active' : ''}`}
                                        title={sidebarTitleFor(item)}
                                        tabIndex={shouldHideNavFocus ? -1 : 0}
                                    >
                                        <span className="staff-sidebar-item-main">
                                            <span className="staff-sidebar-item-label">{item.label}</span>
                                        </span>
                                        {item.count > 0 && <em>{item.count}</em>}
                                        {renderSidebarTooltip(item)}
                                    </button>
                                );
                            })}
                        </section>
                    ))}
                </nav>

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
