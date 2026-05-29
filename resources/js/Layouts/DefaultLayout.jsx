import React, { useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { ToastProvider } from '../context/ToastContext';
import FlashToast from '../Components/common/FlashToast';
import OTPModal from '../Components/auth/OTPModal';
import DeferredChatBubble from '../Components/common/DeferredChatBubble';

/**
 * DefaultLayout — wraps every page so that FlashToast (which
 * relies on usePage()) lives inside the Inertia context tree.
 * Also provides the ToastContext for client-side toast calls.
 * Handles scroll position retention across reloads.
 */
const DefaultLayout = ({ children }) => {
    const { auth } = usePage().props;
    const user = auth?.user;
    const shouldShowChat = user?.role === 'Client';

    // Scroll position retention
    useEffect(() => {
        const SCROLL_KEY = 'ecs_scroll_pos';
        const saved = sessionStorage.getItem(SCROLL_KEY);
        if (saved) {
            try {
                const { path, y } = JSON.parse(saved);
                if (path === window.location.pathname) {
                    // Small delay to let the page render before scrolling
                    requestAnimationFrame(() => {
                        window.scrollTo(0, y);
                    });
                }
            } catch (e) { /* ignore parse errors */ }
        }

        let timer = null;
        const handleScroll = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                sessionStorage.setItem(SCROLL_KEY, JSON.stringify({
                    path: window.location.pathname,
                    y: window.scrollY,
                }));
            }, 150);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            clearTimeout(timer);
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    return (
        <ToastProvider>
            {children}
            <FlashToast />
            <OTPModal />
            {shouldShowChat && <DeferredChatBubble user={user} />}
        </ToastProvider>
    );
};

export default DefaultLayout;
