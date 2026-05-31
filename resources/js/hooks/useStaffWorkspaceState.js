import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const canUseBrowserStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
const NAVIGATION_QUERY_CHANGE_EVENT = 'ecs:navigation-query-change';

const readUrlTab = () => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('tab');
};

const replaceUrlTab = (tab) => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState(window.history.state, '', url.toString());
};

const useStaffWorkspaceState = ({ storageKey, defaultTab, allowedTabs = [], tabAliases = {} }) => {
    const allowed = useMemo(() => new Set(allowedTabs), [allowedTabs]);
    const initialRenderRef = useRef(true);
    const intentionalNavigationRef = useRef(false);
    const activeTabRef = useRef(defaultTab);

    const normalizeTab = useCallback((tab) => {
        const aliased = tabAliases[tab] || tab;
        if (aliased && allowed.has(aliased)) return aliased;
        return defaultTab;
    }, [allowed, defaultTab, tabAliases]);

    const [activeTab, setActiveTabState] = useState(() => {
        const urlTab = normalizeTab(readUrlTab());
        if (urlTab !== defaultTab || readUrlTab()) return urlTab;

        if (canUseBrowserStorage()) {
            return normalizeTab(window.localStorage.getItem(`${storageKey}:tab`));
        }

        return defaultTab;
    });

    useEffect(() => {
        activeTabRef.current = activeTab;
        if (canUseBrowserStorage()) {
            window.localStorage.setItem(`${storageKey}:tab`, activeTab);
        }
        replaceUrlTab(activeTab);
    }, [activeTab, storageKey]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const handleNavigationQueryChange = (event) => {
            if (event.detail?.path && event.detail.path !== window.location.pathname) return;

            const params = event.detail?.params || Object.fromEntries(new URLSearchParams(event.detail?.search || window.location.search).entries());
            if (!params.tab) return;

            const normalized = normalizeTab(params.tab);
            intentionalNavigationRef.current = normalized !== activeTabRef.current;
            setActiveTabState(normalized);
        };

        window.addEventListener(NAVIGATION_QUERY_CHANGE_EVENT, handleNavigationQueryChange);
        window.addEventListener('popstate', handleNavigationQueryChange);
        return () => {
            window.removeEventListener(NAVIGATION_QUERY_CHANGE_EVENT, handleNavigationQueryChange);
            window.removeEventListener('popstate', handleNavigationQueryChange);
        };
    }, [normalizeTab]);

    useEffect(() => {
        if (!canUseBrowserStorage()) return undefined;

        let frame = null;
        const persistScroll = () => {
            window.localStorage.setItem(`${storageKey}:scroll:${activeTabRef.current}`, String(window.scrollY || 0));
        };
        const saveScroll = () => {
            if (frame) return;
            frame = window.requestAnimationFrame(() => {
                frame = null;
                persistScroll();
            });
        };

        window.addEventListener('scroll', saveScroll, { passive: true });
        window.addEventListener('beforeunload', persistScroll);

        return () => {
            if (frame) window.cancelAnimationFrame(frame);
            window.removeEventListener('scroll', saveScroll);
            window.removeEventListener('beforeunload', persistScroll);
        };
    }, [storageKey]);

    useEffect(() => {
        if (!canUseBrowserStorage()) return undefined;

        if (intentionalNavigationRef.current) {
            intentionalNavigationRef.current = false;
            window.localStorage.setItem(`${storageKey}:scroll:${activeTab}`, '0');
            window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
            return undefined;
        }

        const savedScroll = Number(window.localStorage.getItem(`${storageKey}:scroll:${activeTab}`) || 0);
        if (!savedScroll || initialRenderRef.current === false) {
            initialRenderRef.current = false;
            return undefined;
        }

        initialRenderRef.current = false;
        let cancelled = false;
        let attempts = 0;

        const restore = () => {
            if (cancelled) return;
            attempts += 1;
            const maxScroll = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight;
            window.scrollTo({ top: Math.min(savedScroll, Math.max(maxScroll, 0)), left: 0, behavior: 'auto' });
            if (attempts < 25) {
                window.setTimeout(() => window.requestAnimationFrame(restore), 120);
            }
        };

        window.requestAnimationFrame(restore);

        return () => {
            cancelled = true;
        };
    }, [activeTab, storageKey]);

    const setActiveTab = useCallback((nextTab) => {
        const normalized = normalizeTab(nextTab);
        intentionalNavigationRef.current = normalized !== activeTabRef.current;
        setActiveTabState(normalized);
    }, [normalizeTab]);

    return [activeTab, setActiveTab];
};

export default useStaffWorkspaceState;
