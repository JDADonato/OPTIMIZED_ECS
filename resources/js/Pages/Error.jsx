import React from 'react';
import { Link, usePage } from '@inertiajs/react';
import { ArrowLeft, Home } from 'lucide-react';
import { dashboardHrefForUser } from '../utils/dashboardLinks';

const COPY = {
    403: {
        eyebrow: 'Access blocked',
        title: 'This area is not available for your role.',
        body: 'You are signed in, but this page belongs to a different workspace. Use your dashboard to continue.',
    },
    404: {
        eyebrow: 'Page not found',
        title: 'We could not find that page.',
        body: 'The page may have moved, or the link may be out of date.',
    },
    419: {
        eyebrow: 'Session expired',
        title: 'Your session needs a refresh.',
        body: 'Reload the page and try the action again.',
    },
    429: {
        eyebrow: 'Too many attempts',
        title: 'Please slow down for a moment.',
        body: 'This action is temporarily rate-limited to protect the system.',
    },
    500: {
        eyebrow: 'Server error',
        title: 'Something failed on our side.',
        body: 'Try again in a moment. If it keeps happening, share the request reference with support.',
    },
    503: {
        eyebrow: 'Temporarily unavailable',
        title: 'The system is busy right now.',
        body: 'Try again shortly.',
    },
};

const ErrorPage = ({ status = 500, requestId = null, message = null }) => {
    const { auth } = usePage().props;
    const user = auth?.user;
    const copy = COPY[status] || COPY[500];
    const dashboardHref = user ? dashboardHrefForUser(user, '/') : '/';

    return (
        <main className="min-h-screen bg-[#f8f4ef] px-6 py-10 text-[#1a1a1a]">
            <section className="mx-auto flex min-h-[72vh] max-w-2xl flex-col justify-center">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-[#9a6a00]">{copy.eyebrow}</p>
                <h1 className="mt-3 text-4xl font-black">{copy.title}</h1>
                <p className="mt-4 text-lg font-semibold text-slate-600">{message || copy.body}</p>
                {requestId && (
                    <p className="mt-4 rounded-xl border border-[#ead8d8] bg-white px-4 py-3 text-sm font-bold text-slate-600">
                        Request reference: <span className="font-black text-[#1a1a1a]">{requestId}</span>
                    </p>
                )}
                <div className="mt-8 flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={() => window.history.back()}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#ead8d8] bg-white px-5 py-3 text-sm font-black text-[#720101]"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Go back
                    </button>
                    <Link
                        href={dashboardHref}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#8b0000] px-5 py-3 text-sm font-black text-white"
                    >
                        <Home className="h-4 w-4" />
                        {user ? 'Open dashboard' : 'Go home'}
                    </Link>
                </div>
            </section>
        </main>
    );
};

export default ErrorPage;
