import { useState, useEffect, useRef } from 'react';

const EVENT_TYPES_CACHE_KEY = 'ecs:booking:event-types';

const readCachedEventTypes = () => {
    if (typeof window === 'undefined' || !window.sessionStorage) return [];

    try {
        const cached = JSON.parse(window.sessionStorage.getItem(EVENT_TYPES_CACHE_KEY) || '[]');
        return Array.isArray(cached) ? cached : [];
    } catch (error) {
        return [];
    }
};

const writeCachedEventTypes = (eventTypes) => {
    if (typeof window === 'undefined' || !window.sessionStorage || !Array.isArray(eventTypes)) return;

    try {
        window.sessionStorage.setItem(EVENT_TYPES_CACHE_KEY, JSON.stringify(eventTypes));
    } catch (error) {
        // Cache failures should never block booking.
    }
};

const EventIdentity = ({ bookingData, updateBooking, onNext, onBack, initialEventTypes = [] }) => {
    const hydratedEventTypes = Array.isArray(initialEventTypes) ? initialEventTypes : [];
    const cachedEventTypes = hydratedEventTypes.length ? [] : readCachedEventTypes();
    const initialTypes = hydratedEventTypes.length ? hydratedEventTypes : cachedEventTypes;
    const [selected, setSelected] = useState(bookingData.eventType || '');
    const [eventName, setEventName] = useState(bookingData.eventName || '');
    const [eventTypes, setEventTypes] = useState(initialTypes);
    const [loading, setLoading] = useState(initialTypes.length === 0);
    const [attemptedNext, setAttemptedNext] = useState(false);
    const eventNameRef = useRef(null);

    useEffect(() => {
        if (hydratedEventTypes.length) {
            setEventTypes(hydratedEventTypes);
            setLoading(false);
            writeCachedEventTypes(hydratedEventTypes);
            return;
        }

        if (cachedEventTypes.length) {
            setEventTypes(cachedEventTypes);
            setLoading(false);
        }

        fetch('/api/event-types?per_page=50')
            .then(res => res.json())
            .then(data => {
                const nextEventTypes = Array.isArray(data.data) ? data.data : [];
                setEventTypes(nextEventTypes);
                writeCachedEventTypes(nextEventTypes);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching event types:', err);
                setLoading(false);
            });
    }, [hydratedEventTypes.length]);

    const handleSelect = (eventType) => {
        setSelected(eventType.label);
        updateBooking({
            eventType: eventType.label,
            eventTypeSlug: eventType.slug,
            package_category: eventType.package_category || 'standard',
            event_applicable_setups: eventType.applicable_setups || [],
            event_security_type: eventType.security_type,
            event_security_label: eventType.security_label,
            event_security_description: eventType.security_description,
        });
    };

    const handleNext = () => {
        setAttemptedNext(true);

        if (!eventName.trim()) {
            eventNameRef.current?.focus();
            return;
        }

        if (!selected) return;

        updateBooking({ eventType: selected, eventName: eventName.trim() });
        onNext(true);
    };

    const selectedEventType = eventTypes.find((eventType) => eventType.label === selected);
    const selectedSetups = selectedEventType?.applicable_setups || bookingData.event_applicable_setups || [];
    const showNameError = attemptedNext && !eventName.trim();
    const showTypeError = attemptedNext && !selected;

    return (
        <div className="booking-step">
            <div className="booking-step-grid">
                <section className="booking-step-panel">
                    <div className="booking-step-copy">
                        <p className="booking-step-kicker">Occasion</p>
                        <h2>Start with the celebration.</h2>
                        <p>Pick the closest event type and give the event a clear name so it is easy to track from your dashboard.</p>
                    </div>

                    <label htmlFor="eventName" className="booking-field-label">Event name</label>
                    <input
                        ref={eventNameRef}
                        id="eventName"
                        type="text"
                        required
                        value={eventName}
                        onChange={(event) => {
                            setEventName(event.target.value);
                            updateBooking({ eventName: event.target.value });
                        }}
                        placeholder="e.g. Ana and Miguel's wedding"
                        className={`booking-input ${showNameError ? 'border-red-300 ring-4 ring-red-100' : ''}`}
                        aria-invalid={showNameError}
                        aria-describedby={showNameError ? 'eventNameHelp' : undefined}
                    />
                    {showNameError && (
                        <p id="eventNameHelp" className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                            Please enter an event name before continuing. This is how the booking will appear in your dashboard.
                        </p>
                    )}
                </section>

                <section className="booking-choice-area">
                    {showTypeError && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                            Please choose the event type closest to your celebration.
                        </div>
                    )}
                    {loading ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {[0, 1, 2, 3].map((item) => (
                                <div key={item} className="h-28 animate-pulse rounded-2xl border border-[#720101]/10 bg-white">
                                    <div className="h-full rounded-2xl bg-gradient-to-r from-[#fffaf3] via-white to-[#f1e5dc]" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="booking-event-grid">
                            {eventTypes.map((eventType) => {
                                const isSelected = selected === eventType.label;
                                return (
                                    <button
                                        key={eventType.id}
                                        type="button"
                                        onClick={() => handleSelect(eventType)}
                                        className={`booking-event-option ${isSelected ? 'booking-event-option-active' : ''}`}
                                    >
                                        <span className="booking-event-image" style={{ backgroundImage: `url(${eventType.image})` }} />
                                        <span className="booking-event-content">
                                            <strong>{eventType.label}</strong>
                                            <small>{eventType.description}</small>
                                        </span>
                                        {isSelected && <span className="booking-selected-dot">Selected</span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {selectedEventType && selectedSetups.length > 0 && (
                        <div className="booking-event-inclusions">
                            <div>
                                <p className="booking-step-kicker">Included setup</p>
                                <h3>{selectedEventType.label} includes</h3>
                            </div>
                            <ul>
                                {selectedSetups.map((item) => (
                                    <li key={item}>{item}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </section>
            </div>

            <div className="booking-step-actions">
                {onBack ? (
                    <button onClick={onBack} className="booking-secondary-btn">Back</button>
                ) : <span />}
                <button onClick={handleNext} className="booking-primary-btn">
                    Continue
                </button>
            </div>
        </div>
    );
};

export default EventIdentity;
