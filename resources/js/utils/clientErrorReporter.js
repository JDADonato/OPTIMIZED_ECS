const SENSITIVE_KEY_PATTERN = /(password|otp|csrf|token|secret|authorization|cookie|paymongo|payment_id|payment_intent|checkout_session)/i;
const SENSITIVE_VALUE_PATTERNS = [
    /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
    /Basic\s+[A-Za-z0-9._~+/=-]+/gi,
    /sk_(test|live)_[A-Za-z0-9]+/gi,
    /pk_(test|live)_[A-Za-z0-9]+/gi,
    /\b(pay|pi|cs)_[A-Za-z0-9]+\b/gi,
];

let lastReportKey = '';
let lastReportAt = 0;

const redactString = (value = '') => SENSITIVE_VALUE_PATTERNS
    .reduce((current, pattern) => current.replace(pattern, '[redacted]'), String(value))
    .slice(0, 8000);

const redact = (value) => {
    if (Array.isArray(value)) {
        return value.map(redact).slice(0, 50);
    }

    if (value && typeof value === 'object') {
        return Object.entries(value).reduce((safe, [key, item]) => {
            safe[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : redact(item);
            return safe;
        }, {});
    }

    if (typeof value === 'string') {
        return redactString(value);
    }

    return value;
};

const normalizeError = (error) => {
    if (error instanceof Error) {
        return {
            message: error.message,
            stack: error.stack,
        };
    }

    if (typeof error === 'string') {
        return { message: error };
    }

    return {
        message: error?.message || 'Unknown client error',
        stack: error?.stack,
    };
};

export const reportClientError = (error, context = {}) => {
    try {
        const normalized = normalizeError(error);
        const key = `${normalized.message}:${context?.source || ''}`;
        const now = Date.now();

        if (key === lastReportKey && now - lastReportAt < 5000) {
            return;
        }

        lastReportKey = key;
        lastReportAt = now;

        const payload = {
            message: redactString(normalized.message || 'Unknown client error'),
            stack: redactString(normalized.stack || ''),
            componentStack: redactString(context?.componentStack || ''),
            url: window.location.href,
            userAgent: navigator.userAgent,
            context: redact({
                ...context,
                componentStack: undefined,
            }),
        };

        const body = JSON.stringify(payload);

        if (navigator.sendBeacon) {
            const blob = new Blob([body], { type: 'application/json' });
            if (navigator.sendBeacon('/api/client-errors', blob)) {
                return;
            }
        }

        window.fetch('/api/client-errors', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body,
            keepalive: true,
        }).catch(() => {});
    } catch {
        // Reporting must never create a second application failure.
    }
};

export const installGlobalClientErrorHandlers = () => {
    if (window.__ecsClientErrorHandlersInstalled) {
        return;
    }

    window.__ecsClientErrorHandlersInstalled = true;

    window.addEventListener('error', (event) => {
        reportClientError(event.error || event.message, {
            source: 'window.error',
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        reportClientError(event.reason || 'Unhandled promise rejection', {
            source: 'window.unhandledrejection',
        });
    });
};
