import React from 'react';
import StaffDrawer from './StaffDrawer';
import StaffStatusBadge from './StaffStatusBadge';
import {
    bookingStatusLabel,
    liveStatusLabel,
    ownershipStatusLabel,
    paymentMethodLabel,
    preparationStatusLabel,
    reviewStatusLabel,
} from '../../utils/statusLabels';
import { bookingContactEmail, bookingContactName, bookingContactPhone, customerAccountEmail, customerAccountHandle, customerAccountName, customerAccountPhone, hasDifferentBookingContact } from '../../utils/customerIdentity';

const formatDate = (value) => {
    if (!value) return 'Date pending';
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (value) => {
    if (!value) return 'Time pending';
    const [hour, minute] = String(value).split(':');
    const date = new Date();
    date.setHours(Number(hour || 0), Number(minute || 0), 0, 0);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const formatMoney = (value) => `PHP ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const responsibleArea = (task) => {
    const area = task?.responsible_area || task?.department || task?.raw_department;
    return ['Operations', 'Admin', 'Service prep', undefined, null, ''].includes(area) ? 'Service prep' : area;
};

const fullAddress = (booking) => [
    booking?.venue_address_line,
    booking?.venue_barangay,
    booking?.venue_city,
    booking?.venue_province,
].filter(Boolean).join(', ') || booking?.venue || 'Venue pending';

const normalizeDishes = (selectedMenu) => {
    if (!selectedMenu) return [];
    try {
        const parsed = typeof selectedMenu === 'string' ? JSON.parse(selectedMenu || '{}') : selectedMenu;
        return Object.entries(parsed || {}).flatMap(([category, items]) => (
            Array.isArray(items) ? items.map((item) => ({
                category,
                name: typeof item === 'string' ? item : item?.name,
            })) : []
        )).filter((item) => item.name);
    } catch (e) {
        return [];
    }
};

const DetailCard = ({ label, value, children }) => (
    <section className="staff-detail-card">
        <p className="staff-detail-label">{label}</p>
        {value !== undefined && <p className="staff-detail-value">{value}</p>}
        {children}
    </section>
);

const EventDetailDrawer = ({
    isOpen,
    booking,
    role = 'staff',
    currentUser,
    title = 'Event details',
    eyebrow = 'Event brief',
    actionSlot,
    footer,
    onClose,
    children,
}) => {
    if (!booking) return null;

    const bookingStatus = bookingStatusLabel(booking.status);
    const reviewStatus = reviewStatusLabel(booking.review_status || (booking.status === 'Pending' ? 'Submitted' : booking.status));
    const ownershipStatus = ownershipStatusLabel(booking, currentUser);
    const liveStatus = liveStatusLabel(booking.live_status);
    const dishes = normalizeDishes(booking.selected_menu);
    const payments = booking.payments || [];
    const tasks = booking.preparation_tasks || [];
    const historyNotes = booking.history_notes || [];
    const showCustomerAccount = hasDifferentBookingContact(booking);

    return (
        <StaffDrawer
            isOpen={isOpen}
            eyebrow={eyebrow}
            title={title || `Booking #${booking.id}`}
            onClose={onClose}
            footer={footer}
        >
            <div className="space-y-4">
                <section className="rounded-lg border border-[#720101]/10 bg-[#fffaf3] p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p className="marketing-kicker">Booking #{String(booking.id || '').padStart(4, '0')}</p>
                            <h3 className="mt-1 text-xl font-black text-slate-950">{booking.event_display_name || booking.event_name || booking.event_type || booking.package_name || `Booking #${booking.id}`}</h3>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <StaffStatusBadge tone={bookingStatus.tone === 'success' ? 'good' : bookingStatus.tone === 'danger' ? 'danger' : bookingStatus.tone === 'warning' ? 'warn' : 'muted'}>{bookingStatus.label}</StaffStatusBadge>
                                <StaffStatusBadge tone={reviewStatus.tone === 'success' ? 'good' : reviewStatus.tone === 'danger' ? 'danger' : reviewStatus.tone === 'warning' ? 'warn' : 'muted'}>{reviewStatus.label}</StaffStatusBadge>
                                <StaffStatusBadge tone={ownershipStatus.tone === 'success' ? 'good' : ownershipStatus.tone === 'warning' ? 'warn' : 'muted'}>{ownershipStatus.label}</StaffStatusBadge>
                            </div>
                            <p className="mt-2 text-sm font-semibold text-slate-500">Owner: {booking.owner_name || booking.assigned_name || booking.owner || 'Unassigned'}</p>
                        </div>
                        {actionSlot && <div className="flex flex-wrap justify-start gap-2 sm:justify-end">{actionSlot}</div>}
                    </div>
                </section>

                <div className="staff-detail-grid">
                    <DetailCard label="Booking contact" value={bookingContactName(booking)}>
                        <p className="mt-2 text-sm font-semibold text-slate-500">{bookingContactEmail(booking) || 'No email recorded'}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">{bookingContactPhone(booking) || 'No phone recorded'}</p>
                    </DetailCard>
                    {showCustomerAccount && (
                        <DetailCard label="Customer account" value={customerAccountName(booking)}>
                            {customerAccountHandle(booking) && <p className="mt-2 text-sm font-semibold text-slate-500">{customerAccountHandle(booking)}</p>}
                            <p className="mt-1 text-sm font-semibold text-slate-500">{customerAccountEmail(booking) || 'No account email'}</p>
                            <p className="mt-1 text-sm font-semibold text-slate-500">{customerAccountPhone(booking) || 'No account phone'}</p>
                        </DetailCard>
                    )}
                    <DetailCard label="Schedule" value={`${formatDate(booking.event_date)} / ${formatTime(booking.event_time)}`}>
                        <p className="mt-2 text-sm font-semibold text-slate-500">{booking.pax || 0} guests</p>
                    </DetailCard>
                    <DetailCard label="Venue" value={fullAddress(booking)}>
                        {booking.venue_building_details && <p className="mt-2 text-sm font-semibold text-slate-500">{booking.venue_building_details}</p>}
                    </DetailCard>
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                    <DetailCard label="Event total" value={formatMoney(booking.totalCost ?? booking.total_cost ?? booking.budget)} />
                    <DetailCard label="Travel fee" value={formatMoney(booking.transport_fee)} />
                    <DetailCard label="Live status">
                        <div className="mt-2"><StaffStatusBadge tone={liveStatus.tone === 'success' ? 'good' : liveStatus.tone === 'warning' ? 'warn' : 'muted'}>{liveStatus.label}</StaffStatusBadge></div>
                    </DetailCard>
                </div>

                <DetailCard label="Menu and package">
                    <p className="mt-2 text-sm font-black text-slate-900">{booking.package_name || booking.package || booking.event_type || 'Package pending'}</p>
                    {dishes.length === 0 ? (
                        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-500">No dishes selected yet.</p>
                    ) : (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {dishes.slice(0, 12).map((dish, index) => (
                                <div key={`${dish.category}-${dish.name}-${index}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{dish.category}</p>
                                    <p className="text-sm font-bold text-slate-800">{dish.name}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </DetailCard>

                <DetailCard label="Payments and refunds">
                    {payments.length === 0 ? (
                        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-500">No payment records yet.</p>
                    ) : (
                        <div className="mt-3 grid gap-2">
                            {payments.slice(0, 5).map((payment) => (
                                <div key={payment.id} className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-sm font-black text-slate-900">{payment.payment_type || 'Payment'} / {paymentMethodLabel(payment.method || payment.payment_method)}</p>
                                        <p className="text-xs font-bold text-slate-400">{formatDate(payment.due_date || payment.paid_at || payment.created_at)}</p>
                                    </div>
                                    <p className="text-sm font-black text-slate-950">{formatMoney(payment.amount)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </DetailCard>

                <DetailCard label="Preparation">
                    {tasks.length === 0 ? (
                        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-500">No preparation tasks yet.</p>
                    ) : (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {tasks.map((task) => {
                                const taskStatus = preparationStatusLabel(task.status);
                                return (
                                    <div key={task.id} className="rounded-lg border border-slate-100 bg-white p-3">
                                        <p className="text-sm font-black text-slate-900">{task.label}</p>
                                        <p className="mt-1 text-xs font-bold text-slate-400">{responsibleArea(task)} / {taskStatus.label}</p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </DetailCard>

                {historyNotes.length > 0 && (
                    <DetailCard label="Staff notes and activity">
                        <div className="mt-3 grid gap-2">
                            {historyNotes.map((note) => (
                                <div key={note.id} className="rounded-lg border border-amber-100 bg-[#fffaf3] px-3 py-2">
                                    <p className="text-sm font-semibold text-slate-700">{note.body}</p>
                                    {note.created_at && <p className="mt-1 text-[11px] font-bold text-slate-400">{formatDate(note.created_at)}</p>}
                                </div>
                            ))}
                        </div>
                    </DetailCard>
                )}

                {children}

                {role === 'history' && (
                    <p className="rounded-lg border border-amber-100 bg-[#fffaf3] p-4 text-sm font-bold text-slate-600">
                        Completed event details are archived. Add a note or use the available post-event follow-up actions.
                    </p>
                )}
            </div>
        </StaffDrawer>
    );
};

export default EventDetailDrawer;
