const DB_NAME = 'ecs-chat-cache';
const DB_VERSION = 1;
const STORE_NAME = 'conversation_messages';
const STORAGE_PREFIX = 'ecs:chat:messages:';
const MAX_CACHED_MESSAGES = 80;

const isBrowser = () => typeof window !== 'undefined';

const latestServerMessageId = (messages = []) => {
    return messages.reduce((latest, message) => {
        const id = Number(message?.id);
        if (!Number.isFinite(id) || String(message.id).startsWith('tmp-')) return latest;
        return Math.max(latest, id);
    }, 0);
};

const cacheableMessages = (messages = []) => {
    return messages.filter(message => {
        if (message?.optimistic_status) return false;
        const id = Number(message?.id);
        return Number.isFinite(id) && !String(message.id).startsWith('tmp-');
    });
};

const normalizeEntry = (conversationId, entry = {}) => {
    const messages = cacheableMessages(Array.isArray(entry.messages) ? entry.messages : []).slice(-MAX_CACHED_MESSAGES);

    return {
        conversationId: String(conversationId),
        messages,
        hasOlderMessages: Boolean(entry.hasOlderMessages),
        marker: entry.marker || '',
        latestServerId: Number(entry.latestServerId || latestServerMessageId(messages) || 0),
        cachedAt: Number(entry.cachedAt || Date.now()),
    };
};

let dbPromise = null;

const openDb = () => {
    if (!isBrowser() || !window.indexedDB) return Promise.resolve(null);
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve) => {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'conversationId' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
    });

    return dbPromise;
};

const localStorageKey = (conversationId) => `${STORAGE_PREFIX}${conversationId}`;

const readFallback = (conversationId) => {
    if (!isBrowser() || !window.localStorage) return null;

    try {
        const raw = window.localStorage.getItem(localStorageKey(conversationId));
        return raw ? normalizeEntry(conversationId, JSON.parse(raw)) : null;
    } catch (error) {
        return null;
    }
};

const writeFallback = (conversationId, entry) => {
    if (!isBrowser() || !window.localStorage) return;

    try {
        window.localStorage.setItem(localStorageKey(conversationId), JSON.stringify(normalizeEntry(conversationId, entry)));
    } catch (error) {
        // Storage may be full or disabled; in-memory cache still carries the session.
    }
};

export const chatMessageStore = {
    latestServerMessageId,

    async get(conversationId) {
        if (!conversationId) return null;
        const key = String(conversationId);
        const db = await openDb();

        if (!db) return readFallback(key);

        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const request = tx.objectStore(STORE_NAME).get(key);
            request.onsuccess = () => resolve(request.result ? normalizeEntry(key, request.result) : readFallback(key));
            request.onerror = () => resolve(readFallback(key));
        });
    },

    async set(conversationId, entry) {
        if (!conversationId) return null;
        const key = String(conversationId);
        const normalized = normalizeEntry(key, {
            ...entry,
            cachedAt: Date.now(),
        });
        writeFallback(key, normalized);
        const db = await openDb();

        if (!db) return normalized;

        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(normalized);
            tx.oncomplete = () => resolve(normalized);
            tx.onerror = () => resolve(normalized);
        });
    },
};
