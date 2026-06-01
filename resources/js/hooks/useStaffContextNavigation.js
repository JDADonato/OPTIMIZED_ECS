import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    STAFF_NAVIGATION_QUERY_CHANGE_EVENT,
    createStaffContext,
    getStaffContextSearchText,
    hasStaffContext,
    normalizeStaffContextParams,
    readStaffContextFromLocation,
    replaceStaffContextUrl,
} from '../utils/staffContext';

const EMPTY_CONTEXT = createStaffContext();

const useStaffContextNavigation = ({
    activeTab,
    setActiveTab,
    allowedTabs = [],
    tabAliases = {},
    defaultTab = 'today',
    contextTabs = [],
    onApplyContext,
    getSearchText = getStaffContextSearchText,
}) => {
    const allowed = useMemo(() => new Set(allowedTabs), [allowedTabs]);
    const contextTabSet = useMemo(() => new Set(contextTabs), [contextTabs]);
    const [staffContext, setStaffContextState] = useState(() => readStaffContextFromLocation());
    const activeTabRef = useRef(activeTab);

    useEffect(() => {
        activeTabRef.current = activeTab;
    }, [activeTab]);

    const normalizeTab = useCallback((tab) => {
        const aliased = tabAliases[tab] || tab;
        return aliased && allowed.has(aliased) ? aliased : defaultTab;
    }, [allowed, defaultTab, tabAliases]);

    const setStaffContext = useCallback((context) => {
        setStaffContextState(createStaffContext(context));
    }, []);

    const clearStaffContext = useCallback(() => {
        setStaffContextState(EMPTY_CONTEXT);
    }, []);

    const applyContextParams = useCallback((rawParams = {}) => {
        const params = normalizeStaffContextParams(rawParams);
        const targetTab = normalizeTab(params.tab || activeTabRef.current || defaultTab);
        const context = createStaffContext(params);
        const searchText = getSearchText(context);

        if (params.tab) {
            setActiveTab(targetTab);
        }

        setStaffContextState(context);
        onApplyContext?.({ params, targetTab, context, searchText });
    }, [defaultTab, getSearchText, normalizeTab, onApplyContext, setActiveTab]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const handleNavigationQueryChange = (event) => {
            if (event.detail?.path && event.detail.path !== window.location.pathname) return;
            applyContextParams(event.detail?.params || new URLSearchParams(event.detail?.search || window.location.search));
        };

        applyContextParams(new URLSearchParams(window.location.search));
        window.addEventListener(STAFF_NAVIGATION_QUERY_CHANGE_EVENT, handleNavigationQueryChange);
        window.addEventListener('popstate', handleNavigationQueryChange);

        return () => {
            window.removeEventListener(STAFF_NAVIGATION_QUERY_CHANGE_EVENT, handleNavigationQueryChange);
            window.removeEventListener('popstate', handleNavigationQueryChange);
        };
    }, [applyContextParams]);

    useEffect(() => {
        if (!hasStaffContext(staffContext)) return;
        if (contextTabSet.size === 0 || contextTabSet.has(activeTab)) return;

        setStaffContextState(EMPTY_CONTEXT);
    }, [activeTab, contextTabSet, staffContext]);

    useEffect(() => {
        replaceStaffContextUrl({ tab: activeTab, context: staffContext });
    }, [activeTab, staffContext]);

    return {
        staffContext,
        setStaffContext,
        clearStaffContext,
        hasContext: hasStaffContext(staffContext),
        contextSearchText: getSearchText(staffContext),
    };
};

export default useStaffContextNavigation;
