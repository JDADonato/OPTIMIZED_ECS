import { useState } from 'react';
import Modal from '../common/Modal';

const guestPresets = [50, 100, 150, 200, 300, 500];

const GuestLogistics = ({ bookingData, updateBooking, onNext, onBack }) => {
    const [pax, setPax] = useState(bookingData.pax || 50);
    const [dietaryNotes, setDietaryNotes] = useState(bookingData.dietaryNotes || '');
    const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    const handlePaxChange = (value) => {
        const nextPax = parseInt(value, 10) || 0;
        setPax(nextPax);
        updateBooking({ pax: nextPax });
    };

    const handleDietaryChange = (value) => {
        setDietaryNotes(value);
        updateBooking({ dietaryNotes: value });
    };

    const handleNext = () => {
        if (!pax || pax < 20) {
            setModal({
                isOpen: true,
                type: 'error',
                title: 'Guest count needed',
                message: 'Please enter at least 20 guests to continue.',
            });
            return;
        }

        if (bookingData.remainingPax && pax > bookingData.remainingPax) {
            setModal({
                isOpen: true,
                type: 'error',
                title: 'Capacity exceeded',
                message: `Only ${bookingData.remainingPax} slots are available for this date.`,
            });
            return;
        }

        updateBooking({ pax: parseInt(pax, 10), dietaryNotes });
        onNext(true);
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

            <div className="booking-single-panel booking-guests-panel">
                <div className="booking-guests-main">
                    <div>
                        <p className="booking-step-kicker">Guests</p>
                        <h2>Enter your estimated headcount.</h2>
                        <p>A close estimate is enough. You can refine the count with the team later.</p>
                    </div>

                    <div className="booking-compact-number">
                        <button type="button" onClick={() => handlePaxChange(Math.max(20, pax - 10))}>-</button>
                        <input
                            type="number"
                            min="20"
                            max={bookingData.remainingPax || 3500}
                            value={pax}
                            onChange={(event) => handlePaxChange(event.target.value)}
                            aria-label="Number of guests"
                        />
                        <button type="button" onClick={() => handlePaxChange(pax + 10)}>+</button>
                    </div>

                    <div className="booking-guest-presets">
                        {guestPresets.map((count) => (
                            <button
                                key={count}
                                type="button"
                                onClick={() => handlePaxChange(count)}
                                className={pax === count ? 'active' : ''}
                            >
                                {count}
                            </button>
                        ))}
                    </div>

                    <p className="text-sm font-semibold text-slate-500">
                        Minimum 20 guests{bookingData.remainingPax ? `. Available for this date: ${bookingData.remainingPax}.` : '.'}
                    </p>
                </div>

                <div className="booking-guests-notes">
                    <label className="booking-field-label">Dietary notes <span>Optional</span></label>
                    <textarea
                        rows="3"
                        placeholder="Allergies, halal, vegetarian options, no pork, nut-free..."
                        value={dietaryNotes}
                        onChange={(event) => handleDietaryChange(event.target.value)}
                        className="booking-input resize-none"
                    />

                    {bookingData.remainingPax && parseInt(pax, 10) > bookingData.remainingPax && (
                        <p className="booking-inline-error">Only {bookingData.remainingPax} slots are available for this date.</p>
                    )}
                </div>
            </div>

            <div className="booking-step-actions">
                <button onClick={onBack} className="booking-secondary-btn">Back</button>
                <button onClick={handleNext} className="booking-primary-btn">Continue</button>
            </div>
        </div>
    );
};

export default GuestLogistics;
