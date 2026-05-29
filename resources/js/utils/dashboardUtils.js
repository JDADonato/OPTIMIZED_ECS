export const normalizeStatus = (status) => String(status || '').toLowerCase();

export const formatDate = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

export const formatDateTime = (value) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
};

export const formatTime = (value) => {
    if (!value) return 'Time TBD';
    const text = String(value).trim();
    if (/\b(am|pm)\b/i.test(text)) {
        return text
            .replace(/\s+/g, ' ')
            .replace(/\b(am|pm)\b/gi, match => match.toUpperCase());
    }

    const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (match) {
        const date = new Date();
        date.setHours(Number(match[1]), Number(match[2]), 0, 0);
        return date.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    }

    return text.replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, (_, hour, minute) => {
        const date = new Date();
        date.setHours(Number(hour), Number(minute), 0, 0);
        return date.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    });
};

export const formatMoney = (value) => Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export const formatCurrency = (value) => `PHP ${formatMoney(value)}`;

export const formatBookingRef = (id) => `#BK-${String(id).padStart(4, '0')}`;

export const getBookingTotal = (booking) => Number(booking?.totalCost ?? booking?.total_cost ?? booking?.budget ?? 0);

export const getBookingValue = (booking) => Number(booking?.total_cost || booking?.budget || 0);

export const titleCase = (value) => {
    if (!value) return '';
    return String(value)
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase());
};

export const getDateKey = (value) => {
    if (!value) return '';
    return String(value).substring(0, 10);
};

export const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
};

export const getFirstDayOfMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
};

export const formatFullAddress = (booking) => {
    if (!booking) return 'Not specified';
    const parts = [
        booking.venue_address_line,
        booking.venue_street,
        booking.venue_city,
        booking.venue_province,
        booking.venue_zip_code,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Not specified';
};

export const getSelectedDishes = (booking) => {
    if (!booking?.selected_menu) return [];
    try {
        const menu = typeof booking.selected_menu === 'string'
            ? JSON.parse(booking.selected_menu)
            : booking.selected_menu;

        return Object.entries(menu || {}).flatMap(([category, items]) => {
            if (!Array.isArray(items)) return [];
            return items.map((item) => ({
                category,
                name: typeof item === 'object' && item !== null ? (item.name || item.label || item.id) : item,
            })).filter((item) => item.name);
        });
    } catch (error) {
        console.error('Unable to parse selected menu', error);
        return [];
    }
};

export const getErrorMessage = (error, fallback) => {
    if (error?.error) return error.error;
    if (error?.message) return error.message;
    const validationErrors = error?.errors ? Object.values(error.errors).flat() : [];
    return validationErrors[0] || fallback;
};

const customerValidationMessages = {
    package_id: 'Please choose a package again.',
    event_date: 'Please choose an event date.',
    selected_menu: 'Please review your selected dishes.',
};

export const getCustomerSafeValidationMessage = (error, fallback = 'Please review the highlighted details and try again.') => {
    const fields = error?.errors && typeof error.errors === 'object' ? Object.keys(error.errors) : [];
    const mapped = fields.map(field => customerValidationMessages[field]).find(Boolean);
    if (mapped) return mapped;

    const raw = String(error?.error || error?.message || '').toLowerCase();
    const rawField = Object.keys(customerValidationMessages).find(field => raw.includes(field));
    if (rawField) return customerValidationMessages[rawField];

    return fallback;
};

export const paginate = (items, page, perPage = 8) => {
    const total = Array.isArray(items) ? items.length : 0;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * perPage;

    return {
        items: (items || []).slice(start, start + perPage),
        page: safePage,
        totalPages,
        total,
        start: total === 0 ? 0 : start + 1,
        end: Math.min(start + perPage, total),
    };
};
