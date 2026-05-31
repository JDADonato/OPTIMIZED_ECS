import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { useAuth } from '../context/AuthContext';
import ClientNavbar from '../Components/common/ClientNavbar';
import Footer from '../Components/common/Footer';
import SmartImage from '../Components/common/SmartImage';
import StaffPreviewBanner from '../Components/common/StaffPreviewBanner';
import RevealOnScroll from '../Components/common/RevealOnScroll';
import { isStaffUser } from '../utils/dashboardLinks';

/* ── SVG Icons ── */
const settledStatuses = ['Paid', 'Verified'];
const isSettled = (status) => settledStatuses.includes(status);
const sharedSelectedBookingKey = 'ecs_selected_booking_id';
const journeyTrackerCacheKey = 'ecs_home_journey_tracker_cache';
const journeyTrackerCollapsedKey = 'ecs_home_journey_tracker_collapsed';
const eventDisplayName = (booking) => booking?.event_name || booking?.event_type || booking?.client_full_name || 'Eloquente event';
const compactEventDate = (date) => date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date pending';
const paymentLabel = (type) => ({
    Reservation: 'Reservation Fee',
    DownPayment: 'Down Payment',
    Downpayment: 'Down Payment',
    Final: 'Final Payment',
}[type] || type || 'Payment');
const readSharedSelectedBooking = () => {
    if (typeof window === 'undefined') return null;
    try {
        const stored = localStorage.getItem(sharedSelectedBookingKey);
        return stored ? Number(stored) : null;
    } catch (e) {
        return null;
    }
};
const writeSharedSelectedBooking = (id) => {
    if (typeof window === 'undefined' || !id) return;
    try {
        localStorage.setItem(sharedSelectedBookingKey, String(id));
    } catch (e) {
        // Ignore local storage issues; the tracker still works without persistence.
    }
};
const readJourneyTrackerCache = () => {
    if (typeof window === 'undefined') return { bookings: [], payments: [] };
    try {
        const cached = JSON.parse(localStorage.getItem(journeyTrackerCacheKey) || '{}');
        return {
            bookings: Array.isArray(cached.bookings) ? cached.bookings : [],
            payments: Array.isArray(cached.payments) ? cached.payments : [],
        };
    } catch (e) {
        return { bookings: [], payments: [] };
    }
};
const writeJourneyTrackerCache = (payload) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(journeyTrackerCacheKey, JSON.stringify({
            bookings: payload.bookings || [],
            payments: payload.payments || [],
            cached_at: payload.cached_at || new Date().toISOString(),
        }));
    } catch (e) {
        // Cache is only a speed boost; ignore storage failures.
    }
};
const readJourneyTrackerCollapsed = () => {
    if (typeof window === 'undefined') return false;
    try {
        return localStorage.getItem(journeyTrackerCollapsedKey) === 'true';
    } catch (e) {
        return false;
    }
};
const writeJourneyTrackerCollapsed = (collapsed) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(journeyTrackerCollapsedKey, collapsed ? 'true' : 'false');
    } catch (e) {
        // Ignore local storage issues; the tracker remains usable without persistence.
    }
};
const hasSelectedMenu = (selectedMenu) => {
    if (!selectedMenu) return false;
    try {
        const parsed = typeof selectedMenu === 'string' ? JSON.parse(selectedMenu || '{}') : selectedMenu;
        return Object.values(parsed || {}).some(items => Array.isArray(items) ? items.length > 0 : Boolean(items));
    } catch (e) {
        return Boolean(selectedMenu);
    }
};
const Rv = ({ children, cls = '', d = '' }) => <RevealOnScroll className={cls} delay={d}>{children}</RevealOnScroll>;

const Counter = ({ end, suffix = '' }) => {
    const [val, setVal] = useState(0);
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current; if (!el) return;
        const io = new IntersectionObserver(([e]) => {
            if (e.isIntersecting) {
                let s = 0; const dur = 1800; const step = 16; const inc = end / (dur / step);
                const t = setInterval(() => { s += inc; if (s >= end) { setVal(end); clearInterval(t); } else setVal(Math.floor(s)); }, step);
                io.unobserve(el);
            }
        }, { threshold: 0.3 });
        io.observe(el); return () => io.disconnect();
    }, [end]);
    return <span ref={ref}>{val}{suffix}</span>;
};

const _EventJourneyTracker = ({ booking, payments }) => {
    if (!booking) return null;
    const steps = buildFloatingJourneySteps(booking, payments);
    const completedCount = steps.filter(s => s.done).length;
    const progressWidth = steps.length > 1 ? (completedCount / (steps.length - 1)) * 100 : (completedCount ? 100 : 0);
    const activeStepIndex = steps.findIndex(s => !s.done);
    const activeStep = activeStepIndex === -1 ? steps.length : activeStepIndex;

    return (
        <div className="bg-white border-b border-gray-100 shadow-sm pt-28 pb-8 px-5">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <p className="text-[#f0aa0b] text-xs font-bold uppercase tracking-widest mb-1">Your Event Journey</p>
                        <h2 className="text-[#1a1a1a] text-2xl font-display font-bold">{eventDisplayName(booking)}</h2>
                    </div>
                    <button 
                        onClick={() => router.get('/dashboard/client')}
                        className="bg-[#720101] hover:bg-[#5a0101] text-white text-xs font-black uppercase tracking-widest py-3 px-8 rounded-2xl shadow-xl shadow-[#720101]/20 transition-all active:scale-95"
                    >
                        View Dashboard
                    </button>
                </div>
                
                <div className="relative pt-4 pb-12">
                    <div className="absolute top-[2.1rem] left-0 w-full h-1 bg-gray-100 rounded-full"></div>
                    <div className="absolute top-[2.1rem] left-0 h-1 bg-[#720101] rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(114,1,1,0.3)]" style={{ width: `${progressWidth}%` }}></div>
                    
                    <div
                        className="relative grid gap-3 pb-2"
                        style={{ gridTemplateColumns: `repeat(${Math.max(steps.length, 1)}, minmax(0, 1fr))` }}
                    >
                        {steps.map((step, idx) => {
                            const isCompleted = step.done;
                            const isActive = idx === activeStep;
                            const isLocked = step.locked;
                            
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                        if (!step.locked) router.get(`/dashboard/client?tab=${step.tab}&booking=${booking.id}${step.target ? `&target=${step.target}` : ''}`);
                                    }}
                                    disabled={step.locked}
                                    className="group flex min-w-0 flex-col items-center disabled:cursor-not-allowed"
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-500 z-10 
                                        ${isCompleted ? 'bg-[#720101] border-[#720101] text-white' : 
                                          isActive ? 'bg-white border-[#720101] text-[#720101] shadow-xl' : 
                                          'bg-white border-gray-100 text-gray-300'}`}>
                                        {isCompleted ? 'OK' : isLocked ? (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                        ) : idx + 1}
                                    </div>
                                    <p className={`mt-4 text-[10px] font-black uppercase tracking-[0.15em] text-center max-w-[80px] transition-colors
                                        ${isActive ? 'text-[#720101]' : isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
                                        {step.label}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};


const buildFloatingJourneySteps = (booking, payments) => {
    const bookingPayments = (payments || []).filter((payment) => payment.booking_id === booking.id);
    const total = Number(booking.total_cost || 0);
    const paid = bookingPayments
        .filter((payment) => isSettled(payment.status))
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    
    const isApproved = ['Confirmed', 'Completed'].includes(booking.status);
    const hasReservation = bookingPayments.some((payment) => payment.payment_type === 'Reservation' && isSettled(payment.status)) || (total > 0 && paid / total >= 0.1);
    const eventDetailsDone = Boolean(booking.venue_address_line && booking.event_time && (booking.event_timeline || booking.special_instructions || booking.color_motif));
    const paymentsDone = bookingPayments.length > 0 && bookingPayments.every((payment) => isSettled(payment.status));

    const needsClarification = Boolean(booking.clarification_request && !booking.clarification_response);
    const needsMenuSelection = !hasSelectedMenu(booking.selected_menu);
    const steps = [
        { label: 'Booking approved', done: isApproved, action: 'Awaiting approval', tab: 'details', target: 'approval-status-panel', isPendingGate: !isApproved },
        { label: 'Reservation payment', done: hasReservation, action: 'Complete payment', tab: 'payments', locked: !isApproved },
        { label: 'Event details', done: eventDetailsDone, action: 'Add timeline/motif', tab: 'details', target: 'event-details-panel' },
        { label: 'Payment balance', done: paymentsDone, action: booking.nextPaymentDue ? `Pay ${paymentLabel(booking.nextPaymentDue.payment_type)}` : 'Review final balance', tab: 'payments', locked: !isApproved },
    ];

    if (needsMenuSelection) {
        steps.unshift({ label: 'Menu selection', done: false, action: 'Choose dishes', tab: 'menu' });
    }

    if (needsClarification) {
        steps.unshift({
            label: 'Staff request',
            done: false,
            action: 'Answer requested details',
            tab: 'details',
            target: 'staff-request-panel',
            isPendingGate: true,
        });
    }

    return steps;
};

const JourneyStepCard = ({ step, index, bookingId, orientation = 'horizontal' }) => {
    const isVertical = orientation === 'vertical';
    const goToStep = () => {
        if (!step.locked) router.get(`/dashboard/client?tab=${step.tab}&booking=${bookingId}${step.target ? `&target=${step.target}` : ''}`);
    };

    return (
        <button
            type="button"
            onClick={goToStep}
            disabled={step.locked}
            className={`min-w-0 rounded-xl border text-left transition-all duration-200 motion-safe:hover:-translate-y-0.5 ${isVertical ? 'flex items-center gap-3 px-3 py-3' : 'px-2.5 py-2'} ${step.done ? 'border-green-200 bg-green-50 hover:border-green-300' : step.isPendingGate ? 'border-[#f0aa0b]/40 bg-[#f0aa0b]/5 ring-1 ring-[#f0aa0b]/20 hover:bg-[#f0aa0b]/10' : step.locked ? 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-50' : 'border-gray-200 bg-gray-50 hover:border-[#720101]/20 hover:bg-white'}`}
        >
            <div className={`${isVertical ? '' : 'mb-1.5'} flex min-w-0 items-center gap-1.5`}>
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${step.done ? 'bg-green-600 text-white' : step.isPendingGate ? 'bg-[#f0aa0b] text-white animate-pulse' : step.locked ? 'bg-gray-200 text-gray-400' : 'bg-white text-gray-500 ring-1 ring-gray-200'}`}>
                    {step.done ? 'OK' : step.locked ? (
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    ) : index + 1}
                </div>
                <div className="min-w-0 flex-1">
                    <p className={`min-w-0 truncate text-[11px] font-bold ${step.locked ? 'text-gray-400' : 'text-gray-900'}`}>{step.label}</p>
                    {(!step.done || isVertical) && (
                        <p className={`mt-0.5 line-clamp-2 text-[10px] font-medium leading-4 ${step.isPendingGate ? 'text-[#b27a00]' : step.locked ? 'text-gray-400' : 'text-gray-500'}`}>
                            {step.done ? 'Complete' : step.locked ? 'Step locked' : step.action}
                        </p>
                    )}
                </div>
            </div>
        </button>
    );
};

const JourneySkeleton = () => (
    <section className="border-b border-[#720101]/10 bg-[#fffaf3] px-5 py-4 sm:px-8">
        <div className="mx-auto max-w-7xl rounded-2xl border border-[#720101]/10 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <div className="h-3 w-28 animate-pulse rounded bg-[#720101]/10" />
                    <div className="mt-3 h-5 w-44 animate-pulse rounded bg-gray-100" />
                </div>
                <div className="h-2 w-32 animate-pulse rounded-full bg-gray-100" />
            </div>
            <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3].map(item => <div key={item} className="h-20 animate-pulse rounded-xl bg-gray-50" />)}
            </div>
        </div>
    </section>
);

const EventPickerButton = ({ activeBookings, booking, compact = false, onSelect }) => {
    const [pickerOpen, setPickerOpen] = useState(false);
    const pickerRef = useRef(null);

    useEffect(() => {
        if (!pickerOpen) return;

        const closeOnOutsideClick = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                setPickerOpen(false);
            }
        };
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') setPickerOpen(false);
        };

        document.addEventListener('mousedown', closeOnOutsideClick);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('mousedown', closeOnOutsideClick);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [pickerOpen]);

    if (activeBookings.length <= 1) return null;

    return (
        <div ref={pickerRef} className={`relative max-w-full ${compact ? 'mt-3 w-full' : 'mt-2 w-full sm:w-auto sm:min-w-[15rem] sm:max-w-[22rem]'}`}>
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={pickerOpen}
                onClick={() => setPickerOpen(open => !open)}
                className={`group flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border bg-white/80 text-left outline-none transition-all duration-200 hover:border-[#720101]/25 hover:bg-white hover:shadow-sm focus:border-[#720101]/35 focus:ring-4 focus:ring-[#720101]/10 ${compact ? 'px-3 py-2.5' : 'px-3 py-2'} ${pickerOpen ? 'border-[#720101]/30 bg-white shadow-sm' : 'border-[#720101]/10'}`}
            >
                <span className="min-w-0">
                    <span className="block truncate text-sm font-display font-bold leading-tight text-[#1a1a1a]">
                        {eventDisplayName(booking)}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] font-bold uppercase tracking-[0.14em] text-[#720101]/70">
                        Booking #{booking.id} / {compactEventDate(booking.event_date)}
                    </span>
                </span>
                <svg className={`h-4 w-4 shrink-0 text-[#720101] transition-transform duration-200 ${pickerOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {pickerOpen && (
                <div
                    role="listbox"
                    className={`absolute left-0 z-50 w-full min-w-[18rem] overflow-hidden rounded-2xl border border-[#720101]/10 bg-white shadow-2xl shadow-[#720101]/10 motion-safe:animate-[pickerIn_.18s_ease-out] ${compact ? 'bottom-full mb-2 origin-bottom' : 'mt-2 origin-top'}`}
                >
                    <div className="border-b border-[#f0aa0b]/20 bg-[#fffaf3] px-3 py-2.5">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9f6500]">Select event</p>
                    </div>
                    <div className="custom-scrollbar max-h-60 overflow-y-auto p-1.5">
                        {activeBookings.map((item) => {
                            const isSelected = item.id === booking.id;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => {
                                        onSelect(item.id);
                                        setPickerOpen(false);
                                    }}
                                    className={`w-full rounded-xl px-3 py-2.5 text-left transition ${isSelected ? 'bg-[#720101] text-white shadow-sm' : 'text-[#1a1a1a] hover:bg-[#faf7f2]'}`}
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <p className="min-w-0 truncate font-display text-sm font-bold">{eventDisplayName(item)}</p>
                                        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${isSelected ? 'bg-white/15 text-white/85' : 'bg-[#fffaf3] text-[#720101]'}`}>#{item.id}</span>
                                    </div>
                                    <p className={`mt-0.5 text-[11px] font-semibold ${isSelected ? 'text-white/75' : 'text-gray-500'}`}>
                                        {compactEventDate(item.event_date)} / {item.pax || 0} pax
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const FloatingJourneyTracker = ({ bookings, payments, loading = false }) => {
    const activeBookings = useMemo(() => bookings.filter((booking) => !['Cancelled', 'cancelled', 'Completed'].includes(booking.status)), [bookings]);
    const [selectedId, setSelectedId] = useState(() => readSharedSelectedBooking());
    const [open, setOpen] = useState(false);
    const [inlineCollapsed, setInlineCollapsed] = useState(() => readJourneyTrackerCollapsed());
    const [isDocked, setIsDocked] = useState(false);
    const [hasTransitioned, setHasTransitioned] = useState(false);
    const [dockedEventListOpen, setDockedEventListOpen] = useState(false);
    const inlineRef = useRef(null);
    const booking = activeBookings.find((item) => item.id === selectedId) || activeBookings[0];

    useEffect(() => {
        if (!selectedId && activeBookings[0]) {
            setSelectedId(activeBookings[0].id);
        }
    }, [activeBookings, selectedId]);

    useEffect(() => {
        if (booking?.id) {
            writeSharedSelectedBooking(booking.id);
        }
    }, [booking?.id]);

    useEffect(() => {
        writeJourneyTrackerCollapsed(inlineCollapsed);
    }, [inlineCollapsed]);

    useEffect(() => {
        const el = inlineRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(([entry]) => {
            const nextDocked = !entry.isIntersecting && entry.boundingClientRect.top < 0;
            setIsDocked(nextDocked);
            if (nextDocked) setHasTransitioned(true);
        }, { threshold: 0, rootMargin: '-80px 0px 0px 0px' });

        observer.observe(el);
        return () => observer.disconnect();
    }, [booking?.id]);

    if (!booking) return loading ? <JourneySkeleton /> : null;

    const steps = buildFloatingJourneySteps(booking, payments);
    const completed = steps.filter((step) => step.done).length;
    const progress = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 100;
    const remaining = steps.filter((step) => !step.done);
    const heading = remaining.length === 0 ? 'Everything needed is complete' : `${remaining.length} step${remaining.length > 1 ? 's' : ''} remaining`;
    const selectBooking = (id) => {
        setSelectedId(Number(id));
        setDockedEventListOpen(false);
    };

    const InlinePanel = () => (
        <div className={`rounded-2xl border border-[#720101]/10 bg-white shadow-sm transition-all duration-300 motion-safe:animate-[fadeUp_.28s_ease-out] ${inlineCollapsed ? 'p-4' : 'p-4'}`}>
            <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${inlineCollapsed ? '' : 'mb-4'}`}>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:gap-4">
                        <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-widest text-[#720101]">Journey Tracker</p>
                            <h3 className="mt-1 text-lg font-display font-bold text-[#1a1a1a]">{heading}</h3>
                            {activeBookings.length <= 1 && (
                                <p className="mt-1 truncate text-xs font-semibold text-gray-500">{eventDisplayName(booking)} - Booking #{booking.id}</p>
                            )}
                        </div>
                        <EventPickerButton activeBookings={activeBookings} booking={booking} onSelect={selectBooking} />
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="min-w-[170px]">
                        <div className="mb-2 flex justify-between text-xs font-bold text-gray-500">
                            <span>Progress</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100">
                            <div className="h-2 rounded-full bg-[#720101] transition-all duration-700" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setInlineCollapsed(collapsed => !collapsed)}
                        aria-expanded={!inlineCollapsed}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#720101]/10 bg-white text-[#720101] transition hover:border-[#720101]/25 hover:bg-[#fffaf3] focus:outline-none focus:ring-4 focus:ring-[#720101]/10"
                    >
                        <svg className={`h-5 w-5 transition-transform duration-200 ${inlineCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
            </div>
            <div className={`overflow-hidden transition-all duration-300 motion-reduce:transition-opacity ${inlineCollapsed ? 'max-h-0 opacity-0' : 'max-h-[18rem] opacity-100'}`}>
                <div className="grid max-w-full gap-2 pt-0" style={{ gridTemplateColumns: `repeat(${Math.max(steps.length, 1)}, minmax(0, 1fr))` }}>
                    {steps.map((step, index) => <JourneyStepCard key={step.label} step={step} index={index} bookingId={booking.id} />)}
                </div>
            </div>
        </div>
    );

    const DockedSummary = () => (
        <button
            onClick={() => setOpen(true)}
            className={`fixed bottom-5 left-5 z-40 w-[calc(100%-2.5rem)] max-w-sm rounded-2xl border border-[#720101]/10 bg-white px-4 py-3 text-left shadow-xl transition-all duration-300 motion-reduce:transition-opacity ${hasTransitioned ? 'motion-safe:animate-[dockIn_.24s_ease-out]' : ''} hover:border-[#720101]/25`}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-widest text-[#720101]">Journey Tracker</p>
                    <p className="mt-1 truncate text-sm font-bold text-[#1a1a1a]">{heading}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <div className="h-2 w-20 rounded-full bg-gray-100">
                        <div className="h-2 rounded-full bg-[#720101] transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-xs font-black text-gray-700">{progress}%</span>
                </div>
            </div>
        </button>
    );

    const DockedEventList = () => (
        <div className="custom-scrollbar grid max-h-[46vh] gap-2 overflow-y-auto pr-1">
            <button
                type="button"
                onClick={() => setDockedEventListOpen(false)}
                className="mb-1 inline-flex w-fit items-center rounded-full bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-200"
            >
                Back to steps
            </button>
            {activeBookings.map((item) => {
                const isSelected = item.id === booking.id;
                return (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => selectBooking(item.id)}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${isSelected ? 'border-[#720101] bg-[#720101] text-white shadow-sm' : 'border-[#720101]/10 bg-white text-[#1a1a1a] hover:border-[#720101]/20 hover:bg-[#fffaf3]'}`}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <p className="min-w-0 truncate font-display text-sm font-bold">{eventDisplayName(item)}</p>
                            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${isSelected ? 'bg-white/15 text-white/85' : 'bg-[#fffaf3] text-[#720101]'}`}>#{item.id}</span>
                        </div>
                        <p className={`mt-1 text-[11px] font-semibold ${isSelected ? 'text-white/75' : 'text-gray-500'}`}>
                            {compactEventDate(item.event_date)} / {item.pax || 0} pax
                        </p>
                    </button>
                );
            })}
        </div>
    );

    const DockedPanel = () => (
        <div className={`fixed bottom-5 left-5 z-40 flex max-h-[calc(100vh-2.5rem)] w-[calc(100%-2.5rem)] max-w-md flex-col rounded-2xl border border-[#720101]/10 bg-white p-4 shadow-xl transition-all duration-300 motion-reduce:transition-opacity motion-safe:animate-[dockIn_.24s_ease-out]`}>
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#720101]">Journey Tracker</p>
                    <h2 className="mt-1 text-base font-display font-bold text-[#1a1a1a]">{heading}</h2>
                    <p className="mt-1 truncate text-xs font-semibold text-gray-500">{eventDisplayName(booking)} - Booking #{booking.id}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {activeBookings.length > 1 && (
                        <button
                            type="button"
                            onClick={() => setDockedEventListOpen(open => !open)}
                            className={`rounded-full px-3 py-2 text-xs font-bold transition ${dockedEventListOpen ? 'bg-[#720101] text-white' : 'bg-[#fffaf3] text-[#720101] hover:bg-[#f8eadf]'}`}
                        >
                            {dockedEventListOpen ? 'Steps' : 'Switch'}
                        </button>
                    )}
                    <button onClick={() => { setOpen(false); setDockedEventListOpen(false); }} className="rounded-full bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200">Collapse</button>
                </div>
            </div>
            <div className="mb-4">
                <div className="mb-2 flex justify-between text-[11px] font-bold uppercase tracking-widest text-gray-500">
                    <span>Progress</span>
                    <span>{progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-[#720101] transition-all duration-700" style={{ width: `${progress}%` }} />
                </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
                {dockedEventListOpen ? (
                    <DockedEventList />
                ) : (
                    <div className="custom-scrollbar grid max-h-[56vh] gap-2 overflow-y-auto pr-1">
                        {steps.map((step, index) => <JourneyStepCard key={step.label} step={step} index={index} bookingId={booking.id} orientation="vertical" />)}
                    </div>
                )}
            </div>
            <button onClick={() => router.get('/dashboard/client')} className="mt-3 w-full rounded-xl bg-[#720101] px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-[#5a0101]">Open Dashboard</button>
        </div>
    );

    return (
        <>
            <section ref={inlineRef} className={`border-b border-[#720101]/10 bg-[#fffaf3] px-5 py-4 transition-opacity duration-300 sm:px-8 ${isDocked ? 'opacity-70' : 'opacity-100'}`}>
                <div className="mx-auto max-w-7xl">
                    <InlinePanel />
                </div>
            </section>
            {isDocked && (open ? <DockedPanel /> : <DockedSummary />)}
        </>
    );
};

const announcementTypeLabels = {
    general: 'Announcement',
    promo: 'Special Offer',
    event_reminder: 'Event Reminder',
    holiday_advisory: 'Holiday Advisory',
    menu_update: 'Menu Update',
    service_notice: 'Service Notice',
    urgent: 'Important Notice',
};

const announcementImage = (announcement) => {
    const path = announcement?.image_url || announcement?.image_path;
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/')) return path;
    return `/storage/${path.replace(/^\/+/, '')}`;
};

const HomepageAnnouncements = ({ announcements }) => {
    if (!announcements.length) return null;

    const [featured, ...rest] = announcements;
    const image = announcementImage(featured);

    return (
        <section className="bg-white px-5 py-12 sm:px-8">
            <div className="mx-auto max-w-7xl">
                <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[.22em] text-[#f0aa0b]">Latest Updates</p>
                        <h2 className="mt-2 font-display text-3xl font-bold text-[#1a1a1a]">Announcements from Eloquente</h2>
                    </div>
                    <p className="max-w-xl text-sm font-medium leading-6 text-gray-500">
                        Fresh advisories, menu notes, and booking updates from the team.
                    </p>
                </div>

                <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
                    <article className="overflow-hidden rounded-3xl border border-[#720101]/10 bg-[#fffaf3] shadow-sm">
                        {image && <SmartImage src={image} alt="" aspectRatio="16 / 9" containerClassName="h-64" />}
                        <div className="p-6 md:p-8">
                            <span className="inline-flex rounded-full bg-[#720101]/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#720101]">
                                {announcementTypeLabels[featured.type] || 'Announcement'}
                            </span>
                            <h3 className="mt-4 font-display text-2xl font-bold leading-tight text-[#1a1a1a] md:text-3xl">
                                {featured.title}
                            </h3>
                            <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-gray-600">
                                {featured.summary || featured.body}
                            </p>
                            {featured.cta_label && featured.cta_url && (
                                <Link href={featured.cta_url} className="mt-6 inline-flex items-center rounded-full bg-[#720101] px-6 py-3 text-sm font-black uppercase tracking-wider text-white transition-colors hover:bg-[#5a0101]">
                                    {featured.cta_label}
                                </Link>
                            )}
                        </div>
                    </article>

                    <div className="grid gap-4">
                        {rest.slice(0, 3).map((announcement) => (
                            <article key={announcement.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                                <span className="text-[11px] font-black uppercase tracking-widest text-[#720101]">
                                    {announcementTypeLabels[announcement.type] || 'Announcement'}
                                </span>
                                <h3 className="mt-2 text-lg font-black text-[#1a1a1a]">{announcement.title}</h3>
                                <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-gray-500">
                                    {announcement.summary || announcement.body}
                                </p>
                                {announcement.cta_label && announcement.cta_url && (
                                    <Link href={announcement.cta_url} className="mt-3 inline-flex text-sm font-black text-[#720101] hover:text-[#f0aa0b]">
                                        {announcement.cta_label}
                                    </Link>
                                )}
                            </article>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

const homeMarqueeItems = [
    'Staff-reviewed availability',
    'Menu planning with clear package pricing',
    'Secure payment tracking',
    'Food tasting support',
    'Event handoff timeline',
    'Dashboard updates from booking to event day',
];

const HomeMarquee = () => {
    return (
        <section className="home-marquee border-y border-white/10 bg-[#15110f] text-white" aria-label="Planning and service assurances">
            <div className="home-marquee__viewport" tabIndex={0}>
                <div className="home-marquee__track">
                    {[0, 1].map((group) => (
                        <div key={group} className="home-marquee__group" aria-hidden={group === 1}>
                            {homeMarqueeItems.map((item) => (
                                <span key={`${group}-${item}`} className="home-marquee__item">
                                    <span className="home-marquee__dot" aria-hidden="true" />
                                    <span className="home-marquee__text">{item}</span>
                                </span>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
            <style>{`
                .home-marquee {
                    min-height: 3.15rem;
                }
                .home-marquee__viewport {
                    display: flex;
                    align-items: center;
                    min-height: 3.15rem;
                    overflow: hidden;
                    outline: none;
                }
                .home-marquee__track {
                    display: flex;
                    width: max-content;
                    animation: homeMarqueeScroll 24s linear infinite;
                    will-change: transform;
                }
                .home-marquee__viewport:hover .home-marquee__track,
                .home-marquee__viewport:focus-visible .home-marquee__track {
                    animation-play-state: paused;
                }
                .home-marquee__group {
                    display: flex;
                    flex: 0 0 auto;
                    align-items: center;
                }
                .home-marquee__item {
                    display: inline-flex;
                    align-items: center;
                    gap: .72rem;
                    padding: .78rem 1.55rem;
                    white-space: nowrap;
                    border-right: 1px solid rgba(255, 255, 255, .1);
                }
                .home-marquee__text {
                    color: rgba(255, 255, 255, .86);
                    font-size: .88rem;
                    font-weight: 800;
                    letter-spacing: .02em;
                }
                .home-marquee__dot {
                    width: .36rem;
                    height: .36rem;
                    border-radius: 999px;
                    background: #f0aa0b;
                    box-shadow: 0 0 0 .18rem rgba(240, 170, 11, .12);
                }
                @keyframes homeMarqueeScroll {
                    from { transform: translateX(0); }
                    to { transform: translateX(-50%); }
                }
                @media (max-width: 640px) {
                    .home-marquee,
                    .home-marquee__viewport {
                        min-height: 2.8rem;
                    }
                    .home-marquee__item {
                        gap: .5rem;
                        padding: .58rem 1rem;
                    }
                    .home-marquee__text {
                        font-size: .78rem;
                    }
                }
                @media (prefers-reduced-motion: reduce) {
                    .home-marquee__track {
                        animation: none;
                        transform: none;
                    }
                }
            `}</style>
        </section>
    );
};

const LandingPage = () => {
    const { user, logout } = useAuth();
    const cachedJourneyData = useMemo(() => readJourneyTrackerCache(), []);
    const [journeyData, setJourneyData] = useState(cachedJourneyData);
    const [journeyLoading, setJourneyLoading] = useState(false);
    const [announcements, setAnnouncements] = useState([]);

    useEffect(() => {
        if (user && user.role === 'Client') {
            setJourneyLoading(journeyData.bookings.length === 0);
            fetch('/api/customer/journey-tracker')
                .then(r => r.json())
                .then(data => {
                    const payload = {
                        bookings: data.bookings || [],
                        payments: data.payments || [],
                        cached_at: data.cached_at,
                    };
                    setJourneyData(payload);
                    writeJourneyTrackerCache(payload);
                })
                .catch(err => console.error(err))
                .finally(() => setJourneyLoading(false));
        } else {
            setJourneyData({ bookings: [], payments: [] });
        }
    }, [user]);

    useEffect(() => {
        let mounted = true;

        fetch('/api/announcements?limit=4')
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                if (mounted) {
                    setAnnouncements(Array.isArray(data) ? data : []);
                }
            })
            .catch(() => {
                if (mounted) setAnnouncements([]);
            });

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <div className="min-h-screen flex flex-col bg-white" style={{fontFamily:"'Inter',sans-serif"}}>
            <Head title="Eloquente Catering | Plan, Book, and Track Your Event">
                <meta name="description" content="Plan your catering event with Eloquente: check availability, build a menu, submit for review, pay securely, and track progress from your dashboard." />
            </Head>

            <ClientNavbar user={user} logout={logout} />
            <StaffPreviewBanner user={user} label="customer-facing home page" />

            {/* HERO */}
            <section className="relative flex items-center overflow-hidden bg-[#15110f]" style={{minHeight:'100vh',paddingTop: isStaffUser(user) ? 104 : 68}}>
                <img src="https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=85&w=1800" alt="Elegant catered reception service" className="absolute inset-0 w-full h-full object-cover opacity-55"/>
                <div className="absolute inset-0 bg-gradient-to-r from-[#15110f] via-[#15110f]/88 to-[#720101]/42"/>
                <div className="relative z-10 w-full max-w-7xl mx-auto grid gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.05fr_0.72fr] lg:items-end">
                    <div className="text-center lg:text-left">
                        <p className="mb-5 text-sm font-black uppercase tracking-[0.24em] text-[#f0aa0b] md:text-base" style={{opacity:0,animation:'fadeUp .6s .25s forwards'}}>Eloquente Catering Services</p>
                        <h1 className="font-display text-white leading-[1.08] mb-5" style={{fontSize:'clamp(2.6rem,6vw,5.75rem)',opacity:0,animation:'fadeUp .7s .4s forwards'}}>
                            Where great food speaks for itself
                        </h1>
                        <p className="hidden">
                            Premium catering for weddings, corporate events, and private celebrations - crafted with precision, served with heart.
                        </p>
                        <p className="text-white/85 text-base md:text-lg leading-relaxed max-w-xl mb-8 mx-auto lg:mx-0" style={{opacity:0,animation:'fadeUp .7s .55s forwards'}}>
                            Premium menus, polished setup, transparent planning, and service teams prepared for weddings, company events, and private celebrations.
                        </p>
                        <div className="flex flex-col items-center gap-3 sm:flex-row lg:items-start" style={{opacity:0,animation:'fadeUp .7s .7s forwards'}}>
                            <Link href="/book" className="bg-[#f0aa0b] hover:bg-[#d4950a] text-[#1a1a1a] font-bold py-4 px-10 rounded-full text-sm uppercase tracking-wider transition-colors shadow-lg">
                                Start Booking
                            </Link>
                            <Link href="/menu" className="rounded-full border border-white/25 px-8 py-4 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:border-[#f0aa0b] hover:text-[#f0aa0b]">
                                Browse Menu
                            </Link>
                            <Link href="/contact" className="px-2 py-4 text-sm font-bold uppercase tracking-wider text-white/75 transition-colors hover:text-[#f0aa0b]">
                                Ask a Question
                            </Link>
                        </div>
                    </div>
                    <div className="hidden lg:block" style={{opacity:0,animation:'fadeUp .8s .6s forwards'}}>
                        <div className="rounded-2xl border border-white/10 bg-[#15110f]/90 p-8 shadow-2xl shadow-black/20">
                                <p className="text-[#f0aa0b] text-xs font-black uppercase tracking-widest mb-4">Service Proof</p>
                                <div className="space-y-5">
                                    {[{n:'Events Catered',v:500,s:'+'},{n:'Happy Clients',v:420,s:'+'},{n:'Years of Excellence',v:15,s:''}].map((s,i)=>(
                                        <div key={i} className="flex items-center justify-between border-b border-white/10 pb-3">
                                            <span className="text-white text-sm">{s.n}</span>
                                            <span className="text-white font-display text-2xl font-bold"><Counter end={s.v} suffix={s.s}/></span>
                                        </div>
                                    ))}
                                </div>
                        </div>
                    </div>
                </div>
                <style>{`
                    @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
                    @keyframes dockIn { from{opacity:0;transform:translate(-10px,12px) scale(.98)} to{opacity:1;transform:translate(0,0) scale(1)} }
                    @keyframes slowZoom { from{transform:scale(1.05)} to{transform:scale(1.12)} }
                `}</style>
            </section>

            <HomeMarquee />

            <FloatingJourneyTracker bookings={journeyData.bookings} payments={journeyData.payments} loading={journeyLoading} />

            <HomepageAnnouncements announcements={announcements} />

            <section className="bg-[#fffaf3] px-5 py-14 sm:px-8">
                <div className="mx-auto max-w-7xl">
                    <Rv>
                        <div className="mb-8 max-w-2xl">
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#720101]">Choose your next step</p>
                            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-[#1a1a1a] md:text-4xl">Start where you are in the planning process.</h2>
                        </div>
                    </Rv>
                    <div className="grid gap-4 lg:grid-cols-3">
                        {[
                            ['Book an Event', 'Ready to check a date and submit your event details for review.', '/book', 'Start Booking', 'bg-[#720101] text-white'],
                            ['Browse Menu', 'Compare dishes and packages before deciding what kind of celebration you want.', '/menu', 'Browse Menu', 'bg-white text-[#720101]'],
                            ['Schedule Tasting', 'Not ready yet? Taste bestsellers and talk through your event direction first.', '/food-tasting', 'Schedule Tasting', 'bg-white text-[#720101]'],
                        ].map(([title, text, href, label, tone], index) => (
                            <Rv key={title} d={`rv-d${index + 1}`}>
                                <Link href={href} className="group flex h-full flex-col rounded-3xl border border-[#720101]/10 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f0aa0b]/20 text-sm font-black text-[#720101]">{index + 1}</span>
                                    <h3 className="mt-6 font-display text-2xl font-bold text-[#1a1a1a]">{title}</h3>
                                    <p className="mt-3 flex-1 text-sm font-medium leading-7 text-gray-600">{text}</p>
                                    <span className={`mt-6 inline-flex w-fit rounded-full px-5 py-3 text-xs font-black uppercase tracking-widest transition-colors ${tone} ${index === 0 ? 'group-hover:bg-[#5a0101]' : 'border border-[#720101]/15 group-hover:bg-[#fff7e8]'}`}>
                                        {label}
                                    </span>
                                </Link>
                            </Rv>
                        ))}
                    </div>
                </div>
            </section>

            <section className="bg-white px-5 py-20 sm:px-8">
                <div className="mx-auto grid max-w-7xl gap-8 rounded-3xl border border-[#720101]/10 bg-white lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
                    <Rv>
                        <div className="p-6 sm:p-8">
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#720101]">How booking works</p>
                            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-[#1a1a1a] md:text-4xl">A clear path from idea to booked event.</h2>
                            <p className="mt-4 text-sm font-medium leading-7 text-gray-600">
                                The same system carries you from availability and menu choices to staff review, secure payment, and dashboard tracking.
                            </p>
                        </div>
                    </Rv>
                    <div className="grid gap-3 p-6 pt-0 sm:grid-cols-2 sm:p-8 lg:grid-cols-3">
                        {[
                            ['1', 'Share the event', 'Choose occasion, date, venue, and guest estimate.'],
                            ['2', 'Shape the menu', 'Pick dishes with visible package and per-head pricing.'],
                            ['3', 'Staff review', 'Marketing confirms details or asks for missing information.'],
                            ['4', 'Secure the date', 'Pay only when a payment step is due.'],
                            ['5', 'Track progress', 'Use your dashboard for payments, messages, and updates.'],
                            ['6', 'Event day', 'Preparation notes and status stay connected to your booking.'],
                        ].map(([number, title, text]) => (
                            <div key={title} className="rounded-2xl border border-[#720101]/10 bg-[#fffaf3] p-4">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f0aa0b]/20 text-xs font-black text-[#720101]">{number}</span>
                                <h3 className="mt-4 font-display text-lg font-bold text-[#1a1a1a]">{title}</h3>
                                <p className="mt-2 text-xs font-semibold leading-5 text-gray-500">{text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* MENU AND AMENITIES */}
            <section className="py-24 bg-white overflow-hidden">
                <div className="max-w-7xl mx-auto px-5 sm:px-8">
                    <Rv><div className="mb-14 grid gap-8 lg:grid-cols-[0.75fr_1fr] lg:items-end">
                        <div>
                            <p className="text-[#720101] text-xs font-black uppercase tracking-[.22em] mb-3">Menu & Amenities</p>
                            <h2 className="font-display text-[#1a1a1a] text-3xl md:text-5xl leading-tight">Food, setup, and service planned together.</h2>
                        </div>
                        <p className="max-w-2xl text-sm font-medium leading-7 text-gray-600">
                            Browse dishes and packages, then see how service flow, buffet presentation, crew, and venue logistics support the event beyond the menu.
                        </p>
                    </div></Rv>

                    <div className="grid gap-6 lg:grid-cols-2">
                        {[
                            {title:'Budget-aware planning',text:'Set a practical range and see how menu choices, guest count, and package decisions affect the event total.',img:'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&q=80&w=900'},
                            {title:'Menus shaped around the event',text:'Build a selection that reflects the occasion, service style, and guest needs without losing pricing clarity.',img:'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=900'},
                        ].map((item,i)=>(
                            <Rv key={item.title} d={`rv-d${i+1}`}>
                                <article className="overflow-hidden rounded-3xl border border-gray-100 bg-[#faf7f2] shadow-sm">
                                    <SmartImage src={item.img} alt={item.title} aspectRatio="4 / 3" containerClassName="h-72" />
                                    <div className="p-7">
                                        <h3 className="font-display text-2xl font-bold text-[#1a1a1a]">{item.title}</h3>
                                        <p className="mt-3 text-sm font-medium leading-7 text-gray-600">{item.text}</p>
                                    </div>
                                </article>
                            </Rv>
                        ))}
                    </div>

                    <div className="mt-6 grid gap-4 lg:grid-cols-2">
                        {[
                            ['Buffet and table setup', 'Serving stations, table arrangements, and presentation details are prepared around the venue and guest flow.'],
                            ['Crew and logistics', 'Staffing, access notes, high-rise details, and cleanup expectations are checked before the event day.'],
                        ].map(([title,text],i)=>(
                            <Rv key={title} d={`rv-d${i+3}`}>
                                <div className="rounded-2xl border border-[#720101]/10 bg-white p-6 shadow-sm">
                                    <p className="text-xs font-black uppercase tracking-[.2em] text-[#f0aa0b]">Service Detail</p>
                                    <h3 className="mt-3 font-display text-xl font-bold text-[#720101]">{title}</h3>
                                    <p className="mt-2 text-sm font-medium leading-6 text-gray-600">{text}</p>
                                </div>
                            </Rv>
                        ))}
                    </div>
                    <Rv>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <Link href="/menu" className="rounded-full bg-[#720101] px-6 py-3 text-sm font-black uppercase tracking-widest text-white transition hover:bg-[#5a0101]">Browse Menu</Link>
                            <Link href="/amenities" className="rounded-full border border-[#720101]/15 bg-white px-6 py-3 text-sm font-black uppercase tracking-widest text-[#720101] transition hover:bg-[#fff7e8]">View Amenities</Link>
                        </div>
                    </Rv>
                </div>
            </section>

            {/* SERVICES - angled section */}
            <section className="clip-slant-top clip-slant-bot bg-[#faf7f2] py-32 -mt-8">
                <div className="max-w-6xl mx-auto px-5 sm:px-8">
                    <Rv><div className="text-center mb-14">
                        <p className="text-[#f0aa0b] text-xs font-bold uppercase tracking-[.2em] mb-3">Our Services</p>
                        <h2 className="font-display text-[#1a1a1a] text-3xl md:text-4xl">Events We Bring to Life</h2>
                    </div></Rv>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {[
                            {t:'Weddings',img:'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=500',d:'Elegant packages for your dream day'},
                            {t:'Corporate',img:'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=500',d:'Professional business catering'},
                            {t:'Private Parties',img:'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&q=80&w=500',d:'Celebrate personal moments in style'},
                            {t:'Debut & Baptismal',img:'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&q=80&w=500',d:'Handled with care & warmth'},
                        ].map((s,i)=>(
                            <Rv key={i} d={`rv-d${i+1}`}>
                                <div className="group rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all duration-500 cursor-pointer">
                                    <div className="relative h-52 overflow-hidden">
                                        <SmartImage src={s.img} alt={s.t} aspectRatio="1 / 1" containerClassName="h-full" className="transition-transform duration-700 group-hover:scale-110" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-[#720101]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"/>
                                        <div className="absolute bottom-0 left-0 right-0 p-5 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                                            <p className="text-white/80 text-sm">{s.d}</p>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <h3 className="font-display text-[#1a1a1a] font-bold">{s.t}</h3>
                                    </div>
                                </div>
                            </Rv>
                        ))}
                    </div>
                </div>
            </section>

            {/* TASTING SECTION */}
            <section className="py-24 bg-white relative overflow-hidden">
                <div className="max-w-6xl mx-auto px-5 sm:px-8">
                    <Rv>
                        <div className="flex flex-col md:flex-row items-center gap-12 bg-[#faf7f2] rounded-3xl p-8 md:p-12 border border-[#f0aa0b]/20 relative overflow-hidden shadow-sm">
                            <div className="absolute inset-x-0 top-0 h-1 bg-[#f0aa0b]"></div>
                            
                            <div className="flex-1 z-10">
                                <p className="text-[#720101] text-xs font-bold uppercase tracking-[.2em] mb-3">Try Before You Buy</p>
                                <h2 className="font-display text-[#1a1a1a] text-3xl md:text-4xl mb-4">Schedule a Private Food Tasting</h2>
                                <p className="text-[#1a1a1a]/60 leading-relaxed mb-8 max-w-md">
                                    Not ready to book yet? Taste bestsellers, meet the team, and talk through your event direction before submitting a full booking request.
                                </p>
                                <Link href="/food-tasting" className="bg-[#720101] hover:bg-[#5a0101] text-white font-bold py-3.5 px-8 rounded-full text-sm uppercase tracking-wider transition-all shadow-md hover:shadow-lg inline-flex items-center gap-2">
                                    Schedule Tasting
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                                </Link>
                            </div>
                            <div className="flex-1 w-full relative z-10">
                                <img src="https://images.unsplash.com/photo-1528712306091-ed0763094c98?auto=format&fit=crop&q=80&w=760" alt="Tasting plates prepared for review" className="w-full h-72 md:h-80 object-cover rounded-2xl shadow-lg border-4 border-white"/>
                                <div className="absolute -bottom-5 -left-5 bg-white p-4 rounded-xl shadow-xl flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#f0aa0b]/20 flex items-center justify-center text-[#f0aa0b]">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    </div>
                                    <div>
                                        <p className="text-[#1a1a1a] font-bold text-sm">Free for 2 Guests</p>
                                        <p className="text-[#1a1a1a]/50 text-xs">When you book an event</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Rv>
                </div>
            </section>

            {/* PRICING RULES */}
            <section className="relative overflow-hidden bg-[#15110f] py-24 text-white">
                <div className="absolute inset-x-0 top-0 h-1 bg-[#f0aa0b]"/>
                <div className="mx-auto max-w-6xl px-5 sm:px-8">
                    <Rv>
                        <div className="mb-12 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[.22em] text-[#f0aa0b]">Transparent Pricing</p>
                                <h2 className="mt-4 font-display text-3xl font-bold leading-tight md:text-5xl">Payment rules that adjust to your booking timeline.</h2>
                            </div>
                            <p className="max-w-2xl text-sm font-medium leading-7 text-white/55">
                                Payment timing follows your event date, so standard bookings and rush bookings each show the right amount due before work proceeds.
                            </p>
                        </div>
                    </Rv>

                    <div className="grid gap-5 lg:grid-cols-3">
                        {[
                            { tag: 'Standard', title: 'More than 30 days before event', amount: '10% / 70% / 20%', points: ['10% reservation fee due within 24 hours', '70% down payment due 1 month before', '20% final balance due 10 days before'], accent: 'bg-[#f0aa0b] text-[#1a1a1a]' },
                            { tag: 'Rush 1', title: '11 to 30 days before event', amount: '80% / 20%', points: ['80% combines reservation and down payment', 'Due within 24 hours to secure the date', '20% final balance due 10 days before'], accent: 'bg-white text-[#720101]' },
                            { tag: 'Rush 2', title: '10 days or less before event', amount: '100%', points: ['Full payment is required immediately', 'Due within 24 hours after booking', 'Used for urgent sourcing and final staffing'], accent: 'bg-[#720101] text-white' },
                        ].map((rule, index) => (
                            <Rv key={rule.tag} d={`rv-d${index + 1}`}>
                                <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/10 backdrop-blur transition-transform hover:-translate-y-1">
                                    <div className="mb-6 flex items-start justify-between gap-4">
                                        <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${rule.accent}`}>{rule.tag}</span>
                                        <p className="font-display text-3xl font-bold text-[#f0aa0b]">{rule.amount}</p>
                                    </div>
                                    <h3 className="font-display text-xl font-bold text-white">{rule.title}</h3>
                                    <div className="mt-6 grid gap-3">
                                        {rule.points.map((point) => (
                                            <div key={point} className="flex gap-3 rounded-xl bg-black/20 p-3">
                                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#f0aa0b]"/>
                                                <p className="text-sm font-medium leading-6 text-white/65">{point}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Rv>
                        ))}
                    </div>
                    <Rv>
                        <div className="mt-6 rounded-2xl border border-[#f0aa0b]/25 bg-[#f0aa0b]/10 p-5">
                            <p className="text-sm font-semibold leading-6 text-white/75">
                                All unpaid balances are shown in the dashboard. If dishes are changed while editing is still allowed, the system recalculates the total using current menu prices and updates only unpaid balances.
                            </p>
                        </div>
                    </Rv>
                </div>
            </section>

            {/* TESTIMONIALS */}
            <section className="bg-[#faf7f2] py-24">
                <div className="max-w-7xl mx-auto grid gap-10 px-5 sm:px-8 lg:grid-cols-[0.82fr_1.18fr]">
                    <Rv>
                        <div className="self-start">
                            <p className="text-[#720101] text-xs font-black uppercase tracking-[.22em] mb-3">Social Proof</p>
                            <h2 className="font-display text-[#1a1a1a] text-3xl md:text-5xl leading-tight">Trusted by families, planners, and teams.</h2>
                            <p className="mt-5 text-sm font-medium leading-7 text-gray-600">
                                Clients choose Eloquente for polished service, clear planning, and the confidence that event details are handled before the day begins.
                            </p>
                            <div className="mt-8 grid grid-cols-3 gap-1 overflow-hidden rounded-2xl border border-[#720101]/10 bg-[#720101]/10">
                                {[['500+','events'],['420+','clients'],['15','years']].map(([value,label])=>(
                                    <div key={label} className="bg-white p-5">
                                        <p className="font-display text-3xl font-bold text-[#720101]">{value}</p>
                                        <p className="mt-1 text-[11px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Rv>
                    <div className="grid gap-5">
                        {[
                            {name:'Maria Santos',role:'Bride - Dec 2025',text:'Eloquente made our wedding reception flawless. 350 guests served on time, every dish was incredible. Our families still talk about the lechon.'},
                            {name:'James Reyes',role:'HR Director - Accenture PH',text:"We've used them for three annual company dinners. Consistent quality, transparent pricing, and the booking system is genuinely useful."},
                            {name:'Angela Cruz',role:'Event Planner',text:"As a planner, I need reliable caterers. Eloquente's budget tool helped my client get premium food within a tight budget. Highly recommended."},
                        ].map((t,i)=>(
                            <Rv key={i} d={`rv-d${i+1}`}>
                                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#720101]/8 text-[#720101] font-bold">{t.name[0]}</div>
                                        <div>
                                            <div className="flex gap-0.5 mb-3">{[1,2,3,4,5].map(j=><svg key={j} className="w-4 h-4 text-[#f0aa0b]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>)}</div>
                                            <p className="text-sm font-medium leading-7 text-gray-600">"{t.text}"</p>
                                            <div className="mt-4">
                                                <p className="text-sm font-bold text-[#1a1a1a]">{t.name}</p>
                                                <p className="text-xs font-semibold text-gray-400">{t.role}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Rv>
                        ))}
                    </div>
                </div>
            </section>

            {/* FINAL CTA */}
            <section className="relative overflow-hidden bg-[#15110f] py-20 text-center">
                <img src="https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&q=85&w=1800" alt="Formal celebration table setup" className="absolute inset-0 h-full w-full object-cover opacity-28"/>
                <div className="absolute inset-0 bg-[#15110f]/88"/>
                <div className="absolute inset-0 bg-gradient-to-r from-[#15110f]/95 via-[#15110f]/82 to-[#15110f]/95"/>
                <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8">
                    <Rv>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f0aa0b]">Ready when you are</p>
                        <h2 className="mx-auto mt-3 max-w-4xl font-display text-white text-3xl md:text-4xl lg:text-5xl leading-tight mb-5 drop-shadow-[0_3px_14px_rgba(0,0,0,0.55)]">Let's make your next event unforgettable.</h2>
                        <p className="text-white/85 mb-10 max-w-xl mx-auto font-semibold leading-7 drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">Start with a booking request, or browse the menu first if you are still shaping the celebration.</p>
                        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                            <Link href="/book" className="bg-[#f0aa0b] hover:bg-[#d4950a] text-[#1a1a1a] font-bold py-4 px-10 rounded-full text-sm uppercase tracking-wider transition-colors shadow-lg">
                                Start Booking
                            </Link>
                            <Link href="/menu" className="rounded-full border border-white/20 px-8 py-4 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:border-[#f0aa0b] hover:text-[#f0aa0b]">
                                Browse Menu
                            </Link>
                        </div>
                    </Rv>
                </div>
            </section>

            {/*
                    <p className="text-white/20 text-xs">© 2026 Eloquente Catering Services</p>
                </div>
            </footer>}

            */}

            <Footer />
        </div>
    );
};

export default LandingPage;
