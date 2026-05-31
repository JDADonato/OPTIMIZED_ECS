import React from 'react';
import { router } from '@inertiajs/react';
import { RefreshCw, Home } from 'lucide-react';
import { reportClientError } from '../../utils/clientErrorReporter';
import { dashboardHrefForUser } from '../../utils/dashboardLinks';

class AppErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        reportClientError(error, {
            source: 'react.error-boundary',
            componentStack: errorInfo?.componentStack,
        });
    }

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        const user = this.props.auth?.user;
        const homeHref = user ? dashboardHrefForUser(user, '/') : '/';

        return (
            <main className="min-h-screen bg-[#f8f4ef] px-6 py-10 text-[#1a1a1a]">
                <section className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center">
                    <p className="text-xs font-black uppercase tracking-[0.28em] text-[#9a6a00]">Something went wrong</p>
                    <h1 className="mt-3 text-4xl font-black">This page could not finish loading.</h1>
                    <p className="mt-4 text-lg font-semibold text-slate-600">
                        Your data was not changed. Refresh the page, or return to your workspace and try again.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#8b0000] px-5 py-3 text-sm font-black text-white"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Reload page
                        </button>
                        <button
                            type="button"
                            onClick={() => router.visit(homeHref)}
                            className="inline-flex items-center gap-2 rounded-xl border border-[#ead8d8] bg-white px-5 py-3 text-sm font-black text-[#720101]"
                        >
                            <Home className="h-4 w-4" />
                            Open dashboard
                        </button>
                    </div>
                </section>
            </main>
        );
    }
}

export default AppErrorBoundary;
