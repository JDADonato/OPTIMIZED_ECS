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

export const AdminSurfaceSection = ({ children, className = '' }) => (
    <section className={`admin-surface-section ${className}`.trim()}>
        {children}
    </section>
);

export const AdminResponsiveTable = ({ children, className = '' }) => (
    <div className={`staff-table-wrap admin-surface-grid admin-responsive-table ${className}`.trim()}>
        {children}
    </div>
);
