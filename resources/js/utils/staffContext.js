export const STAFF_NAVIGATION_QUERY_CHANGE_EVENT = 'ecs:navigation-query-change';

export const createStaffContext = (params = {}) => ({
    customerId: String(params.customer || params.customer_id || params.customerId || '').trim(),
    customerQuery: String(params.customerQuery || params.customerName || params.customerEmail || params.customerPhone || '').trim(),
    booking: String(params.booking || params.booking_id || params.bookingId || '').trim(),
    conversation: String(params.conversation || params.conversation_id || params.conversationId || '').trim(),
});

export const hasStaffContext = (context = {}) => Boolean(
    context.customerId || context.customerQuery || context.booking || context.conversation
);

export const getStaffContextSearchText = (context = {}, options = {}) => {
    if (context.customerQuery) return context.customerQuery;
    if (!context.booking) return '';

    if (typeof options.bookingFormatter === 'function') {
        return options.bookingFormatter(context.booking);
    }

    return `Booking #${context.booking}`;
};

export const contextFromSearchParams = (searchParams) => (
    createStaffContext(Object.fromEntries(searchParams.entries()))
);

export const readStaffContextFromLocation = () => {
    if (typeof window === 'undefined') return createStaffContext();
    return contextFromSearchParams(new URLSearchParams(window.location.search));
};

export const normalizeStaffContextParams = (rawParams = {}) => {
    if (rawParams instanceof URLSearchParams) {
        return Object.fromEntries(rawParams.entries());
    }

    return rawParams || {};
};

export const replaceStaffContextUrl = ({
    tab,
    context = {},
    workspace,
    extra = {},
} = {}) => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    if (workspace) url.searchParams.set('workspace', workspace);
    if (tab) url.searchParams.set('tab', tab);

    const nextContext = createStaffContext(context);
    const entries = {
        customer: nextContext.customerId,
        customerQuery: nextContext.customerQuery,
        booking: nextContext.booking,
        conversation: nextContext.conversation,
        ...extra,
    };

    Object.entries(entries).forEach(([key, value]) => {
        const text = String(value ?? '').trim();
        if (text) {
            url.searchParams.set(key, text);
        } else {
            url.searchParams.delete(key);
        }
    });

    window.history.replaceState(window.history.state, '', url.toString());
};

export const buildStaffContextQuery = ({
    tab,
    context = {},
    workspace,
    extra = {},
} = {}) => {
    const params = new URLSearchParams();
    if (workspace) params.set('workspace', workspace);
    if (tab) params.set('tab', tab);

    const nextContext = createStaffContext(context);
    Object.entries({
        customer: nextContext.customerId,
        customerQuery: nextContext.customerQuery,
        booking: nextContext.booking,
        conversation: nextContext.conversation,
        ...extra,
    }).forEach(([key, value]) => {
        const text = String(value ?? '').trim();
        if (text) params.set(key, text);
    });

    return params.toString();
};
