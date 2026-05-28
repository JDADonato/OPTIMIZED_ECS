import React from 'react';

export const StaffWorkspaceSkeleton = ({
    title = 'Staff Workspace',
    roleLabel = 'Staff team',
    navGroups = [],
    metrics = 4,
    rows = 6,
    label = 'Preparing workspace',
}) => (
    <div className="staff-workspace" aria-label={label}>
        <aside className="staff-sidebar">
            <div className="staff-sidebar-brand">
                <p>Eloquente</p>
                <h1>{title}</h1>
            </div>

            <nav className="staff-sidebar-nav custom-scrollbar">
                {navGroups.map((group) => (
                    <section key={group.label} className="staff-sidebar-group">
                        <p>{group.label}</p>
                        {group.items.map((item) => (
                            <div key={item} className="staff-sidebar-item staff-skeleton-nav-item">
                                <span>{item}</span>
                            </div>
                        ))}
                    </section>
                ))}
            </nav>

            <div className="staff-sidebar-user">
                <div>
                    <p>{roleLabel}</p>
                    <strong>Loading</strong>
                </div>
                <div className="staff-sidebar-user-actions">
                    <span />
                    <span />
                </div>
            </div>
        </aside>

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

                <div className="staff-work-surface staff-workspace-skeleton-surface">
                    <div className="staff-filter-bar">
                        <span />
                        <span />
                        <span />
                    </div>
                    <StaffSkeleton rows={rows} label={label} />
                </div>
            </main>
        </div>
    </div>
);

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
