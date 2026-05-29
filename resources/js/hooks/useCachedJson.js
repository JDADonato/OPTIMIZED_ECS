import { useCallback } from 'react';
import { usePage } from '@inertiajs/react';
import { bustSmartCache, fetchSmartResource, getUserScopedCacheKey } from '../utils/smartResource';

export default function useCachedJson(defaultBustUrls = []) {
    const { auth } = usePage().props;
    const user = auth?.user || null;

    const scopedKey = useCallback((url) => getUserScopedCacheKey(user, url), [user?.id, user?.role]);

    const fetchCachedJson = useCallback(async (url, ttl = 45000) => {
        const result = await fetchSmartResource(url, { cacheKey: scopedKey(url), ttl });
        return result.raw || result.data;
    }, [scopedKey]);

    const bustCache = useCallback((...urls) => {
        bustSmartCache(...[...urls, ...defaultBustUrls].map(scopedKey));
    }, [defaultBustUrls, scopedKey]);

    return { bustCache, fetchCachedJson };
}
