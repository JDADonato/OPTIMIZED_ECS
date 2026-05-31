import React, { useEffect, useMemo, useState } from 'react';
import StaffDrawer from './StaffDrawer';
import StaffEmptyState from './StaffEmptyState';
import StaffPagination from './StaffPagination';
import StaffSkeleton from './StaffSkeleton';
import StaffStatusBadge from './StaffStatusBadge';
import { getListData, getPaginationMeta } from '../../utils/apiResponses';
import { feedbackStatusLabel } from '../../utils/statusLabels';
import csrfFetch from '../../utils/csrf';
import { bookingContactEmail, bookingContactName, bookingContactPhone, customerAccountName, hasDifferentBookingContact } from '../../utils/customerIdentity';

const formatDate = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatMoney = (value) => `PHP ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const noteDate = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const statusTone = (value) => {
    const normalized = String(value || '').toLowerCase();
    if (['closed', 'resolved', 'completed', 'verified', 'paid', 'approved'].includes(normalized)) return 'good';
    if (['needs follow up', 'pending', 'open'].includes(normalized)) return 'warn';
    if (['rejected', 'cancelled', 'failed'].includes(normalized)) return 'danger';
    return 'muted';
};

const EventHistoryPanel = ({ role = 'staff', onToast, surfaceMode = 'default' }) => {
    const isAdminSurface = surfaceMode === 'admin-full';
    const [events, setEvents] = useState([]);
    const [pagination, setPagination] = useState({ currentPage: 1, perPage: 15, total: 0, lastPage: 1 });
    const [loading, setLoading] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [noteBody, setNoteBody] = useState('');
    const [noteSaving, setNoteSaving] = useState(false);
    const [filters, setFilters] = useState({
        search: '',
        date_from: '',
        date_to: '',
        post_event_status: 'all',
        feedback_status: 'all',
        payment_status: 'all',
        refund_status: 'all',
    });

    const notify = (message, type = 'success') => {
        if (onToast) {
            onToast(message, type);
            return;
        }
        if (type === 'error') console.error(message);
    };

    const fetchHistory = async ({ page = pagination.currentPage, nextFilters = filters } = {}) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                paginated: '1',
                page,
                per_page: pagination.perPage,
            });

            Object.entries(nextFilters).forEach(([key, value]) => {
                if (value && value !== 'all') params.set(key, value);
            });

            const response = await fetch(`/api/staff/event-history?${params.toString()}`, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Could not load event history.');

            setEvents(getListData(payload));
            const meta = getPaginationMeta(payload);
            setPagination((current) => ({
                ...current,
                currentPage: meta?.currentPage || page,
                lastPage: meta?.lastPage || 1,
                perPage: meta?.perPage || current.perPage,
                total: meta?.total || 0,
            }));
        } catch (error) {
            notify(error.message || 'Could not load event history.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory({ page: 1 });
    }, []);

    const setFilter = (key, value) => {
        const nextFilters = { ...filters, [key]: value };
        setFilters(nextFilters);
        fetchHistory({ page: 1, nextFilters });
    };

    const addNote = async () => {
        if (!selectedEvent || noteBody.trim().length < 2) return;
        setNoteSaving(true);
        try {
            const response = await csrfFetch(`/api/staff/event-history/${selectedEvent.id}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ body: noteBody.trim() }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Could not add note.');

            const note = payload.note;
            const mergeNote = (event) => event.id === selectedEvent.id
                ? { ...event, notes: [note, ...(event.notes || [])] }
                : event;
            setEvents((items) => items.map(mergeNote));
            setSelectedEvent((event) => ({ ...event, notes: [note, ...(event.notes || [])] }));
            setNoteBody('');
            notify(payload.message || 'History note added.');
        } catch (error) {
            notify(error.message || 'Could not add note.', 'error');
        } finally {
            setNoteSaving(false);
        }
    };

    const roleCopy = useMemo(() => {
        if (role === 'marketing') return 'Feedback follow-up and testimonial work stay available through Marketing post-event tools.';
        if (role === 'accounting') return 'Payment and refund follow-up remains available through Finance tools when a record needs action.';
        if (role === 'admin') return 'Admin can inspect completed event outcomes while active workflow changes stay out of this archive.';
        return 'Completed event details are archived for staff reference.';
    }, [role]);

    const renderDrawer = () => {
        if (!selectedEvent) return null;
        const feedback = selectedEvent.feedback_summary || {};
        const payments = selectedEvent.payments_summary || {};
        const refunds = selectedEvent.refund_summary || {};

        return (
            <StaffDrawer
                isOpen={Boolean(selectedEvent)}
                eyebrow="Event history"
                title={`Booking #${selectedEvent.id}`}
                onClose={() => setSelectedEvent(null)}
                footer={<button type="button" onClick={() => setSelectedEvent(null)} className="staff-button-primary">Done</button>}
            >
                <div className="space-y-4">
                    <div className="rounded-lg border border-amber-100 bg-[#fffaf3] p-4">
                        <p className="text-xs font-black uppercase tracking-widest text-[#a16207]">Archived event</p>
                        <h3 className="mt-1 text-xl font-black text-slate-950">{selectedEvent.event_display_name || selectedEvent.event_name || selectedEvent.event_type || selectedEvent.package_name || `Booking #${selectedEvent.id}`}</h3>
                        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{selectedEvent.locked_message}</p>
                    </div>

                    <div className="staff-detail-grid">
                        <section className="staff-detail-card">
                            <p className="staff-detail-label">Booking contact</p>
                            <p className="staff-detail-value">{bookingContactName(selectedEvent)}</p>
                            <p className="mt-2 text-sm font-semibold text-slate-500">{bookingContactEmail(selectedEvent) || bookingContactPhone(selectedEvent) || 'No contact recorded'}</p>
                            {hasDifferentBookingContact(selectedEvent) && (
                                <p className="mt-2 text-xs font-black uppercase tracking-wide text-amber-700">Customer account: {customerAccountName(selectedEvent)}</p>
                            )}
                        </section>
                        <section className="staff-detail-card">
                            <p className="staff-detail-label">Event</p>
                            <p className="staff-detail-value">{formatDate(selectedEvent.event_date)}</p>
                            <p className="mt-2 text-sm font-semibold text-slate-500">{selectedEvent.pax || 0} guests / {selectedEvent.venue || 'Venue not recorded'}</p>
                        </section>
                        <section className="staff-detail-card">
                            <p className="staff-detail-label">Outcome</p>
                            <p className="staff-detail-value">{selectedEvent.post_event_status || selectedEvent.live_status || 'Completed'}</p>
                            <p className="mt-2 text-sm font-semibold text-slate-500">Owner: {selectedEvent.owner_name || 'Unassigned'}</p>
                        </section>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-3">
                        <section className="staff-detail-card">
                            <p className="staff-detail-label">Payment summary</p>
                            <p className="staff-detail-value">{formatMoney(payments.paid_amount)}</p>
                            <p className="mt-2 text-sm font-semibold text-slate-500">{payments.pending || 0} pending / {payments.total || 0} records</p>
                        </section>
                        <section className="staff-detail-card">
                            <p className="staff-detail-label">Refund summary</p>
                            <p className="staff-detail-value">{refunds.open || 0} open</p>
                            <p className="mt-2 text-sm font-semibold text-slate-500">{refunds.total || 0} refund case records</p>
                        </section>
                        <section className="staff-detail-card">
                            <p className="staff-detail-label">Feedback</p>
                            <p className="staff-detail-value">{feedback.has_response ? `${feedback.rating || '-'} / 5` : 'No response'}</p>
                            <p className="mt-2 text-sm font-semibold text-slate-500">{feedback.review_status || 'No follow-up status'} / {feedback.testimonial_status || 'No testimonial status'}</p>
                        </section>
                    </div>

                    <section className="staff-detail-card">
                        <p className="staff-detail-label">Limited follow-up</p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{roleCopy}</p>
                    </section>

                    <section className="staff-detail-card">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="staff-detail-label">Internal staff notes</p>
                                <p className="mt-1 text-sm font-semibold text-slate-500">Notes keep context without reopening completed booking work.</p>
                            </div>
                        </div>
                        <div className="mt-4 grid gap-3">
                            <textarea
                                value={noteBody}
                                onChange={(event) => setNoteBody(event.target.value)}
                                rows={3}
                                className="staff-control"
                                placeholder="Add a post-event note for staff..."
                            />
                            <div className="flex justify-end">
                                <button type="button" onClick={addNote} disabled={noteSaving || noteBody.trim().length < 2} className="staff-button-primary">
                                    {noteSaving ? 'Adding...' : 'Add note'}
                                </button>
                            </div>
                            {(selectedEvent.notes || []).length === 0 ? (
                                <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">No history notes yet.</p>
                            ) : (
                                <div className="grid gap-2">
                                    {(selectedEvent.notes || []).map((note) => (
                                        <article key={note.id} className="rounded-lg border border-slate-100 bg-white p-3">
                                            <p className="text-sm font-semibold leading-6 text-slate-700">{note.body}</p>
                                            <p className="mt-2 text-xs font-black uppercase tracking-wide text-slate-400">
                                                {note.user_name || 'Staff'} / {note.user_role || 'Staff'} / {noteDate(note.created_at)}
                                            </p>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </StaffDrawer>
        );
    };

    return (
        <div className={isAdminSurface ? 'admin-embedded-surface' : 'staff-work-surface'}>
            {!isAdminSurface && (
                <div className="staff-surface-head">
                    <div>
                        <p className="marketing-kicker">Shared history</p>
                        <h3 className="mt-1 text-lg font-black text-slate-950">Completed events</h3>
                        <p className="staff-section-copy">Completed bookings are visible here for staff reference and limited post-event follow-up.</p>
                    </div>
                    {loading && <StaffStatusBadge tone="muted">Loading</StaffStatusBadge>}
                </div>
            )}

            <div className={isAdminSurface ? 'admin-command-strip event-history-filter-bar' : 'staff-filter-bar event-history-filter-bar'}>
                <input value={filters.search} onChange={(event) => setFilter('search', event.target.value)} className="staff-control" placeholder="Search booking contact, account, event, venue, or booking #" />
                <input type="date" value={filters.date_from} onChange={(event) => setFilter('date_from', event.target.value)} className="staff-control" />
                <input type="date" value={filters.date_to} onChange={(event) => setFilter('date_to', event.target.value)} className="staff-control" />
                <select value={filters.post_event_status} onChange={(event) => setFilter('post_event_status', event.target.value)} className="staff-control">
                    <option value="all">All post-event states</option>
                    <option value="Feedback Pending">Feedback Pending</option>
                    <option value="Feedback Review">Feedback Review</option>
                    <option value="Closed">Closed</option>
                </select>
                <select value={filters.feedback_status} onChange={(event) => setFilter('feedback_status', event.target.value)} className="staff-control">
                    <option value="all">All feedback</option>
                    <option value="none">No feedback response</option>
                    <option value="Open">Open</option>
                    <option value="Needs Follow Up">Needs Follow Up</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                </select>
                <select value={filters.payment_status} onChange={(event) => setFilter('payment_status', event.target.value)} className="staff-control">
                    <option value="all">All payment states</option>
                    <option value="Pending">Pending payment</option>
                    <option value="Paid">Paid</option>
                    <option value="Verified">Verified</option>
                    <option value="Refunded">Refunded</option>
                </select>
                <select value={filters.refund_status} onChange={(event) => setFilter('refund_status', event.target.value)} className="staff-control">
                    <option value="all">All refund states</option>
                    <option value="none">No refund case</option>
                    <option value="pending">Pending refund</option>
                    <option value="processing">Processing refund</option>
                    <option value="completed">Completed refund</option>
                </select>
            </div>

            {loading && events.length === 0 ? (
                <StaffSkeleton rows={6} label="Loading event history" />
            ) : events.length === 0 ? (
                <StaffEmptyState title="No completed events found" message="Completed bookings will appear here after events are closed." />
            ) : (
                <div className={isAdminSurface ? 'staff-table-wrap admin-surface-grid admin-responsive-table' : 'staff-table-wrap'}>
                    <table className="staff-table">
                        <thead>
                            <tr>
                                <th>Booking</th>
                                <th>Event</th>
                                <th>Booking contact</th>
                                <th>Owner</th>
                                <th>Post-event</th>
                                <th>Feedback</th>
                                <th className="text-right">Value</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((event) => {
                                const feedback = event.feedback_summary || {};
                                return (
                                    <tr key={event.id}>
                                        <td className="font-black text-[#720101]">#{event.id}</td>
                                        <td>
                                            <p className="font-black text-slate-950">{event.event_display_name || event.event_name || event.event_type || event.package_name || `Booking #${event.id}`}</p>
                                            <p className="text-xs font-bold text-slate-400">{formatDate(event.event_date)} / {event.pax || 0} guests</p>
                                        </td>
                                        <td>
                                            <p className="font-black text-slate-950">{bookingContactName(event)}</p>
                                            <p className="text-xs font-bold text-slate-400">{bookingContactEmail(event) || bookingContactPhone(event) || 'No contact'}</p>
                                            {hasDifferentBookingContact(event) && (
                                                <p className="text-xs font-bold text-amber-700">Account: {customerAccountName(event)}</p>
                                            )}
                                        </td>
                                        <td>{event.owner_name || 'Unassigned'}</td>
                                        <td><StaffStatusBadge tone={statusTone(event.post_event_status)}>{event.post_event_status || 'Completed'}</StaffStatusBadge></td>
                                        <td>
                                            {(() => {
                                                const status = feedbackStatusLabel(feedback.review_status);
                                                return <StaffStatusBadge tone={status.tone === 'success' ? 'good' : status.tone === 'danger' ? 'danger' : status.tone === 'warning' ? 'warn' : 'muted'}>{status.label}</StaffStatusBadge>;
                                            })()}
                                        </td>
                                        <td className="text-right font-black text-slate-950">{formatMoney(event.total_cost)}</td>
                                        <td className="text-right">
                                            <button type="button" onClick={() => setSelectedEvent(event)} className="staff-row-action">Open</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <StaffPagination
                page={pagination.currentPage}
                perPage={pagination.perPage}
                total={pagination.total}
                onPageChange={(page) => fetchHistory({ page })}
            />
            {renderDrawer()}
        </div>
    );
};

export default EventHistoryPanel;
