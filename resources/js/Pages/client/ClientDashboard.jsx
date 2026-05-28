import React, { Suspense, lazy, useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { router } from '@inertiajs/react';
import { fetchMenuItemsFromAPI } from '../../utils/menuUtils';
import ClientNavbar from '../../Components/common/ClientNavbar';
import ConfirmModal from '../../Components/common/ConfirmModal';
import CustomerAnnouncements from '../../Components/content/CustomerAnnouncements';
import { customerBookingStatus, customerPaymentStatus, isSettledPaymentStatus, paymentTypeLabel, statusToneClasses } from '../../utils/statusLabels';
import { fetchSmartResource, getUserScopedCacheKey, writeSmartCache } from '../../utils/smartResource';
import useOnlineStatus from '../../hooks/useOnlineStatus';

const ReceiptModal = lazy(() => import('../../Components/common/ReceiptModal'));

const peso = (value) => `PHP ${Number(value || 0).toLocaleString()}`;
const paymentLabel = paymentTypeLabel;
const menuCategories = [
    { id: 'starter', label: 'Starters' },
    { id: 'main', label: 'Main Courses' },
    { id: 'side', label: 'Sides' },
    { id: 'dessert', label: 'Desserts' },
    { id: 'drink', label: 'Refreshments' },
];
const dashboardSections = ['details', 'menu', 'payments', 'history'];
const eventDisplayName = (booking) => booking?.event_display_name || booking?.event_name || booking?.event_type || booking?.package_name || (booking?.id ? `Booking #${booking.id}` : 'Eloquente event');
const sharedSelectedBookingKey = 'ecs_selected_booking_id';
const formatEventDate = (date, options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) => (
    date ? new Date(date).toLocaleDateString('en-US', options) : 'Date pending'
);
const isOpenTasting = (tasting) => tasting && !['Cancelled', 'Completed'].includes(tasting.status);
const toDateInputValue = (date) => {
    if (!date) return '';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
};

const readStoredDashboardValue = (key, fallback = null) => {
    if (typeof window === 'undefined') return fallback;

    try {
        return localStorage.getItem(key) || fallback;
    } catch (e) {
        return fallback;
    }
};

const writeStoredDashboardValue = (key, value) => {
    if (typeof window === 'undefined' || value === null || value === undefined) return;

    try {
        localStorage.setItem(key, String(value));
    } catch (e) {
        // Ignore storage errors so dashboard navigation still works normally.
    }
};

const readStoredDashboardJson = (key, fallback = null) => {
    if (typeof window === 'undefined') return fallback;

    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch (e) {
        return fallback;
    }
};

const writeStoredDashboardJson = (key, value) => {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        // Cache is a speed boost only.
    }
};

const quickTimes = [
    { label: '8:00 AM', value: '08:00' },
    { label: '10:00 AM', value: '10:00' },
    { label: '12:00 PM', value: '12:00' },
    { label: '2:00 PM', value: '14:00' },
    { label: '4:00 PM', value: '16:00' },
    { label: '6:00 PM', value: '18:00' },
    { label: '8:00 PM', value: '20:00' },
];

const motifPresets = [
    { label: 'Burgundy', value: '#720101' },
    { label: 'Gold', value: '#f0aa0b' },
    { label: 'Ivory', value: '#fff7e6' },
    { label: 'Navy', value: '#0f2742' },
    { label: 'Sage', value: '#7f9a7a' },
    { label: 'Blush', value: '#e7aaa5' },
    { label: 'Black', value: '#151515' },
];

const timelineTemplates = {
    Wedding: [
        { time: '16:00', activity: 'Supplier ingress', note: 'Venue access and setup' },
        { time: '17:30', activity: 'Guest arrival', note: 'Welcome and registration' },
        { time: '19:00', activity: 'Dinner service', note: 'Serve after program cue' },
    ],
    Debut: [
        { time: '15:00', activity: 'Supplier ingress', note: 'Setup and final styling' },
        { time: '18:00', activity: 'Program starts', note: 'Entrance and opening remarks' },
        { time: '19:30', activity: 'Dinner service', note: 'Coordinate with host' },
    ],
    Birthday: [
        { time: '14:00', activity: 'Supplier ingress', note: 'Setup buffet and decor' },
        { time: '16:00', activity: 'Guest arrival', note: 'Start receiving guests' },
        { time: '17:00', activity: 'Food service', note: 'Open buffet' },
    ],
    Corporate: [
        { time: '08:00', activity: 'Supplier ingress', note: 'Setup registration and meal area' },
        { time: '10:00', activity: 'Program starts', note: 'Coordinate with event lead' },
        { time: '12:00', activity: 'Meal service', note: 'Lunch service window' },
    ],
};

const specialInstructionFields = [
    { key: 'dietary', label: 'Dietary and allergies', placeholder: 'Allergies, halal, vegetarian, no pork...' },
    { key: 'access', label: 'Access, loading, parking', placeholder: 'Parking, gate pass, elevator, loading bay...' },
    { key: 'vip', label: 'VIP and program notes', placeholder: 'VIP tables, host cues, sensitive timing...' },
    { key: 'other', label: 'Other instructions', placeholder: 'Anything else the team should know.' },
];

const formatTimeLabel = (value) => {
    if (!value) return '';
    const match = String(value).match(/^(\d{1,2}):(\d{2})/);
    if (!match) return value;
    const hour = Number(match[1]);
    const minute = match[2];
    const suffix = hour >= 12 ? 'PM' : 'AM';
    return `${hour % 12 || 12}:${minute} ${suffix}`;
};

const parseEventStartTime = (value) => {
    if (!value) return '';
    const simple = String(value).match(/^(\d{1,2}):(\d{2})/);
    if (simple) return `${String(simple[1]).padStart(2, '0')}:${simple[2]}`;
    const meridiem = String(value).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!meridiem) return '';
    let hour = Number(meridiem[1]);
    if (meridiem[3].toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (meridiem[3].toUpperCase() === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${meridiem[2]}`;
};

const addMinutesToTime = (value, minutesToAdd) => {
    const start = parseEventStartTime(value);
    if (!start) return '';
    const [hours, minutes] = start.split(':').map(Number);
    const total = (hours * 60 + minutes + minutesToAdd + 1440) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const parseTimelineRows = (value) => {
    const lines = String(value || '').split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.length === 0) return [{ time: '', activity: '', note: '' }];
    return lines.map((line) => {
        const match = line.match(/^(.+?)\s[-–]\s(.+?)(?:\s[-–]\s(.+))?$/);
        return match
            ? { time: parseEventStartTime(match[1]) || match[1], activity: match[2] || '', note: match[3] || '' }
            : { time: '', activity: line, note: '' };
    });
};

const serializeTimelineRows = (rows) => rows
    .filter(row => row.time || row.activity || row.note)
    .map(row => [formatTimeLabel(row.time) || row.time, row.activity, row.note].filter(Boolean).join(' - '))
    .join('\n');

const parseSpecialInstructions = (value) => {
    const text = String(value || '');
    const sections = { dietary: '', access: '', vip: '', other: text };
    specialInstructionFields.forEach((field) => {
        const pattern = new RegExp(`${field.label}:\\s*([\\s\\S]*?)(?=\\n[A-Za-z, &]+:|$)`, 'i');
        const match = text.match(pattern);
        if (match) {
            sections[field.key] = match[1].trim();
            if (field.key !== 'other') sections.other = sections.other.replace(match[0], '').trim();
        }
    });
    return sections;
};

const serializeSpecialInstructions = (sections) => specialInstructionFields
    .map(field => ({ label: field.label, value: String(sections[field.key] || '').trim() }))
    .filter(field => field.value)
    .map(field => `${field.label}: ${field.value}`)
    .join('\n');

const hasSelectedMenu = (selectedMenu) => {
    if (!selectedMenu) return false;
    try {
        const parsed = typeof selectedMenu === 'string' ? JSON.parse(selectedMenu || '{}') : selectedMenu;
        return Object.values(parsed || {}).some(items => Array.isArray(items) ? items.length > 0 : Boolean(items));
    } catch (e) {
        return Boolean(selectedMenu);
    }
};

const buildJourneySteps = (booking, payments) => {
    const bookingPayments = payments.filter((payment) => payment.booking_id === booking.id);
    const total = Number(booking.total_cost || 0);
    const paid = bookingPayments
        .filter((payment) => isSettledPaymentStatus(payment.status))
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const isApproved = ['Confirmed', 'Completed'].includes(booking.status);
    const hasReservation = bookingPayments.some((payment) => payment.payment_type === 'Reservation' && isSettledPaymentStatus(payment.status)) || (total > 0 && paid / total >= 0.1);
    const eventDetailsDone = Boolean(booking.venue_address_line && booking.event_time && (booking.event_timeline || booking.special_instructions || booking.color_motif));
    const paymentsDone = bookingPayments.length > 0 && bookingPayments.every((payment) => isSettledPaymentStatus(payment.status));
    const needsClarification = Boolean(booking.clarification_request && !booking.clarification_response);
    const needsMenuSelection = !hasSelectedMenu(booking.selected_menu);

    const steps = [
        { label: 'Booking approved', done: isApproved, action: 'Awaiting Marketing Executive approval', tab: 'details', target: 'approval-status-panel', isPendingGate: !isApproved },
        { label: 'Reservation payment', done: hasReservation, action: 'Complete the reservation fee', tab: 'payments', locked: !isApproved },
        { label: 'Event details', done: eventDetailsDone, action: 'Add timeline, venue notes, and motif', tab: 'details', target: 'event-details-panel' },
        { label: 'Payment balance', done: paymentsDone, action: booking.nextPaymentDue ? `Pay ${paymentLabel(booking.nextPaymentDue.payment_type)}` : 'No remaining payment', tab: 'payments', locked: !isApproved },
    ];

    if (needsMenuSelection) {
        steps.unshift({ label: 'Menu selection', done: false, action: 'Choose dishes for this event', tab: 'menu' });
    }

    if (needsClarification) {
        steps.unshift({
            label: 'Staff request',
            done: false,
            action: 'Answer the details requested by the team',
            tab: 'details',
            target: 'staff-request-panel',
            isPendingGate: true,
        });
    }

    return steps;
};

const HistoryPanel = ({ bookings, onRemove }) => (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#720101]">History</p>
                <h3 className="mt-1 text-xl font-display font-bold text-[#1a1a1a]">Cancelled and completed events</h3>
                <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-gray-500">Past records stay read-only. Use Rebook to start a new booking with the proper availability, menu, pricing, and payment steps.</p>
            </div>
        </div>
        {bookings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                <p className="font-bold text-gray-900">No history yet.</p>
            </div>
        ) : (
            <div className="grid gap-4">
                {bookings.map((booking) => (
                    <div key={booking.id} className="group relative rounded-2xl border border-gray-100 bg-[#faf7f2] p-5 transition-all hover:border-gray-200 hover:shadow-sm">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <h4 className="font-display text-lg font-bold text-[#1a1a1a]">{eventDisplayName(booking)}</h4>
                                    <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${statusToneClasses[customerBookingStatus(booking.status).tone]?.light || statusToneClasses.neutral.light}`}>
                                        {customerBookingStatus(booking.status).label}
                                    </span>
                                </div>
                                <p className="text-sm font-semibold text-gray-600">
                                    {new Date(booking.event_date).toLocaleDateString()} - {booking.pax} pax - {peso(booking.total_cost)}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {onRemove && (
                                    <button 
                                        onClick={() => onRemove(booking.id)}
                                        className="rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-600 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-700"
                                    >
                                        Remove
                                    </button>
                                )}
                                <button onClick={() => router.get('/book')} className="rounded-xl bg-[#720101] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#5a0101]">
                                    Rebook Event
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
);

const SmartEventDetailsPanel = ({
    activeBooking,
    detailsForm,
    setDetailsForm,
    detailsEditMode,
    setDetailsEditMode,
    savingDetails,
    saveEventDetails,
    uploadingImage,
    uploadInspirationImage,
    timelineRows,
    setDetailTime,
    updateTimelineRow,
    addTimelineRow,
    removeTimelineRow,
    applyTimelineTemplate,
    specialInstructionSections,
    updateSpecialInstructionSection,
    customMotifColor,
    setCustomMotifColor,
    applyMotifPreset,
    addCustomMotifColor,
}) => {
    const eventStartTime = parseEventStartTime(activeBooking.event_time);
    const readSections = [
        { label: 'Venue address', value: detailsForm.venue_address_line },
        { label: 'Venue notes', value: detailsForm.venue_building_details },
        { label: 'Reservation time', value: formatTimeLabel(detailsForm.reservation_time) || detailsForm.reservation_time },
        { label: 'Serving time', value: formatTimeLabel(detailsForm.serving_time) || detailsForm.serving_time },
        { label: 'Color motif', value: detailsForm.color_motif },
        { label: 'Event timeline', value: serializeTimelineRows(timelineRows) || detailsForm.event_timeline },
        { label: 'Special instructions', value: serializeSpecialInstructions(specialInstructionSections) || detailsForm.special_instructions },
    ].filter(section => String(section.value || '').trim());
    const detailCount = readSections.length + (detailsForm.theme_uploads ? 1 : 0);

    const TimePicker = ({ label, value, fieldKey, helper }) => {
        const isCustom = value && !quickTimes.some(time => time.value === value);
        return (
            <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">{label}</p>
                        <p className="text-xs font-semibold text-gray-500">{helper}</p>
                    </div>
                    <strong className="text-sm text-[#720101]">{formatTimeLabel(value) || 'Not set'}</strong>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    {quickTimes.map(time => (
                        <button
                            key={`${fieldKey}-${time.value}`}
                            type="button"
                            onClick={() => setDetailTime(fieldKey, time.value)}
                            className={`rounded-xl border px-3 py-2 text-xs font-black transition ${value === time.value ? 'border-[#720101] bg-[#720101] text-white' : 'border-gray-200 bg-[#faf7f2] text-gray-700 hover:border-[#720101]/30'}`}
                        >
                            {time.label}
                        </button>
                    ))}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <label className={`flex h-12 items-center gap-3 rounded-xl border px-3 ${isCustom ? 'border-[#720101] bg-[#720101]/5' : 'border-gray-200 bg-white'}`}>
                        <span className="text-xs font-black uppercase tracking-widest text-gray-500">Custom</span>
                        <input
                            type="time"
                            value={parseEventStartTime(value)}
                            onChange={(event) => setDetailTime(fieldKey, event.target.value)}
                            className="min-w-0 flex-1 bg-transparent text-sm font-bold text-gray-900 outline-none"
                        />
                    </label>
                    {eventStartTime && (
                        <>
                            <button type="button" onClick={() => setDetailTime(fieldKey, eventStartTime)} className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-600 hover:bg-gray-50">Event start</button>
                            <button type="button" onClick={() => setDetailTime(fieldKey, addMinutesToTime(eventStartTime, 60))} className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-600 hover:bg-gray-50">+1 hour</button>
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div id="event-details-panel" className="max-w-full overflow-hidden rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex flex-col gap-3 border-b border-gray-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-xs font-black uppercase tracking-widest text-[#720101]">Event details</p>
                    <h3 className="mt-1 font-display text-2xl font-bold text-[#1a1a1a]">Planning details</h3>
                </div>
                {activeBooking.canEditSupplementary && (
                    <div className="flex flex-wrap gap-2">
                        {detailsEditMode && (
                            <button
                                type="button"
                                onClick={() => setDetailsEditMode(false)}
                                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => detailsEditMode ? saveEventDetails() : setDetailsEditMode(true)}
                            disabled={savingDetails}
                            className="rounded-xl bg-[#720101] px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-sm hover:bg-[#5a0101] disabled:opacity-50"
                        >
                            {detailsEditMode ? (savingDetails ? 'Saving...' : 'Save changes') : 'Edit'}
                        </button>
                    </div>
                )}
            </div>

            {!activeBooking.canEditSupplementary && activeBooking.status !== 'Cancelled' && (
                <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4">
                    <p className="text-sm font-bold text-red-800">Hard Freeze Active</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-red-700">Your event details are locked because final preparations are underway. For urgent changes, message your Marketing Executive.</p>
                </div>
            )}

            {!detailsEditMode ? (
                <div className="space-y-4">
                    <div className="rounded-2xl border border-[#720101]/10 bg-[#faf7f2]/70 p-4">
                        <p className="text-sm font-black text-[#1a1a1a]">{detailCount ? `${detailCount} planning detail${detailCount > 1 ? 's' : ''} added` : 'Planning details are not filled yet'}</p>
                        <p className="mt-1 text-sm font-semibold text-gray-500">Use Edit when you are ready to share timing, motif, program, and venue notes with the team.</p>
                    </div>
                    {detailCount > 0 && (
                        <div className="grid gap-3 lg:grid-cols-2">
                            {readSections.map(section => (
                                <div key={section.label} className={`rounded-2xl border border-gray-100 bg-white p-4 ${section.label.includes('timeline') || section.label.includes('instructions') ? 'lg:col-span-2' : ''}`}>
                                    <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{section.label}</p>
                                    <p className="mt-2 whitespace-pre-wrap break-words text-sm font-bold leading-6 text-gray-900">{section.value}</p>
                                </div>
                            ))}
                            {detailsForm.theme_uploads && (
                                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                                    <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">Inspiration image</p>
                                    <a href={detailsForm.theme_uploads} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm font-black text-[#720101] hover:text-[#5a0101]">View uploaded reference</a>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-5">
                    <div className="grid gap-4 lg:grid-cols-2">
                        <label className="block">
                            <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">Venue address</span>
                            <input
                                value={detailsForm.venue_address_line || ''}
                                onChange={(event) => setDetailsForm(prev => ({ ...prev, venue_address_line: event.target.value }))}
                                placeholder="Complete venue address"
                                className="mt-2 h-12 w-full rounded-2xl border border-[#720101]/10 bg-white px-4 text-sm font-semibold text-gray-900 outline-none transition focus:border-[#720101] focus:ring-4 focus:ring-[#720101]/10"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">Venue notes</span>
                            <input
                                value={detailsForm.venue_building_details || ''}
                                onChange={(event) => setDetailsForm(prev => ({ ...prev, venue_building_details: event.target.value }))}
                                placeholder="Building, floor, room, gate, landmarks"
                                className="mt-2 h-12 w-full rounded-2xl border border-[#720101]/10 bg-white px-4 text-sm font-semibold text-gray-900 outline-none transition focus:border-[#720101] focus:ring-4 focus:ring-[#720101]/10"
                            />
                        </label>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                        <TimePicker label="Reservation time" fieldKey="reservation_time" value={detailsForm.reservation_time} helper="When guests or organizers can access the setup." />
                        <TimePicker label="Serving time" fieldKey="serving_time" value={detailsForm.serving_time} helper="When food service should begin." />
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-[#faf7f2]/40 p-4">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                            <label className="block min-w-0">
                                <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">Color motif</span>
                                <input
                                    value={detailsForm.color_motif || ''}
                                    onChange={(event) => setDetailsForm(prev => ({ ...prev, color_motif: event.target.value }))}
                                    placeholder="e.g., Royal Gold, Deep Navy, Ivory"
                                    className="mt-2 h-12 w-full rounded-2xl border border-[#720101]/10 bg-white px-4 text-sm font-semibold text-gray-900 outline-none transition focus:border-[#720101] focus:ring-4 focus:ring-[#720101]/10"
                                />
                            </label>
                            <div className="flex items-center gap-2">
                                <input type="color" value={customMotifColor} onChange={(event) => setCustomMotifColor(event.target.value)} className="h-12 w-14 cursor-pointer rounded-xl border border-gray-200 bg-white p-1" aria-label="Custom motif color" />
                                <button type="button" onClick={addCustomMotifColor} className="h-12 rounded-xl border border-gray-200 bg-white px-4 text-xs font-black uppercase tracking-widest text-gray-600 hover:bg-gray-50">Add</button>
                            </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {motifPresets.map(preset => (
                                <button key={preset.label} type="button" onClick={() => applyMotifPreset(preset)} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-700 hover:border-[#720101]/30">
                                    <span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: preset.value }} />
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">Event timeline / program</p>
                                <p className="text-xs font-semibold text-gray-500">Add the moments the kitchen and service team should prepare around.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {Object.keys(timelineTemplates).map(template => (
                                    <button key={template} type="button" onClick={() => applyTimelineTemplate(template)} className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-600 hover:bg-gray-50">{template}</button>
                                ))}
                            </div>
                        </div>
                        <div className="mt-4 space-y-3">
                            {timelineRows.map((row, index) => (
                                <div key={index} className="grid gap-2 rounded-2xl border border-gray-100 bg-[#faf7f2]/40 p-3 lg:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)_auto]">
                                    <input type="time" value={parseEventStartTime(row.time)} onChange={(event) => updateTimelineRow(index, 'time', event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 outline-none focus:border-[#720101]" />
                                    <input value={row.activity || ''} onChange={(event) => updateTimelineRow(index, 'activity', event.target.value)} placeholder="Activity" className="h-11 min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 outline-none focus:border-[#720101]" />
                                    <input value={row.note || ''} onChange={(event) => updateTimelineRow(index, 'note', event.target.value)} placeholder="Note" className="h-11 min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 outline-none focus:border-[#720101]" />
                                    <button type="button" onClick={() => removeTimelineRow(index)} className="h-11 rounded-xl border border-red-100 bg-red-50 px-3 text-xs font-black text-red-700 hover:bg-red-100">Remove</button>
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={addTimelineRow} className="mt-3 rounded-xl border border-[#720101]/20 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-[#720101] hover:bg-[#720101]/5">Add timeline row</button>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                        {specialInstructionFields.map(field => (
                            <label key={field.key} className="block rounded-2xl border border-gray-100 bg-white p-4">
                                <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">{field.label}</span>
                                <textarea
                                    rows={3}
                                    value={specialInstructionSections[field.key] || ''}
                                    onChange={(event) => updateSpecialInstructionSection(field.key, event.target.value)}
                                    placeholder={field.placeholder}
                                    className="mt-2 w-full resize-none rounded-2xl border border-[#720101]/10 bg-white px-4 py-3 text-sm font-semibold leading-6 text-gray-900 outline-none transition focus:border-[#720101] focus:ring-4 focus:ring-[#720101]/10"
                                />
                            </label>
                        ))}
                    </div>

                    <div className="rounded-2xl border border-dashed border-[#720101]/20 bg-[#faf7f2]/60 p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">Inspiration image</p>
                                {detailsForm.theme_uploads && <a href={detailsForm.theme_uploads} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-sm font-black text-[#720101] hover:text-[#5a0101]">Current reference uploaded</a>}
                            </div>
                            <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-[#720101] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#5a0101]">
                                {uploadingImage ? 'Uploading...' : detailsForm.theme_uploads ? 'Replace image' : 'Upload image'}
                                <input type="file" accept="image/*" className="hidden" disabled={uploadingImage} onChange={(event) => uploadInspirationImage(event.target.files?.[0])} />
                            </label>
                        </div>
                        {detailsForm.theme_uploads && <img src={detailsForm.theme_uploads} alt="Event inspiration" className="mt-4 max-h-64 w-full rounded-2xl object-cover" />}
                    </div>
                </div>
            )}
        </div>
    );
};

const ClientDashboard = () => {
    const { user, logout } = useAuth();
    const online = useOnlineStatus();
    const dashboardStoragePrefix = `ecs_client_dashboard_${user?.id || 'guest'}`;
    const activeBookingStorageKey = `${dashboardStoragePrefix}_active_booking_id`;
    const activeSectionStorageKey = `${dashboardStoragePrefix}_active_section`;
    const dashboardDataStorageKey = `${dashboardStoragePrefix}_data`;
    const dashboardSmartCacheKey = getUserScopedCacheKey(user, 'client:dashboard');
    const cachedDashboardData = readStoredDashboardJson(dashboardDataStorageKey);
    const [data, setData] = useState(cachedDashboardData || { bookings: [], historyBookings: [], tastings: [], payments: [] });
    const [loading, setLoading] = useState(!cachedDashboardData);
    const [activeBookingId, setActiveBookingId] = useState(() => {
        const stored = readStoredDashboardValue(sharedSelectedBookingKey) || readStoredDashboardValue(activeBookingStorageKey);
        return stored ? Number(stored) : null;
    });
    const [activeSection, setActiveSection] = useState(() => {
        const stored = readStoredDashboardValue(activeSectionStorageKey, 'details');
        return dashboardSections.includes(stored) ? stored : 'details';
    });
    const [toast, setToast] = useState(null);
    const [detailsForm, setDetailsForm] = useState({});
    const [savingDetails, setSavingDetails] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [menuCatalog, setMenuCatalog] = useState({ starter: [], main: [], side: [], dessert: [], drink: [] });
    const [menuCatalogLoaded, setMenuCatalogLoaded] = useState(false);
    const [menuSelections, setMenuSelections] = useState({ starter: [], main: [], side: [], dessert: [], drink: [] });
    const [savingMenu, setSavingMenu] = useState(false);
    const [menuEditMode, setMenuEditMode] = useState(false);
    const [eventPickerOpen, setEventPickerOpen] = useState(false);
    const [detailsEditMode, setDetailsEditMode] = useState(false);
    const [activeDetailRow, setActiveDetailRow] = useState(null);
    const [timelineRows, setTimelineRows] = useState([{ time: '', activity: '', note: '' }]);
    const [specialInstructionSections, setSpecialInstructionSections] = useState({ dietary: '', access: '', vip: '', other: '' });
    const [customMotifColor, setCustomMotifColor] = useState('#720101');
    const [activeMenuCategory, setActiveMenuCategory] = useState('starter');
    const [clarificationResponse, setClarificationResponse] = useState('');
    const [submittingClarification, setSubmittingClarification] = useState(false);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', confirmText: 'Confirm', onConfirm: null });
    const [feedbackRequests, setFeedbackRequests] = useState([]);
    const [feedbackForm, setFeedbackForm] = useState({ rating: 5, food_rating: 5, service_rating: 5, communication_rating: 5, value_rating: 5, comments: '', testimonial_permission: false });
    const [submittingFeedback, setSubmittingFeedback] = useState(false);

    const closeConfirmModal = () => setConfirmModal({ isOpen: false, title: '', message: '', confirmText: 'Confirm', onConfirm: null });

    const [submittingPayment, setSubmittingPayment] = useState(false);
    const [coreForm, setCoreForm] = useState({ event_date: '', pax: '' });
    const [savingCore, setSavingCore] = useState(false);
    const [corePricePreview, setCorePricePreview] = useState(null);
    const [pendingScrollTarget, setPendingScrollTarget] = useState(null);
    const autoSelectedInitialSection = React.useRef(false);

    // Modal states
    const [editCoreModalOpen, setEditCoreModalOpen] = useState(false);
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [receiptModal, setReceiptModal] = useState({ isOpen: false, payment: null, booking: null });

    const isSettledPayment = (payment) => isSettledPaymentStatus(payment.status);

    const calculateMenuTotal = (selections, pax) => {
        let sum = 0;
        Object.values(selections).forEach(catItems => {
            catItems.forEach(item => {
                sum += ((item.costPerHead || 0) + (item.priceAdj || 0)) * pax;
            });
        });
        return sum;
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        const booking = Number(params.get('booking'));
        const target = params.get('target');
        if (dashboardSections.includes(tab)) {
            setActiveSection(tab);
        } else if (tab === 'tastings') {
            setActiveSection('details');
            window.history.replaceState({}, '', `${window.location.pathname}${window.location.search.replace(/([?&])tab=tastings&?/, '$1').replace(/[?&]$/, '')}${window.location.hash}`);
        }
        if (booking) {
            setActiveBookingId(booking);
        }
        if (target) {
            setPendingScrollTarget(target);
        }
        fetchData();
    }, []);

    useEffect(() => {
        if (activeSection !== 'menu' || menuCatalogLoaded) return undefined;

        let cancelled = false;
        fetchMenuItemsFromAPI()
            .then((catalog) => {
                if (!cancelled) {
                    setMenuCatalog(catalog);
                    setMenuCatalogLoaded(true);
                }
            })
            .catch((error) => {
                console.error('Error fetching menu catalog:', error);
            });

        return () => {
            cancelled = true;
        };
    }, [activeSection, menuCatalogLoaded]);

    useEffect(() => {
        if (activeBookingId) {
            writeStoredDashboardValue(activeBookingStorageKey, activeBookingId);
            writeStoredDashboardValue(sharedSelectedBookingKey, activeBookingId);
        }
    }, [activeBookingId, activeBookingStorageKey]);

    useEffect(() => {
        writeStoredDashboardValue(activeSectionStorageKey, activeSection);
    }, [activeSection, activeSectionStorageKey]);

    useEffect(() => {
        const booking = data.bookings.find(b => b.id === activeBookingId);
        if (!booking) return;

        setDetailsForm({
            reservation_time: booking.reservation_time || '',
            serving_time: booking.serving_time || '',
            venue_address_line: booking.venue_address_line || '',
            venue_building_details: booking.venue_building_details || '',
            color_motif: booking.color_motif || '',
            event_timeline: booking.event_timeline || '',
            special_instructions: booking.special_instructions || '',
            theme_uploads: booking.theme_uploads || '',
        });
        setTimelineRows(parseTimelineRows(booking.event_timeline));
        setSpecialInstructionSections(parseSpecialInstructions(booking.special_instructions));

        try {
            const parsed = typeof booking.selected_menu === 'string'
                ? JSON.parse(booking.selected_menu || '{}')
                : (booking.selected_menu || {});
            setMenuSelections({
                starter: parsed.starter || [],
                main: parsed.main || [],
                side: parsed.side || [],
                dessert: parsed.dessert || [],
                drink: parsed.drink || [],
            });
        } catch (e) {
            setMenuSelections({ starter: [], main: [], side: [], dessert: [], drink: [] });
        }
        setMenuEditMode(false);
        setDetailsEditMode(false);
        setActiveDetailRow(null);
        setClarificationResponse(booking.clarification_response || '');
        setCoreForm({
            event_date: toDateInputValue(booking.event_date),
            pax: booking.pax || '',
        });
    }, [activeBookingId, data.bookings]);

    useEffect(() => {
        if (!pendingScrollTarget || loading) return undefined;

        const timer = setTimeout(() => {
            const target = document.getElementById(pendingScrollTarget);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setPendingScrollTarget(null);
            }
        }, 180);

        return () => clearTimeout(timer);
    }, [pendingScrollTarget, activeSection, activeBookingId, loading]);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const fetchData = async () => {
        try {
            const smartResult = await fetchSmartResource('/api/dashboard/client', {
                cacheKey: dashboardSmartCacheKey,
                ttl: 30000,
                force: false,
            });
            const result = smartResult.raw || smartResult.data || {};
            if (result) {
                const nextData = {
                    bookings: result.bookings || [],
                    historyBookings: result.historyBookings || [],
                    tastings: result.tastings || [],
                    payments: result.payments || [],
                };
                setData(nextData);
                writeStoredDashboardJson(dashboardDataStorageKey, nextData);
                writeSmartCache(dashboardSmartCacheKey, result, result.meta || smartResult.meta || {});
                setLoading(false);

                const activeBookings = result.bookings || [];
                const storedBookingId = Number(readStoredDashboardValue(sharedSelectedBookingKey) || readStoredDashboardValue(activeBookingStorageKey));
                const preferredBookingId = activeBookingId || storedBookingId || null;

                if (activeBookings.length > 0 && (!preferredBookingId || !activeBookings.some((booking) => booking.id === preferredBookingId))) {
                    // Default to the event with the closest upcoming date
                    const now = new Date();
                    const sorted = [...activeBookings].sort((a, b) => {
                        const da = Math.abs(new Date(a.event_date) - now);
                        const db = Math.abs(new Date(b.event_date) - now);
                        return da - db;
                    });
                    setActiveBookingId(sorted[0].id);
                } else if (preferredBookingId) {
                    setActiveBookingId(preferredBookingId);
                } else if (activeBookings.length === 0) {
                    setActiveBookingId(null);
                }

                fetch('/api/customer/feedback-requests', { headers: { Accept: 'application/json' } })
                    .then(response => response.ok ? response.json() : [])
                    .then(pendingFeedback => {
                        setFeedbackRequests(Array.isArray(pendingFeedback) ? pendingFeedback : []);
                    })
                    .catch((error) => {
                        console.error('Error fetching feedback requests:', error);
                    });
            }
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    const submitFeedback = async (token) => {
        if (!token || submittingFeedback) return;
        setSubmittingFeedback(true);
        try {
            const response = await fetch(`/api/customer/feedback-requests/${token}/responses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(feedbackForm),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || 'Could not submit feedback.');
            setToast({ message: result.message || 'Thank you for your feedback.', type: 'success' });
            setFeedbackForm({ rating: 5, food_rating: 5, service_rating: 5, communication_rating: 5, value_rating: 5, comments: '', testimonial_permission: false });
            fetchData();
        } catch (error) {
            console.error(error);
            setToast({ message: error.message || 'Could not submit feedback.', type: 'error' });
        } finally {
            setSubmittingFeedback(false);
        }
    };

    const handlePaymentSubmit = async (e, nextPayment) => {
        e.preventDefault();

        if (!nextPayment?.id || !activeBookingId) {
            setToast({ message: 'No payment is due for this booking right now.', type: 'error' });
            return;
        }

        setSubmittingPayment(true);
        setToast({ message: 'Opening checkout...', type: 'success' });

        router.post('/checkout/initialize', {
            booking_id: activeBookingId,
            payment_id: nextPayment.id,
        }, {
            preserveScroll: true,
            onError: () => {
                setToast({ message: 'Unable to open PayMongo checkout. Please try again.', type: 'error' });
                setSubmittingPayment(false);
            },
            onCancel: () => {
                setSubmittingPayment(false);
            },
            onFinish: () => {
                setSubmittingPayment(false);
            },
        });
    };

    const paymentsByBookingId = React.useMemo(() => {
        const map = new Map();
        data.payments.forEach((payment) => {
            if (!map.has(payment.booking_id)) map.set(payment.booking_id, []);
            map.get(payment.booking_id).push(payment);
        });
        return map;
    }, [data.payments]);

    const activeBooking = React.useMemo(() => data.bookings.find(b => b.id === activeBookingId), [data.bookings, activeBookingId]);
    const activePayments = activeBooking ? (paymentsByBookingId.get(activeBooking.id) || []) : [];
    const activePaid = React.useMemo(() => activePayments.filter(isSettledPayment).reduce((sum, payment) => sum + Number(payment.amount || 0), 0), [activePayments]);
    const activeTotal = Number(activeBooking?.total_cost || 0);
    const activeBalance = Math.max(activeTotal - activePaid, 0);
    const activeProgress = activeTotal > 0 ? Math.min((activePaid / activeTotal) * 100, 100) : 0;
    const activeJourneySteps = React.useMemo(() => activeBooking ? buildJourneySteps(activeBooking, activePayments) : [], [activeBooking, activePayments]);
    const actionableJourneySteps = React.useMemo(() => activeJourneySteps.filter((step) => !step.notRequired), [activeJourneySteps]);
    const completedJourneySteps = React.useMemo(() => actionableJourneySteps.filter((step) => step.done), [actionableJourneySteps]);
    const journeyProgress = actionableJourneySteps.length > 0 ? (completedJourneySteps.length / actionableJourneySteps.length) * 100 : 100;
    const remainingJourneySteps = React.useMemo(() => actionableJourneySteps.filter((step) => !step.done), [actionableJourneySteps]);
    const latestTasting = React.useMemo(() => {
        if (!data.tastings.length) return null;
        return data.tastings.find(isOpenTasting) || data.tastings[0];
    }, [data.tastings]);

    const jumpToJourneyStep = (step) => {
        if (!step || step.locked) return;
        if (step.tab && dashboardSections.includes(step.tab)) {
            setActiveSection(step.tab);
        }
        if (step.target) {
            setPendingScrollTarget(step.target);
        }
    };

    const clientNextActions = React.useMemo(() => {
        if (!activeBooking) {
            return [{
                id: 'start-booking',
                priority: 'action',
                title: 'Start your event request',
                description: 'Create a booking request so the team can review your date, menu, and event details.',
                badge: 'Start',
                primaryLabel: 'Book',
                onOpen: () => router.visit('/booking'),
            }];
        }

        const nextStep = remainingJourneySteps.find((step) => !step.locked) || remainingJourneySteps[0];
        if (!nextStep) {
            return [{
                id: 'event-ready',
                priority: 'info',
                title: 'Your event file is complete',
                description: activeBooking.status === 'Completed' ? 'This event is completed. Receipts and history stay available below.' : 'Everything currently needed for this event is complete.',
                badge: 'Ready',
                primaryLabel: 'Review',
                tone: 'good',
                onOpen: () => setActiveSection(activeBooking.status === 'Completed' ? 'history' : 'details'),
            }];
        }

        return [{
            id: `journey-${nextStep.label}`,
            priority: nextStep.isPendingGate ? 'urgent' : 'action',
            title: nextStep.label,
            description: nextStep.action,
            target: eventDisplayName(activeBooking),
            badge: remainingJourneySteps.length,
            primaryLabel: 'Continue',
            tone: nextStep.isPendingGate ? 'danger' : 'warn',
            disabledReason: nextStep.locked ? 'This step unlocks after Marketing approves your booking.' : null,
            onOpen: () => jumpToJourneyStep(nextStep),
        }];
    }, [activeBooking, remainingJourneySteps]);
    const activeNextAction = clientNextActions[0] || null;

    useEffect(() => {
        if (!activeBooking || loading || autoSelectedInitialSection.current) return;
        const params = new URLSearchParams(window.location.search);
        if (params.get('tab')) {
            autoSelectedInitialSection.current = true;
            return;
        }

        const nextStep = remainingJourneySteps.find((step) => !step.locked && step.tab && dashboardSections.includes(step.tab));
        if (nextStep?.tab && activeSection === 'details') {
            setActiveSection(nextStep.tab);
        }
        autoSelectedInitialSection.current = true;
    }, [activeBooking, activeSection, loading, remainingJourneySteps]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f7f4ee] font-sans">
                <ClientNavbar user={user} logout={logout} />

                <main className="relative mx-auto max-w-7xl px-5 py-8 sm:px-8" style={{ paddingTop: 100 }}>
                    <div className="mb-8 rounded-3xl bg-[#1a1a1a] p-6 text-white shadow-xl shadow-black/10 sm:p-8">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                            <div className="min-w-0 flex-1">
                                <div className="h-3 w-32 animate-pulse rounded-full bg-[#f0aa0b]/35" />
                                <div className="mt-4 h-10 w-full max-w-xl animate-pulse rounded-full bg-white/14" />
                                <div className="mt-4 h-4 w-full max-w-2xl animate-pulse rounded-full bg-white/10" />
                                <div className="mt-2 h-4 w-3/5 animate-pulse rounded-full bg-white/10" />
                            </div>
                            <div className="grid min-w-full gap-3 sm:grid-cols-3 lg:min-w-[520px]">
                                {[0, 1, 2].map((item) => (
                                    <div key={item} className="rounded-2xl bg-white/10 p-4">
                                        <div className="h-3 w-16 animate-pulse rounded-full bg-white/20" />
                                        <div className="mt-3 h-7 w-24 animate-pulse rounded-full bg-white/18" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-8 lg:flex-row">
                        <aside className="w-full flex-shrink-0 space-y-6 lg:w-64">
                            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                                {[0, 1, 2, 3].map((item) => (
                                    <div key={item} className={`flex items-center gap-3 border-l-4 px-5 py-4 ${item === 0 ? 'border-[#720101] bg-[#720101]/5' : 'border-transparent'}`}>
                                        <span className="h-5 w-5 animate-pulse rounded-md bg-[#ead8cc]" />
                                        <span className={`h-4 animate-pulse rounded-full bg-[#eee7df] ${item === 2 ? 'w-28' : 'w-24'}`} />
                                        {item === 0 && <span className="ml-auto h-2.5 w-2.5 rounded-full bg-[#f0aa0b]/70" />}
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-3 border-t border-gray-200 pt-4">
                                <div className="h-12 animate-pulse rounded-xl border border-gray-200 bg-white" />
                                <div className="h-12 animate-pulse rounded-xl bg-red-50" />
                            </div>
                        </aside>

                        <section className="min-w-0 flex-1 space-y-6">
                            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
                                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <div className="h-9 w-full max-w-md animate-pulse rounded-full bg-[#eee7df]" />
                                        <div className="mt-4 flex flex-wrap gap-3">
                                            <div className="h-5 w-36 animate-pulse rounded-full bg-[#f1e5dc]" />
                                            <div className="h-5 w-24 animate-pulse rounded-full bg-[#f1e5dc]" />
                                            <div className="h-5 w-20 animate-pulse rounded-full bg-[#f1e5dc]" />
                                        </div>
                                    </div>
                                    <div className="text-left sm:text-right">
                                        <div className="h-3 w-20 animate-pulse rounded-full bg-[#ead8cc] sm:ml-auto" />
                                        <div className="mt-3 h-9 w-36 animate-pulse rounded-full bg-[#eee7df]" />
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
                                <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <div className="h-3 w-28 animate-pulse rounded-full bg-[#ead8cc]" />
                                        <div className="mt-3 h-8 w-52 animate-pulse rounded-full bg-[#eee7df]" />
                                    </div>
                                    <div className="h-11 w-32 animate-pulse rounded-xl bg-[#720101]/12" />
                                </div>

                                <div className="mt-6 grid gap-4 md:grid-cols-2">
                                    {[0, 1, 2, 3].map((item) => (
                                        <div key={item} className="rounded-2xl border border-gray-100 bg-[#faf7f2]/40 p-5">
                                            <div className="h-3 w-24 animate-pulse rounded-full bg-[#ead8cc]" />
                                            <div className="mt-4 h-6 w-44 animate-pulse rounded-full bg-[#eee7df]" />
                                            <div className="mt-4 h-3 w-full animate-pulse rounded-full bg-[#f1e5dc]" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </div>
                </main>
            </div>
        );
    }

    // Action handlers
    const handleCancelBooking = async () => {
        try {
            const res = await fetch(`/api/bookings/${activeBooking.id}/cancel`, { method: 'PUT' });
            const result = await res.json().catch(() => ({}));
            if (res.ok) {
                setToast({ message: 'Booking successfully cancelled.', type: 'success' });
                setCancelModalOpen(false);
                fetchData();
            } else {
                setToast({ message: result.error || 'Unable to cancel this booking.', type: 'error' });
            }
        } catch (e) {
            setToast({ message: 'We could not open checkout. Please try again.', type: 'error' });
        }
    };

    const saveEventDetails = async () => {
        setSavingDetails(true);
        try {
            const payload = {
                ...detailsForm,
                event_timeline: serializeTimelineRows(timelineRows),
                special_instructions: serializeSpecialInstructions(specialInstructionSections),
            };
            const res = await fetch(`/api/bookings/${activeBooking.id}/event-details`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = await res.json().catch(() => ({}));
            if (res.ok) {
                setToast({ message: 'Event details saved.', type: 'success' });
                setDetailsEditMode(false);
                setActiveDetailRow(null);
                fetchData();
            } else {
                setToast({ message: result.error || 'Unable to save event details.', type: 'error' });
            }
        } catch (e) {
            setToast({ message: 'We could not save your details. Please try again.', type: 'error' });
        } finally {
            setSavingDetails(false);
        }
    };

    const submitClarificationResponse = async () => {
        if (!activeBooking?.id || clarificationResponse.trim().length < 3) {
            setToast({ message: 'Please add a short response for the team.', type: 'error' });
            return;
        }

        setSubmittingClarification(true);
        try {
            const res = await fetch(`/api/bookings/${activeBooking.id}/clarification-response`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ response: clarificationResponse.trim() }),
            });
            const result = await res.json().catch(() => ({}));
            if (res.ok) {
                setToast({ message: 'Your response was sent to the team.', type: 'success' });
                fetchData();
            } else {
                setToast({ message: result.message || 'We could not send your response yet.', type: 'error' });
            }
        } catch (e) {
            setToast({ message: 'We could not send your response yet.', type: 'error' });
        } finally {
            setSubmittingClarification(false);
        }
    };

    const uploadInspirationImage = async (file) => {
        if (!file) return;
        setUploadingImage(true);
        try {
            const formData = new FormData();
            formData.append('image', file);
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const result = await res.json();
            if (res.ok) {
                setDetailsForm(prev => ({ ...prev, theme_uploads: result.url }));
                setToast({ message: 'Inspiration image uploaded. Save details to keep it on this booking.', type: 'success' });
            } else {
                setToast({ message: result.message || 'Image upload failed.', type: 'error' });
            }
        } catch (e) {
            setToast({ message: 'We could not upload the image. Please try again.', type: 'error' });
        } finally {
            setUploadingImage(false);
        }
    };

    const setDetailTime = (key, value) => {
        setDetailsForm(prev => ({ ...prev, [key]: value }));
    };

    const applyMotifPreset = (preset) => {
        const current = String(detailsForm.color_motif || '').trim();
        const nextValue = `${preset.label} ${preset.value}`;
        const hasPreset = current.toLowerCase().includes(preset.label.toLowerCase()) || current.includes(preset.value);
        setDetailsForm(prev => ({
            ...prev,
            color_motif: hasPreset ? current : [current, nextValue].filter(Boolean).join(', '),
        }));
        setCustomMotifColor(preset.value);
    };

    const addCustomMotifColor = () => {
        const current = String(detailsForm.color_motif || '').trim();
        if (current.includes(customMotifColor)) return;
        setDetailsForm(prev => ({
            ...prev,
            color_motif: [current, customMotifColor].filter(Boolean).join(', '),
        }));
    };

    const updateTimelineRow = (index, key, value) => {
        setTimelineRows(prev => prev.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
    };

    const addTimelineRow = () => {
        setTimelineRows(prev => [...prev, { time: '', activity: '', note: '' }]);
    };

    const removeTimelineRow = (index) => {
        setTimelineRows(prev => {
            const nextRows = prev.filter((_, rowIndex) => rowIndex !== index);
            return nextRows.length ? nextRows : [{ time: '', activity: '', note: '' }];
        });
    };

    const applyTimelineTemplate = (templateName) => {
        setTimelineRows(timelineTemplates[templateName] || [{ time: '', activity: '', note: '' }]);
    };

    const updateSpecialInstructionSection = (key, value) => {
        setSpecialInstructionSections(prev => ({ ...prev, [key]: value }));
    };

    const swapMenuItem = (category, oldIndex, newDishId) => {
        const dish = menuCatalog[category]?.find(item => String(item.id) === String(newDishId));
        if (!dish) return;
        setMenuSelections(prev => ({
            ...prev,
            [category]: prev[category].map((item, index) => index === oldIndex ? dish : item),
        }));
    };

    const addMenuItem = (category, dishId) => {
        const dish = menuCatalog[category]?.find(item => String(item.id) === String(dishId));
        if (!dish) return;
        setMenuSelections(prev => ({
            ...prev,
            [category]: [...(prev[category] || []), dish],
        }));
    };

    const removeMenuItem = (category, indexToRemove) => {
        setMenuSelections(prev => ({
            ...prev,
            [category]: (prev[category] || []).filter((_, index) => index !== indexToRemove),
        }));
    };

    const saveMenuSelection = () => {
        setSavingMenu(true);
        router.put(`/api/bookings/${activeBooking.id}/menu`, {
            selected_menu: menuSelections
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setToast({ message: 'Menu selection updated. Pricing and unpaid balances were recalculated.', type: 'success' });
                setMenuEditMode(false);
                fetchData();
            },
            onError: (errors) => {
                setToast({ message: errors.error || 'Unable to update menu.', type: 'error' });
            },
            onFinish: () => {
                setSavingMenu(false);
            }
        });
    };

    const handleCoreUpdate = async (event, confirmedPricingChange = false) => {
        event?.preventDefault();
        if (!activeBooking?.id || savingCore) return;

        const nextPax = Number(coreForm.pax);
        if (!coreForm.event_date || !nextPax || nextPax < 1) {
            setToast({ message: 'Choose a valid event date and guest count.', type: 'error' });
            return;
        }

        const paxChanged = nextPax !== Number(activeBooking.pax || 0);
        const hasMenu = Object.values(menuSelections || {}).some((items) => Array.isArray(items) && items.length > 0);
        if (paxChanged && hasMenu && !confirmedPricingChange) {
            const oldTotal = Number(activeBooking.total_cost || 0);
            const newTotal = calculateMenuTotal(menuSelections, nextPax);
            const paid = activePayments.filter(isSettledPayment).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
            setCorePricePreview({
                oldPax: Number(activeBooking.pax || 0),
                newPax: nextPax,
                oldTotal,
                newTotal,
                remainingBalance: Math.max(newTotal - paid, 0),
            });
            return;
        }

        setSavingCore(true);
        try {
            const res = await fetch(`/api/bookings/${activeBooking.id}/update`, {
                method: 'PUT',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    event_date: coreForm.event_date,
                    pax: nextPax,
                }),
            });
            const result = await res.json().catch(() => ({}));
            if (!res.ok) {
                const firstValidationMessage = result.errors ? Object.values(result.errors).flat()[0] : null;
                throw new Error(firstValidationMessage || result.error || 'Unable to update date and guest count.');
            }

            const pricingMessage = result.pricing_change
                ? ` New balance: ${peso(result.pricing_change.remaining_balance || 0)}.`
                : '';
            setToast({ message: `${result.message || 'Date and guest count updated.'}${pricingMessage}`, type: 'success' });
            setEditCoreModalOpen(false);
            setCorePricePreview(null);
            fetchData();
        } catch (error) {
            setToast({ message: error.message || 'Unable to update date and guest count.', type: 'error' });
        } finally {
            setSavingCore(false);
        }
    };



    return (
        <div className="min-h-screen bg-[#f7f4ee] font-sans">
            <ClientNavbar user={user} logout={logout} />

            <main className="max-w-7xl mx-auto py-8 px-5 sm:px-8 relative" style={{paddingTop: 100}}>
                {toast && (
                    <div className="pointer-events-none fixed bottom-5 right-5 z-50 animate-slideUp">
                        <div className="pointer-events-auto flex max-w-[360px] items-start gap-3 rounded-xl bg-[#fffaf3] px-4 py-3 text-sm shadow-[0_10px_30px_rgba(50,35,20,0.18)]">
                        <p className={`min-w-0 flex-1 font-semibold leading-5 ${toast.type === 'error' ? 'text-[#8b0000]' : 'text-[#374151]'}`}>{toast.message}</p>
                        </div>
                    </div>
                )}

                {!online && (
                    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-bold text-amber-900 shadow-sm">
                        Connection is unstable. You can keep viewing saved dashboard data, but payments and event changes may need a refresh.
                    </div>
                )}

                <CustomerAnnouncements />

                {feedbackRequests.length > 0 && (
                    <div className="mb-8 rounded-3xl border border-[#f0aa0b]/30 bg-[#fffaf3] p-6 shadow-sm">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                            <div className="max-w-2xl">
                                <p className="text-xs font-black uppercase tracking-widest text-[#720101]">Feedback Request</p>
                                <h2 className="mt-2 text-2xl font-display font-bold text-[#1a1a1a]">How did your event go?</h2>
                                <p className="mt-2 text-sm font-medium leading-6 text-gray-600">
                                    Share your experience for {feedbackRequests[0].booking?.event_name || feedbackRequests[0].booking?.event_type || 'your completed event'}.
                                </p>
                            </div>
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    submitFeedback(feedbackRequests[0].token);
                                }}
                                className="w-full space-y-4 lg:max-w-xl"
                            >
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {[
                                        ['rating', 'Overall'],
                                        ['food_rating', 'Food'],
                                        ['service_rating', 'Service'],
                                        ['communication_rating', 'Communication'],
                                        ['value_rating', 'Value'],
                                    ].map(([field, label]) => (
                                        <label key={field} className="block">
                                            <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">{label}</span>
                                            <select
                                                value={feedbackForm[field]}
                                                onChange={(event) => setFeedbackForm(prev => ({ ...prev, [field]: Number(event.target.value) }))}
                                                className="mt-1 w-full rounded-xl border border-[#720101]/10 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-[#720101]/30 focus:ring-2 focus:ring-[#720101]/15"
                                            >
                                                {[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} / 5</option>)}
                                            </select>
                                        </label>
                                    ))}
                                </div>
                                <textarea
                                    value={feedbackForm.comments}
                                    onChange={(event) => setFeedbackForm(prev => ({ ...prev, comments: event.target.value }))}
                                    placeholder="Tell us what went well or what we can improve."
                                    rows={3}
                                    className="w-full resize-none rounded-xl border border-[#720101]/10 bg-white px-4 py-3 text-sm font-medium text-gray-800 outline-none focus:border-[#720101]/30 focus:ring-2 focus:ring-[#720101]/15"
                                />
                                <label className="flex items-center gap-3 text-sm font-semibold text-gray-600">
                                    <input
                                        type="checkbox"
                                        checked={feedbackForm.testimonial_permission}
                                        onChange={(event) => setFeedbackForm(prev => ({ ...prev, testimonial_permission: event.target.checked }))}
                                        className="h-4 w-4 rounded border-gray-300 text-[#720101] focus:ring-[#720101]/20"
                                    />
                                    Eloquente may use my comments as a testimonial.
                                </label>
                                <button
                                    type="submit"
                                    disabled={submittingFeedback}
                                    className="rounded-xl bg-[#720101] px-6 py-3 text-sm font-black uppercase tracking-widest text-white shadow-sm transition hover:bg-[#5a0101] disabled:opacity-60"
                                >
                                    {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                <div className="mb-8 rounded-3xl bg-[#1a1a1a] p-6 text-white shadow-xl shadow-black/10 sm:p-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-[#f0aa0b]">Client Dashboard</p>
                            <h1 className="mt-2 text-3xl font-display font-bold sm:text-4xl">Plan, track, and complete your event.</h1>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">Use the tabs below to review booking details, finalize your menu, complete payments, and keep your event history in one place.</p>
                        </div>
                        {activeBooking && (
                            <div className="grid min-w-full gap-3 sm:grid-cols-3 lg:min-w-[520px]">
                                <div className="rounded-2xl bg-white/10 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">Paid</p>
                                    <p className="mt-1 text-xl font-bold">{peso(activePaid)}</p>
                                </div>
                                <div className="rounded-2xl bg-white/10 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">Balance</p>
                                    <p className="mt-1 text-xl font-bold text-[#f0aa0b]">{peso(activeBalance)}</p>
                                </div>
                                <div className="rounded-2xl bg-white/10 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">Remaining Steps</p>
                                    <p className="mt-1 text-xl font-bold">{remainingJourneySteps.length}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {data.bookings.length === 0 && data.historyBookings.length === 0 ? (
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-16 text-center">
                        <div className="w-20 h-20 bg-[#f0aa0b]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-10 h-10 text-[#f0aa0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <h2 className="text-2xl font-display font-bold text-[#1a1a1a] mb-2">No active bookings</h2>
                        <p className="text-[#1a1a1a]/50 mb-8 max-w-md mx-auto">You haven't booked any events with us yet. Let's create something memorable.</p>
                        <button onClick={() => router.get('/book')} className="bg-[#720101] hover:bg-[#5a0101] text-white font-bold py-3 px-8 rounded-full shadow-md transition-all">Book Your Event</button>
                    </div>
                ) : data.bookings.length === 0 ? (
                    <div className="space-y-6">
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 text-center">
                            <h2 className="text-2xl font-display font-bold text-[#1a1a1a] mb-2">No active bookings</h2>
                            <p className="text-[#1a1a1a]/50 mb-6 max-w-md mx-auto">Cancelled or completed events are kept in history. Start a new event or rebook from a past one.</p>
                            <button onClick={() => router.get('/book')} className="bg-[#720101] hover:bg-[#5a0101] text-white font-bold py-3 px-8 rounded-full shadow-md transition-all">Book Your Event</button>
                        </div>
                        <HistoryPanel bookings={data.historyBookings} />
                    </div>
                ) : (
                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* LEFT COLUMN: Vertical Side-Nav & Booking Selector */}
                        <div className="w-full lg:w-64 flex-shrink-0 space-y-6">
                            <nav className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                {[
                                    { id: 'details', label: 'Event Details', needsWork: activeJourneySteps.some(s => s.label === 'Event details' && !s.done), icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1 -18 0 a 9 9 0 0 1 18 0z' },
                                    { id: 'menu', label: 'Menu', needsWork: activeJourneySteps.some(s => s.label === 'Menu selection' && !s.done), icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
                                    { id: 'payments', label: 'Payments', needsWork: activeBooking.nextPaymentDue, icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 1 1 -4 0 a 2 2 0 0 1 4 0z' },
                                    { id: 'history', label: 'History', needsWork: false, icon: 'M12 8v4l3 3m6-3a9 9 0 1 1 -18 0 a 9 9 0 0 1 18 0z' },
                                ].map(section => (
                                    <button 
                                        key={section.id} 
                                        onClick={() => setActiveSection(section.id)}
                                        className={`relative w-full flex items-center gap-3 px-5 py-4 text-sm font-bold border-l-4 transition-all ${activeSection === section.id ? 'border-[#720101] bg-[#720101]/5 text-[#720101]' : 'border-transparent text-[#1a1a1a]/60 hover:bg-gray-50 hover:text-[#1a1a1a]'}`}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={section.icon} /></svg>
                                        {section.label}
                                        {section.needsWork && <span className="ml-auto h-2.5 w-2.5 rounded-full bg-[#f0aa0b] shadow-[0_0_0_3px_rgba(240,170,11,0.16)]" />}
                                    </button>
                                ))}
                            </nav>

                            {/* Global Action Buttons */}
                            <div className="pt-4 border-t border-gray-200">
                                <button 
                                    onClick={() => setEditCoreModalOpen(true)}
                                    disabled={activeBooking.status === 'Cancelled'}
                                    className="w-full bg-white border border-gray-200 text-gray-700 font-bold py-3 px-4 rounded-xl shadow-sm mb-3 hover:bg-gray-50 transition-colors disabled:opacity-50"
                                >
                                    Update Date / Pax
                                </button>
                                <button 
                                    onClick={() => setCancelModalOpen(true)}
                                    disabled={activeBooking.status === 'Cancelled'}
                                    className="w-full bg-red-50 text-red-700 font-bold py-3 px-4 rounded-xl shadow-sm hover:bg-red-100 transition-colors disabled:opacity-50"
                                >
                                    Cancel Booking
                                </button>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Content */}
                        <div className="min-w-0 flex-1 space-y-6">
                            {activeBooking && (
                                <>
                                    {/* Event Snapshot */}
                                    <div id="event-snapshot-card" className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8">
                                        <div className="flex flex-col gap-6 sm:flex-row sm:items-center justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-3 mb-2">
                                                {data.bookings.length > 1 && (
                                                    <div className="relative max-w-full">
                                                        <button
                                                            type="button"
                                                            aria-haspopup="listbox"
                                                            aria-expanded={eventPickerOpen}
                                                            onClick={() => setEventPickerOpen(open => !open)}
                                                            onBlur={() => setTimeout(() => setEventPickerOpen(false), 140)}
                                                            className="group inline-flex max-w-full items-center gap-3 rounded-2xl border border-transparent bg-transparent px-0 py-2 pr-2 text-left transition hover:border-[#720101]/20 hover:px-3 focus:border-[#720101]/30 focus:px-3 focus:outline-none focus:ring-4 focus:ring-[#720101]/10"
                                                        >
                                                            <span className="min-w-0 truncate font-display text-3xl font-bold leading-tight text-[#1a1a1a]">
                                                                {eventDisplayName(activeBooking)}
                                                            </span>
                                                            <span className="hidden shrink-0 rounded-full border border-[#720101]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#720101] sm:inline-flex">
                                                                #{activeBooking.id}
                                                            </span>
                                                            <svg className={`h-5 w-5 shrink-0 text-[#720101] transition ${eventPickerOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </button>

                                                        {eventPickerOpen && (
                                                            <div className="absolute left-0 top-full z-30 mt-3 w-[min(28rem,calc(100vw-3rem))] overflow-hidden rounded-3xl border border-[#720101]/10 bg-white shadow-2xl shadow-[#720101]/10" role="listbox">
                                                                <div className="border-b border-[#f0aa0b]/20 bg-[#fffaf3] px-4 py-3">
                                                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#9f6500]">Select event</p>
                                                                </div>
                                                                <div className="max-h-72 overflow-y-auto p-2">
                                                                    {data.bookings.map((booking) => {
                                                                        const isSelected = booking.id === activeBooking.id;
                                                                        return (
                                                                            <button
                                                                                key={booking.id}
                                                                                type="button"
                                                                                role="option"
                                                                                aria-selected={isSelected}
                                                                                onMouseDown={(event) => event.preventDefault()}
                                                                                onClick={() => {
                                                                                    setActiveBookingId(booking.id);
                                                                                    setEventPickerOpen(false);
                                                                                }}
                                                                                className={`w-full rounded-2xl px-4 py-3 text-left transition ${isSelected ? 'bg-[#720101] text-white' : 'text-[#1a1a1a] hover:bg-[#faf7f2]'}`}
                                                                            >
                                                                                <div className="flex items-center justify-between gap-4">
                                                                                    <p className="min-w-0 truncate font-display text-lg font-bold">{eventDisplayName(booking)}</p>
                                                                                    <span className={`shrink-0 text-[10px] font-black uppercase tracking-widest ${isSelected ? 'text-white/75' : 'text-[#720101]'}`}>#{booking.id}</span>
                                                                                </div>
                                                                                <p className={`mt-1 text-xs font-semibold ${isSelected ? 'text-white/70' : 'text-gray-500'}`}>
                                                                                    {formatEventDate(booking.event_date, { month: 'long', day: 'numeric', year: 'numeric' })} - {booking.pax} pax
                                                                                </p>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {data.bookings.length <= 1 && (
                                                    <h2 className="text-2xl font-display font-bold text-[#1a1a1a]">{eventDisplayName(activeBooking)}</h2>
                                                )}
                                                <span className={`px-3 py-1 text-[11px] font-bold rounded-full uppercase tracking-wider ${statusToneClasses[customerBookingStatus(activeBooking.status).tone]?.light || statusToneClasses.warning.light}`}>
                                                    {customerBookingStatus(activeBooking.status).label}
                                                </span>
                                                {data.bookings.length <= 1 && (
                                                    <span className="text-xs font-black uppercase tracking-widest text-[#720101]">
                                                        Booking #{activeBooking.id}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[#1a1a1a]/60 text-sm font-medium">
                                                <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-[#f0aa0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> {new Date(activeBooking.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                                <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-[#f0aa0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> {activeBooking.event_time}</span>
                                                <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-[#f0aa0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg> {activeBooking.pax} Pax</span>
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-left sm:text-right">
                                            <p className="text-[#1a1a1a]/50 text-xs font-bold uppercase tracking-widest mb-1">Total Cost</p>
                                            <p className="text-3xl font-display font-bold text-[#720101]">PHP {parseFloat(activeBooking.total_cost || 0).toLocaleString()}</p>
                                        </div>
                                        </div>
                                    </div>

                                    {activeBooking.clarification_request && !activeBooking.clarification_response && (
                                        <div id="staff-request-panel" className="rounded-3xl border border-[#f0aa0b]/35 bg-[#fff7e8] p-6 shadow-sm sm:p-7">
                                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                <div className="max-w-2xl">
                                                    <p className="text-xs font-black uppercase tracking-widest text-[#9f6500]">Details requested</p>
                                                    <h3 className="mt-2 text-xl font-display font-bold text-[#1a1a1a]">The team needs a few details from you.</h3>
                                                    <p className="mt-2 text-sm font-semibold leading-6 text-gray-600">{activeBooking.clarification_request}</p>
                                                </div>
                                            </div>
                                            <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                                                <label className="block">
                                                    <span className="text-xs font-black uppercase tracking-widest text-gray-500">Your response</span>
                                                    <textarea
                                                        value={clarificationResponse}
                                                        onChange={(event) => setClarificationResponse(event.target.value)}
                                                        rows={3}
                                                        disabled={Boolean(activeBooking.clarification_response)}
                                                        placeholder="Write the details requested by the team..."
                                                        className="mt-2 w-full rounded-2xl border border-[#720101]/10 bg-white px-4 py-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-[#720101] focus:ring-4 focus:ring-[#720101]/10 disabled:bg-gray-50"
                                                    />
                                                </label>
                                                {!activeBooking.clarification_response && (
                                                    <button
                                                        onClick={submitClarificationResponse}
                                                        disabled={submittingClarification}
                                                        className="rounded-xl bg-[#720101] px-5 py-3 text-sm font-black text-white transition hover:bg-[#5a0101] disabled:opacity-60"
                                                    >
                                                        {submittingClarification ? 'Sending...' : 'Send Response'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {activeNextAction && (
                                        <div className="rounded-2xl border border-[#720101]/10 bg-white px-4 py-3 shadow-sm">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-black uppercase tracking-widest text-[#720101]">Next</p>
                                                    <p className="mt-1 text-sm font-bold leading-6 text-[#1a1a1a]">
                                                        {activeNextAction.title}: <span className="font-semibold text-gray-600">{activeNextAction.disabledReason || activeNextAction.description}</span>
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={Boolean(activeNextAction.disabledReason)}
                                                    onClick={activeNextAction.disabledReason ? undefined : activeNextAction.onOpen}
                                                    className="shrink-0 rounded-xl bg-[#720101] px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-[#5a0101] disabled:cursor-not-allowed disabled:bg-gray-300"
                                                >
                                                    {activeNextAction.primaryLabel || 'Continue'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Pending Approval Banner */}
                                    {activeBooking.status === 'Pending' && (
                                        <div id="approval-status-panel" className="rounded-3xl border-2 border-[#f0aa0b]/30 bg-gradient-to-r from-[#f0aa0b]/5 via-white to-[#f0aa0b]/5 p-6 sm:p-8 shadow-sm">
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-[#f0aa0b]/15">
                                                    <svg className="w-7 h-7 text-[#f0aa0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="text-lg font-display font-bold text-[#1a1a1a]">Awaiting Approval</h3>
                                                    <p className="mt-1 text-sm font-medium text-gray-600 leading-6">Your booking has been submitted and is under review by our Marketing Executive. Once approved, you'll be able to proceed with the reservation payment and complete the remaining steps. You can still update your event details and food tasting schedule in the meantime.</p>
                                                </div>
                                                <span className="inline-flex items-center gap-2 rounded-full bg-[#f0aa0b]/15 px-4 py-2 text-xs font-black uppercase tracking-widest text-[#b27a00] border border-[#f0aa0b]/25">
                                                    <span className="h-2 w-2 rounded-full bg-[#f0aa0b] animate-pulse" />
                                                    Being Reviewed
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Content based on Active Section */}
                                    {activeSection === 'details' && (
                                        <SmartEventDetailsPanel
                                            activeBooking={activeBooking}
                                            detailsForm={detailsForm}
                                            setDetailsForm={setDetailsForm}
                                            detailsEditMode={detailsEditMode}
                                            setDetailsEditMode={setDetailsEditMode}
                                            savingDetails={savingDetails}
                                            saveEventDetails={saveEventDetails}
                                            uploadingImage={uploadingImage}
                                            uploadInspirationImage={uploadInspirationImage}
                                            timelineRows={timelineRows}
                                            setDetailTime={setDetailTime}
                                            updateTimelineRow={updateTimelineRow}
                                            addTimelineRow={addTimelineRow}
                                            removeTimelineRow={removeTimelineRow}
                                            applyTimelineTemplate={applyTimelineTemplate}
                                            specialInstructionSections={specialInstructionSections}
                                            updateSpecialInstructionSection={updateSpecialInstructionSection}
                                            customMotifColor={customMotifColor}
                                            setCustomMotifColor={setCustomMotifColor}
                                            applyMotifPreset={applyMotifPreset}
                                            addCustomMotifColor={addCustomMotifColor}
                                        />
                                    )}

                                    {false && activeSection === 'details' && (
                                        <div id="event-details-panel" className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8">
                                            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p className="text-xs font-black uppercase tracking-widest text-[#720101]">Event details</p>
                                                    <h3 className="mt-1 text-xl font-bold font-display text-[#1a1a1a]">Planning notes</h3>
                                                </div>
                                                {activeBooking.canEditSupplementary && (
                                                    <div className="flex gap-2">
                                                        {detailsEditMode ? (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setDetailsEditMode(false);
                                                                        setActiveDetailRow(null);
                                                                    }}
                                                                    className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50"
                                                                >
                                                                    Cancel
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={saveEventDetails}
                                                                    disabled={savingDetails}
                                                                    className="rounded-xl bg-[#720101] px-5 py-2 text-xs font-black uppercase tracking-widest text-white shadow-sm hover:bg-[#5a0101] disabled:opacity-50"
                                                                >
                                                                    {savingDetails ? 'Saving...' : 'Save'}
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setDetailsEditMode(true);
                                                                    setActiveDetailRow('venue');
                                                                }}
                                                                className="rounded-xl bg-[#1a1a1a] px-5 py-2 text-xs font-black uppercase tracking-widest text-white shadow-sm hover:bg-black"
                                                            >
                                                                Edit Details
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {!activeBooking.canEditSupplementary && activeBooking.status !== 'Cancelled' && (
                                                <div className="mb-6 p-4 rounded-xl flex items-start gap-3 bg-red-50 border border-red-100">
                                                    <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                    <div>
                                                        <p className="text-sm font-bold text-red-800">Hard Freeze Active</p>
                                                        <p className="text-xs text-red-700 mt-1">Your event details are currently locked as our team is making final preparations. If you need to make an urgent change, please use the messaging module to contact your Marketing Executive directly.</p>
                                                    </div>
                                                </div>
                                            )}

                                            {(() => {
                                                const detailFields = [
                                                    { id: 'venue', label: 'Venue Address', value: detailsForm.venue_address_line, type: 'text', key: 'venue_address_line', placeholder: 'Complete venue address' },
                                                    { id: 'color_motif', label: 'Color Motif', value: detailsForm.color_motif, type: 'text', key: 'color_motif', placeholder: 'e.g., Royal Gold and Deep Navy' },
                                                    { id: 'reservation_time', label: 'Reservation Time', value: detailsForm.reservation_time, type: 'text', key: 'reservation_time', placeholder: 'e.g., 4:00 PM' },
                                                    { id: 'serving_time', label: 'Serving Time', value: detailsForm.serving_time, type: 'text', key: 'serving_time', placeholder: 'e.g., 6:30 PM' },
                                                    { id: 'event_timeline', label: 'Event Timeline / Program', value: detailsForm.event_timeline, type: 'textarea', key: 'event_timeline', placeholder: 'Outline your program here' },
                                                    { id: 'special_instructions', label: 'Special Instructions & Allergies', value: detailsForm.special_instructions, type: 'textarea', key: 'special_instructions', placeholder: 'Dietary restrictions, guest count adjustments, access notes, etc.' },
                                                ];
                                                const filledFields = detailFields.filter(field => String(field.value || '').trim());
                                                const filledCount = filledFields.length + (detailsForm.theme_uploads ? 1 : 0);
                                                const missingCount = detailFields.length + 1 - filledCount;

                                                if (!detailsEditMode) {
                                                    return (
                                                        <div className="space-y-5">
                                                            <div className="rounded-2xl border border-[#720101]/10 bg-[#faf7f2]/70 p-5">
                                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                                    <div>
                                                                        <p className="text-sm font-black text-[#1a1a1a]">{filledCount ? `${filledCount} planning detail${filledCount > 1 ? 's' : ''} added` : 'No planning notes added yet'}</p>
                                                                        <p className="mt-1 text-sm font-semibold text-gray-500">{missingCount ? `${missingCount} optional detail${missingCount > 1 ? 's are' : ' is'} still blank.` : 'All planning fields have been filled.'}</p>
                                                                    </div>
                                                                    {activeBooking.canEditSupplementary && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setDetailsEditMode(true);
                                                                                setActiveDetailRow('venue');
                                                                            }}
                                                                            className="rounded-xl bg-[#720101] px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-sm hover:bg-[#5a0101]"
                                                                        >
                                                                            Update Notes
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {filledCount > 0 && (
                                                                <div className="grid gap-3 md:grid-cols-2">
                                                                    {filledFields.map(field => (
                                                                        <div key={field.id} className="rounded-2xl border border-gray-100 bg-white p-4">
                                                                            <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{field.label}</p>
                                                                            <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6 text-gray-900">{field.value}</p>
                                                                        </div>
                                                                    ))}
                                                                    {detailsForm.theme_uploads && (
                                                                        <div className="rounded-2xl border border-gray-100 bg-white p-4">
                                                                            <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">Inspiration Image</p>
                                                                            <a href={detailsForm.theme_uploads} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm font-black text-[#720101] hover:text-[#5a0101]">View uploaded reference</a>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div className="space-y-5">
                                                        <div className="grid gap-4 md:grid-cols-2">
                                                            {detailFields.map(field => (
                                                                <label key={field.id} className={field.type === 'textarea' ? 'block md:col-span-2' : 'block'}>
                                                                    <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">{field.label}</span>
                                                                    {field.type === 'textarea' ? (
                                                                        <textarea
                                                                            rows={4}
                                                                            value={detailsForm[field.key] || ''}
                                                                            onChange={(event) => setDetailsForm(prev => ({ ...prev, [field.key]: event.target.value }))}
                                                                            placeholder={field.placeholder}
                                                                            className="mt-2 w-full resize-none rounded-2xl border border-[#720101]/10 bg-white px-4 py-3 text-sm font-semibold leading-6 text-gray-900 outline-none transition focus:border-[#720101] focus:ring-4 focus:ring-[#720101]/10"
                                                                        />
                                                                    ) : (
                                                                        <input
                                                                            value={detailsForm[field.key] || ''}
                                                                            onChange={(event) => setDetailsForm(prev => ({ ...prev, [field.key]: event.target.value }))}
                                                                            placeholder={field.placeholder}
                                                                            className="mt-2 h-12 w-full rounded-2xl border border-[#720101]/10 bg-white px-4 text-sm font-semibold text-gray-900 outline-none transition focus:border-[#720101] focus:ring-4 focus:ring-[#720101]/10"
                                                                        />
                                                                    )}
                                                                </label>
                                                            ))}
                                                        </div>

                                                        <div className="rounded-2xl border border-dashed border-[#720101]/20 bg-[#faf7f2]/60 p-5">
                                                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                                                <div>
                                                                    <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">Inspiration Image</p>
                                                                    <p className="mt-1 text-sm font-semibold text-gray-600">{detailsForm.theme_uploads ? 'Reference image uploaded.' : 'Optional mood board, theme sample, or layout reference.'}</p>
                                                                </div>
                                                                <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-[#720101] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#5a0101]">
                                                                    {uploadingImage ? 'Uploading...' : detailsForm.theme_uploads ? 'Replace Image' : 'Upload Image'}
                                                                    <input type="file" accept="image/*" className="hidden" disabled={uploadingImage} onChange={(event) => uploadInspirationImage(event.target.files?.[0])} />
                                                                </label>
                                                            </div>
                                                            {detailsForm.theme_uploads && (
                                                                <img src={detailsForm.theme_uploads} alt="Event inspiration" className="mt-4 h-44 w-full rounded-2xl object-cover" />
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            <div className="hidden">
                                                {[
                                                    { id: 'venue', label: 'Venue Address', value: detailsForm.venue_address_line, type: 'text', key: 'venue_address_line', placeholder: 'Complete Venue Address', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' },
                                                    { id: 'color_motif', label: 'Color Motif', value: detailsForm.color_motif, type: 'text', key: 'color_motif', placeholder: 'e.g., Royal Gold & Deep Navy', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
                                                    { id: 'reservation_time', label: 'Reservation Time', value: detailsForm.reservation_time, type: 'text', key: 'reservation_time', placeholder: 'e.g., 4:00 PM', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                                                    { id: 'serving_time', label: 'Serving Time', value: detailsForm.serving_time, type: 'text', key: 'serving_time', placeholder: 'e.g., 6:30 PM', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
                                                    { id: 'event_timeline', label: 'Event Timeline / Program', value: detailsForm.event_timeline, type: 'textarea', key: 'event_timeline', placeholder: 'Outline your program here...', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
                                                    { id: 'special_instructions', label: 'Special Instructions & Allergies', value: detailsForm.special_instructions, type: 'textarea', key: 'special_instructions', placeholder: 'Dietary restrictions, guest count adjustments, etc.', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                                                ].map(field => {
                                                    const isExpanded = activeDetailRow === field.id;
                                                    return (
                                                        <div 
                                                            key={field.id}
                                                            className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${isExpanded && detailsEditMode ? 'border-[#720101] bg-white shadow-xl shadow-[#720101]/5 p-6' : 'border-gray-100 bg-[#faf7f2]/40 p-5'} ${detailsEditMode ? 'cursor-pointer hover:border-[#720101]/30 hover:bg-white hover:shadow-md' : ''}`}
                                                            onClick={() => { if (!isExpanded && activeBooking.canEditSupplementary && detailsEditMode) setActiveDetailRow(field.id); }}
                                                        >
                                                            <div className="flex items-start gap-4">
                                                                <div className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors sm:flex ${isExpanded && detailsEditMode ? 'bg-[#720101] text-white' : 'bg-white text-[#720101] group-hover:bg-[#720101]/10 shadow-sm border border-gray-100'}`}>
                                                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={field.icon} /></svg>
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center justify-between gap-4">
                                                                        <h4 className={`text-xs font-black uppercase tracking-[0.15em] transition-colors ${isExpanded ? 'text-[#720101]' : 'text-gray-400 group-hover:text-gray-600'}`}>{field.label}</h4>
                                                                        {!isExpanded && detailsEditMode && (
                                                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100">
                                                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {(!isExpanded || !detailsEditMode) && (
                                                                        <p className="mt-1 text-sm font-bold text-gray-900 truncate pr-4">
                                                                            {field.value ? field.value : <span className="text-gray-300 italic font-medium">Not filled</span>}
                                                                        </p>
                                                                    )}
                                                                    {isExpanded && detailsEditMode && (
                                                                        <div className="mt-4 animate-fadeIn">
                                                                            {field.type === 'textarea' ? (
                                                                                <textarea 
                                                                                    autoFocus
                                                                                    className="w-full bg-gray-50 border-0 border-b-2 border-gray-200 rounded-t-xl px-4 py-3 text-sm font-bold text-gray-900 focus:border-[#720101] focus:ring-0 focus:bg-white transition-all resize-none h-32"
                                                                                    value={detailsForm[field.key] || ''}
                                                                                    onChange={(e) => setDetailsForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                                                                                    placeholder={field.placeholder}
                                                                                />
                                                                            ) : (
                                                                                <input 
                                                                                    autoFocus
                                                                                    className="w-full bg-gray-50 border-0 border-b-2 border-gray-200 rounded-t-xl px-4 py-3 text-sm font-bold text-gray-900 focus:border-[#720101] focus:ring-0 focus:bg-white transition-all h-12"
                                                                                    value={detailsForm[field.key] || ''}
                                                                                    onChange={(e) => setDetailsForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                                                                                    placeholder={field.placeholder}
                                                                                />
                                                                            )}
                                                                            <div className="mt-4 flex justify-end gap-3">
                                                                                <button 
                                                                                    type="button" 
                                                                                    onClick={(e) => { e.stopPropagation(); setActiveDetailRow(null); }} 
                                                                                    className="rounded-xl border border-gray-200 bg-white px-5 py-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition-colors shadow-sm"
                                                                                >
                                                                                    Confirm
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                
                                                {/* Image Upload Accordion */}
                                                <div 
                                                    className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${activeDetailRow === 'image' && detailsEditMode ? 'border-[#720101] bg-white shadow-xl shadow-[#720101]/5 p-6' : 'border-gray-100 bg-[#faf7f2]/40 p-5'} ${detailsEditMode ? 'cursor-pointer hover:border-[#720101]/30 hover:bg-white hover:shadow-md' : ''}`}
                                                    onClick={() => { if (activeDetailRow !== 'image' && activeBooking.canEditSupplementary && detailsEditMode) setActiveDetailRow('image'); }}
                                                >
                                                    <div className="flex items-start gap-4">
                                                        <div className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors sm:flex ${activeDetailRow === 'image' && detailsEditMode ? 'bg-[#720101] text-white' : 'bg-white text-[#720101] group-hover:bg-[#720101]/10 shadow-sm border border-gray-100'}`}>
                                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-4">
                                                                <h4 className={`text-xs font-black uppercase tracking-[0.15em] transition-colors ${activeDetailRow === 'image' ? 'text-[#720101]' : 'text-gray-400 group-hover:text-gray-600'}`}>Inspiration Image</h4>
                                                                {activeDetailRow !== 'image' && detailsEditMode && (
                                                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100">
                                                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {(activeDetailRow !== 'image' || !detailsEditMode) && (
                                                                <p className="mt-1 text-sm font-bold text-gray-900 truncate pr-4">
                                                                    {detailsForm.theme_uploads ? <span className="text-green-600 flex items-center gap-1.5"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>Image uploaded</span> : <span className="text-gray-300 italic font-medium">No image uploaded</span>}
                                                                </p>
                                                            )}
                                                            {activeDetailRow === 'image' && detailsEditMode && (
                                                                <div className="mt-4 animate-fadeIn">
                                                                    <div className="flex flex-col gap-6">
                                                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                                                            <p className="text-sm font-medium text-gray-500 leading-relaxed max-w-xs">Upload a mood board, theme sample, or layout reference for our team.</p>
                                                                            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#720101] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#720101]/20 hover:bg-[#5a0101] transition-all active:scale-95">
                                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                                                {uploadingImage ? 'Uploading...' : 'Upload Image'}
                                                                                <input type="file" accept="image/*" className="hidden" disabled={uploadingImage} onChange={(e) => uploadInspirationImage(e.target.files?.[0])} />
                                                                            </label>
                                                                        </div>
                                                                        
                                                                        {detailsForm.theme_uploads && (
                                                                            <div className="relative group/img aspect-video sm:aspect-auto sm:h-64 overflow-hidden rounded-2xl border-4 border-white shadow-lg">
                                                                                <img src={detailsForm.theme_uploads} alt="Event inspiration" className="h-full w-full object-cover" />
                                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                                                    <span className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border border-white/30">Current Reference</span>
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        <div className="flex justify-end pt-2">
                                                                            <button 
                                                                                type="button" 
                                                                                onClick={(e) => { e.stopPropagation(); setActiveDetailRow(null); }} 
                                                                                className="rounded-xl border border-gray-200 bg-white px-5 py-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition-colors shadow-sm"
                                                                            >
                                                                                Confirm
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {false && activeBooking.canEditSupplementary && detailsEditMode && (
                                                <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                                                    <button onClick={saveEventDetails} disabled={savingDetails} className="group relative bg-[#1a1a1a] hover:bg-black text-white font-black uppercase tracking-widest text-xs py-4 px-8 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 overflow-hidden">
                                                        <span className="relative z-10 flex items-center gap-2">
                                                            {savingDetails ? (
                                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                            ) : (
                                                                <svg className="w-4 h-4 text-[#f0aa0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                            )}
                                                            {savingDetails ? 'Synchronizing...' : 'Save All Details'}
                                                        </span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeSection === 'history' && (
                                        <HistoryPanel bookings={data.historyBookings} onRemove={(id) => {
                                            setConfirmModal({
                                                isOpen: true,
                                                title: 'Remove event from history?',
                                                message: 'This hides the event from your dashboard history.',
                                                confirmText: 'Remove',
                                                onConfirm: () => {
                                                    closeConfirmModal();
                                                    fetch(`/api/bookings/${id}/remove-history`, { method: 'DELETE' })
                                                        .then(() => fetchData())
                                                        .catch(err => setToast({ message: 'Error removing history.', type: 'error' }));
                                                },
                                            });
                                        }} />
                                    )}

                                    {activeSection === 'menu' && (
                                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8 animate-fadeIn">
                                            <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="max-w-2xl">
                                                    <h3 className="text-2xl font-bold font-display text-[#1a1a1a]">Curated Menu</h3>
                                                    <p className="mt-2 text-sm font-medium leading-relaxed text-gray-500">Fine-tune your menu. Swapping dishes will update your event total based on the current menu prices.</p>
                                                </div>
                                                {activeBooking.canEditMenu && !menuEditMode && (
                                                    <button onClick={() => setMenuEditMode(true)} className="group flex items-center gap-2 rounded-2xl bg-[#720101] px-6 py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-[#720101]/20 hover:bg-[#5a0101] transition-all active:scale-95">
                                                        <svg className="w-4 h-4 text-[#f0aa0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                        Customize Menu
                                                    </button>
                                                )}
                                            </div>

                                            <div className="mb-8 rounded-2xl border border-[#720101]/10 bg-[#faf7f2]/70 p-5">
                                                {latestTasting ? (
                                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                                        <div>
                                                            <p className="text-[11px] font-black uppercase tracking-widest text-[#720101]">Optional tasting</p>
                                                            <h4 className="mt-1 text-lg font-display font-bold text-[#1a1a1a]">
                                                                {isOpenTasting(latestTasting) ? 'Food tasting request on file' : 'Latest tasting request'}
                                                            </h4>
                                                            <p className="mt-2 text-sm font-semibold leading-6 text-gray-600">
                                                                {formatEventDate(latestTasting.preferred_date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                                                {latestTasting.preferred_time ? ` at ${latestTasting.preferred_time}` : ''} - {latestTasting.status || 'Pending'}
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            <button onClick={() => router.get('/food-tasting')} className="rounded-xl border border-[#720101]/15 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-[#720101] hover:bg-[#720101]/5">
                                                                View tasting page
                                                            </button>
                                                            {isOpenTasting(latestTasting) && (
                                                                <button
                                                                    onClick={() => setConfirmModal({
                                                                        isOpen: true,
                                                                        title: 'Cancel tasting session?',
                                                                        message: 'This will cancel the selected food tasting request.',
                                                                        confirmText: 'Cancel Session',
                                                                        onConfirm: () => {
                                                                            closeConfirmModal();
                                                                            fetch(`/api/food-tasting/${latestTasting.id}`, { method: 'DELETE', headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '' } })
                                                                                .then(() => { setToast({ message: 'Tasting cancelled.', type: 'success' }); fetchData(); })
                                                                                .catch(() => setToast({ message: 'Error cancelling tasting.', type: 'error' }));
                                                                        },
                                                                    })}
                                                                    className="rounded-xl bg-red-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-red-700 hover:bg-red-100"
                                                                >
                                                                    Cancel tasting
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                                        <div>
                                                            <p className="text-[11px] font-black uppercase tracking-widest text-[#720101]">Optional tasting</p>
                                                            <p className="mt-1 text-sm font-semibold leading-6 text-gray-600">Want to taste the menu first? Schedule a tasting before final menu decisions.</p>
                                                        </div>
                                                        <button onClick={() => router.get('/food-tasting')} className="rounded-xl border border-[#720101]/15 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-[#720101] hover:bg-[#720101]/5">
                                                            Schedule tasting
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {!activeBooking.canEditMenu && activeBooking.status !== 'Cancelled' && (
                                                <div className="mb-8 p-5 rounded-2xl flex items-start gap-4 bg-red-50 border border-red-100 shadow-sm">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black uppercase tracking-widest text-red-800">30-Day Menu Freeze</p>
                                                        <p className="text-xs font-medium text-red-700/80 mt-1 leading-relaxed">Your menu is locked for final sourcing. Contact your Marketing Executive for critical adjustments.</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Category Tabs */}
                                            <div className="flex overflow-x-auto border-b border-gray-100 mb-8 pb-1 gap-8 no-scrollbar">
                                                {menuCategories.map(cat => (
                                                    <button
                                                        key={cat.id}
                                                        onClick={() => setActiveMenuCategory(cat.id)}
                                                        className={`relative whitespace-nowrap pb-4 text-xs font-black uppercase tracking-[0.2em] transition-all ${activeMenuCategory === cat.id ? 'text-[#720101]' : 'text-gray-400 hover:text-gray-600'}`}
                                                    >
                                                        {cat.label}
                                                        {activeMenuCategory === cat.id && (
                                                            <div className="absolute bottom-0 left-0 right-0 h-1 rounded-full bg-[#720101] animate-scaleX" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>

                                            {menuEditMode && (
                                                <div className="mb-8 overflow-hidden rounded-3xl bg-[#1a1a1a] p-6 text-white shadow-2xl relative">
                                                    <div className="absolute top-0 right-0 p-8 opacity-10">
                                                        <svg className="w-24 h-24 text-[#f0aa0b]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" /></svg>
                                                    </div>
                                                    <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f0aa0b]">Live Price Estimate</p>
                                                            <div className="mt-1 flex items-baseline gap-2">
                                                                <h4 className="text-3xl font-display font-bold">{peso(calculateMenuTotal(menuSelections, activeBooking.pax))}</h4>
                                                                <span className="text-xs font-bold text-white/40 italic">Projected New Total</span>
                                                            </div>
                                                        </div>
                                                        <div className="h-px w-full sm:h-10 sm:w-px bg-white/10" />
                                                        <p className="text-xs font-medium text-white/60 max-w-[200px]">Includes seasonal adjustments and pax count of <span className="text-white font-bold">{activeBooking.pax}</span>.</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Active Category Content */}
                                            {menuCategories.filter(c => c.id === activeMenuCategory).map((category) => {
                                                const items = menuSelections[category.id] || [];
                                                return (
                                                    <div key={category.id} className="animate-fadeIn">
                                                        <div className="grid gap-4 sm:grid-cols-2">
                                                            {items.map((item, index) => (
                                                                <div key={`${category.id}-${index}`} className="group relative overflow-hidden rounded-3xl border border-gray-100 bg-[#faf7f2]/40 p-4 transition-all hover:bg-white hover:shadow-xl hover:shadow-[#720101]/5">
                                                                    <div className="flex gap-4">
                                                                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl shadow-sm">
                                                                            <img src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=300'} alt={item.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <h5 className="truncate text-base font-bold text-gray-900">{item.name}</h5>
                                                                            <p className="mt-1 text-xs font-bold text-[#720101]">{peso((item.costPerHead || 0) + (item.priceAdj || 0))} <span className="text-gray-400 font-medium">/ head</span></p>
                                                                            {item.priceAdj > 0 && <span className="mt-2 inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-black uppercase text-orange-700 ring-1 ring-orange-200">Premium Choice</span>}
                                                                        </div>
                                                                    </div>
                                                                    {activeBooking.canEditMenu && menuEditMode && (
                                                                        <div className="mt-4 flex gap-2">
                                                                            <div className="relative flex-1">
                                                                                <select
                                                                                    value={item.id || ''}
                                                                                    onChange={(e) => swapMenuItem(category.id, index, e.target.value)}
                                                                                    className="w-full appearance-none rounded-xl border border-gray-200 bg-white pl-4 pr-10 py-3 text-xs font-bold text-gray-700 outline-none focus:border-[#720101] focus:ring-4 focus:ring-[#720101]/5 transition-all cursor-pointer"
                                                                                >
                                                                                    {(menuCatalog[category.id] || []).map((dish) => (
                                                                                        <option key={dish.id} value={dish.id}>{dish.name} (+{peso(dish.priceAdj || 0)})</option>
                                                                                    ))}
                                                                                </select>
                                                                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#720101]">
                                                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                                                                                </div>
                                                                            </div>
                                                                            <button 
                                                                                onClick={() => removeMenuItem(category.id, index)} 
                                                                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors shadow-sm active:scale-90"
                                                                                title="Remove dish"
                                                                            >
                                                                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {activeBooking.canEditMenu && menuEditMode && (
                                                            <div className="mt-6">
                                                                <div className="relative">
                                                                    <select
                                                                        value=""
                                                                        onChange={(e) => addMenuItem(category.id, e.target.value)}
                                                                        className="w-full appearance-none rounded-2xl border-2 border-dashed border-gray-200 bg-white px-6 py-5 text-sm font-bold text-gray-400 outline-none hover:border-[#720101]/30 hover:bg-[#720101]/5 hover:text-[#720101] transition-all cursor-pointer text-center"
                                                                    >
                                                                        <option value="">+ Add {category.label.slice(0, -1)} Selection</option>
                                                                        {(menuCatalog[category.id] || []).map((dish) => (
                                                                            <option key={dish.id} value={dish.id}>{dish.name} - {peso((dish.costPerHead || 0) + (dish.priceAdj || 0))} / head</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {items.length === 0 && !menuEditMode && (
                                                            <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 bg-[#faf7f2]/30 p-12 text-center mt-4">
                                                                <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                                                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                                                </div>
                                                                <p className="font-bold text-gray-400 tracking-wide">No {category.label.toLowerCase()} in current selection.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {activeBooking.canEditMenu && menuEditMode && (
                                                <div className="mt-10 flex flex-wrap justify-end gap-4 pt-8 border-t border-gray-100">
                                                    <button onClick={() => setMenuEditMode(false)} className="rounded-2xl border border-gray-200 bg-white px-8 py-3.5 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition-all shadow-sm active:scale-95">Discard Changes</button>
                                                    <button onClick={saveMenuSelection} disabled={savingMenu} className="flex items-center gap-2 rounded-2xl bg-[#720101] px-10 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-[#720101]/20 hover:bg-[#5a0101] transition-all active:scale-95 disabled:opacity-50">
                                                        {savingMenu ? 'Processing Selection...' : 'Save & Recalculate Total'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeSection === 'payments' && (
                                        <div className="space-y-6">
                                            {/* Financial Summary */}
                                            <div className="bg-[#1a1a1a] rounded-3xl shadow-lg p-6 sm:p-8 text-white relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                                                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 relative z-10"><svg className="w-5 h-5 text-[#f0aa0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Financial Summary</h3>
                                                
                                                {(() => {
                                                    const total = parseFloat(activeBooking.total_cost || 0);
                                                    const payments = activePayments;
                                                    const paid = payments.filter(isSettledPayment).reduce((s, p) => s + parseFloat(p.amount), 0);
                                                    const balance = total - paid;
                                                    const pct = total > 0 ? (paid / total) * 100 : 0;

                                                    return (
                                                        <div className="relative z-10">
                                                            <div className="grid grid-cols-2 gap-6 mb-6">
                                                                <div>
                                                                    <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Total Paid</p>
                                                                    <p className="text-2xl font-bold">PHP {paid.toLocaleString()}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Remaining Balance</p>
                                                                    <p className="text-2xl font-bold text-[#f0aa0b]">PHP {balance.toLocaleString()}</p>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="flex justify-between text-xs font-bold text-white/80 mb-2">
                                                                    <span>Payment Progress</span>
                                                                    <span>{Math.round(pct)}%</span>
                                                                </div>
                                                                <div className="w-full bg-black/30 rounded-full h-2">
                                                                    <div className="bg-[#f0aa0b] h-2 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }}></div>
                                                                </div>
                                                            </div>
                                                            <div className="mt-6 grid gap-3">
                                                                {payments.map((payment) => {
                                                                    const displayStatus = customerPaymentStatus(payment.status, payment.due_date);
                                                                    const overdue = displayStatus.label === 'Overdue';
                                                                    return (
                                                                        <div key={payment.id} className={`rounded-2xl border p-4 ${isSettledPayment(payment) ? 'border-green-400/20 bg-green-500/10' : overdue ? 'border-red-400/30 bg-red-500/10' : 'border-white/10 bg-white/5'}`}>
                                                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                                                <div>
                                                                                    <p className="text-sm font-bold text-white">{paymentLabel(payment.payment_type)}</p>
                                                                                    <p className="mt-1 text-xs font-semibold text-white/55">Due {payment.due_date ? new Date(payment.due_date).toLocaleDateString() : 'on confirmation'}</p>
                                                                                </div>
                                                                                <div className="text-left sm:text-right">
                                                                                    <p className="text-sm font-bold text-white">{peso(payment.amount)}</p>
                                                                                    <div className="flex flex-col sm:items-end mt-1 gap-1.5">
                                                                                        <p className={`text-xs font-bold uppercase tracking-widest ${statusToneClasses[displayStatus.tone]?.dark || statusToneClasses.warning.dark}`}>
                                                                                            {displayStatus.label}
                                                                                        </p>
                                                                                        {isSettledPayment(payment) && (
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => setReceiptModal({ isOpen: true, payment: payment, booking: activeBooking })}
                                                                                                className="text-[10px] font-black uppercase tracking-widest text-green-100 hover:text-white bg-green-900/40 hover:bg-green-800/60 px-3 py-1.5 rounded-full transition-colors inline-flex items-center gap-1.5"
                                                                                            >
                                                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                                                                View Receipt
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {activeBooking.nextPaymentDue ? (
                                                                <form onSubmit={(e) => handlePaymentSubmit(e, activeBooking.nextPaymentDue)} className={`mt-6 rounded-2xl border border-[#f0aa0b]/25 bg-white/[0.07] p-5 relative overflow-hidden ${activeBooking.status === 'Pending' ? 'opacity-80' : ''}`}>
                                                                    {activeBooking.status === 'Pending' && (
                                                                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm p-6 text-center">
                                                                            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f0aa0b] text-[#1a1a1a] shadow-lg">
                                                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                                            </div>
                                                                            <h5 className="text-sm font-black uppercase tracking-widest text-white">Payment Locked</h5>
                                                                            <p className="mt-1 text-xs font-bold text-white/80 leading-relaxed max-w-[240px]">Payments are disabled until your booking is officially approved by our team.</p>
                                                                        </div>
                                                                    )}
                                                                    <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
                                                                        <div>
                                                                            <p className="text-[11px] font-black uppercase tracking-widest text-[#f0aa0b]">Next Payment Required</p>
                                                                            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                                                                <h4 className="font-display text-2xl font-bold text-white">{paymentLabel(activeBooking.nextPaymentDue.payment_type)}</h4>
                                                                                <p className="text-xl font-black text-[#f0aa0b]">{peso(activeBooking.nextPaymentDue.amount)}</p>
                                                                            </div>
                                                                            {activeBooking.nextPaymentDue.description && (
                                                                                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-white/60">{activeBooking.nextPaymentDue.description}</p>
                                                                            )}
                                                                            <div className="mt-4 rounded-xl border border-red-300/20 bg-red-500/10 p-3">
                                                                                <p className="text-xs font-black uppercase tracking-widest text-red-200">Payment due: {new Date(activeBooking.nextPaymentDue.due_date).toLocaleDateString()}</p>
                                                                                <p className="mt-1 text-xs font-medium leading-5 text-red-100/75">Please complete this payment by the due date to keep your event date reserved.</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex flex-col gap-3 lg:min-w-[220px]">
                                                                            <div className="rounded-xl bg-black/20 p-3 text-xs font-bold text-white/65">
                                                                                Secure checkout opens on the next screen.
                                                                            </div>
                                                                            <button
                                                                                type="submit"
                                                                                disabled={submittingPayment || activeBooking.status === 'Pending'}
                                                                                className={`rounded-xl bg-[#f0aa0b] px-6 py-3.5 text-sm font-black text-[#1a1a1a] shadow-lg shadow-black/20 transition-all hover:bg-[#d99a08] ${submittingPayment || activeBooking.status === 'Pending' ? 'cursor-not-allowed opacity-70' : ''}`}
                                                                            >
                                                                                {submittingPayment ? 'Opening Checkout...' : activeBooking.status === 'Pending' ? 'Awaiting Approval' : 'Proceed to Checkout'}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </form>
                                                            ) : (
                                                                <div className="mt-6 rounded-2xl border border-green-400/20 bg-green-500/10 p-5 text-center">
                                                                    <p className="font-bold text-green-200">All caught up. You have no pending payments at this time.</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* Payment Schedule */}
                                            {false && (() => {
                                                const tranches = activePayments;
                                                if (tranches.length === 0) return null;
                                                return (
                                                    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden p-6">
                                                        <h4 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-widest">Payment Schedule</h4>
                                                        <div className="space-y-3">
                                                            {tranches.map((tranche, idx) => (
                                                                <div key={idx} className={`flex justify-between items-center p-4 rounded-xl border ${isSettledPayment(tranche) ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSettledPayment(tranche) ? 'bg-green-500 text-white' : 'bg-gray-300 text-white'}`}>
                                                                            {isSettledPayment(tranche) ? (
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                                            ) : (
                                                                                <span className="text-xs font-bold">{idx + 1}</span>
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <p className="font-bold text-gray-900 text-sm">{paymentLabel(tranche.payment_type)}</p>
                                                                            {!isSettledPayment(tranche) && tranche.due_date && (
                                                                                <p className="text-xs font-medium text-gray-500">Due: {new Date(tranche.due_date).toLocaleDateString()}</p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="font-bold text-gray-900">PHP {parseFloat(tranche.amount).toLocaleString()}</p>
                                                                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${isSettledPayment(tranche) ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                                                                            {customerPaymentStatus(tranche.status, tranche.due_date).label}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Sequential Payment Action Card */}
                                            {false ? (
                                                <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                                                    <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                                        <div>
                                                            <p className="text-xs font-bold text-[#720101] uppercase tracking-widest mb-1">Next Payment Required</p>
                                                            <h3 className="text-xl font-display font-bold text-[#1a1a1a]">{paymentLabel(activeBooking.nextPaymentDue.payment_type)}</h3>
                                                            {activeBooking.nextPaymentDue.description && (
                                                                <p className="text-sm font-medium text-gray-500 mt-1 max-w-sm">{activeBooking.nextPaymentDue.description}</p>
                                                            )}
                                                            <div className="mt-3 bg-red-50 border border-red-100 p-3 rounded-xl inline-block">
                                                                <p className="text-xs font-bold text-red-800">
                                                                    Payment Due: {new Date(activeBooking.nextPaymentDue.due_date).toLocaleDateString()}
                                                                </p>
                                                                <p className="text-[11px] text-red-600 font-medium mt-0.5 max-w-sm">
                                                                    Please complete this payment by the due date to keep your event date reserved.
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Amount Due</p>
                                                            <p className="text-2xl font-bold text-[#1a1a1a]">PHP {parseFloat(activeBooking.nextPaymentDue.amount).toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                    
                                                    <form onSubmit={(e) => handlePaymentSubmit(e, activeBooking.nextPaymentDue)} className="p-6 sm:p-8">
                                                        <div className="mb-8 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                                                            <div className="flex items-start gap-3">
                                                                <svg className="mt-0.5 h-5 w-5 text-[#720101]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                                <div>
                                                                    <p className="text-sm font-bold text-gray-900">Checkout</p>
                                                                    <p className="mt-1 text-sm font-medium text-gray-500">You will choose your payment method on the secure checkout page.</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between items-center pt-6 border-t border-gray-100">
                                                            <div className="flex items-center gap-2 text-gray-400">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                                <span className="text-xs font-bold uppercase tracking-wider">Encrypted checkout</span>
                                                            </div>
                                                            <button 
                                                                type="submit" 
                                                                disabled={submittingPayment}
                                                                className={`bg-[#1a1a1a] hover:bg-black text-white font-bold py-3.5 px-10 rounded-xl shadow-md transition-all flex items-center gap-2 ${submittingPayment ? 'opacity-75 cursor-not-allowed' : ''}`}
                                                            >
                                                                {submittingPayment ? (
                                                                    <>
                                                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                                        Opening...
                                                                    </>
                                                                ) : 'Proceed to Checkout'}
                                                            </button>
                                                        </div>
                                                    </form>
                                                </div>
                                            ) : (
                                                <div className="hidden">
                                                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                    </div>
                                                    <h3 className="text-xl font-bold text-green-900 mb-2">All Caught Up!</h3>
                                                    <p className="text-green-700 font-medium">You have no pending payments at this time. Thank you!</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-[11px] font-black uppercase tracking-widest text-[#720101]">Event progress</span>
                                                <span className="rounded-full bg-[#720101]/10 px-2.5 py-1 text-[11px] font-black text-[#720101]">{Math.round(journeyProgress)}%</span>
                                                <span className="text-xs font-semibold text-gray-500">
                                                    {remainingJourneySteps.length === 0 ? 'Complete' : `${remainingJourneySteps.length} step${remainingJourneySteps.length > 1 ? 's' : ''} left`}
                                                </span>
                                            </div>
                                            <div className="flex min-w-0 flex-wrap gap-1.5">
                                                {activeJourneySteps.map((step, index) => (
                                                    <button
                                                        type="button"
                                                        key={step.label}
                                                        onClick={() => jumpToJourneyStep(step)}
                                                        disabled={step.locked}
                                                        title={step.action}
                                                        className={`inline-flex max-w-[11rem] items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-bold transition ${step.done ? 'border-green-200 bg-green-50 text-green-700 hover:border-green-300' : step.isPendingGate ? 'border-[#f0aa0b]/40 bg-[#f0aa0b]/10 text-[#9f6500]' : step.locked ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400' : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-[#720101]/20 hover:bg-white'}`}
                                                    >
                                                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] ${step.done ? 'bg-green-600 text-white' : step.isPendingGate ? 'bg-[#f0aa0b] text-white' : step.locked ? 'bg-gray-200 text-gray-400' : 'bg-white text-gray-500 ring-1 ring-gray-200'}`}>
                                                            {step.done ? 'OK' : index + 1}
                                                        </span>
                                                        <span className="truncate">{step.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </main>
            
            {/* MODALS */}
            {corePricePreview && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setCorePricePreview(null)}></div>
                    <div className="relative w-full max-w-lg animate-fadeIn rounded-3xl bg-white p-7 shadow-2xl">
                        <p className="text-xs font-black uppercase tracking-widest text-[#720101]">Guest count affects pricing</p>
                        <h3 className="mt-2 text-2xl font-display font-bold text-[#1a1a1a]">Review the updated balance</h3>
                        <p className="mt-2 text-sm font-semibold leading-6 text-gray-500">
                            Your menu is priced per guest. Changing guests from {corePricePreview.oldPax} to {corePricePreview.newPax} may update your event total and unpaid payment schedule.
                        </p>
                        <div className="mt-5 grid gap-3 rounded-2xl border border-[#720101]/10 bg-[#fffaf3] p-4 sm:grid-cols-3">
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">Old total</p>
                                <p className="mt-1 text-lg font-black text-gray-900">{peso(corePricePreview.oldTotal)}</p>
                            </div>
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">New total</p>
                                <p className="mt-1 text-lg font-black text-[#720101]">{peso(corePricePreview.newTotal)}</p>
                            </div>
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">Balance</p>
                                <p className="mt-1 text-lg font-black text-[#720101]">{peso(corePricePreview.remainingBalance)}</p>
                            </div>
                        </div>
                        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button type="button" onClick={() => setCorePricePreview(null)} className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50">Review again</button>
                            <button type="button" disabled={savingCore} onClick={() => handleCoreUpdate(null, true)} className="rounded-xl bg-[#720101] px-6 py-3 text-sm font-black text-white shadow-sm hover:bg-[#5a0101] disabled:opacity-60">
                                {savingCore ? 'Saving...' : 'Confirm changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {editCoreModalOpen && activeBooking && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setEditCoreModalOpen(false); setCorePricePreview(null); }}></div>
                    <form onSubmit={handleCoreUpdate} className="relative w-full max-w-lg animate-fadeIn rounded-3xl bg-white p-7 shadow-2xl">
                        <p className="text-xs font-black uppercase tracking-widest text-[#720101]">Update event schedule</p>
                        <h3 className="mt-2 text-2xl font-display font-bold text-[#1a1a1a]">Change date or guest count</h3>
                        <p className="mt-2 text-sm font-semibold leading-6 text-gray-500">
                            We will check availability before saving. Your booking status will stay as-is unless the server blocks the change.
                        </p>
                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                            <label className="block">
                                <span className="text-xs font-black uppercase tracking-widest text-gray-500">Event date</span>
                                <input
                                    type="date"
                                    value={coreForm.event_date}
                                    onChange={(event) => setCoreForm(prev => ({ ...prev, event_date: event.target.value }))}
                                    className="mt-2 w-full rounded-2xl border border-[#720101]/10 bg-white px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-[#720101] focus:ring-4 focus:ring-[#720101]/10"
                                    required
                                />
                            </label>
                            <label className="block">
                                <span className="text-xs font-black uppercase tracking-widest text-gray-500">Guests</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={coreForm.pax}
                                    onChange={(event) => setCoreForm(prev => ({ ...prev, pax: event.target.value }))}
                                    className="mt-2 w-full rounded-2xl border border-[#720101]/10 bg-white px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-[#720101] focus:ring-4 focus:ring-[#720101]/10"
                                    required
                                />
                            </label>
                        </div>
                        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button type="button" onClick={() => { setEditCoreModalOpen(false); setCorePricePreview(null); }} className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50">Cancel</button>
                            <button type="submit" disabled={savingCore} className="rounded-xl bg-[#720101] px-6 py-3 text-sm font-black text-white shadow-sm hover:bg-[#5a0101] disabled:opacity-60">
                                {savingCore ? 'Checking...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {cancelModalOpen && activeBooking && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCancelModalOpen(false)}></div>
                    <div className="relative w-full max-w-lg animate-fadeIn rounded-3xl bg-white p-7 shadow-2xl">
                        <p className="text-xs font-black uppercase tracking-widest text-red-700">Cancel booking</p>
                        <h3 className="mt-2 text-2xl font-display font-bold text-[#1a1a1a]">{eventDisplayName(activeBooking)}</h3>
                        <p className="mt-2 text-sm font-semibold leading-6 text-gray-500">
                            Booking #{activeBooking.id} on {formatEventDate(activeBooking.event_date, { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4">
                            <p className="text-sm font-semibold leading-6 text-red-800">{activeBooking.cancellationImpact?.message || "This will cancel the selected booking and move it to your history."}</p>
                        </div>
                        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button onClick={() => setCancelModalOpen(false)} className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50">Keep Booking</button>
                            <button onClick={handleCancelBooking} className="rounded-xl bg-red-700 px-6 py-3 text-sm font-black text-white shadow-sm hover:bg-red-800">Cancel Booking</button>
                        </div>
                    </div>
                </div>
            )}

            {receiptModal.isOpen && (
                <Suspense fallback={null}>
                    <ReceiptModal
                        isOpen={receiptModal.isOpen}
                        onClose={() => setReceiptModal({ isOpen: false, payment: null, booking: null })}
                        payment={receiptModal.payment}
                        booking={receiptModal.booking}
                    />
                </Suspense>
            )}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                tone="danger"
                onCancel={closeConfirmModal}
                onConfirm={confirmModal.onConfirm}
            />
        </div>
    );
};

export default ClientDashboard;
