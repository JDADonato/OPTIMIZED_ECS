export const eventDisplayName = (booking) => (
    booking?.event_display_name
    || booking?.event_name
    || booking?.event_type
    || booking?.package_name
    || (booking?.id ? `Booking #${booking.id}` : 'Eloquente event')
);

