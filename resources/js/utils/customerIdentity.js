const clean = (value) => {
    const text = String(value ?? '').trim();
    return text || null;
};

const normalize = (value) => clean(value)?.replace(/\s+/g, ' ').toLowerCase() || '';

export const customerAccountName = (record = {}) => (
    clean(record.customer_account?.name)
    || clean(record.user?.full_name)
    || clean(record.user_full_name)
    || clean(record.full_name)
    || clean(record.user?.username)
    || clean(record.username)
    || (record.customer_account?.id || record.user_id ? `Customer #${record.customer_account?.id || record.user_id}` : 'Customer account')
);

export const customerAccountHandle = (record = {}) => {
    const username = clean(record.customer_account?.username) || clean(record.user?.username) || clean(record.username);
    return username ? `@${username}` : null;
};

export const customerAccountEmail = (record = {}) => (
    clean(record.customer_account?.email)
    || clean(record.user?.email)
    || clean(record.user_email)
    || clean(record.email)
);

export const customerAccountPhone = (record = {}) => (
    clean(record.customer_account?.phone)
    || clean(record.user?.phone)
    || clean(record.user_phone)
    || clean(record.phone)
);

export const bookingContactName = (record = {}) => (
    clean(record.booking_contact?.name)
    || clean(record.client_full_name)
    || clean(record.client_name)
    || customerAccountName(record)
);

export const bookingContactEmail = (record = {}) => (
    clean(record.booking_contact?.email)
    || clean(record.client_email)
    || customerAccountEmail(record)
);

export const bookingContactPhone = (record = {}) => (
    clean(record.booking_contact?.phone)
    || clean(record.client_phone)
    || customerAccountPhone(record)
);

export const hasDifferentBookingContact = (record = {}) => {
    if (typeof record.has_different_booking_contact === 'boolean') {
        return record.has_different_booking_contact;
    }

    return (
        normalize(bookingContactName(record)) !== '' &&
        normalize(customerAccountName(record)) !== '' &&
        normalize(bookingContactName(record)) !== normalize(customerAccountName(record))
    ) || (
        normalize(bookingContactEmail(record)) !== '' &&
        normalize(customerAccountEmail(record)) !== '' &&
        normalize(bookingContactEmail(record)) !== normalize(customerAccountEmail(record))
    ) || (
        normalize(bookingContactPhone(record)) !== '' &&
        normalize(customerAccountPhone(record)) !== '' &&
        normalize(bookingContactPhone(record)) !== normalize(customerAccountPhone(record))
    );
};

export const describeCustomerIdentity = (record = {}) => ({
    customerAccountName: customerAccountName(record),
    customerAccountHandle: customerAccountHandle(record),
    customerAccountEmail: customerAccountEmail(record),
    customerAccountPhone: customerAccountPhone(record),
    bookingContactName: bookingContactName(record),
    bookingContactEmail: bookingContactEmail(record),
    bookingContactPhone: bookingContactPhone(record),
    hasDifferentBookingContact: hasDifferentBookingContact(record),
});
