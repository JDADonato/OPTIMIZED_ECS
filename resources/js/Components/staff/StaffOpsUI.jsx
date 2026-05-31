import React from 'react';
import RevealOnScroll from '../common/RevealOnScroll';

const toneClass = (tone = 'neutral') => `is-${tone || 'neutral'}`;

export const StaffOpsMetricStrip = ({ metrics = [], className = '' }) => (
    <div className={`staff-ops-metric-strip ${className}`.trim()}>
        {metrics.map((metric, index) => {
            const content = (
                <>
                    <div className="staff-ops-metric-copy">
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                        {metric.description && <p>{metric.description}</p>}
                    </div>
                    {metric.actionLabel && (
                        <span className="staff-ops-card-action">
                            {metric.actionLabel}
                        </span>
                    )}
                </>
            );

            return metric.onAction ? (
                <button
                    key={`${metric.label}-${index}`}
                    type="button"
                    onClick={metric.onAction}
                    className={`staff-ops-metric-card ${toneClass(metric.tone)}`}
                >
                    {content}
                </button>
            ) : (
                <article key={`${metric.label}-${index}`} className={`staff-ops-metric-card ${toneClass(metric.tone)}`}>
                    {content}
                </article>
            );
        })}
    </div>
);

export const StaffOpsPanel = ({
    eyebrow,
    title,
    description,
    actionLabel,
    onAction,
    children,
    className = '',
    delay = '',
    tone = 'neutral',
}) => (
    <RevealOnScroll as="section" delay={delay} className={`staff-ops-panel ${toneClass(tone)} ${className}`.trim()}>
        {(eyebrow || title || description || actionLabel) && (
            <div className="staff-ops-panel-head">
                <div>
                    {eyebrow && <p className="staff-ops-kicker">{eyebrow}</p>}
                    {title && <h3>{title}</h3>}
                    {description && <p className="staff-ops-panel-description">{description}</p>}
                </div>
                {actionLabel && onAction && (
                    <button type="button" onClick={onAction} className="staff-ops-button">
                        {actionLabel}
                    </button>
                )}
            </div>
        )}
        {children && (
            <div className="staff-ops-panel-body">
                {children}
            </div>
        )}
    </RevealOnScroll>
);

export const StaffOpsListRow = ({
    eyebrow,
    title,
    detail,
    value,
    valueLabel,
    status,
    tone = 'neutral',
    actionLabel,
    onClick,
    children,
}) => {
    const Wrapper = onClick ? 'button' : 'div';

    return (
        <Wrapper
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={`staff-ops-list-row ${toneClass(tone)} ${onClick ? 'is-clickable' : ''}`.trim()}
        >
            <div className="staff-ops-list-main">
                {eyebrow && <span>{eyebrow}</span>}
                <strong>{title}</strong>
                {detail && <p>{detail}</p>}
                {children}
            </div>
            {(value || status || actionLabel) && (
                <div className="staff-ops-list-side">
                    {value && <b>{value}</b>}
                    {valueLabel && <em>{valueLabel}</em>}
                    {status}
                    {actionLabel && <span className="staff-ops-row-action">{actionLabel}</span>}
                </div>
            )}
        </Wrapper>
    );
};

export const StaffOpsSearchBar = ({
    value,
    onChange,
    placeholder = 'Search records...',
    children,
    className = '',
}) => (
    <div className={`staff-ops-searchbar ${className}`.trim()}>
        <label className="staff-ops-search-input">
            <span aria-hidden="true">⌕</span>
            <input value={value} onChange={onChange} placeholder={placeholder} />
        </label>
        {children && <div className="staff-ops-search-controls">{children}</div>}
    </div>
);

export const StaffDecisionBrief = ({ finding, signal, nextMove, tone = 'neutral', source }) => (
    <article className={`staff-decision-brief ${toneClass(tone)}`}>
        <div className="staff-decision-head">
            <span>{tone === 'danger' ? 'Needs action' : tone === 'warning' ? 'Watch' : 'Stable'}</span>
            <div>
                {source && <p>{source}</p>}
                <strong>{finding}</strong>
            </div>
        </div>
        <div className="staff-decision-grid">
            <div>
                <span>Signal</span>
                <p>{signal}</p>
            </div>
            <div>
                <span>Next move</span>
                <p>{nextMove}</p>
            </div>
        </div>
    </article>
);
