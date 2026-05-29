export const csrfRequestHeaders = (headers = {}) => ({
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...headers,
});

export const csrfFetch = (url, options = {}) => fetch(url, {
    ...options,
    credentials: options.credentials || 'same-origin',
    headers: csrfRequestHeaders(options.headers || {}),
});

export default csrfFetch;
