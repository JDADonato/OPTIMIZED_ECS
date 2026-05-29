import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, CreditCard, ShieldCheck, Sparkles, Utensils } from 'lucide-react';
import logoImg from '../../../images/ECS_LOGO_AUTH.png';

const featureIcons = {
    secure: ShieldCheck,
    calendar: CalendarDays,
    menu: Utensils,
    payment: CreditCard,
    check: CheckCircle2,
};

const AuthShell = ({
    mode,
    brandTitle,
    brandCopy,
    title,
    subtitle,
    features = [],
    children,
    footer,
    compact = false,
    simple = false,
    hideAuthSwitch = false,
    hideHomeLink = false,
    backLabel = 'Home',
    backHref = '/',
    onBack = null,
}) => {
    const isLogin = mode === 'login';
    const [transitionTarget, setTransitionTarget] = useState(null);
    const visualMode = transitionTarget || mode;
    const visualIsLogin = visualMode === 'login';
    const mainPadding = compact ? 'px-4 py-4 sm:px-6 lg:px-10' : 'px-4 py-8 sm:px-6 lg:px-12';
    const headerPadding = compact ? 'px-6 pb-4 pt-5 sm:px-7' : 'px-6 pb-5 pt-6 sm:px-8';
    const headingMargin = compact ? 'mt-4' : 'mt-7';
    const formPadding = compact ? 'px-6 py-4 sm:px-7' : 'px-6 py-6 sm:px-8';
    const footerPadding = compact ? 'px-6 py-4 sm:px-7' : 'px-6 py-5 sm:px-8';

    const handleAuthSwitch = (targetMode) => {
        if (targetMode === mode || transitionTarget) {
            return;
        }

        setTransitionTarget(targetMode);
        window.setTimeout(() => {
            router.visit(targetMode === 'login' ? '/login' : '/register', {
                preserveScroll: false,
                preserveState: false,
            });
        }, 360);
    };

    const backControl = (className) => {
        if (hideHomeLink) return <span />;

        const content = (
            <>
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
            </>
        );

        if (onBack) {
            return (
                <button type="button" onClick={onBack} className={className}>
                    {content}
                </button>
            );
        }

        return (
            <Link href={backHref} prefetch="mount" className={className}>
                {content}
            </Link>
        );
    };

    const authCard = (
        <section className={`auth-card auth-card-${mode} ${transitionTarget ? `auth-card-exit auth-card-exit-to-${transitionTarget}` : ''} overflow-hidden rounded-[28px] border border-white/70 bg-white/[.88] shadow-[0_24px_80px_rgba(15,23,42,.16)] backdrop-blur-xl`}>
            <div className={`border-b border-slate-200/70 ${headerPadding}`}>
                {!hideAuthSwitch && (
                    <div className="auth-switch relative grid grid-cols-2 rounded-full bg-slate-100 p-1">
                        <span className={`auth-switch-indicator ${visualIsLogin ? 'translate-x-0' : 'translate-x-full'}`} />
                        <button
                            type="button"
                            onClick={() => handleAuthSwitch('login')}
                            disabled={isLogin || Boolean(transitionTarget)}
                            className={`relative z-10 rounded-full px-4 py-2.5 text-center text-sm font-bold transition ${visualIsLogin ? 'text-white' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Sign in
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAuthSwitch('register')}
                            disabled={!isLogin || Boolean(transitionTarget)}
                            className={`relative z-10 rounded-full px-4 py-2.5 text-center text-sm font-bold transition ${!visualIsLogin ? 'text-white' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Register
                        </button>
                    </div>
                )}

                <div key={`${mode}-heading`} className={`auth-heading ${simple ? 'mt-5' : headingMargin}`}>
                    {!simple && (
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-600">
                            {isLogin ? 'Welcome back' : 'Start planning'}
                        </p>
                    )}
                    <h2 className={`${simple ? 'mt-0' : 'mt-2'} text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl`}>{title}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>
                </div>
            </div>

            <div key={mode} className={`auth-form-panel auth-form-panel-${mode} ${formPadding}`}>
                {children}
            </div>

            {footer && (
                <div className={`border-t border-slate-200/70 bg-slate-50/80 text-center ${footerPadding}`}>
                    {footer}
                </div>
            )}
        </section>
    );

    if (simple) {
        return (
            <div className={`auth-page auth-page-${mode} auth-page-simple h-screen overflow-hidden font-sans text-slate-950`}>
                <img
                    src="https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=85&w=1800"
                    alt=""
                    className={`auth-hero-image auth-hero-image-${mode} absolute inset-0 h-full w-full object-cover`}
                />
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,.96),rgba(255,250,243,.9)_46%,rgba(114,1,1,.22))]" />
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-white via-white/82 to-transparent" />

                <header className="absolute inset-x-0 top-0 z-30 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
                    {backControl("inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/75 px-4 py-2 text-sm font-bold text-slate-600 shadow-sm backdrop-blur transition hover:border-red-200 hover:text-red-900")}
                    <img src={logoImg} alt="Eloquente Catering" className="h-11 w-auto drop-shadow-sm" />
                </header>

                <main className="relative z-20 flex h-screen items-center justify-center overflow-hidden px-4 pb-6 pt-20 sm:px-6 sm:pb-7 sm:pt-20 lg:px-10">
                    <div className="w-full max-w-[460px]">
                        <div className="auth-simple-intro auth-heading mb-3 text-center">
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">Eloquente Catering</p>
                            <h1 className="mt-1.5 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{brandTitle}</h1>
                            <p className="mx-auto mt-1.5 max-w-sm text-xs font-semibold leading-5 text-slate-600 sm:text-sm">{brandCopy}</p>
                        </div>
                        {authCard}
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className={`auth-page auth-page-${mode} h-screen font-sans text-slate-950`}>
            <div className="absolute inset-0 overflow-hidden">
                <div className="auth-bg-grid" />
                <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-white/70 to-transparent" />
            </div>

            <div className="relative grid h-screen lg:grid-cols-[minmax(420px,0.9fr)_minmax(520px,1.1fr)]">
                <aside className="auth-brand-panel hidden overflow-hidden lg:flex">
                    <img
                        src="/images/hero-catering.png"
                        alt=""
                        className={`auth-hero-image auth-hero-image-${mode} absolute inset-0 h-full w-full object-cover`}
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(28,9,8,.84),rgba(127,29,29,.62)_44%,rgba(12,74,110,.38))]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_42%,transparent_0,rgba(0,0,0,.28)_52%,rgba(0,0,0,.64)_100%)]" />
                    <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/55 via-black/18 to-transparent" />

                    <div className="relative z-10 flex h-full w-full flex-col justify-between p-12">
                        {backControl("inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 backdrop-blur transition hover:bg-white/20 hover:text-white")}

                        <div className="auth-brand-copy max-w-xl">
                            <div className="mb-7 inline-flex h-10 items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 backdrop-blur">
                                <Sparkles className="h-4 w-4 text-amber-300" />
                                Eloquente Catering Services
                            </div>
                            <img src={logoImg} alt="Eloquente Catering" className="mb-8 h-20 w-auto drop-shadow-2xl" />
                            <h1 className="auth-brand-title max-w-lg text-4xl font-bold leading-tight text-white xl:text-5xl">{brandTitle}</h1>
                            <p className="auth-brand-description mt-4 max-w-md text-sm leading-6 text-white/75 xl:text-base">{brandCopy}</p>
                        </div>

                        {features.length > 0 && (
                            <div className="grid grid-cols-3 gap-3">
                                {features.map((feature) => {
                                    const Icon = featureIcons[feature.icon] || CheckCircle2;
                                    return (
                                        <div key={feature.label} className="rounded-2xl border border-white/15 bg-white/10 p-3 text-white backdrop-blur-md xl:p-4">
                                            <Icon className="mb-2 h-5 w-5 text-amber-300" />
                                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">{feature.kicker}</p>
                                            <p className="mt-1 text-sm font-bold">{feature.label}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </aside>

                <main className={`flex h-screen items-center justify-center overflow-hidden ${mainPadding}`}>
                    <div className="w-full max-w-[460px]">
                        <div className="mb-4 flex items-center justify-between lg:hidden">
                            {backControl("inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-red-900")}
                            <img src={logoImg} alt="Eloquente Catering" className="h-10 w-auto" />
                        </div>

                        {authCard}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AuthShell;
