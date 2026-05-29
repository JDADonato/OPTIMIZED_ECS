import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { fetchSmartResource, getUserScopedCacheKey, readSmartCache } from '../utils/smartResource';
import { buildUrl } from './useStaffResource';

export default function useSmartResource(url, {
    cacheKey = url,
    params = {},
    enabled = true,
    ttl = 45000,
    persist = true,
    initialData = null,
    select = (payload) => payload,
    onSuccess = null,
} = {}) {
    const { auth } = usePage().props;
    const user = auth?.user || null;
    const paramsKey = JSON.stringify(params);
    const requestUrl = useMemo(() => buildUrl(url, params), [url, paramsKey]);
    const resolvedCacheKey = useMemo(() => getUserScopedCacheKey(user, `${cacheKey}:${requestUrl}`), [cacheKey, requestUrl, user?.id, user?.role]);
    const cached = useMemo(() => readSmartCache(resolvedCacheKey), [resolvedCacheKey]);
    const [data, setData] = useState(() => initialData ?? (cached ? select(cached.data) : null));
    const [meta, setMeta] = useState(() => cached?.meta || {});
    const [loading, setLoading] = useState(Boolean(enabled && !initialData && !cached));
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const abortRef = useRef(null);

    const load = useCallback(async ({ silent = false, force = false } = {}) => {
        if (!enabled) return null;

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        if (silent || data) setRefreshing(true);
        else setLoading(true);
        setError(null);

        try {
            const result = await fetchSmartResource(requestUrl, {
                cacheKey: resolvedCacheKey,
                ttl,
                force,
                persist,
                signal: controller.signal,
            });
            const selected = select(result.data);
            setData(selected);
            setMeta(result.meta || {});
            onSuccess?.(selected, result);
            return selected;
        } catch (requestError) {
            if (requestError?.name !== 'AbortError') setError(requestError);
            return null;
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [data, enabled, onSuccess, persist, requestUrl, resolvedCacheKey, select, ttl]);

    useEffect(() => {
        if (!enabled) return undefined;
        load({ silent: Boolean(data || cached) });
        return () => abortRef.current?.abort();
    }, [enabled, requestUrl]);

    return {
        data,
        meta,
        loading,
        refreshing,
        error,
        refetch: load,
        cacheKey: resolvedCacheKey,
    };
}
