import { useEffect, useRef } from 'react';

const getNow = () => Date.now();

export default function useSmartRefresh({
    enabled = true,
    interval = 30000,
    idleAfter = 180000,
    refresh,
    refreshOnFocus = true,
    channels = [],
    eventNames = ['.operational.resource.changed'],
    resources = [],
}) {
    const refreshRef = useRef(refresh);
    const lastInteractionRef = useRef(getNow());
    const lastRefreshRef = useRef(0);

    useEffect(() => {
        refreshRef.current = refresh;
    }, [refresh]);

    useEffect(() => {
        if (!enabled || typeof refreshRef.current !== 'function') return undefined;

        const markInteraction = () => {
            lastInteractionRef.current = getNow();
        };

        const canRefresh = () => {
            if (document.visibilityState !== 'visible') return false;
            return getNow() - lastInteractionRef.current <= idleAfter;
        };

        const runRefresh = (reason) => {
            if (!canRefresh()) return;
            lastRefreshRef.current = getNow();
            refreshRef.current({ silent: true, reason, force: reason === 'realtime' });
        };

        const handleFocus = () => {
            markInteraction();
            if (refreshOnFocus && getNow() - lastRefreshRef.current > 2500) {
                runRefresh('focus');
            }
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                markInteraction();
                runRefresh('visible');
            }
        };

        const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
        events.forEach((eventName) => window.addEventListener(eventName, markInteraction, { passive: true }));
        window.addEventListener('focus', handleFocus);
        window.addEventListener('online', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);

        const timer = window.setInterval(() => {
            runRefresh('interval');
        }, interval);

        return () => {
            window.clearInterval(timer);
            events.forEach((eventName) => window.removeEventListener(eventName, markInteraction));
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('online', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [enabled, interval, idleAfter, refreshOnFocus]);

    useEffect(() => {
        if (!enabled || !window.Echo || !Array.isArray(channels) || channels.length === 0) return undefined;

        let timer = null;
        const allowedResources = Array.isArray(resources) ? resources.filter(Boolean) : [];
        const activeEvents = Array.isArray(eventNames) && eventNames.length > 0
            ? eventNames
            : ['.operational.resource.changed'];
        const handleEvent = (event = {}) => {
            if (allowedResources.length > 0 && event.resource && !allowedResources.includes(event.resource)) {
                return;
            }

            window.clearTimeout(timer);
            timer = window.setTimeout(() => {
                refreshRef.current?.({ silent: true, reason: 'realtime', force: true });
            }, 180);
        };

        const subscriptions = [];
        channels.filter(Boolean).forEach((channelName) => {
            const channel = window.Echo.private(channelName);
            activeEvents.forEach((eventName) => {
                channel.listen(eventName, handleEvent);
                subscriptions.push({ channel, eventName });
            });
        });

        return () => {
            window.clearTimeout(timer);
            subscriptions.forEach(({ channel, eventName }) => {
                channel.stopListening?.(eventName, handleEvent);
            });
        };
    }, [
        enabled,
        JSON.stringify(channels || []),
        JSON.stringify(eventNames || []),
        JSON.stringify(resources || []),
    ]);
}
