import React, { lazy, Suspense, useEffect, useState } from 'react';

const ChatBubble = lazy(() => import('./ChatBubble'));

const DeferredChatBubble = ({ user }) => {
    const [shouldLoad, setShouldLoad] = useState(false);
    const [openOnLoad, setOpenOnLoad] = useState(false);
    const [unreadTotal, setUnreadTotal] = useState(0);

    useEffect(() => {
        if (!user || shouldLoad) return undefined;

        const params = new URLSearchParams(window.location.search);
        if (params.get('chat') === 'open' || params.get('tab') === 'messages') {
            setOpenOnLoad(true);
            setShouldLoad(true);
            return undefined;
        }

        let cancelled = false;
        const fetchUnreadCount = async () => {
            try {
                const res = await fetch('/api/chat/unread-count', { headers: { Accept: 'application/json' } });
                if (!res.ok || cancelled) return;
                const data = await res.json();
                setUnreadTotal(Number(data.count || 0));
            } catch (e) {
                // Keep the launcher usable even when the badge request fails.
            }
        };

        fetchUnreadCount();
        const timer = window.setInterval(fetchUnreadCount, 120000);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [shouldLoad, user]);

    useEffect(() => {
        if (!user) return undefined;

        const handleNavigationQueryChange = (event) => {
            if (event.detail?.path && event.detail.path !== window.location.pathname) return;

            const params = event.detail?.params || Object.fromEntries(new URLSearchParams(event.detail?.search || window.location.search).entries());
            if (params.chat === 'open' || params.tab === 'messages') {
                setOpenOnLoad(true);
                setShouldLoad(true);
            }
        };

        window.addEventListener('ecs:navigation-query-change', handleNavigationQueryChange);
        window.addEventListener('popstate', handleNavigationQueryChange);
        return () => {
            window.removeEventListener('ecs:navigation-query-change', handleNavigationQueryChange);
            window.removeEventListener('popstate', handleNavigationQueryChange);
        };
    }, [user]);

    useEffect(() => {
        if (!user || shouldLoad) return undefined;

        const load = () => setShouldLoad(true);
        if ('requestIdleCallback' in window) {
            const idleId = window.requestIdleCallback(load, { timeout: 3500 });
            return () => window.cancelIdleCallback(idleId);
        }

        const timer = window.setTimeout(load, 2500);
        return () => window.clearTimeout(timer);
    }, [shouldLoad, user]);

    if (!user) return null;

    if (shouldLoad) {
        return (
            <Suspense fallback={(
                <div id="chat-bubble" className="fixed bottom-5 right-5 z-50">
                    <button
                        type="button"
                        disabled
                        className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/80 bg-[#720101] text-white opacity-80 shadow-lg shadow-slate-950/20 ring-1 ring-black/5"
                        aria-label="Opening support chat"
                    >
                        <svg className="h-5 w-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    </button>
                </div>
            )}>
                <ChatBubble user={user} openOnMount={openOnLoad} />
            </Suspense>
        );
    }

    return (
        <div id="chat-bubble" className="fixed bottom-5 right-5 z-50">
            <button
                type="button"
                onClick={() => {
                    setOpenOnLoad(true);
                    setShouldLoad(true);
                }}
                className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/80 bg-[#720101] text-white shadow-lg shadow-slate-950/20 ring-1 ring-black/5 transition-all hover:-translate-y-0.5 hover:bg-[#5a0101] focus:outline-none focus:ring-4 focus:ring-[#720101]/20"
                aria-label="Open support chat"
                title="Open support chat"
            >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {unreadTotal > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#f0aa0b] px-1 text-[10px] font-black text-[#1a1a1a] shadow-sm">
                        {unreadTotal > 99 ? '99+' : unreadTotal}
                    </span>
                )}
            </button>
        </div>
    );
};

export default DeferredChatBubble;
