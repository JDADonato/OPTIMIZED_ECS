import React from 'react';

export const StaffWorkspaceSkeleton = ({
    brand = 'Eloquente',
    brandLogo = null,
    workspaceBadge = null,
    workspaces = [],
    activeWorkspace = null,
    active = null,
    title = 'Staff Workspace',
    roleLabel = 'Staff team',
    navGroups = [],
    metrics = 4,
    rows = 6,
    label = 'Preparing workspace',
    workspaceClassName = '',
    topNav = false,
}) => {
    const hasTopNav = topNav || workspaces.length > 0 || Boolean(workspaceBadge);
    const itemLabel = (item) => (typeof item === 'string' ? item : item.label);
    const itemId = (item) => (typeof item === 'string' ? item : item.id);

    return (
    <div className={`staff-workspace ${workspaceClassName} ${hasTopNav ? 'has-workspace-topnav staff-role-shell' : ''}`.trim()} aria-label={label}>
        {hasTopNav && (
            <div className="staff-workspace-topnav">
                <header className={`staff-workspace-navbar staff-workspace-skeleton-navbar ${workspaces.length > 0 ? 'has-switcher' : 'has-context'} has-search`}>
                    <div className="staff-workspace-navbar-brand">
                        {brandLogo ? <img src={brandLogo} alt={brand} /> : <span className="staff-workspace-skeleton-brand-text">{brand}</span>}
                        {workspaceBadge && <span>{workspaceBadge}</span>}
                    </div>
                    {workspaces.length > 0 && (
                        <nav className="staff-workspace-switcher" aria-label="Loading workspaces">
                            {workspaces.map((workspace) => (
                                <span key={workspace.id} className={activeWorkspace === workspace.id ? 'is-active' : ''}>
                                    {workspace.label}
                                </span>
                            ))}
                        </nav>
                    )}
                    <div className="staff-workspace-navbar-spacer" aria-hidden="true" />
                    <div className="staff-workspace-navbar-utilities">
                        <div className="staff-workspace-navbar-utility-search">
                            <span className="staff-workspace-skeleton-search" />
                        </div>
                        <div className="staff-workspace-navbar-utility-actions">
                            <span className="staff-workspace-skeleton-action" />
                            <span className="staff-workspace-skeleton-avatar" />
                        </div>
                    </div>
                </header>
            </div>
        )}
        <aside className="staff-sidebar">
            {!hasTopNav && (
                <div className="staff-sidebar-brand">
                    <p>{brand}</p>
                    <h1>{title}</h1>
                </div>
            )}

            <nav className="staff-sidebar-nav custom-scrollbar">
                {navGroups.map((group) => (
                    <section key={group.label} className="staff-sidebar-group">
                        <p>{group.label}</p>
                        {group.items.map((item) => (
                            <div key={itemId(item)} className={`staff-sidebar-item staff-skeleton-nav-item ${active === itemId(item) ? 'is-active' : ''}`.trim()}>
                                <span className="staff-sidebar-item-main">
                                    <span className="staff-sidebar-item-label">{itemLabel(item)}</span>
                                </span>
                            </div>
                        ))}
                    </section>
                ))}
            </nav>

            {!hasTopNav && <div className="staff-sidebar-user">
                <div>
                    <p>{roleLabel}</p>
                    <strong>Loading</strong>
                </div>
                <div className="staff-sidebar-user-actions">
                    <span />
                    <span />
                </div>
            </div>}
        </aside>

        <span className="staff-sidebar-edge-toggle staff-sidebar-edge-toggle-skeleton" aria-hidden="true" />

        <div className="staff-workspace-main">
            <main>
                <div className="staff-workspace-skeleton-head">
                    <div>
                        <span />
                        <strong />
                    </div>
                    <div className="staff-workspace-skeleton-metrics">
                        {Array.from({ length: metrics }).map((_, index) => <i key={index} />)}
                    </div>
                </div>

                <div className={`staff-work-surface staff-workspace-skeleton-surface ${hasTopNav ? 'is-modern' : ''}`.trim()}>
                    {hasTopNav ? (
                        <>
                            <div className="staff-workspace-skeleton-command">
                                <span />
                                <span />
                                <span />
                                <span />
                            </div>
                            <div className="staff-workspace-skeleton-card-grid">
                                {Array.from({ length: metrics }).map((_, index) => <span key={index} />)}
                            </div>
                            <StaffSkeleton rows={rows} label={label} />
                        </>
                    ) : (
                        <>
                            <div className="staff-filter-bar">
                                <span />
                                <span />
                                <span />
                            </div>
                            <StaffSkeleton rows={rows} label={label} />
                        </>
                    )}
                </div>
            </main>
        </div>
    </div>
    );
};

const StaffSkeleton = ({ rows = 5, variant = 'table', className = '', label = 'Preparing your workspace...' }) => {
    if (variant === 'metrics') {
        return (
            <div className={`staff-skeleton staff-skeleton-metrics ${className}`} aria-label={label}>
                {Array.from({ length: rows }).map((_, index) => (
                    <div key={index} className="staff-skeleton-metric">
                        <span />
                        <strong />
                        <em />
                    </div>
                ))}
            </div>
        );
    }

    if (variant === 'panel') {
        return (
            <div className={`staff-skeleton staff-skeleton-panel ${className}`} aria-label={label}>
                <div className="staff-skeleton-panel-lines">
                    {Array.from({ length: rows }).map((_, index) => <span key={index} />)}
                </div>
            </div>
        );
    }

    return (
        <div className={`staff-skeleton ${className}`} aria-label={label}>
            {Array.from({ length: rows }).map((_, index) => (
                <div key={index} className="staff-skeleton-row">
                    <span />
                    <span />
                    <span />
                </div>
            ))}
        </div>
    );
};

export default StaffSkeleton;
