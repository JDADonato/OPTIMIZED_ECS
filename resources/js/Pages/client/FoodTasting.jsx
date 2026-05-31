import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, MessageSquareText, Phone, Utensils } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import csrfFetch from '../../utils/csrf';
import { FieldError, FormErrorSummary } from '../../Components/common/FormFeedback';
import { focusFirstInvalidField, firstErrorMessage } from '../../utils/validation';
import StaffPreviewBanner from '../../Components/common/StaffPreviewBanner';
import RevealOnScroll from '../../Components/common/RevealOnScroll';
import { dashboardHrefForUser, isStaffUser } from '../../utils/dashboardLinks';

const FoodTasting = () => {
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        guest_name: user ? user.username : '',
        guest_email: user ? user.email || '' : '',
        guest_phone: '',
        preferred_date: '',
        preferred_time: '',
        notes: '',
        website: '',
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [errors, setErrors] = useState({});
    const [scheduledTastingId, setScheduledTastingId] = useState(null);
    const dashboardHref = dashboardHrefForUser(user, '/');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (errors[e.target.name]) {
            setErrors((current) => ({ ...current, [e.target.name]: undefined }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        setErrors({});

        try {
            const response = await csrfFetch('/api/food-tasting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await response.json();

            if (response.ok) {
                setMessage({ type: 'success', text: 'Food tasting scheduled successfully.' });
                setScheduledTastingId(data.tastingId || true);
                if (!user) setFormData({ guest_name: '', guest_email: '', guest_phone: '', preferred_date: '', preferred_time: '', notes: '', website: '' });
            } else {
                const nextErrors = data.errors || {};
                setErrors(nextErrors);
                setMessage({ type: 'error', text: firstErrorMessage(nextErrors, data.message || 'We could not schedule the tasting. Please try again.') });
                focusFirstInvalidField(nextErrors);
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'We could not schedule the tasting. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f7f4ee] font-sans text-[#1a1a1a]">
            <header className="fixed top-0 z-50 w-full border-b border-[#720101]/10 bg-white/95 shadow-sm backdrop-blur">
                <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-5 sm:px-8">
                    <button onClick={() => window.history.length > 1 ? window.history.back() : router.get('/')} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-[#720101] transition-colors hover:bg-[#720101]/5">
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>
                    <div className="text-center">
                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#720101]">Food Tasting</p>
                        <p className="hidden text-xs font-semibold text-gray-500 sm:block">Schedule a tasting session before finalizing your menu</p>
                    </div>
                    <button onClick={() => router.get(user ? dashboardHref : '/')} className="rounded-full bg-[#720101] px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-[#5a0101]">
                        {user ? 'Dashboard' : 'Home'}
                    </button>
                </div>
            </header>
            <StaffPreviewBanner user={user} label="customer-facing food tasting page" />

            <main className={`mx-auto grid max-w-7xl gap-8 px-5 pb-12 ${isStaffUser(user) ? 'pt-36' : 'pt-28'} sm:px-8 lg:grid-cols-[0.9fr_1.1fr]`}>
                <RevealOnScroll as="section" className="rounded-3xl bg-[#1a1a1a] p-8 text-white shadow-xl shadow-black/10 lg:sticky lg:top-24 lg:self-start">
                    <div className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0aa0b] text-[#1a1a1a]">
                        <Utensils className="h-7 w-7" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#f0aa0b]">Food Tasting</p>
                    <h1 className="mt-3 text-4xl font-display font-bold leading-tight">Taste the menu before the event day.</h1>
                    <p className="mt-4 text-sm font-medium leading-7 text-white/65">Schedule a focused tasting session so our team can confirm flavor direction, dietary needs, and final menu notes.</p>

                    <div className="mt-8 grid gap-3">
                        {[
                            [CalendarDays, 'Pick your preferred date'],
                            [Clock, 'Choose a convenient time'],
                            [MessageSquareText, 'Share allergies and menu notes'],
                            [Phone, 'Our team confirms availability'],
                        ].map(([Icon, text]) => (
                            <div key={text} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
                                <Icon className="h-5 w-5 text-[#f0aa0b]" />
                                <span className="text-sm font-bold text-white/85">{text}</span>
                            </div>
                        ))}
                    </div>
                </RevealOnScroll>

                <RevealOnScroll as="section" delay="rv-d1" className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
                    <div className="mb-6 flex items-start justify-between gap-5">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-[#720101]">Request Session</p>
                            <h2 className="mt-1 text-2xl font-display font-bold">Schedule your tasting</h2>
                        </div>
                        {user && <button onClick={() => router.get(dashboardHref)} className="hidden rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 sm:block">Dashboard</button>}
                    </div>

                    {message && (
                        <div className={`mb-6 flex items-center gap-3 rounded-2xl p-4 text-sm font-bold ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                            <CheckCircle2 className="h-5 w-5" />
                            {message.text}
                        </div>
                    )}

                    {scheduledTastingId && user && (
                        <div className="mb-6 rounded-2xl border border-[#720101]/10 bg-[#faf7f2] p-4">
                            <p className="text-sm font-bold text-[#1a1a1a]">Your tasting request is on file. The team will confirm the schedule from the Marketing workspace.</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <button onClick={() => router.get(dashboardHref)} className="rounded-xl bg-[#720101] px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-[#5a0101]">Go to Dashboard</button>
                                <button onClick={() => router.get('/menu')} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-700 hover:bg-gray-50">Browse Menu</button>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="grid gap-5">
                        <input type="text" name="website" value={formData.website} onChange={handleChange} tabIndex="-1" autoComplete="off" className="hidden" aria-hidden="true" />
                        <FormErrorSummary errors={errors} message={Object.keys(errors).length > 0 ? firstErrorMessage(errors) : ''} />
                        <div className="grid gap-5 sm:grid-cols-2">
                            <label className="block">
                                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Name</span>
                                <input name="guest_name" required value={formData.guest_name} onChange={handleChange} className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-[#720101] focus:bg-white" />
                                <FieldError message={errors.guest_name} />
                            </label>
                            <label className="block">
                                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Email</span>
                                <input type="email" name="guest_email" required value={formData.guest_email} onChange={handleChange} className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-[#720101] focus:bg-white" />
                                <FieldError message={errors.guest_email} />
                            </label>
                            <label className="block">
                                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Phone</span>
                                <input type="tel" name="guest_phone" required value={formData.guest_phone} onChange={handleChange} className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-[#720101] focus:bg-white" />
                                <FieldError message={errors.guest_phone} />
                            </label>
                            <label className="block">
                                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Preferred Date</span>
                                <input type="date" name="preferred_date" required value={formData.preferred_date} onChange={handleChange} className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-[#720101] focus:bg-white" />
                                <FieldError message={errors.preferred_date} />
                            </label>
                            <label className="block">
                                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Preferred Time</span>
                                <input type="time" name="preferred_time" required value={formData.preferred_time} onChange={handleChange} className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-[#720101] focus:bg-white" />
                                <FieldError message={errors.preferred_time} />
                            </label>
                        </div>
                        <label className="block">
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Notes / Dietary Requirements</span>
                            <textarea name="notes" rows="5" value={formData.notes} onChange={handleChange} className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#720101] focus:bg-white" placeholder="Allergies, preferred dishes, event context, or special tasting requests." />
                            <FieldError message={errors.notes} />
                        </label>
                        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button type="button" onClick={() => router.get('/menu')} className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50">Browse Menu</button>
                            <button type="submit" disabled={loading} className="rounded-xl bg-[#720101] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#720101]/15 hover:bg-[#5a0101] disabled:opacity-60">
                                {loading ? 'Scheduling...' : 'Schedule tasting'}
                            </button>
                        </div>
                    </form>
                </RevealOnScroll>
            </main>
        </div>
    );
};

export default FoodTasting;
