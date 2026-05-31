import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import useOnlineStatus from './useOnlineStatus';
import { buildUrl } from './useStaffResource';
import { fetchSmartResource, getUserScopedCacheKey, readSmartCache } from '../utils/smartResource';

const DEFAULT_SELECT = (payload) => payload;
const DEFAULT_EVENTS = ['.operational.resource.changed'];
const DEFAULT_TIMEOUT = 12000;
const MAX_RETRY_DELAY = 60000;
const MAX_AUTO_RETRIES = 5;

const normalizeList = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

export default function useLiveResource(url, {
    cacheKey = url,
    params = {},
    channels = [],
    eventNames = DEFAULT_EVENTS,
    resources = [],
    interval = 30000,
    idleAfter = 180000,
    enabled = true,
    ttl = 15000,
    persist = true,
    timeout = DEFAULT_TIMEOUT,
    select = DEFAULT_SELECT,
    initialData = null,
    onSuccess = null,
    maxAutoRetries = MAX_AUTO_RETRIES,
} = {}) {
    const { auth } = usePage().props;
    const user = auth?.user || null;
    const online = useOnlineStatus();
    const paramsKey = JSON.stringify(params || {});
    const requestUrl = useMemo(() => buildUrl(url, params), [url, paramsKey]);
    const resolvedCacheKey = useMemo(
        () => getUserScopedCacheKey(user, `${cacheKey}:${requestUrl}`),
        [cacheKey, requestUrl, user?.id, user?.role],
    );
    const cached = useMemo(() => readSmartCache(resolvedCacheKey), [resolvedCacheKey]);
    const initialSelected = initialData ?? (cached ? select(cached.data) : null);

    const [data, setData] = useState(initialSelected);
    const [meta, setMeta] = useState(cached?.meta || {});
    const [loading, setLoading] = useState(Boolean(enabled && !initialSelected));
    const [refreshing, setRefreshing] = useState(false);
    const [syncState, setSyncState] = useState(() => {
        if (!enabled) return 'idle';
        if (!online) return initialSelected ? 'stale' : 'offline';
        return initialSelected ? 'saved' : 'loading';
    });
    const [lastSyncedAt, setLastSyncedAt] = useState(cached?.meta?.generated_at || null);
    const [error, setError] = useState(null);
    const [changedKeys, setChangedKeys] = useState(() => new Set());

    const abortRef = useRef(null);
    const retryTimerRef = useRef(null);
    const eventTimerRef = useRef(null);
    const lastInteractionRef = useRef(Date.now());
    const lastRefreshRef = useRef(0);
    const failuresRef = useRef(0);
    const dataRef = useRef(initialSelected);
    const selectRef = useRef(select);
    const onSuccessRef = useRef(onSuccess);

    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    useEffect(() => {
        selectRef.current = select;
    }, [select]);

    useEffect(() => {
        onSuccessRef.current = onSuccess;
    }, [onSuccess]);

    const clearRetry = useCallback(() => {
        if (retryTimerRef.current) {
            window.clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
    }, []);

    const clearChanged = useCallback((key) => {
        setChangedKeys((current) => {
            if (!current.has(key)) return current;
            const next = new Set(current);
            next.delete(key);
            return next;
        });
    }, []);

    const markChanged = useCallback((key = '__resource__') => {
        setChangedKeys((current) => {
            const next = new Set(current);
            next.add(key);
            return next;
        });

        window.setTimeout(() => clearChanged(key), 2400);
    }, [clearChanged]);

    const scheduleRetry = useCallback((loadFn) => {
        clearRetry();
        if (failuresRef.current > maxAutoRetries) {
            setSyncState(dataRef.current ? 'stale' : 'error');
            return;
        }

        const delay = Math.min(4000 * (2 ** Math.max(0, failuresRef.current - 1)), MAX_RETRY_DELAY);
        retryTimerRef.current = window.setTimeout(() => {
            loadFn({ silent: true, force: true, reason: 'retry' });
        }, delay);
    }, [clearRetry, maxAutoRetries]);

    const canBackgroundRefresh = useCallback(() => (
        document.visibilityState === 'visible'
        && Date.now() - lastInteractionRef.current <= idleAfter
    ), [idleAfter]);

    const load = useCallback(async ({ silent = false, force = false, reason = 'manual' } = {}) => {
        if (!enabled) return dataRef.current;

        if (!online) {
            setLoading(false);
            setRefreshing(false);
            setSyncState(dataRef.current ? 'stale' : 'offline');
            return dataRef.current;
        }

        if (reason !== 'retry') {
            failuresRef.current = 0;
        }

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        let timedOut = false;
        const timeoutId = window.setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeout);

        if (silent || dataRef.current) {
            setRefreshing(true);
            setSyncState('syncing');
        } else {
            setLoading(true);
            setSyncState('loading');
        }
        setError(null);

        try {
            const result = await fetchSmartResource(requestUrl, {
                cacheKey: resolvedCacheKey,
                ttl,
                force,
                persist,
                signal: controller.signal,
            });
            const selected = selectRef.current(result.raw || result.data);
            const previous = dataRef.current;

            setData(selected);
            setMeta(result.meta || {});
            setLastSyncedAt(result.meta?.generated_at || new Date().toISOString());
            setSyncState(reason === 'mutation' ? 'saved' : 'live');
            failuresRef.current = 0;
            clearRetry();

            if (previous && result.changed !== false && selected !== previous) {
                markChanged('__resource__');
            }

            onSuccessRef.current?.(selected, result);
            return selected;
        } catch (requestError) {
            if (requestError?.name === 'AbortError' && !timedOut) {
                return dataRef.current;
            }

            failuresRef.current += 1;
            setError(requestError);
            setSyncState(failuresRef.current > maxAutoRetries
                ? (dataRef.current ? 'stale' : 'error')
                : (dataRef.current ? 'reconnecting' : 'error'));
            scheduleRetry(load);
            return dataRef.current;
        } finally {
            window.clearTimeout(timeoutId);
            if (!controller.signal.aborted || timedOut) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [clearRetry, enabled, markChanged, maxAutoRetries, online, persist, requestUrl, resolvedCacheKey, scheduleRetry, timeout, ttl]);

    useEffect(() => {
        if (!enabled) return undefined;
        load({ silent: Boolean(dataRef.current || cached), reason: 'initial' });
        return () => abortRef.current?.abort();
    }, [enabled, requestUrl]);

    useEffect(() => {
        if (!enabled) return undefined;

        const markInteraction = () => {
            lastInteractionRef.current = Date.now();
        };
        const runRefresh = (reason) => {
            if (!canBackgroundRefresh()) return;
            lastRefreshRef.current = Date.now();
            load({ silent: true, reason });
        };
        const handleFocus = () => {
            markInteraction();
            if (Date.now() - lastRefreshRef.current > 2500) {
                runRefresh('focus');
            }
        };
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                markInteraction();
                runRefresh('visible');
            }
        };

        const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
        events.forEach((eventName) => window.addEventListener(eventName, markInteraction, { passive: true }));
        window.addEventListener('focus', handleFocus);
        window.addEventListener('online', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);

        const timer = window.setInterval(() => runRefresh('interval'), interval);

        return () => {
            window.clearInterval(timer);
            events.forEach((eventName) => window.removeEventListener(eventName, markInteraction));
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('online', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [canBackgroundRefresh, enabled, interval, load]);

    useEffect(() => {
        if (!enabled || !online) {
            setSyncState(dataRef.current ? 'stale' : 'offline');
            return;
        }

        if (syncState === 'offline' || syncState === 'stale' || syncState === 'reconnecting') {
            load({ silent: true, force: true, reason: 'online' });
        }
    }, [enabled, load, online]);

    useEffect(() => {
        const activeChannels = normalizeList(channels);
        const activeEvents = normalizeList(eventNames);
        const allowedResources = normalizeList(resources);

        if (!enabled || !window.Echo || activeChannels.length === 0 || activeEvents.length === 0) {
            return undefined;
        }

        const handleEvent = (event = {}) => {
            if (allowedResources.length > 0 && event.resource && !allowedResources.includes(event.resource)) {
                return;
            }

            markChanged(event.entity_id ?? event.resource ?? '__resource__');
            if (eventTimerRef.current) window.clearTimeout(eventTimerRef.current);
            eventTimerRef.current = window.setTimeout(() => {
                load({ silent: true, force: true, reason: 'realtime' });
            }, 180);
        };

        const subscriptions = [];
        activeChannels.forEach((channelName) => {
            const channel = window.Echo.private(channelName);
            activeEvents.forEach((eventName) => {
                channel.listen(eventName, handleEvent);
                subscriptions.push({ channel, eventName });
            });
        });

        return () => {
            if (eventTimerRef.current) window.clearTimeout(eventTimerRef.current);
            subscriptions.forEach(({ channel, eventName }) => {
                channel.stopListening?.(eventName, handleEvent);
            });
        };
    }, [
        enabled,
        JSON.stringify(channels || []),
        JSON.stringify(eventNames || []),
        JSON.stringify(resources || []),
        load,
        markChanged,
    ]);

    useEffect(() => () => {
        abortRef.current?.abort();
        clearRetry();
        if (eventTimerRef.current) window.clearTimeout(eventTimerRef.current);
    }, [clearRetry]);

    return {
        data,
        meta,
        loading,
        refreshing,
        syncState,
        lastSyncedAt,
        error,
        hasData: data !== null && data !== undefined,
        changedKeys,
        refetch: load,
        markChanged,
        clearChanged,
    };
}
