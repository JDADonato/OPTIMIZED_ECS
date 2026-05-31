import { useEffect, useState } from 'react';
import axios from 'axios';
import { usePage } from '@inertiajs/react';
import { Loader2, LockKeyhole } from 'lucide-react';
import AuthShell from '../../Components/auth/AuthShell';
import PasswordStrengthField, { PasswordMatchHint } from '../../Components/auth/PasswordStrengthField';
import { useToast } from '../../context/ToastContext';
import { evaluatePassword } from '../../utils/passwordPolicy';

const dashboardForRole = (role) => {
    if (role === 'Admin') return '/dashboard/admin';
    if (role === 'Marketing') return '/dashboard/marketing';
    if (role === 'Accounting') return '/dashboard/accounting';
    return '/';
};

const authFlowDebugEnabled = import.meta.env.DEV || import.meta.env.VITE_DEBUG_AUTH_FLOW === 'true';
const authFlowDebug = (message, details = {}) => {
    if (!authFlowDebugEnabled) return;
    console.info('[auth-flow-debug]', message, details);
};

const csrfMetaState = () => {
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    return {
        tokenPresent: Boolean(token),
        tokenLength: token.length,
    };
};

const ChangeRequiredPassword = () => {
    const toast = useToast();
    const { auth } = usePage().props;
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState({});
    const [redirectTarget, setRedirectTarget] = useState(null);
    const [form, setForm] = useState({
        password: '',
        password_confirmation: '',
    });

    useEffect(() => {
        authFlowDebug('Change-required password page loaded', {
            path: window.location.pathname,
            role: auth?.user?.role,
            mustChangePassword: auth?.user?.must_change_password,
            ...csrfMetaState(),
        });
    }, [auth?.user?.must_change_password, auth?.user?.role]);

    const signOut = async () => {
        setProcessing(true);

        try {
            await axios.post('/logout');
        } catch (error) {
            // Even if the session is already stale, leave the trapped page.
        } finally {
            window.location.replace('/login');
        }
    };

    const submit = async (event) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});

        const passwordEvaluation = evaluatePassword(form.password, {
            username: auth?.user?.username,
            email: auth?.user?.email,
        });
        if (!passwordEvaluation.valid || form.password !== form.password_confirmation) {
            setErrors({
                password: !passwordEvaluation.valid ? ['Please complete the password requirements.'] : undefined,
                password_confirmation: form.password !== form.password_confirmation ? ['Passwords do not match.'] : undefined,
            });
            setProcessing(false);
            return;
        }

        try {
            authFlowDebug('Submitting required password change', {
                role: auth?.user?.role,
                ...csrfMetaState(),
            });
            const response = await axios.post('/password/change-required', form, {
                headers: {
                    Accept: 'application/json',
                },
            });
            const target = response.data?.redirect || dashboardForRole(auth?.user?.role);
            setRedirectTarget(target);
            authFlowDebug('Required password change response received', {
                status: response.status,
                redirect: target,
                role: response.data?.role,
                mustChangePassword: response.data?.must_change_password,
            });

            if (response.data?.must_change_password) {
                toast.error('Password was saved, but your account still needs a password reset. Please try signing in again.');
                return;
            }

            toast.success('Password updated.');
            authFlowDebug('Navigating after required password change', {
                redirect: target,
                currentPath: window.location.pathname,
            });
            window.location.replace(target);
            window.setTimeout(() => {
                if (window.location.pathname === '/password/change-required') {
                    authFlowDebug('Primary navigation did not leave password page; using fallback', {
                        redirect: target,
                    });
                    window.location.href = target;
                }
            }, 800);
        } catch (error) {
            const nextErrors = error.response?.data?.errors || {};
            setErrors(nextErrors);
            authFlowDebug('Required password change failed', {
                status: error.response?.status,
                message: error.message,
                hasValidationErrors: Object.keys(nextErrors).length > 0,
                ...csrfMetaState(),
            });
            toast.error(error.response?.status === 419
                ? 'Your session expired. Refresh and try again.'
                : 'Please check your new password.');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <AuthShell
            mode="login"
            compact
            simple
            brandTitle="Set your own password."
            brandCopy="For account safety, temporary staff passwords must be replaced before opening the workspace."
            title="Change password"
            subtitle="Choose a stronger password before opening your workspace."
            features={[]}
            hideAuthSwitch
            backLabel="Back to sign in"
            backHref="/login"
            onBack={signOut}
        >
            <form className="space-y-3.5" onSubmit={submit}>
                <PasswordStrengthField
                    id="password"
                    name="password"
                    label="New password"
                    value={form.password}
                    username={auth?.user?.username}
                    email={auth?.user?.email}
                    required
                    placeholder="Create password"
                    error={errors.password}
                    onChange={(value) => setForm((current) => ({ ...current, password: value }))}
                />

                <div>
                    <label htmlFor="password_confirmation" className="auth-label">Confirm password</label>
                    <div className="auth-field auth-field-compact">
                        <LockKeyhole className="h-4 w-4 text-slate-400" />
                        <input
                            id="password_confirmation"
                            type="password"
                            required
                            className="auth-input"
                            value={form.password_confirmation}
                            onChange={(event) => setForm((current) => ({ ...current, password_confirmation: event.target.value }))}
                        />
                    </div>
                    {errors.password_confirmation && <p className="mt-2 text-xs font-bold text-red-700">{errors.password_confirmation}</p>}
                    <PasswordMatchHint
                        password={form.password}
                        confirmation={form.password_confirmation}
                        touched={Boolean(form.password_confirmation)}
                    />
                </div>

                <button type="submit" disabled={processing} className="auth-submit auth-submit-compact">
                    {processing ? (
                        <span className="flex items-center justify-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Updating...
                        </span>
                    ) : 'Update password'}
                </button>

                {redirectTarget && (
                    <a
                        href={redirectTarget}
                        className="block rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-black text-amber-800 transition hover:bg-amber-100"
                    >
                        Continue to dashboard
                    </a>
                )}
            </form>
        </AuthShell>
    );
};

export default ChangeRequiredPassword;
