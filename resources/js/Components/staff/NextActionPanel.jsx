import React from 'react';
import StaffEmptyState from './StaffEmptyState';
import StaffStatusBadge from './StaffStatusBadge';

const priorityRank = {
    urgent: 0,
    action: 1,
    followup: 2,
    info: 3,
};

const priorityTone = {
    urgent: 'danger',
    action: 'warn',
    followup: 'warn',
    info: 'muted',
};

const priorityLabel = {
    urgent: 'Urgent',
    action: 'Needs action',
    followup: 'Follow-up',
    info: 'Update',
};

const normalizeActions = (actions) => [...(actions || [])]
    .filter(Boolean)
    .sort((a, b) => (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9));

const NextActionPanel = ({
    eyebrow = 'Priority queue',
    title = 'Work needing action',
    description,
    actions = [],
    emptyTitle = 'Nothing needs attention',
    emptyMessage = 'New work will appear here when it needs action.',
}) => {
    const sortedActions = normalizeActions(actions);

    return (
        <section className="staff-work-surface">
            <div className="staff-surface-head">
                <div>
                    <p className="marketing-kicker">{eyebrow}</p>
                    <h3 className="mt-1 text-lg font-black text-slate-950">{title}</h3>
                    {description && <p className="staff-section-copy">{description}</p>}
                </div>
            </div>
            <div className="p-4">
                {sortedActions.length === 0 ? (
                    <StaffEmptyState title={emptyTitle} message={emptyMessage} />
                ) : (
                    <div className="staff-priority-list">
                        {sortedActions.map((action) => {
                            const disabled = Boolean(action.disabledReason);
                            return (
                                <button
                                    key={action.id}
                                    type="button"
                                    disabled={disabled}
                                    onClick={disabled ? undefined : action.onOpen}
                                    className={`staff-priority-item ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                                >
                                    <div className="staff-priority-copy">
                                        <span className="staff-item-kicker">{priorityLabel[action.priority] || 'Next'}</span>
                                        <h3>{action.title}</h3>
                                        <p>{disabled ? action.disabledReason : action.description}</p>
                                        {action.target && <p className="mt-1 text-[11px] font-black uppercase tracking-widest text-slate-400">{action.target}</p>}
                                    </div>
                                    <div className="staff-priority-meta">
                                        <StaffStatusBadge tone={action.tone || priorityTone[action.priority] || 'muted'}>{action.badge || action.primaryLabel || 'Open'}</StaffStatusBadge>
                                        {action.primaryLabel && <span>{action.primaryLabel}</span>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
};

export default NextActionPanel;
