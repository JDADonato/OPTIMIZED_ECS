import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import { Loader2, LockKeyhole, Mail, Phone, UserRound } from 'lucide-react';
import AuthShell from '../Components/auth/AuthShell';
import PasswordStrengthField, { PasswordMatchHint } from '../Components/auth/PasswordStrengthField';
import { evaluatePassword } from '../utils/passwordPolicy';

const Register = () => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [showTerms, setShowTerms] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [canAgree, setCanAgree] = useState(false);
    const termsRef = useRef(null);
    const passwordEvaluation = useMemo(
        () => evaluatePassword(formData.password, { username: formData.username, email: formData.email }),
        [formData.password, formData.username, formData.email],
    );

    useEffect(() => {
        if (showTerms && termsRef.current) {
            if (termsRef.current.scrollHeight <= termsRef.current.clientHeight + 5) {
                setCanAgree(true);
            }
        }
    }, [showTerms]);

    const handleTermsScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollHeight - scrollTop <= clientHeight + 5) {
            setCanAgree(true);
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (!passwordEvaluation.valid) {
            setError('Please complete the password requirements before creating your account.');
            return;
        }

        if (!agreedToTerms) {
            setError('You must agree to the Terms and Conditions to register.');
            return;
        }

        setLoading(true);

        router.post('/register', {
            username: formData.username,
            password: formData.password,
            email: formData.email,
            phone: formData.phone,
        }, {
            onError: (errors) => {
                const msg = errors.username || errors.password || errors.email || errors.phone || 'We could not create your account. Please try again.';
                setError(msg);
                setLoading(false);
            },
            onFinish: () => {
                setLoading(false);
            },
        });
    };

    return (
        <>
            <AuthShell
                mode="register"
                compact
                simple
                brandTitle="Create your client account."
                brandCopy="Save your booking draft and keep every event update in one place."
                title="Create account"
                subtitle="Enter your details to continue."
                features={[]}
                footer={(
                    <p className="text-sm text-slate-500">
                        Already have an account?{' '}
                        <Link href="/login" prefetch="mount" className="font-bold text-red-900 transition hover:text-amber-700">Sign in</Link>
                    </p>
                )}
            >
                <form className="space-y-3" onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="username" className="auth-label">Username</label>
                        <div className="auth-field auth-field-compact">
                            <UserRound className="h-4 w-4 text-slate-400" />
                            <input
                                id="username" name="username" type="text" required
                                className="auth-input"
                                placeholder="Choose a username" value={formData.username} onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label htmlFor="email" className="auth-label">Email</label>
                            <div className="auth-field auth-field-compact">
                                <Mail className="h-4 w-4 text-slate-400" />
                                <input
                                    id="email" name="email" type="email" required
                                    className="auth-input"
                                    placeholder="your@email.com" value={formData.email} onChange={handleChange}
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="phone" className="auth-label">Mobile Number</label>
                            <div className="auth-field auth-field-compact">
                                <Phone className="h-4 w-4 text-slate-400" />
                                <input
                                    id="phone" name="phone" type="tel" required
                                    className="auth-input"
                                    placeholder="09XX XXX XXXX" value={formData.phone} onChange={handleChange}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <PasswordStrengthField
                            id="password"
                            name="password"
                            label="Password"
                            value={formData.password}
                            username={formData.username}
                            email={formData.email}
                            required
                            placeholder="Create password"
                            onChange={(value) => setFormData((current) => ({ ...current, password: value }))}
                        />
                        <div>
                            <label htmlFor="confirmPassword" className="auth-label">Confirm</label>
                            <div className="auth-field auth-field-compact">
                                <LockKeyhole className="h-4 w-4 text-slate-400" />
                                <input
                                    id="confirmPassword" name="confirmPassword" type="password" required
                                    className="auth-input"
                                    placeholder="Repeat password" value={formData.confirmPassword} onChange={handleChange}
                                />
                            </div>
                            <PasswordMatchHint
                                password={formData.password}
                                confirmation={formData.confirmPassword}
                                touched={Boolean(formData.confirmPassword)}
                            />
                        </div>
                    </div>

                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 transition hover:border-red-200 hover:bg-red-50/50">
                        <input
                            id="terms" name="terms" type="checkbox"
                            checked={agreedToTerms}
                            onChange={(e) => {
                                if (e.target.checked && !canAgree) { setShowTerms(true); }
                                else { setAgreedToTerms(e.target.checked); }
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-red-900 focus:ring-red-900"
                        />
                        <span className="text-sm text-slate-600">
                            I agree to the{' '}
                            <button type="button" onClick={() => setShowTerms(true)} className="font-bold text-red-900 underline decoration-red-900/30 underline-offset-4 transition hover:text-amber-700">
                                Terms and Conditions
                            </button>
                        </span>
                    </label>

                    {error && (
                        <div className="auth-error">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit" disabled={loading}
                        className="auth-submit auth-submit-compact"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Creating account...
                            </span>
                        ) : 'Create account'}
                    </button>
                </form>
            </AuthShell>

            {showTerms && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
                    <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
                        <div className="border-b border-gray-200 p-6">
                            <h3 className="text-xl font-bold text-gray-900">Terms and Conditions</h3>
                        </div>
                        <div
                            className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-6 text-sm text-gray-700"
                            onScroll={handleTermsScroll}
                            ref={termsRef}
                        >
                            <p>Welcome to the Eloquente Catering Services Booking Portal. These terms explain how bookings, payments, service changes, and account use are handled when you plan an event with us.</p>

                            <h4 className="mt-4 text-base font-bold">1. Booking and Reservation</h4>
                            <ul className="list-disc space-y-2 pl-5">
                                <li>Bookings must meet the active lead-time, guest-count, and daily capacity rules shown in the portal.</li>
                                <li>A submitted booking remains Pending until Eloquente reviews the event date, venue logistics, menu, and service feasibility.</li>
                                <li>Your event date is secured only after the required reservation payment is completed and accepted.</li>
                            </ul>

                            <h4 className="mt-4 text-base font-bold">2. Payments</h4>
                            <ul className="list-disc space-y-2 pl-5">
                                <li>Standard bookings follow the payment schedule displayed in your dashboard. Rush bookings may require combined or full payment depending on the event date.</li>
                                <li>The reservation fee is non-refundable once accepted because it blocks capacity and starts event preparation.</li>
                                <li>Payments are recorded through the portal or approved payment channels. Digital receipts and balances are shown in your dashboard.</li>
                            </ul>

                            <h4 className="mt-4 text-base font-bold">3. Pricing and Service Fees</h4>
                            <ul className="list-disc space-y-2 pl-5">
                                <li>Final pricing depends on package, selected dishes, guest count, venue location, high-rise requirements, overtime, and approved add-ons.</li>
                                <li>Menu changes are recalculated using current menu pricing and may update unpaid balances.</li>
                                <li>Outside food, special hauling, third-party venue rules, or unusual setup requirements may add separate charges after review.</li>
                            </ul>

                            <h4 className="mt-4 text-base font-bold">4. Changes and Lock-in Periods</h4>
                            <ul className="list-disc space-y-2 pl-5">
                                <li>Core details such as date, venue, and guest count may require re-validation when changed.</li>
                                <li>Menu, logistics, and service details may be locked close to the event date to protect sourcing, staffing, and preparation quality.</li>
                                <li>Eloquente may contact you about incomplete bookings, pending payments, or required event details so you can continue planning.</li>
                            </ul>

                            <h4 className="mt-4 text-base font-bold">5. Client Responsibilities</h4>
                            <ul className="list-disc space-y-2 pl-5">
                                <li>You are responsible for accurate contact details, event schedule, venue address, guest count, dietary notes, and access requirements.</li>
                                <li>You agree to monitor your dashboard for approvals, payment deadlines, and messages from Eloquente staff.</li>
                            </ul>

                            <h4 className="mt-4 text-base font-bold">6. Cancellations and Refunds</h4>
                            <ul className="list-disc space-y-2 pl-5">
                                <li>Cancellation requests must be submitted through the portal or an approved Eloquente communication channel.</li>
                                <li>Refund eligibility depends on event date proximity, completed preparation, payment type, and any approved written agreement.</li>
                                <li>Payments may become non-refundable when cancellation is too close to the event or after materials, staffing, or services have been committed.</li>
                            </ul>

                            <h4 className="mt-4 text-base font-bold">7. Account and Data Use</h4>
                            <ul className="list-disc space-y-2 pl-5">
                                <li>Your account is used to manage bookings, messages, payments, notifications, and event records.</li>
                                <li>Keep your login details private. Eloquente may suspend access if misuse, fraud, or suspicious activity is detected.</li>
                            </ul>

                            <p className="mt-4 font-semibold text-gray-900">By clicking &quot;I Agree&quot;, you confirm that you understand and accept these terms for using the Eloquente booking portal.</p>
                        </div>
                        <div className="flex flex-col items-center justify-between gap-3 rounded-b-2xl border-t border-gray-200 bg-gray-50 p-4 sm:flex-row">
                            {!canAgree ? (
                                <div className="text-xs font-medium text-primary-600">
                                    Please scroll to the bottom to agree
                                </div>
                            ) : (
                                <div className="text-xs font-medium text-green-600">
                                    You can now agree
                                </div>
                            )}
                            <div className="flex w-full gap-3 sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => setShowTerms(false)}
                                    className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:flex-none"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={!canAgree}
                                    onClick={() => {
                                        setAgreedToTerms(true);
                                        setShowTerms(false);
                                    }}
                                    className={`flex-1 rounded-lg px-6 py-2 text-sm font-medium text-white transition sm:flex-none ${canAgree ? 'bg-red-900 shadow-md hover:bg-red-800' : 'cursor-not-allowed bg-gray-300'}`}
                                >
                                    I Agree
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Register;
