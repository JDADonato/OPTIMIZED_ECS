import axios from 'axios';
import { installGlobalClientErrorHandlers } from './utils/clientErrorReporter';

installGlobalClientErrorHandlers();

window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
window.axios.defaults.headers.common['X-CSRF-TOKEN'] = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
window.axios.defaults.withCredentials = true;

const authFlowDebugEnabled = import.meta.env.DEV || import.meta.env.VITE_DEBUG_AUTH_FLOW === 'true';
const authFlowDebug = (message, details = {}) => {
    if (!authFlowDebugEnabled) {
        return;
    }

    console.info('[auth-flow-debug]', message, details);
};

const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
const originalFetch = window.fetch.bind(window);

const updateCsrfToken = (token) => {
    if (!token) {
        return;
    }

    let meta = document.querySelector('meta[name="csrf-token"]');

    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'csrf-token');
        document.head.appendChild(meta);
    }

    meta.setAttribute('content', token);
    window.axios.defaults.headers.common['X-CSRF-TOKEN'] = token;
    authFlowDebug('CSRF token updated', {
        tokenPresent: Boolean(token),
        tokenLength: token ? String(token).length : 0,
    });
};

const notifySessionExpired = () => {
    window.dispatchEvent(new CustomEvent('ecs:session-expired', {
        detail: {
            message: 'Your session expired. Refresh the page and try again.',
        },
    }));
};

const refreshCsrfToken = async () => {
    authFlowDebug('Refreshing CSRF token');
    const response = await originalFetch('/api/session/csrf-token', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });

    if (!response.ok) {
        throw new Error('Could not refresh the session token.');
    }

    const data = await response.json().catch(() => ({}));
    updateCsrfToken(data.token);
    return data.token;
};

const isSameOriginUrl = (rawUrl = window.location.href) => {
    const url = new URL(rawUrl || window.location.href, window.location.href);
    return url.origin === window.location.origin;
};

const isUnsafeMethod = (method = 'GET') => !['GET', 'HEAD', 'OPTIONS'].includes(String(method).toUpperCase());

window.axios.interceptors.request.use((config) => {
    const method = config.method || 'get';
    const sameOrigin = isSameOriginUrl(config.url);

    if (sameOrigin && isUnsafeMethod(method)) {
        config.headers = config.headers || {};
        config.headers['X-CSRF-TOKEN'] = csrfToken();
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        authFlowDebug('Axios mutation prepared', {
            url: config.url,
            method: String(method).toUpperCase(),
            tokenPresent: Boolean(csrfToken()),
            retry: Boolean(config.__csrfRetry),
        });
    }

    return config;
});

window.axios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const response = error.response;
        const config = error.config || {};
        const method = config.method || 'get';
        const shouldRetry = response?.status === 419
            && isSameOriginUrl(config.url)
            && isUnsafeMethod(method)
            && !config.__csrfRetry;

        if (!shouldRetry) {
            if (response?.status === 419) {
                authFlowDebug('Axios mutation failed with unrecoverable CSRF mismatch', {
                    url: config.url,
                    method: String(method).toUpperCase(),
                    retry: Boolean(config.__csrfRetry),
                });
                notifySessionExpired();
            }
            return Promise.reject(error);
        }

        try {
            authFlowDebug('Axios mutation received 419; refreshing token and retrying once', {
                url: config.url,
                method: String(method).toUpperCase(),
            });
            const token = await refreshCsrfToken();
            config.__csrfRetry = true;
            config.headers = config.headers || {};
            config.headers['X-CSRF-TOKEN'] = token;
            config.headers['X-Requested-With'] = 'XMLHttpRequest';

            return window.axios(config);
        } catch (refreshError) {
            authFlowDebug('Axios CSRF refresh failed', {
                url: config.url,
                method: String(method).toUpperCase(),
                message: refreshError?.message,
            });
            notifySessionExpired();
            return Promise.reject(error);
        }
    }
);

const withCsrfHeaders = (input, init = {}) => {
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    const token = csrfToken();

    if (token) {
        headers.set('X-CSRF-TOKEN', token);
    }

    if (!headers.has('X-Requested-With')) {
        headers.set('X-Requested-With', 'XMLHttpRequest');
    }

    if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json');
    }

    return {
        ...init,
        headers,
        credentials: init.credentials || 'same-origin',
    };
};

window.fetch = async (input, init = {}) => {
    const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const unsafeMethod = isUnsafeMethod(method);
    const rawUrl = input instanceof Request ? input.url : input;
    const sameOrigin = isSameOriginUrl(rawUrl);

    if (!unsafeMethod || !sameOrigin) {
        return originalFetch(input, init);
    }

    const requestOptions = withCsrfHeaders(input, init);
    const response = await originalFetch(input, requestOptions);

    if (response.status !== 419 || init.__csrfRetry) {
        if (response.status === 419) {
            console.warn('Session token expired or mismatched. Refresh the page before retrying this action.');
            notifySessionExpired();
        }

        return response;
    }

    try {
        await refreshCsrfToken();

        const retryResponse = await originalFetch(input, withCsrfHeaders(input, {
            ...init,
            __csrfRetry: true,
        }));

        if (retryResponse.status === 419) {
            console.warn('Session token expired or mismatched. Refresh the page before retrying this action.');
            notifySessionExpired();
        }

        return retryResponse;
    } catch (error) {
        console.warn('Session token expired and could not be refreshed. Refresh the page before retrying this action.', error);
        notifySessionExpired();
        return response;
    }
};

import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

if (import.meta.env.VITE_REVERB_ENABLED === 'true' && import.meta.env.VITE_REVERB_APP_KEY) {
    window.Echo = new Echo({
        broadcaster: 'reverb',
        key: import.meta.env.VITE_REVERB_APP_KEY,
        wsHost: import.meta.env.VITE_REVERB_HOST,
        wsPort: import.meta.env.VITE_REVERB_PORT ?? 8085,
        wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
        forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
        enabledTransports: ['ws', 'wss'],
    });
}
