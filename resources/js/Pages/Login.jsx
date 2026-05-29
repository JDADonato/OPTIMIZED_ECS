import { useState } from 'react';
import { Link } from '@inertiajs/react';
import { Eye, EyeOff, Loader2, LockKeyhole, UserRound } from 'lucide-react';
import AuthShell from '../Components/auth/AuthShell';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useAuth();
    const toast = useToast();

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await login(username, password, rememberMe);

            if (!result.success) {
                setError(result.message);
                toast.error(`Sign-in issue: ${result.message}`);
                setLoading(false);
            }
        } catch (err) {
            toast.error('We could not sign you in. Please try again.');
            setLoading(false);
        }
    };

    return (
        <AuthShell
            mode="login"
            compact
            simple
            brandTitle="Welcome back."
            brandCopy="Continue managing your event details, messages, and payments."
            title="Sign in"
            subtitle="Use your account details to continue."
            features={[]}
            footer={(
                <p className="text-sm text-slate-500">
                    Do not have an account?{' '}
                    <Link href="/register" prefetch="mount" className="font-bold text-red-900 transition hover:text-amber-700">
                        Create one
                    </Link>
                </p>
            )}
        >
            <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="username" className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Username</label>
                    <div className="auth-field">
                        <UserRound className="h-5 w-5 text-slate-400" />
                        <input
                            id="username"
                            type="text"
                            required
                            className="auth-input"
                            placeholder="Enter your username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="password" className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Password</label>
                    <div className="auth-field">
                        <LockKeyhole className="h-5 w-5 text-slate-400" />
                        <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            className="auth-input pr-11"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 transition hover:border-red-200 hover:bg-red-50/50">
                    <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-red-900 focus:ring-red-900"
                    />
                    <span className="text-sm font-medium text-slate-600">Remember me for 30 days</span>
                </label>

                <div className="text-right">
                    <Link href="/forgot-password" className="text-sm font-bold text-red-900 transition hover:text-amber-700">
                        Forgot password?
                    </Link>
                </div>

                {error && (
                    <div className="auth-error">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="auth-submit"
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Signing in...
                        </span>
                    ) : 'Sign in'}
                </button>
            </form>
        </AuthShell>
    );
};

export default Login;
