import React, { useEffect, useState } from 'react';

const STATE_LABELS = {
    idle: 'Idle',
    loading: 'Loading',
    live: '',
    syncing: 'Loading',
    saved: 'Saved',
    reconnecting: 'Reconnecting',
    offline: 'Offline',
    stale: 'Viewing saved data',
    error: 'Could not update',
};

const STATE_TONES = {
    idle: 'neutral',
    loading: 'neutral',
    live: 'success',
    syncing: 'working',
    saved: 'success',
    reconnecting: 'warning',
    offline: 'warning',
    stale: 'warning',
    error: 'danger',
};

const timeLabel = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export const LiveSyncIndicator = ({
    state = 'idle',
    refreshing = false,
    lastSyncedAt = null,
    error = null,
    onRetry = null,
    labelOverrides = {},
    compact = false,
    quiet = false,
    visibility = 'always',
    className = '',
}) => {
    const resolvedState = refreshing && !['offline', 'stale', 'error', 'reconnecting'].includes(state) ? 'syncing' : state;
    if (['idle', 'live', 'saved'].includes(resolvedState)) {
        return null;
    }

    const exceptionOnly = quiet || visibility === 'exceptions';
    const visibleExceptionStates = ['loading', 'syncing', 'offline', 'stale', 'error', 'reconnecting'];
    if (exceptionOnly && !visibleExceptionStates.includes(resolvedState)) {
        return null;
    }

    const label = labelOverrides[resolvedState] || STATE_LABELS[resolvedState] || STATE_LABELS.idle;
    const tone = STATE_TONES[resolvedState] || 'neutral';
    const syncedAt = timeLabel(lastSyncedAt);

    return (
        <div className={`live-sync-indicator live-sync-${tone} ${compact ? 'is-compact' : ''} ${className}`} role="status" aria-live="polite">
            <span className="live-sync-dot" />
            <span className="live-sync-label">{label}</span>
            {!compact && syncedAt && ['live', 'saved'].includes(resolvedState) && (
                <span className="live-sync-time">Updated {syncedAt}</span>
            )}
            {!compact && error && ['error', 'reconnecting'].includes(resolvedState) && (
                <span className="live-sync-error">Weak connection or server delay.</span>
            )}
            {onRetry && ['error', 'reconnecting', 'stale', 'offline'].includes(resolvedState) && (
                <button type="button" onClick={() => onRetry({ silent: false, force: true, reason: 'retry_button' })}>Retry</button>
            )}
        </div>
    );
};

export const SoftRefreshBoundary = ({
    loading = false,
    refreshing = false,
    stale = false,
    staleMessage = 'Viewing saved data while the connection catches up.',
    hasData = true,
    skeleton = null,
    showRefreshBar = true,
    children,
    className = '',
}) => {
    if (loading && !hasData && skeleton) {
        return skeleton;
    }

    return (
        <div className={`live-soft-refresh ${refreshing ? 'is-refreshing' : ''} ${className}`}>
            {stale && (
                <div className="live-stale-banner" role="status" aria-live="polite">
                    {staleMessage}
                </div>
            )}
            {children}
            {showRefreshBar && refreshing && <span className="live-refresh-bar" aria-hidden="true" />}
        </div>
    );
};

export const UpdatedRowPulse = ({
    as: Component = 'div',
    watchKey = null,
    active = false,
    className = '',
    children,
    ...props
}) => {
    const [pulse, setPulse] = useState(false);

    useEffect(() => {
        if (!active && watchKey === null) return undefined;
        setPulse(true);
        const timer = window.setTimeout(() => setPulse(false), 1800);
        return () => window.clearTimeout(timer);
    }, [active, watchKey]);

    return (
        <Component className={`${className} ${pulse ? 'live-updated-pulse' : ''}`} {...props}>
            {children}
        </Component>
    );
};
