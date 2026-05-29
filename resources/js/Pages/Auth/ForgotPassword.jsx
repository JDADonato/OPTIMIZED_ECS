import { Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import AuthShell from '../../Components/auth/AuthShell';

const ForgotPassword = () => {
    const { flash } = usePage().props;
    const [email, setEmail] = useState('');
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState({});

    const submit = (event) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});
        router.post('/forgot-password', { email }, {
            onError: setErrors,
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <AuthShell
            mode="login"
            compact
            simple
            brandTitle="Reset access."
            brandCopy="Request a secure link to set a new password."
            title="Forgot password"
            subtitle="Enter the email connected to your Eloquente account."
            features={[]}
            hideAuthSwitch
            footer={<Link href="/login" className="text-sm font-bold text-red-900 hover:text-amber-700">Back to sign in</Link>}
        >
            <form className="space-y-5" onSubmit={submit}>
                {flash?.message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{flash.message}</div>}
                <div>
                    <label htmlFor="email" className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Email</label>
                    <div className="auth-field">
                        <Mail className="h-5 w-5 text-slate-400" />
                        <input id="email" type="email" required className="auth-input" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
                    </div>
                    {errors.email && <p className="mt-2 text-sm font-bold text-red-700">{errors.email}</p>}
                </div>
                <button type="submit" disabled={processing} className="auth-submit">
                    {processing ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Sending...</span> : 'Send reset link'}
                </button>
            </form>
        </AuthShell>
    );
};

export default ForgotPassword;
