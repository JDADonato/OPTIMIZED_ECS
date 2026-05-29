import React, { useState, useRef, useEffect } from 'react';
import { usePage, router } from '@inertiajs/react';
import { useToast } from '../../context/ToastContext';
import csrfFetch from '../../utils/csrf';

const OTPModal = () => {
    const { auth } = usePage().props;
    const user = auth?.user;
    const toast = useToast();
    const [otpValues, setOtpValues] = useState(Array(6).fill(''));
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expiresAt, setExpiresAt] = useState(user?.otp_expires_at || null);
    const [resendAvailableAt, setResendAvailableAt] = useState(user?.otp_resend_available_at || null);
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const [resendSeconds, setResendSeconds] = useState(0);
    const inputRefs = useRef([]);

    // Initialize refs array
    useEffect(() => {
        inputRefs.current = inputRefs.current.slice(0, 6);
    }, []);

    useEffect(() => {
        const timer = window.setInterval(() => {
            const now = Date.now();
            setRemainingSeconds(expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000)) : 0);
            setResendSeconds(resendAvailableAt ? Math.max(0, Math.ceil((new Date(resendAvailableAt).getTime() - now) / 1000)) : 0);
        }, 1000);

        return () => window.clearInterval(timer);
    }, [expiresAt, resendAvailableAt]);

    if (!user || user.email_verified_at || user.role !== 'Client') {
        return null;
    }

    const focusInput = (index) => {
        if (inputRefs.current[index]) {
            inputRefs.current[index].focus();
        }
    };

    const handleChange = (index, value) => {
        // Only allow numbers
        if (!/^\d*$/.test(value)) return;

        const newOtpValues = [...otpValues];
        // Only take the last character if multiple are entered (except for paste)
        newOtpValues[index] = value.slice(-1);
        setOtpValues(newOtpValues);

        // If a value is entered and it's not the last box, move to the next
        if (value && index < 5) {
            focusInput(index + 1);
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
            // If backspace is pressed on an empty input, focus the previous one
            focusInput(index - 1);
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').trim();
        // Extract only numbers up to 6 digits
        const numbersOnly = pastedData.replace(/\D/g, '').slice(0, 6);
        
        if (numbersOnly) {
            const newOtpValues = [...otpValues];
            for (let i = 0; i < numbersOnly.length; i++) {
                if (i < 6) {
                    newOtpValues[i] = numbersOnly[i];
                }
            }
            setOtpValues(newOtpValues);
            
            // Focus the next empty input or the last input
            const nextIndex = Math.min(numbersOnly.length, 5);
            focusInput(nextIndex);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const fullOtp = otpValues.join('');
        if (fullOtp.length !== 6) return;

        setIsSubmitting(true);
        router.post('/verify-otp', { otp: fullOtp }, {
            onSuccess: () => {
                setIsSubmitting(false);
                toast.success('Email verified successfully!');
            },
            onError: (errors) => {
                setIsSubmitting(false);
                if (errors.otp) {
                    toast.error(errors.otp);
                }
                // Optional: Clear inputs on error to let them try again easily
                // setOtpValues(Array(6).fill(''));
                // focusInput(0);
            }
        });
    };

    const handleResend = async () => {
        const response = await csrfFetch('/resend-otp', {
            method: 'POST',
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            toast.error(payload.error || 'Please wait before requesting another code.');
            if (payload.retry_after_seconds) {
                setResendAvailableAt(new Date(Date.now() + Number(payload.retry_after_seconds) * 1000).toISOString());
            }
            return;
        }
        if (payload.expires_at) setExpiresAt(payload.expires_at);
        if (payload.retry_after_seconds) setResendAvailableAt(new Date(Date.now() + Number(payload.retry_after_seconds) * 1000).toISOString());
        toast.success('Verification code resent!');
    };

    const isComplete = otpValues.every(val => val !== '');
    const expired = expiresAt && remainingSeconds <= 0;
    const countdown = remainingSeconds > 0 ? `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}` : 'expired';

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" style={{ animation: 'fadeIn .3s ease' }}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" style={{ animation: 'imgZoomIn .35s cubic-bezier(0.22,1,0.36,1) both' }}>
                <div className="p-8 text-center bg-gradient-to-br from-[#720101] via-red-800 to-[#720101]">
                    <div className="mx-auto w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <h3 className="text-white font-display font-bold text-xl mb-2">Verify Your Email</h3>
                    <p className="text-red-100/80 text-sm">We've sent a 6-digit verification code to <br/><strong className="text-yellow-400">{user.email}</strong></p>
                    <p className="mt-3 text-xs font-bold uppercase tracking-widest text-yellow-100">Code {expired ? 'expired' : `expires in ${countdown}`}</p>
                </div>
                <div className="p-6 bg-white space-y-6 text-center">
                    {expired && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">This code has expired. Please request a new one.</p>}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
                            {otpValues.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={el => inputRefs.current[index] = el}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleChange(index, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(index, e)}
                                    className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-xl shadow-sm focus:bg-white focus:ring-2 focus:ring-[#720101] focus:border-transparent outline-none transition-all duration-200"
                                    autoComplete="off"
                                />
                            ))}
                        </div>
                        <button 
                            type="submit" 
                            disabled={isSubmitting || !isComplete || expired}
                            className="w-full py-3 px-4 rounded-xl font-bold text-white bg-[#720101] hover:bg-red-900 shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Verifying...
                                </>
                            ) : (
                                'Verify Email'
                            )}
                        </button>
                    </form>
                    <p className="text-sm text-gray-500">
                        Didn't receive the code?{' '}
                        <button type="button" disabled={resendSeconds > 0} onClick={handleResend} className="text-[#720101] font-bold hover:underline transition-colors disabled:text-gray-400 disabled:no-underline">
                            {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend Code'}
                        </button>
                    </p>
                    <p className="text-xs text-gray-400 mt-4">
                        If you need to change your email, you can <button onClick={() => router.post('/logout')} className="underline hover:text-gray-600 transition-colors">logout</button> and register again.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default OTPModal;
