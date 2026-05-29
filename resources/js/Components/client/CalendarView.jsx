import { useEffect, useMemo, useState } from 'react';
import Modal from '../common/Modal';

let disabledDateCache = null;
let disabledDatePromise = null;

const QUICK_TIMES = [
    { label: '8:00 AM', value: '08:00' },
    { label: '10:00 AM', value: '10:00' },
    { label: '12:00 PM', value: '12:00' },
    { label: '2:00 PM', value: '14:00' },
    { label: '4:00 PM', value: '16:00' },
    { label: '6:00 PM', value: '18:00' },
];

const formatDateInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const sameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const monthTitle = (date) => date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

const parseStartTime = (value) => {
    if (!value) return '';
    if (/^\d{2}:\d{2}$/.test(value)) return value;

    const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return '';

    let hour = Number(match[1]);
    const minute = match[2];
    const meridiem = match[3].toUpperCase();
    if (meridiem === 'PM' && hour !== 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;

    return `${String(hour).padStart(2, '0')}:${minute}`;
};

const nearbyAvailableDates = (baseDate, disabledSet, minDate, count = 3) => {
    const start = baseDate ? new Date(`${baseDate}T00:00:00`) : new Date(`${minDate}T00:00:00`);
    const suggestions = [];

    for (let offset = 1; offset <= 21 && suggestions.length < count; offset += 1) {
        const candidate = new Date(start);
        candidate.setDate(start.getDate() + offset);
        const value = formatDateInput(candidate);

        if (value >= minDate && !disabledSet.has(value)) {
            suggestions.push(value);
        }
    }

    return suggestions;
};

const CalendarView = ({ bookingData, updateBooking, onNext, onBack }) => {
    const [selectedDate, setSelectedDate] = useState(bookingData.date || '');
    const [selectedTime, setSelectedTime] = useState(parseStartTime(bookingData.time));
    const [duration, setDuration] = useState(bookingData.duration || 4);
    const [disabledDates, setDisabledDates] = useState(disabledDateCache || []);
    const [visibleMonth, setVisibleMonth] = useState(() => {
        const initial = bookingData.date ? new Date(`${bookingData.date}T00:00:00`) : new Date();
        initial.setDate(1);
        return initial;
    });
    const [loadingDates, setLoadingDates] = useState(!disabledDateCache);
    const [checkingAvailability, setCheckingAvailability] = useState(false);
    const [availability, setAvailability] = useState(null);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);
    const [availabilityError, setAvailabilityError] = useState('');
    const [error, setError] = useState('');
    const [suggestedDates, setSuggestedDates] = useState([]);
    const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '' });
    const isCustomTime = selectedTime && !QUICK_TIMES.some(time => time.value === selectedTime);

    useEffect(() => {
        let cancelled = false;

        if (disabledDateCache) {
            setDisabledDates(disabledDateCache);
            setLoadingDates(false);
            return;
        }

        disabledDatePromise ||= fetch('/api/bookings/disabled-dates')
            .then((res) => (res.ok ? res.json() : { disabled_dates: [] }))
            .then((data) => {
                disabledDateCache = data.disabled_dates || [];
                return disabledDateCache;
            })
            .catch(() => []);

        disabledDatePromise.then((dates) => {
            if (!cancelled) {
                setDisabledDates(dates);
                setLoadingDates(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        updateBooking({ duration });
    }, [duration]);

    const minDate = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        return formatDateInput(date);
    }, []);

    const disabledDateSet = useMemo(() => new Set(disabledDates), [disabledDates]);
    const isDateDisabled = (date) => disabledDateSet.has(date);
    const isBeforeMinDate = (date) => date < minDate;

    const calendarDays = useMemo(() => {
        const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
        const start = new Date(firstDay);
        start.setDate(firstDay.getDate() - firstDay.getDay());

        return Array.from({ length: 42 }, (_, index) => {
            const date = new Date(start);
            date.setDate(start.getDate() + index);
            const value = formatDateInput(date);
            const disabled = !sameMonth(date, visibleMonth) || isBeforeMinDate(value) || isDateDisabled(value);
            return {
                date,
                value,
                day: date.getDate(),
                isCurrentMonth: sameMonth(date, visibleMonth),
                isSelected: value === selectedDate,
                disabled,
            };
        });
    }, [visibleMonth, minDate, disabledDateSet, selectedDate]);

    const changeMonth = (direction) => {
        setVisibleMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
    };

    const formatTimeRange = (timeStr, dur = duration) => {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':').map(Number);
        const formatAMPM = (h, m) => {
            const ampm = h >= 12 ? 'PM' : 'AM';
            const hour = h % 12 || 12;
            return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
        };
        const endHours = (hours + dur) % 24;
        return `${formatAMPM(hours, minutes)} - ${formatAMPM(endHours, minutes)}`;
    };

    const formatDisplayDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const handleDateSelect = (date) => {
        if (!date || isBeforeMinDate(date) || isDateDisabled(date)) {
            setAvailability(null);
            setAvailabilityError('');
            setError('That date is unavailable. Please choose another date.');
            setSuggestedDates(nearbyAvailableDates(date || minDate, disabledDateSet, minDate));
            return;
        }
        setSelectedDate(date);
        setAvailability(null);
        setAvailabilityError('');
        setError('');
        setSuggestedDates([]);
    };

    const chooseSuggestedDate = (date) => {
        setSelectedDate(date);
        setVisibleMonth(new Date(`${date}T00:00:00`));
        setAvailability(null);
        setAvailabilityError('');
        setError('');
        setSuggestedDates([]);
    };

    useEffect(() => {
        let cancelled = false;

        if (!selectedDate || isBeforeMinDate(selectedDate) || isDateDisabled(selectedDate)) {
            setAvailability(null);
            setAvailabilityError('');
            setAvailabilityLoading(false);
            return;
        }

        setAvailabilityLoading(true);
        setAvailabilityError('');

        fetch(`/api/bookings/availability/${selectedDate}`)
            .then((response) => {
                if (!response.ok) throw new Error('Unable to check availability');
                return response.json();
            })
            .then((data) => {
                if (cancelled) return;
                setAvailability(data);
                if (data.isFull) {
                    setError('That date is unavailable. Please choose another date.');
                    setSuggestedDates(nearbyAvailableDates(selectedDate, disabledDateSet, minDate));
                } else {
                    setError('');
                    setSuggestedDates([]);
                }
            })
            .catch(() => {
                if (cancelled) return;
                setAvailability(null);
                setAvailabilityError('Availability could not be loaded. We will check again when you continue.');
            })
            .finally(() => {
                if (!cancelled) setAvailabilityLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedDate, disabledDateSet, minDate]);

    const checkAvailability = async () => {
        if (isDateDisabled(selectedDate)) return { isFull: true };
        if (availability?.date === selectedDate) return availability;
        const response = await fetch(`/api/bookings/availability/${selectedDate}`);
        if (!response.ok) throw new Error('Unable to check availability');
        return response.json();
    };

    const handleNext = async () => {
        if (!selectedDate || !selectedTime) {
            setModal({ isOpen: true, title: 'Choose date and time', message: 'Please select your event date and preferred start time.', type: 'error' });
            return;
        }

        if (error || isDateDisabled(selectedDate)) {
            setModal({ isOpen: true, title: 'Date unavailable', message: 'Please choose another event date.', type: 'error' });
            return;
        }

        setCheckingAvailability(true);
        try {
            const availability = await checkAvailability();
            if (availability.isFull) {
                setError('That date is unavailable. Please choose another date.');
                const dates = nearbyAvailableDates(selectedDate, disabledDateSet, minDate);
                setSuggestedDates(dates);
                setModal({
                    isOpen: true,
                    title: 'Date unavailable',
                    message: dates.length ? 'Please choose another event date. We also found nearby options below.' : 'Please choose another event date.',
                    type: 'error',
                });
                return;
            }

            updateBooking({
                date: selectedDate,
                time: formatTimeRange(selectedTime),
                duration,
                remainingPax: availability.remainingPax,
            });
            onNext(true);
        } catch (err) {
            setModal({ isOpen: true, title: 'Could not check date', message: 'Please try again in a moment.', type: 'error' });
        } finally {
            setCheckingAvailability(false);
        }
    };

    return (
        <div className="booking-step">
            <Modal
                isOpen={modal.isOpen}
                onClose={() => setModal({ ...modal, isOpen: false })}
                title={modal.title}
                message={modal.message}
                type={modal.type}
            />

            <div className="booking-step-grid">
                <section className="booking-step-panel">
                    <div className="booking-step-copy">
                        <p className="booking-step-kicker">Schedule</p>
                        <h2>Choose the date and service window.</h2>
                        <p>Dates need at least 7 days of notice. We will confirm availability before moving forward.</p>
                    </div>

                    <div className="booking-calendar">
                        <div className="booking-calendar-header">
                            <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">&lt;</button>
                            <strong>{monthTitle(visibleMonth)}</strong>
                            <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">&gt;</button>
                        </div>
                        <div className="booking-calendar-weekdays">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day}>{day}</span>)}
                        </div>
                        <div className="booking-calendar-grid">
                            {calendarDays.map(day => (
                                <button
                                    key={day.value}
                                    type="button"
                                    onClick={() => handleDateSelect(day.value)}
                                    disabled={day.disabled}
                                    className={`${day.isSelected ? 'booking-calendar-day-selected' : ''} ${!day.isCurrentMonth ? 'booking-calendar-day-muted' : ''}`}
                                    aria-pressed={day.isSelected}
                                >
                                    {day.day}
                                </button>
                            ))}
                        </div>
                    </div>
                    {loadingDates && <p className="mt-2 text-sm font-semibold text-slate-400">Checking calendar...</p>}
                    {error && <p className="booking-inline-error">{error}</p>}
                    {suggestedDates.length > 0 && (
                        <div className="mt-4 rounded-2xl border border-[#f0aa0b]/30 bg-[#fff7e8] p-4">
                            <p className="text-xs font-black uppercase tracking-widest text-[#720101]">Nearby available dates</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {suggestedDates.map((date) => (
                                    <button
                                        key={date}
                                        type="button"
                                        onClick={() => chooseSuggestedDate(date)}
                                        className="rounded-full border border-[#720101]/15 bg-white px-4 py-2 text-xs font-black text-[#720101] transition hover:border-[#720101] hover:bg-[#fffaf3]"
                                    >
                                        {formatDisplayDate(date)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                <section className="booking-choice-area booking-schedule-panel">
                    <div className="booking-schedule-group">
                        <p className="booking-field-label">Start time</p>
                        <p className="booking-helper-copy">Choose a common start time or set your own.</p>
                        <div className="booking-time-list">
                            {QUICK_TIMES.map((time) => (
                                <button
                                    key={time.value}
                                    type="button"
                                    onClick={() => setSelectedTime(time.value)}
                                    className={selectedTime === time.value ? 'active' : ''}
                                >
                                    {time.label}
                                </button>
                            ))}
                        </div>
                        <label className={`booking-custom-time ${isCustomTime ? 'active' : ''}`}>
                            <span>Set own time</span>
                            <input
                                type="time"
                                value={selectedTime}
                                onChange={(event) => setSelectedTime(event.target.value)}
                            />
                        </label>
                    </div>

                    <div className="booking-schedule-group">
                        <p className="booking-field-label">Service length</p>
                        <p className="booking-helper-copy">Standard service is 4 hours.</p>
                        <div className="booking-duration-list">
                            {[4, 5, 6, 7, 8].map((hours) => (
                                <button
                                    key={hours}
                                    type="button"
                                    onClick={() => setDuration(hours)}
                                    className={duration === hours ? 'active' : ''}
                                >
                                    {hours}h
                                </button>
                            ))}
                        </div>
                        {duration > 4 && <p className="mt-2 text-sm font-semibold text-slate-500">Extra service hours: PHP {((duration - 4) * 5000).toLocaleString()}</p>}
                    </div>

                    <div className="booking-summary-strip booking-schedule-summary">
                        <div className="booking-schedule-summary-copy">
                            <span>Selected schedule</span>
                            <strong>
                                {selectedDate ? formatDisplayDate(selectedDate) : 'Choose a date'} - {selectedTime ? formatTimeRange(selectedTime) : 'Choose a time'}
                            </strong>
                            <p>
                                {availabilityError
                                    || (!selectedDate
                                    ? 'Pick a date to check capacity'
                                    : availabilityLoading
                                        ? 'Checking this date...'
                                        : availability?.isFull
                                            ? 'This date is fully booked'
                                            : availability
                                                ? 'Date is available.'
                                                : 'We will verify availability before you continue.')}
                            </p>
                        </div>
                        <div className={`booking-availability-metrics ${availability?.isFull ? 'full' : availability ? 'open' : ''}`}>
                            <div>
                                <span>Slots</span>
                                <strong>{availabilityLoading ? '...' : availability ? availability.remainingEvents : '-'}</strong>
                            </div>
                            <div>
                                <span>Pax left</span>
                                <strong>{availabilityLoading ? '...' : availability ? availability.remainingPax.toLocaleString() : '-'}</strong>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            <div className="booking-step-actions">
                <button onClick={onBack} className="booking-secondary-btn">Back</button>
                <button onClick={handleNext} disabled={checkingAvailability} className="booking-primary-btn">
                    {checkingAvailability ? 'Checking...' : 'Continue'}
                </button>
            </div>
        </div>
    );
};

export default CalendarView;
