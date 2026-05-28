const memoryCache = new Map();
const inFlight = new Map();
const STORAGE_PREFIX = 'ecs:smart-resource:';

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeJsonParse = (value, fallback = null) => {
    try {
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
};

const storageKey = (key) => `${STORAGE_PREFIX}${key}`;

const normalizeRole = (role) => String(role || 'guest').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');

export const getUserScopedCacheKey = (user, resourceKey) => {
    const userId = user?.id ? String(user.id) : 'guest';
    const role = normalizeRole(user?.role);
    return `user:${userId}:${role}:${resourceKey}`;
};

export const readSmartCache = (key, { maxAge = null } = {}) => {
    if (!key) return null;

    const memory = memoryCache.get(key);
    const now = Date.now();
    if (memory && (!maxAge || now - memory.time <= maxAge)) {
        return memory;
    }

    if (!canUseStorage()) return memory || null;

    const stored = safeJsonParse(window.localStorage.getItem(storageKey(key)));
    if (!stored) return memory || null;
    if (maxAge && now - Number(stored.time || 0) > maxAge) return memory || null;

    memoryCache.set(key, stored);
    return stored;
};

export const writeSmartCache = (key, data, meta = {}) => {
    if (!key) return null;

    const entry = {
        data,
        meta,
        time: Date.now(),
    };

    memoryCache.set(key, entry);

    if (canUseStorage()) {
        try {
            window.localStorage.setItem(storageKey(key), JSON.stringify(entry));
        } catch {
            // Storage can fail in private windows or when quota is full; memory cache still works.
        }
    }

    return entry;
};

export const readUserSmartCache = (user, resourceKey, options = {}) => (
    readSmartCache(getUserScopedCacheKey(user, resourceKey), options)
);

export const writeUserSmartCache = (user, resourceKey, data, meta = {}) => (
    writeSmartCache(getUserScopedCacheKey(user, resourceKey), data, meta)
);

export const bustSmartCache = (...keys) => {
    keys.filter(Boolean).forEach((key) => {
        memoryCache.delete(key);
        inFlight.delete(key);
        if (canUseStorage()) {
            window.localStorage.removeItem(storageKey(key));
        }
    });
};

export const clearSmartCacheForPrefix = (prefix) => {
    if (!prefix) return;

    [...memoryCache.keys()].forEach((key) => {
        if (key.startsWith(prefix)) memoryCache.delete(key);
    });
    [...inFlight.keys()].forEach((key) => {
        if (key.startsWith(prefix)) inFlight.delete(key);
    });

    if (!canUseStorage()) return;

    Object.keys(window.localStorage).forEach((key) => {
        if (key.startsWith(`${STORAGE_PREFIX}${prefix}`)) {
            window.localStorage.removeItem(key);
        }
    });
};

export const clearSensitiveAuthState = () => {
    if (!canUseStorage()) return;

    [
        'ecs_booking_draft',
        'ecs_booking_draft_reminder',
        'ecs_selected_booking_id',
        'ecs_home_journey_tracker_cache',
        'ecs_home_journey_tracker_collapsed',
    ].forEach((key) => window.localStorage.removeItem(key));

    window.sessionStorage?.removeItem('ecs_booking_active');
};

const appendVersionParam = (url, version) => {
    if (!version) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}since_version=${encodeURIComponent(version)}`;
};

export const fetchSmartResource = async (url, {
    cacheKey = url,
    ttl = 45000,
    force = false,
    persist = true,
    headers = {},
    signal,
} = {}) => {
    const cached = readSmartCache(cacheKey);
    const now = Date.now();

    if (!force && cached && now - Number(cached.time || 0) < ttl) {
        return {
            data: cached.data,
            meta: cached.meta || {},
            fromCache: true,
            changed: false,
        };
    }

    if (!force && inFlight.has(cacheKey)) {
        return inFlight.get(cacheKey);
    }

    const requestUrl = appendVersionParam(url, cached?.meta?.resource_version);
    const request = fetch(requestUrl, {
        signal,
        headers: {
            Accept: 'application/json',
            ...(cached?.meta?.etag ? { 'If-None-Match': cached.meta.etag } : {}),
            ...headers,
        },
    }).then(async (response) => {
        if (response.status === 304 && cached) {
            return {
                data: cached.data,
                meta: cached.meta || {},
                fromCache: true,
                changed: false,
            };
        }

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw payload;

        if (payload?.meta?.changed === false && cached) {
            return {
                data: cached.data,
                meta: payload.meta || cached.meta || {},
                fromCache: true,
                changed: false,
            };
        }

        const meta = {
            ...(payload?.meta || {}),
            etag: response.headers.get('etag') || payload?.meta?.etag || null,
            generated_at: payload?.meta?.generated_at || new Date().toISOString(),
        };

        if (persist) writeSmartCache(cacheKey, payload, meta);

        return {
            data: payload,
            meta,
            fromCache: false,
            changed: true,
            raw: payload,
        };
    }).finally(() => {
        inFlight.delete(cacheKey);
    });

    inFlight.set(cacheKey, request);
    return request;
};
