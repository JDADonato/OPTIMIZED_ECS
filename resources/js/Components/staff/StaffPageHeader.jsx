import React from 'react';
import NotificationBell from '../common/NotificationBell';

const StaffPageHeader = ({ eyebrow, title, description, actions, metrics = [] }) => (
    <section className="staff-page-header">
        <div>
            {eyebrow && <p className="marketing-kicker">{eyebrow}</p>}
            <h2>{title}</h2>
            {description && <p className="staff-page-header-description">{description}</p>}
        </div>
        <div className="staff-header-utilities">
            {metrics.length > 0 && (
                <div className="staff-header-metrics" style={{ '--metric-count': metrics.length }}>
                    {metrics.map((metric) => (
                        <div key={metric.label}>
                            <span>{metric.label}</span>
                            <strong>{metric.value}</strong>
                        </div>
                    ))}
                </div>
            )}
            {actions && <div className="staff-header-actions">{actions}</div>}
            <NotificationBell variant="dark" placement="inline" />
        </div>
    </section>
);

export default StaffPageHeader;
