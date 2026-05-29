import React from 'react';

const StaffEmptyState = ({ title = 'Nothing needs attention', message = 'Items will appear here when there is work to do.', action }) => (
    <div className="staff-empty-state">
        <div className="staff-empty-mark">0</div>
        <h3>{title}</h3>
        <p>{message}</p>
        {action && <div className="mt-4">{action}</div>}
    </div>
);

export default StaffEmptyState;
