export const getListData = (payload, fallback = []) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.bookings)) return payload.bookings;
    return fallback;
};

export const getPaginationMeta = (payload) => {
    if (!payload || Array.isArray(payload)) return null;
    const meta = payload.meta || payload;

    return {
        currentPage: meta.current_page,
        lastPage: meta.last_page,
        perPage: meta.per_page,
        total: meta.total,
        from: meta.from,
        to: meta.to,
    };
};
