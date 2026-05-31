import React from 'react';

export const StaffCommandBar = ({ children, className = '' }) => (
    <div className={`staff-v2-command-bar ${className}`.trim()}>
        {children}
    </div>
);

export const StaffMetricStrip = ({ metrics = [], actions = null, className = '' }) => (
    <div className={`staff-v2-metric-strip ${className}`.trim()}>
        <div className="staff-v2-metric-list">
            {metrics.map((metric) => (
                <span key={metric.label} className={`staff-v2-metric ${metric.tone ? `is-${metric.tone}` : ''}`.trim()}>
                    <strong>{metric.value}</strong>
                    <em>{metric.label}</em>
                    {metric.hint && <small>{metric.hint}</small>}
                </span>
            ))}
        </div>
        {actions && <div className="staff-v2-metric-actions">{actions}</div>}
    </div>
);

export const StaffInlineInsight = ({ eyebrow = 'Insight', title, signals = [], actionLabel = 'View analysis', onAction, className = '' }) => (
    <div className={`staff-v2-inline-insight ${className}`.trim()}>
        <div className="staff-v2-inline-insight-copy">
            <span>{eyebrow}</span>
            <strong>{title}</strong>
        </div>
        {signals.length > 0 && (
            <div className="staff-v2-inline-insight-signals">
                {signals.map((signal) => (
                    <span key={`${signal.label}-${signal.value}`}>
                        <strong>{signal.value}</strong>
                        <em>{signal.label}</em>
                    </span>
                ))}
            </div>
        )}
        {onAction && (
            <button type="button" className="staff-v2-link-action" onClick={onAction}>
                {actionLabel}
            </button>
        )}
    </div>
);

export const StaffPrimaryAction = ({ children, className = '', ...props }) => (
    <button type="button" className={`staff-v2-primary-action ${className}`.trim()} {...props}>
        {children}
    </button>
);

export const StaffStatusChip = ({ children, tone = 'neutral', className = '' }) => (
    <span className={`staff-v2-status-chip is-${tone} ${className}`.trim()}>
        {children}
    </span>
);

export const StaffWorkTable = ({ children, className = '' }) => (
    <div className={`staff-v2-work-table admin-responsive-table ${className}`.trim()}>
        {children}
    </div>
);

export const StaffDetailDrawer = ({ open, title, description, children, footer, onClose }) => {
    if (!open) return null;

    return (
        <div className="staff-v2-drawer-shell" role="dialog" aria-modal="true" aria-label={title}>
            <button type="button" className="staff-v2-drawer-backdrop" onClick={onClose} aria-label="Close drawer" />
            <aside className="staff-v2-drawer">
                <header>
                    <div>
                        <h3>{title}</h3>
                        {description && <p>{description}</p>}
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close drawer">Close</button>
                </header>
                <div className="staff-v2-drawer-body">{children}</div>
                {footer && <footer>{footer}</footer>}
            </aside>
        </div>
    );
};
