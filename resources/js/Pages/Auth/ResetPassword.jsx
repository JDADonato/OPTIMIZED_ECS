import { Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from 'lucide-react';
import AuthShell from '../../Components/auth/AuthShell';

const ResetPassword = ({ token, email: initialEmail = '' }) => {
    const { errors = {} } = usePage().props;
    const [form, setForm] = useState({ email: initialEmail, password: '', password_confirmation: '' });
    const [processing, setProcessing] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const submit = (event) => {
        event.preventDefault();
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
            <form className="space-y-5" onSubmit={submit}>
                <div>
                    <label htmlFor="email" className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Email</label>
                    <div className="auth-field">
                        <Mail className="h-5 w-5 text-slate-400" />
                        <input id="email" type="email" required className="auth-input" value={form.email} onChange={(event) => setForm(prev => ({ ...prev, email: event.target.value }))} />
                    </div>
                    {errors.email && <p className="mt-2 text-sm font-bold text-red-700">{errors.email}</p>}
                </div>
                <div>
                    <label htmlFor="password" className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">New password</label>
                    <div className="auth-field">
                        <LockKeyhole className="h-5 w-5 text-slate-400" />
                        <input id="password" type={showPassword ? 'text' : 'password'} required className="auth-input pr-11" value={form.password} onChange={(event) => setForm(prev => ({ ...prev, password: event.target.value }))} />
                        <button type="button" onClick={() => setShowPassword(prev => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 hover:bg-slate-100">
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    {errors.password && <p className="mt-2 text-sm font-bold text-red-700">{errors.password}</p>}
                </div>
                <div>
                    <label htmlFor="password_confirmation" className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Confirm password</label>
                    <div className="auth-field">
                        <LockKeyhole className="h-5 w-5 text-slate-400" />
                        <input id="password_confirmation" type="password" required className="auth-input" value={form.password_confirmation} onChange={(event) => setForm(prev => ({ ...prev, password_confirmation: event.target.value }))} />
                    </div>
                </div>
                <button type="submit" disabled={processing} className="auth-submit">
                    {processing ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Saving...</span> : 'Reset password'}
                </button>
            </form>
        </AuthShell>
    );
};

export default ResetPassword;
