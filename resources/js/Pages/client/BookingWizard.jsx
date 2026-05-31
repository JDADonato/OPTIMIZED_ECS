import { lazy, Suspense, useEffect, useState } from 'react';
import { Head, router, Link } from '@inertiajs/react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useBookingDraft, { saveBookingDraft } from '../../hooks/useBookingDraft';
import EventIdentity from '../../Components/client/EventIdentity';
import BlueprintPanel from '../../Components/client/BlueprintPanel';
import Modal from '../../Components/common/Modal';
import ClientNavbar from '../../Components/common/ClientNavbar';
import StaffPreviewBanner from '../../Components/common/StaffPreviewBanner';
import RevealOnScroll from '../../Components/common/RevealOnScroll';
import { getCustomerSafeValidationMessage } from '../../utils/dashboardUtils';
import csrfFetch from '../../utils/csrf';
import { dashboardHrefForUser, isStaffUser } from '../../utils/dashboardLinks';

const totalSteps = 7;
const CalendarView = lazy(() => import('../../Components/client/CalendarView'));
const GuestLogistics = lazy(() => import('../../Components/client/GuestLogistics'));
const MenuBuilder = lazy(() => import('../../Components/client/MenuBuilder'));
const EventSurcharges = lazy(() => import('../../Components/client/EventSurcharges'));
const FoodTastingStep = lazy(() => import('../../Components/client/FoodTastingStep'));
const stepPreloaders = {
    2: () => import('../../Components/client/CalendarView'),
    3: () => import('../../Components/client/GuestLogistics'),
    4: () => import('../../Components/client/MenuBuilder'),
    5: () => import('../../Components/client/MenuBuilder'),
    6: () => import('../../Components/client/EventSurcharges'),
    7: () => import('../../Components/client/FoodTastingStep'),
};

const stepLabels = [
    { step: 1, label: 'Vision' },
    { step: 2, label: 'Date' },
    { step: 3, label: 'Guests' },
    { step: 4, label: 'Packages' },
    { step: 5, label: 'Menu' },
    { step: 6, label: 'Details' },
    { step: 7, label: 'Tasting' },
];

const stepMessages = {
    1: { eyebrow: 'Start with the occasion', greeting: 'What are we helping you celebrate?', sub: 'Choose the event type first. The next steps adjust around your celebration.' },
    2: { eyebrow: 'Choose the day', greeting: "Let's find your date", sub: 'Pick a date, start time, and duration. Availability checks happen here.' },
    3: { eyebrow: 'Estimate the crowd', greeting: 'Who should we prepare for?', sub: 'A close guest estimate is enough. You can refine details later.' },
    4: { eyebrow: 'Choose your package', greeting: 'Review packages for your event type', sub: 'The package options, amenities, pricing, and security terms adjust based on the event you selected.' },
    5: { eyebrow: 'Personalize the spread', greeting: 'Build a menu your guests will remember', sub: 'Choose dishes and keep an eye on the estimate in the summary.' },
    6: { eyebrow: 'Set the logistics', greeting: 'Where should the team prepare?', sub: 'Add contact and venue details so setup fees are clear before submitting.' },
    7: { eyebrow: 'Food tasting', greeting: 'Would you like to schedule a tasting?', sub: 'Choose whether you want a tasting, then submit your event plan.' },
};

const money = (value) => `₱${Number(value || 0).toLocaleString()}`;

const trackPublicFunnel = (event, payload = {}) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('ecs:funnel', { detail: { event, ...payload } }));
    window.dataLayer?.push({ event: `ecs_${event}`, ...payload });
};

const logConversionEvent = (eventName, payload = {}) => {
    csrfFetch('/api/conversion-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            event_name: eventName,
            source: 'customer_booking_wizard',
            ...payload,
        }),
    }).catch(() => {});
};

const summarizeBookingCosts = (data = {}) => {
    const baseEventCost = data.totalCost || 0;
    const serviceCharge = Math.round(baseEventCost * (data.package_service_charge_rate || 0));
    const vatFee = Math.round(baseEventCost * (data.package_vat_rate || 0));
    const locationSurcharge = ['outside-16-30', 'outside-31-50'].includes(data.venueDistance)
        ? Math.round(baseEventCost * (data.package_location_surcharge_rate || 0.20))
        : 0;
    const highRiseFee = data.isHighRise ? Math.round(baseEventCost * (data.package_floor_surcharge_rate || 0.03)) : 0;
    const decemberSurcharge = data.date && data.package_december_surcharge && new Date(data.date).getMonth() === 11
        ? data.package_december_surcharge
        : 0;
    const contingencyFee = data.package_security_type === 'contingency'
        ? Math.round((baseEventCost + serviceCharge + vatFee + locationSurcharge + highRiseFee + decemberSurcharge) * (data.package_security_rate || 0))
        : 0;
    const cashBond = data.package_security_type === 'cash_bond' ? (data.package_cash_bond || 0) : 0;
    const overtimeFee = Math.max(0, (data.duration || 4) - 4) * 5000;
    const laborSurcharge = serviceCharge + vatFee + highRiseFee + decemberSurcharge + contingencyFee + cashBond + overtimeFee;

    return {
        baseEventCost,
        serviceCharge,
        vatFee,
        locationSurcharge,
        highRiseFee,
        decemberSurcharge,
        contingencyFee,
        cashBond,
        overtimeFee,
        laborSurcharge,
        finalTotal: baseEventCost + locationSurcharge + laborSurcharge,
    };
};

const menuRowsFromBooking = (data = {}) => Object.values(data.customMenu || {})
    .flat()
    .filter(Boolean)
    .map((dish) => ({
        id: `${dish.id}-${dish.name}`,
        name: dish.name,
        included: dish.includedInPackage,
        cost: dish.includedInPackage ? 0 : Number(dish.costPerHead || dish.priceAdj || 0) * Number(data.pax || 0),
    }));

const StepFallback = () => (
    <div className="booking-step">
        <div className="booking-step-grid">
            <section className="booking-step-panel">
                <div className="h-5 w-24 animate-pulse rounded-full bg-[#720101]/10" />
                <div className="mt-4 h-10 w-4/5 animate-pulse rounded-2xl bg-[#720101]/10" />
                <div className="mt-4 h-5 w-full animate-pulse rounded-full bg-slate-200" />
                <div className="mt-2 h-5 w-2/3 animate-pulse rounded-full bg-slate-200" />
            </section>
            <section className="booking-choice-area">
                <div className="grid gap-3 sm:grid-cols-2">
                    {[0, 1, 2, 3].map((item) => (
                        <div key={item} className="h-28 animate-pulse rounded-2xl border border-[#720101]/10 bg-white">
                            <div className="h-full rounded-2xl bg-gradient-to-r from-[#fffaf3] via-white to-[#f1e5dc]" />
                        </div>
                    ))}
                </div>
            </section>
        </div>
    </div>
);

const BookingWizard = ({ initialEventTypes = [] }) => {
    const { user } = useAuth();
    const toast = useToast();
    const dashboardHref = dashboardHrefForUser(user, '/');
    const [summaryCollapsed, setSummaryCollapsed] = useState(false);
    const {
        bookingData,
        clearDraft,
        currentStep,
        handleResumeContinue,
        handleResumeStartFresh,
        resumeStep,
        setCurrentStep,
        showResumeModal,
        updateBooking,
    } = useBookingDraft(user, toast);

    const [modal, setModal] = useState({
        isOpen: false,
        type: 'info',
        title: '',
        message: '',
        onConfirm: null,
        confirmText: null,
    });
    const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
    const [reviewData, setReviewData] = useState(null);
    const [showReviewModal, setShowReviewModal] = useState(false);

    useEffect(() => {
        logConversionEvent('booking_started', {
            step: 'Vision',
            metadata: { resume_available: Boolean(resumeStep) },
        });
    }, []);

    useEffect(() => {
        logConversionEvent('booking_step_viewed', {
            step: stepLabels.find(item => item.step === currentStep)?.label || String(currentStep),
            metadata: {
                step_number: currentStep,
                event_type: bookingData.eventType || null,
                has_date: Boolean(bookingData.date),
                pax: bookingData.pax || null,
            },
        });
    }, [currentStep]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const preloadNextStep = () => {
            stepPreloaders[currentStep + 1]?.();
            if (currentStep === 1 && bookingData.eventType) {
                stepPreloaders[3]?.();
            }
        };

        if ('requestIdleCallback' in window) {
            const idleId = window.requestIdleCallback(preloadNextStep, { timeout: 1500 });
            return () => window.cancelIdleCallback?.(idleId);
        }

        const timer = window.setTimeout(preloadNextStep, 800);
        return () => window.clearTimeout(timer);
    }, [bookingData.eventType, currentStep]);

    const showModal = (type, title, message, onConfirm = null, confirmText = null) => {
        setModal({ isOpen: true, type, title, message, onConfirm, confirmText });
    };

    const closeModal = () => {
        setModal(prev => ({ ...prev, isOpen: false }));
    };

    const validateStep = (stepToValidate, dataToValidate = bookingData) => {
        if (stepToValidate === 1 && !dataToValidate.eventType) {
            showModal('error', 'Tell us the occasion', 'Choose the kind of event you are planning so we can shape the next steps around it.');
            return false;
        }

        if (stepToValidate === 1 && !String(dataToValidate.eventName || '').trim()) {
            showModal('error', 'Name your event', 'Enter an event name so you can easily track it from your dashboard.');
            return false;
        }

        if (stepToValidate === 2 && (!dataToValidate.date || !dataToValidate.time)) {
            showModal('error', 'Choose your schedule', 'Select your preferred date and start time so we can check availability for your event.');
            return false;
        }

        if (stepToValidate === 3 && (!dataToValidate.pax || dataToValidate.pax < 20)) {
            showModal('error', 'Guest count needed', 'Please enter at least 20 guests so we can price the event properly.');
            return false;
        }

        if (stepToValidate === 5) {
            const requiredCategories = ['starter', 'main', 'side', 'dessert', 'drink'];
            const categoryLabels = {
                starter: 'starter',
                main: 'main dish',
                side: 'side',
                dessert: 'dessert',
                drink: 'refreshment',
            };
            const missingCategories = requiredCategories.filter(category => !(dataToValidate.selectedDishes?.[category]?.length));
            if (missingCategories.length > 0) {
                showModal(
                    'error',
                    'Complete each menu category',
                    `Please choose at least one ${missingCategories.map(category => categoryLabels[category]).join(', ')} before continuing.`
                );
                return false;
            }
        }

        if (stepToValidate === 6 && (!dataToValidate.client_full_name || !dataToValidate.client_email || !dataToValidate.client_phone || !dataToValidate.venue_city || !dataToValidate.venue_address_line)) {
            showModal('error', 'A few details are needed', 'Complete your contact and venue details so the team knows where and how to prepare.');
            return false;
        }

        return true;
    };

    const nextStep = (skipValidation = false) => {
        if (skipValidation || validateStep(currentStep)) {
            trackPublicFunnel('booking_step_completed', { step: currentStep, next_step: Math.min(currentStep + 1, totalSteps) });
            setCurrentStep(prev => prev + 1);
        }
    };

    const prevStep = () => setCurrentStep(prev => prev - 1);

    const handleStepperClick = (targetStep) => {
        if (targetStep < currentStep) {
            setCurrentStep(targetStep);
            return;
        }

        for (let step = currentStep; step < targetStep; step += 1) {
            if (!validateStep(step)) {
                setCurrentStep(step);
                return;
            }
        }

        setCurrentStep(targetStep);
    };

    const openReviewModal = (extraData = {}) => {
        if (isSubmittingBooking) return;
        const merged = { ...bookingData, ...extraData };

        for (let step = 1; step <= 6; step += 1) {
            if (!validateStep(step, merged)) {
                setCurrentStep(step);
                return;
            }
        }

        if (merged.wantsTasting && (!merged.tasting_guest_name || !merged.tasting_guest_email || !merged.tasting_preferred_date)) {
            showModal('error', 'Missing tasting details', 'Please complete the required food tasting information.');
            setCurrentStep(7);
            return;
        }

        setReviewData(merged);
        setShowReviewModal(true);
    };

    const submitBooking = async (extraData = {}) => {
        if (isSubmittingBooking) return;
        const merged = { ...bookingData, ...extraData };

        if (!user) {
            saveBookingDraft(merged, currentStep);
            showModal('error', 'Save your event plan', 'You have already built your event plan. Create an account to save it, submit it, and continue from your dashboard.', () => router.get('/register'), 'Register Now');
            return;
        }

        const { locationSurcharge, laborSurcharge, finalTotal } = summarizeBookingCosts(merged);

        const payload = {
            user_id: user.id,
            event_date: merged.date,
            event_time: merged.time,
            event_type: merged.eventType,
            event_name: merged.eventName,
            pax: merged.pax,
            budget: merged.budget,
            dietary_notes: merged.dietaryNotes,
            package_id: String(merged.package_id || 'custom'),
            client_full_name: merged.client_full_name,
            venue_address_line: merged.venue_address_line,
            venue_street: merged.venue_street,
            venue_city: merged.venue_city,
            venue_province: merged.venue_province,
            venue_zip_code: merged.venue_zip_code,
            client_email: merged.client_email,
            client_phone: merged.client_phone,
            venue_distance: merged.venueDistance,
            is_high_rise: merged.isHighRise,
            transport_fee: locationSurcharge,
            labor_surcharge: laborSurcharge,
            total_cost: finalTotal,
            selected_menu: merged.customMenu,
        };

        setIsSubmittingBooking(true);
        try {
            await axios.post('/api/bookings', payload);

            if (merged.wantsTasting) {
                try {
                    await axios.post('/api/food-tasting', {
                        guest_name: merged.tasting_guest_name,
                        guest_email: merged.tasting_guest_email,
                        guest_phone: merged.tasting_guest_phone,
                        preferred_date: merged.tasting_preferred_date,
                        preferred_time: merged.tasting_preferred_time,
                        notes: merged.tasting_notes,
                    });
                } catch (err) {
                    console.error("Food tasting submission error:", err);
                }
            }

            clearDraft();
            setShowReviewModal(false);
            showModal(
                'success',
                'Booking Submitted',
                'Your event plan has been submitted. Open your dashboard to track approval, payments, event details, menu edits, tastings, and messages from the Eloquente team.',
                () => router.get(dashboardHref),
                'Go to Dashboard'
            );
        } catch (error) {
            console.error("Submission Error:", error);
            let errorMsg = 'An error occurred while submitting your booking. Please try again.';

            if (error.response && error.response.data) {
                const data = error.response.data;
                errorMsg = data.errors
                    ? getCustomerSafeValidationMessage(data)
                    : getCustomerSafeValidationMessage(data, data.error || data.message || errorMsg);
            }

            showModal('error', 'Booking Failed', errorMsg);
        } finally {
            setIsSubmittingBooking(false);
        }
    };

    const progressPercent = Math.round(((currentStep - 1) / (totalSteps - 1)) * 100);
    const message = stepMessages[currentStep] || stepMessages[1];

    const renderStep = () => {
        if (currentStep === 1) {
            return <EventIdentity bookingData={bookingData} updateBooking={updateBooking} onNext={nextStep} initialEventTypes={initialEventTypes} />;
        }
        if (currentStep === 2) {
            return <CalendarView bookingData={bookingData} updateBooking={updateBooking} onNext={nextStep} onBack={prevStep} />;
        }
        if (currentStep === 3) {
            return <GuestLogistics bookingData={bookingData} updateBooking={updateBooking} onNext={nextStep} onBack={prevStep} />;
        }
        if (currentStep === 4) {
            return <MenuBuilder mode="packages" bookingData={bookingData} updateBooking={updateBooking} onNext={nextStep} onBack={prevStep} />;
        }
        if (currentStep === 5) {
            return <MenuBuilder mode="menu" bookingData={bookingData} updateBooking={updateBooking} onNext={nextStep} onBack={prevStep} />;
        }
        if (currentStep === 6) {
            return <EventSurcharges bookingData={bookingData} updateBooking={updateBooking} onNext={nextStep} onBack={prevStep} user={user} />;
        }
        return <FoodTastingStep bookingData={bookingData} updateBooking={updateBooking} onReview={openReviewModal} onBack={prevStep} isSubmitting={isSubmittingBooking} />;
    };

    const reviewCosts = summarizeBookingCosts(reviewData || bookingData);
    const reviewMenuRows = menuRowsFromBooking(reviewData || bookingData);

    return (
        <div className="booking-page min-h-screen bg-[#fffaf3] font-sans text-slate-900">
            <Head title="Book Your Event | Eloquente Catering">
                <meta name="description" content="Plan your Eloquente Catering event with guided steps for event type, date availability, guests, packages, menu, logistics, and tasting." />
            </Head>
            <ClientNavbar user={user} />
            <StaffPreviewBanner user={user} label="customer-facing booking page" />

            {showResumeModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                        <div className="bg-[#720101] p-7 text-center">
                            <p className="text-[11px] font-black uppercase tracking-widest text-[#f0aa0b]">Saved progress</p>
                            <h3 className="mt-2 font-display text-xl font-bold text-white">Continue your booking?</h3>
                            <p className="mt-2 text-sm font-medium leading-6 text-white/75">You were on step {resumeStep}. You can continue from there or start fresh.</p>
                        </div>
                        <div className="space-y-3 p-5">
                            <button onClick={handleResumeContinue} className="w-full rounded-xl bg-[#720101] px-4 py-3 text-sm font-black text-white transition hover:bg-[#5a0101]">Continue Booking</button>
                            <button onClick={handleResumeStartFresh} className="w-full rounded-xl border border-[#720101]/15 bg-white px-4 py-3 text-sm font-black text-[#720101] transition hover:bg-[#fff7e8]">Start a New Booking</button>
                        </div>
                    </div>
                </div>
            )}

            {showReviewModal && reviewData && (
                <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="booking-review-modal">
                        <div className="booking-review-header">
                            <p>Final review</p>
                            <h3>Check your event plan before sending.</h3>
                            <button
                                type="button"
                                onClick={() => setShowReviewModal(false)}
                                disabled={isSubmittingBooking}
                                aria-label="Close review"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="booking-review-body custom-scrollbar">
                            <section className="booking-review-card">
                                <span>Event</span>
                                <dl>
                                    <div><dt>Type</dt><dd>{reviewData.eventType || '-'}</dd></div>
                                    <div><dt>Date</dt><dd>{reviewData.date || '-'}</dd></div>
                                    <div><dt>Time</dt><dd>{reviewData.time || '-'}</dd></div>
                                    <div><dt>Guests</dt><dd>{reviewData.pax ? `${reviewData.pax} pax` : '-'}</dd></div>
                                    <div><dt>Venue</dt><dd>{[reviewData.venue_address_line, reviewData.venue_city].filter(Boolean).join(', ') || '-'}</dd></div>
                                </dl>
                            </section>

                            <section className="booking-review-card">
                                <span>Menu</span>
                                {reviewData.package_name && (
                                    <div className="booking-review-package">
                                        <strong>{reviewData.package_name}</strong>
                                        <b>{money(reviewData.package_pricing_type === 'flat' ? reviewData.package_flat_price : (reviewData.package_base_price || 0) * (reviewData.pax || 0))}</b>
                                    </div>
                                )}
                                {reviewMenuRows.length > 0 ? (
                                    <ul className="booking-review-menu">
                                        {reviewMenuRows.map(row => (
                                            <li key={row.id}>
                                                <span>{row.name}</span>
                                                <strong>{row.included ? 'Included' : money(row.cost)}</strong>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="booking-review-muted">No dishes selected yet.</p>
                                )}
                            </section>

                            <section className="booking-review-card">
                                <span>{reviewData.wantsTasting ? 'Food tasting' : 'Food tasting skipped'}</span>
                                {reviewData.wantsTasting ? (
                                    <dl>
                                        <div><dt>Guest</dt><dd>{reviewData.tasting_guest_name || reviewData.client_full_name || '-'}</dd></div>
                                        <div><dt>Date</dt><dd>{reviewData.tasting_preferred_date || '-'}</dd></div>
                                        <div><dt>Time</dt><dd>{reviewData.tasting_preferred_time || '-'}</dd></div>
                                    </dl>
                                ) : (
                                    <p className="booking-review-muted">You can coordinate a tasting with the team later from your dashboard.</p>
                                )}
                            </section>
                        </div>

                        <div className="booking-review-footer">
                            <div>
                                <span>Estimated total</span>
                                <strong>{money(reviewCosts.finalTotal)}</strong>
                            </div>
                            <button
                                type="button"
                                onClick={() => submitBooking(reviewData)}
                                disabled={isSubmittingBooking}
                            >
                                {isSubmittingBooking ? 'Submitting...' : 'Submit Booking'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Modal
                isOpen={modal.isOpen}
                onClose={closeModal}
                title={modal.title}
                message={modal.message}
                type={modal.type}
                onConfirm={modal.onConfirm}
                confirmText={modal.confirmText}
            />

            <div className={`flex min-h-[calc(100vh-68px)] ${isStaffUser(user) ? 'pt-[104px]' : 'pt-[68px]'}`}>
                <main className="min-w-0 flex-1">
                    <RevealOnScroll className="border-b border-[#720101]/10 bg-white">
                        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div className="min-w-0">
                                    <Link href="/" className="inline-flex items-center text-xs font-black uppercase tracking-widest text-slate-400 transition hover:text-[#720101]">
                                        <span className="mr-2 text-base leading-none">&larr;</span>
                                        Home
                                    </Link>
                                    <div className="mt-3">
                                        <p className="text-[11px] font-black uppercase tracking-widest text-[#9f6500]">{message.eyebrow}</p>
                                        <h1 className="mt-1 font-display text-2xl font-bold leading-tight text-[#1a1a1a] sm:text-3xl">{message.greeting}</h1>
                                        <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-slate-500">{message.sub}</p>
                                    </div>
                                </div>

                                <div className="w-full max-w-xl lg:w-[34rem]">
                                    <div className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-400">
                                        <span>Step {currentStep} of {totalSteps}</span>
                                        <span className="text-[#720101]">{progressPercent}% complete</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-[#720101]/10">
                                        <div className="h-full rounded-full bg-[#720101] transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                                {stepLabels.map(item => {
                                    const isActive = currentStep === item.step;
                                    const isComplete = currentStep > item.step;
                                    return (
                                        <button
                                            key={item.step}
                                            type="button"
                                            onClick={() => handleStepperClick(item.step)}
                                            className={`min-w-[6rem] rounded-full border px-4 py-2 text-xs font-black transition ${
                                                isActive
                                                    ? 'border-[#720101] bg-[#720101] text-white'
                                                    : isComplete
                                                        ? 'border-[#720101]/15 bg-[#fff7e8] text-[#720101]'
                                                        : 'border-slate-200 bg-white text-slate-500 hover:border-[#720101]/20 hover:text-[#720101]'
                                            }`}
                                        >
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </RevealOnScroll>

                    <RevealOnScroll as="section" delay="rv-d1" className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
                        <div key={currentStep} className="animate-fadeIn">
                            <Suspense fallback={<StepFallback />}>
                                {renderStep()}
                            </Suspense>
                        </div>
                    </RevealOnScroll>
                </main>

                <BlueprintPanel
                    bookingData={bookingData}
                    collapsed={summaryCollapsed}
                    deferCatalog={currentStep < 4}
                    onToggle={() => setSummaryCollapsed(prev => !prev)}
                />
            </div>
        </div>
    );
};

export default BookingWizard;
