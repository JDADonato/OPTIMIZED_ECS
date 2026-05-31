import React, { useMemo, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ClientNavbar from '../Components/common/ClientNavbar';
import Footer from '../Components/common/Footer';
import StaffPreviewBanner from '../Components/common/StaffPreviewBanner';
import RevealOnScroll from '../Components/common/RevealOnScroll';
import csrfFetch from '../utils/csrf';
import { FieldError, FormErrorSummary } from '../Components/common/FormFeedback';
import { focusFirstInvalidField } from '../utils/validation';
import { dashboardHrefForUser, isStaffUser } from '../utils/dashboardLinks';

const initialForm = (user) => ({
    full_name: user?.full_name || user?.username || '',
    email: user?.email || '',
    phone: user?.phone || '',
    event_date: '',
    pax: '',
    event_type: '',
    concern_type: user ? 'active_booking' : 'planning',
    subject: '',
    message: '',
    website: '',
});

const safeErrorMessage = (errors = {}) => {
    if (errors.email) return 'Please enter a valid email address.';
    if (errors.full_name) return 'Please enter your name.';
    if (errors.subject) return 'Please add a subject.';
    if (errors.message) return 'Please tell us what you need help with.';
    if (errors.pax) return 'Guest count must be a valid number.';
    if (errors.event_date) return 'Please choose a valid event date.';
    return 'Please review the highlighted details and try again.';
};

const fieldClass = (errors, field, extra = '') => (
    `${extra} rounded-xl border bg-gray-50 px-4 py-3 text-sm font-semibold shadow-sm transition-all focus:border-[#720101] focus:ring-[#720101] ${
        errors[field] ? 'border-[#720101] bg-red-50 ring-2 ring-[#720101]/15' : 'border-transparent'
    }`
);

const Contact = () => {
    const { user, logout } = useAuth();
    const toast = useToast();
    const [form, setForm] = useState(() => initialForm(user));
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [sentInquiryId, setSentInquiryId] = useState(null);
    const dashboardHref = dashboardHrefForUser(user, '/');
    const activeChatHref = user?.role === 'Client' ? '/dashboard/client?tab=messages' : dashboardHref;

    const canSubmit = useMemo(() => (
        form.full_name.trim() && form.email.trim() && form.subject.trim() && form.message.trim()
    ), [form]);

    const updateField = (field, value) => {
        setForm((current) => ({ ...current, [field]: value }));
        if (errors[field]) {
            setErrors((current) => ({ ...current, [field]: undefined }));
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setErrors({});

        try {
            const response = await csrfFetch('/api/contact-inquiries', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...form,
                    pax: form.pax ? Number(form.pax) : null,
                    event_date: form.event_date || null,
                }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                const result = { payload, errors: payload.errors || {}, message: safeErrorMessage(payload.errors || {}) };
                setErrors(result.errors);
                toast.error(result.message);
                focusFirstInvalidField(result.errors);
                return;
            }

            setSentInquiryId(payload.inquiry_id || true);
            toast.success('Your inquiry was sent to our planning team.');
        } catch (error) {
            toast.error('We could not send your inquiry. Please try again in a moment.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f7f4ee] font-sans">
            <Head title="Contact Eloquente Catering">
                <meta name="description" content="Contact Eloquente Catering for event planning questions, tasting requests, availability help, and catering inquiries." />
            </Head>

            <ClientNavbar user={user} logout={logout} activePath="/contact" />
            <StaffPreviewBanner user={user} label="public contact page" />
            <main className={isStaffUser(user) ? 'pt-[104px]' : 'pt-[68px]'}>
                <section className="bg-[#1a1a1a] text-white">
                    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
                        <RevealOnScroll className="max-w-4xl">
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f0aa0b]">Contact</p>
                            <h1 className="mt-4 font-display text-4xl font-bold sm:text-5xl">Start with the details. We will help shape the event.</h1>
                            <p className="mt-5 max-w-xl text-sm font-medium leading-7 text-white/60">Questions, tasting requests, event planning details, and support all start here.</p>
                        </RevealOnScroll>
                        <div className="mt-8 grid gap-3 sm:grid-cols-3">
                            {[
                                ['Office', 'Metro Manila, Philippines'],
                                ['Planning desk', 'Public inquiries are sent to Marketing'],
                                ['Active bookings', 'Use dashboard chat for faster context'],
                            ].map(([label, value], index) => (
                                <RevealOnScroll key={label} delay={`rv-d${index + 1}`} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3.5 backdrop-blur-sm">
                                    <p className="text-xs font-black uppercase tracking-widest text-[#f0aa0b]">{label}</p>
                                    <p className="mt-1.5 text-sm font-bold leading-6 text-white">{value}</p>
                                </RevealOnScroll>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[0.7fr_1.3fr]">
                    <RevealOnScroll as="aside" className="rounded-3xl bg-white p-6 shadow-sm">
                        <h2 className="font-display text-2xl font-bold text-[#1a1a1a]">Office Hours</h2>
                        <div className="mt-5 space-y-3 text-sm font-semibold text-gray-600">
                            <p>Monday to Friday: 9:00 AM - 6:00 PM</p>
                            <p>Saturday: 9:00 AM - 1:00 PM</p>
                            <p>Sunday: Closed</p>
                        </div>
                        <div className="mt-8 rounded-2xl bg-[#720101]/5 p-5">
                            <p className="text-xs font-black uppercase tracking-widest text-[#720101]">Fastest path</p>
                            <p className="mt-2 text-sm font-medium leading-6 text-gray-600">For active bookings, use dashboard chat so your event context stays attached. General planning questions can still start here.</p>
                            {user && (
                                <Link href={activeChatHref} className="mt-4 inline-flex rounded-xl bg-[#720101] px-4 py-2 text-xs font-black uppercase tracking-widest text-white">
                                    {user.role === 'Client' ? 'Open Dashboard Chat' : 'Open Dashboard'}
                                </Link>
                            )}
                        </div>
                    </RevealOnScroll>

                    <RevealOnScroll delay="rv-d1" className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
                        {sentInquiryId ? (
                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6">
                                <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Inquiry received</p>
                                <h2 className="mt-3 font-display text-2xl font-bold text-[#1a1a1a]">Our planning team has your message.</h2>
                                <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-gray-600">
                                    Marketing can now review your inquiry with the event date, guest count, and contact details you provided. If this is urgent, active clients should also send a dashboard message.
                                </p>
                                <div className="mt-6 flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setForm(initialForm(user));
                                            setSentInquiryId(null);
                                        }}
                                        className="rounded-xl border border-emerald-200 bg-white px-5 py-3 text-sm font-black text-emerald-800"
                                    >
                                        Send Another Inquiry
                                    </button>
                                    <Link href="/book" className="rounded-xl bg-[#720101] px-5 py-3 text-sm font-black text-white">
                                        Start Booking
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h2 className="font-display text-2xl font-bold text-[#1a1a1a]">Send a Planning Inquiry</h2>
                                <p className="mt-2 text-sm font-medium leading-6 text-gray-500">These details become a staff-visible inquiry so the team can follow up with the right context.</p>
                                <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                                    <input type="text" name="website" value={form.website} onChange={(e) => updateField('website', e.target.value)} tabIndex="-1" autoComplete="off" className="hidden" aria-hidden="true" />
                                    <div className="grid gap-5 sm:grid-cols-2">
                                        <div>
                                            <input required value={form.full_name} onChange={(e) => updateField('full_name', e.target.value)} className={fieldClass(errors, 'full_name', 'w-full')} placeholder="Full name" />
                                            <FieldError message={errors.full_name} />
                                        </div>
                                        <div>
                                            <input required type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} className={fieldClass(errors, 'email', 'w-full')} placeholder="Email address" />
                                            <FieldError message={errors.email} />
                                        </div>
                                    </div>
                                    <div className="grid gap-5 sm:grid-cols-3">
                                        <div>
                                            <input value={form.phone} onChange={(e) => updateField('phone', e.target.value)} className={fieldClass(errors, 'phone', 'w-full')} placeholder="Phone number" />
                                            <FieldError message={errors.phone} />
                                        </div>
                                        <div>
                                            <input type="date" value={form.event_date} onChange={(e) => updateField('event_date', e.target.value)} className={fieldClass(errors, 'event_date', 'w-full')} aria-label="Event date" />
                                            <FieldError message={errors.event_date} />
                                        </div>
                                        <div>
                                            <input type="number" min="1" value={form.pax} onChange={(e) => updateField('pax', e.target.value)} className={fieldClass(errors, 'pax', 'w-full')} placeholder="Guest count" />
                                            <FieldError message={errors.pax} />
                                        </div>
                                    </div>
                                    <div className="grid gap-5 sm:grid-cols-2">
                                        <div>
                                            <input value={form.event_type} onChange={(e) => updateField('event_type', e.target.value)} className={fieldClass(errors, 'event_type', 'w-full')} placeholder="Event type" />
                                            <FieldError message={errors.event_type} />
                                        </div>
                                        <div>
                                            <select value={form.concern_type} onChange={(e) => updateField('concern_type', e.target.value)} className={fieldClass(errors, 'concern_type', 'w-full')}>
                                                <option value="planning">Planning inquiry</option>
                                                <option value="availability">Availability</option>
                                                <option value="menu">Menu and packages</option>
                                                <option value="pricing">Pricing</option>
                                                <option value="tasting">Food tasting</option>
                                                <option value="active_booking">Active booking support</option>
                                                <option value="general">General question</option>
                                            </select>
                                            <FieldError message={errors.concern_type} />
                                        </div>
                                    </div>
                                    <div>
                                        <input required value={form.subject} onChange={(e) => updateField('subject', e.target.value)} className={fieldClass(errors, 'subject', 'w-full')} placeholder="Subject" />
                                        <FieldError message={errors.subject} />
                                    </div>
                                    <div>
                                        <textarea required rows="6" value={form.message} onChange={(e) => updateField('message', e.target.value)} className={fieldClass(errors, 'message', 'w-full resize-none')} placeholder="Tell us about your event, timeline, guest count, or question." />
                                        <FieldError message={errors.message} />
                                    </div>
                                    <FormErrorSummary errors={errors} message={Object.keys(errors).length > 0 ? safeErrorMessage(errors) : ''} />
                                    <button type="submit" disabled={!canSubmit || submitting} className="rounded-xl bg-[#720101] px-7 py-3 text-sm font-black uppercase tracking-widest text-white shadow-sm hover:bg-[#5a0101] disabled:cursor-not-allowed disabled:opacity-50">
                                        {submitting ? 'Sending...' : 'Send inquiry'}
                                    </button>
                                </form>
                            </>
                        )}
                    </RevealOnScroll>
                </section>
            </main>
            <Footer />
        </div>
    );
};

export default Contact;
