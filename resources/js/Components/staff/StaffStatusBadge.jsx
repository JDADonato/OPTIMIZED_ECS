import React from 'react';

const toneClass = {
    good: 'staff-status-good',
    warn: 'staff-status-warn',
    danger: 'staff-status-danger',
    muted: 'staff-status-muted',
};

const StaffStatusBadge = ({ children, tone = 'muted' }) => (
    <span className={`staff-status ${toneClass[tone] || toneClass.muted}`}>{children}</span>
);

export default StaffStatusBadge;
