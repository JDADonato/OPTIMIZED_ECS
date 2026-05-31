import { Link, router, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { Loader2, LockKeyhole, Mail } from 'lucide-react';
import AuthShell from '../../Components/auth/AuthShell';
import PasswordStrengthField, { PasswordMatchHint } from '../../Components/auth/PasswordStrengthField';
import { evaluatePassword } from '../../utils/passwordPolicy';

const ResetPassword = ({ token, email: initialEmail = '' }) => {
    const { errors = {} } = usePage().props;
    const [form, setForm] = useState({ email: initialEmail, password: '', password_confirmation: '' });
    const [processing, setProcessing] = useState(false);
    const [localError, setLocalError] = useState('');
    const passwordEvaluation = useMemo(() => evaluatePassword(form.password, { email: form.email }), [form.password, form.email]);

    const submit = (event) => {
        event.preventDefault();
        setLocalError('');
        if (!passwordEvaluation.valid || form.password !== form.password_confirmation) {
            setLocalError('Please complete the password requirements and confirmation before saving.');
            return;
        }
        setProcessing(true);
        router.post('/reset-password', { ...form, token }, {
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <AuthShell
            mode="login"
            compact
            simple
            brandTitle="Set a new password."
            brandCopy="Use the reset link from your email to protect your account."
            title="Reset password"
            subtitle="Choose a new password for your Eloquente account."
            features={[]}
            hideAuthSwitch
            footer={<Link href="/login" className="text-sm font-bold text-red-900 hover:text-amber-700">Back to sign in</Link>}
        >
            <form className="space-y-3.5" onSubmit={submit}>
                <div>
                    <label htmlFor="email" className="auth-label">Email</label>
                    <div className="auth-field auth-field-compact">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <input id="email" type="email" required className="auth-input" value={form.email} onChange={(event) => setForm(prev => ({ ...prev, email: event.target.value }))} />
                    </div>
                    {errors.email && <p className="mt-2 text-sm font-bold text-red-700">{errors.email}</p>}
                </div>
                <PasswordStrengthField
                    id="password"
                    name="password"
                    label="New password"
                    value={form.password}
                    email={form.email}
                    required
                    placeholder="Create password"
                    error={errors.password}
                    onChange={(value) => setForm((prev) => ({ ...prev, password: value }))}
                />
                <div>
                    <label htmlFor="password_confirmation" className="auth-label">Confirm password</label>
                    <div className="auth-field auth-field-compact">
                        <LockKeyhole className="h-4 w-4 text-slate-400" />
                        <input id="password_confirmation" type="password" required className="auth-input" value={form.password_confirmation} onChange={(event) => setForm(prev => ({ ...prev, password_confirmation: event.target.value }))} />
                    </div>
                    <PasswordMatchHint password={form.password} confirmation={form.password_confirmation} touched={Boolean(form.password_confirmation)} />
                </div>
                {localError && <div className="auth-error">{localError}</div>}
                <button type="submit" disabled={processing} className="auth-submit auth-submit-compact">
                    {processing ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Saving...</span> : 'Reset password'}
                </button>
            </form>
        </AuthShell>
    );
};

export default ResetPassword;
