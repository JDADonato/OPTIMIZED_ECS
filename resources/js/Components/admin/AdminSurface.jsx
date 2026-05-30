import React from 'react';

export const AdminPageSurface = ({ children, className = '' }) => (
    <div className={`admin-tab-surface animate-fadeIn ${className}`.trim()}>
        {children}
    </div>
);

export const AdminCommandStrip = ({ children, className = '' }) => (
    <div className={`admin-command-strip ${className}`.trim()}>
        {children}
    </div>
);

export const AdminSurfaceSection = ({ children, className = '', kicker, title, description, actions }) => (
    <section className={`admin-surface-section ${className}`.trim()}>
        {(kicker || title || description || actions) && (
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    {kicker && <p className="admin-kicker">{kicker}</p>}
                    {title && <h3 className="mt-1 text-lg font-black text-gray-950">{title}</h3>}
                    {description && <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-gray-500">{description}</p>}
                </div>
                {actions && <div className="shrink-0">{actions}</div>}
            </div>
        )}
        {children}
    </section>
);

export const AdminResponsiveTable = ({ children, className = '' }) => (
    <div className={`staff-table-wrap admin-surface-grid admin-responsive-table ${className}`.trim()}>
        {children}
    </div>
);
