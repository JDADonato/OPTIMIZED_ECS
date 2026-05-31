import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { fetchSmartResource, getUserScopedCacheKey, readSmartCache } from '../utils/smartResource';

const buildUrl = (url, params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
            query.set(key, value);
        }
    });

    const queryString = query.toString();
    return queryString ? `${url}${url.includes('?') ? '&' : '?'}${queryString}` : url;
};

export default function useStaffResource(url, {
    params = {},
    enabled = true,
    ttl = 45000,
    debounce = 0,
    initialData = null,
} = {}) {
    const { auth } = usePage().props;
    const user = auth?.user || null;
    const [data, setData] = useState(initialData);
    const [loading, setLoading] = useState(Boolean(enabled && !initialData));
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const abortRef = useRef(null);
    const dataRef = useRef(initialData);
    const paramsKey = JSON.stringify(params);
    const requestUrl = useMemo(() => buildUrl(url, params), [url, paramsKey]);
    const cacheKey = useMemo(() => getUserScopedCacheKey(user, requestUrl), [requestUrl, user?.id, user?.role]);
    const cached = useMemo(() => readSmartCache(cacheKey), [cacheKey]);

    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    useEffect(() => {
        if (initialData || !cached?.data) return;
        setData(cached.data);
        setLoading(false);
    }, [cached, initialData]);

    const load = useCallback(async ({ silent = false, bust = false } = {}) => {
        if (!enabled) return null;

        const currentCached = readSmartCache(cacheKey);
        if (!bust && currentCached && Date.now() - Number(currentCached.time || 0) < ttl) {
            setData(currentCached.data);
            setLoading(false);
            setRefreshing(false);
            setError(null);
            return currentCached.data;
        }

        if (!bust && currentCached && dataRef.current === null) {
            setData(currentCached.data);
        }

        if (!bust && currentCached && navigator.onLine === false) {
            setData(currentCached.data);
            setLoading(false);
            setRefreshing(false);
            setError(null);
            return currentCached.data;
        }

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        if (silent) setRefreshing(true);
        else setLoading(true);
        setError(null);

        try {
            const result = await fetchSmartResource(requestUrl, {
                cacheKey,
                ttl,
                force: bust,
                signal: controller.signal,
            });
            setData(result.raw || result.data);
            return result.raw || result.data;
        } catch (requestError) {
            if (requestError?.name !== 'AbortError') setError(requestError);
            return null;
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [cacheKey, enabled, requestUrl, ttl]);

    useEffect(() => {
        if (!enabled) return undefined;
        const timer = window.setTimeout(() => load(), debounce);
        return () => {
            window.clearTimeout(timer);
            abortRef.current?.abort();
        };
    }, [enabled, requestUrl, debounce, load]);

    return {
        data,
        loading,
        refreshing,
        error,
        refetch: load,
    };
}

export { buildUrl };
