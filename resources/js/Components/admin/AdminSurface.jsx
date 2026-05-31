import React from 'react';

export const AdminPageSurface = ({ children, className = '' }) => (
    <div className={`admin-tab-surface animate-fadeIn ${className}`.trim()}>
        {children}
    </div>
);

export const AdminCommandStrip = ({ children, className = '', dense = false }) => (
    <div className={`admin-command-strip ${dense ? 'is-dense' : ''} ${className}`.trim()}>
        {children}
    </div>
);

export const AdminSurfaceSection = ({ children, className = '', kicker, title, description, actions, command, footer, dense = false }) => (
    <section className={`admin-surface-section ${dense ? 'is-dense' : ''} ${className}`.trim()}>
        {(kicker || title || description || actions) && (
            <div className="admin-surface-section-head">
                <div>
                    {kicker && <p className="admin-kicker">{kicker}</p>}
                    {title && <h3>{title}</h3>}
                    {description && <p>{description}</p>}
                </div>
                {actions && <div className="admin-surface-section-actions">{actions}</div>}
            </div>
        )}
        {command && <AdminCommandStrip dense>{command}</AdminCommandStrip>}
        {children}
        {footer && <div className="admin-surface-section-footer">{footer}</div>}
    </section>
);

export const AdminResponsiveTable = ({ children, className = '', dense = false }) => (
    <div className={`staff-table-wrap admin-surface-grid admin-responsive-table ${dense ? 'is-dense' : ''} ${className}`.trim()}>
        {children}
    </div>
);
