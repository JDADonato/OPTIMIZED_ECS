import { useEffect, useState } from 'react';
import useOnlineStatus from './useOnlineStatus';

const normalizeRealtimeState = (state) => {
    if (!state) return 'unavailable';
    if (state === 'connected') return 'live';
    if (['connecting', 'unavailable', 'initialized'].includes(state)) return 'unavailable';
    if (state === 'failed') return 'error';
    return state;
};

export default function useRealtimeStatus() {
    const online = useOnlineStatus();
    const [realtimeState, setRealtimeState] = useState(() => {
        const state = window.Echo?.connector?.pusher?.connection?.state;
        return normalizeRealtimeState(state);
    });

    useEffect(() => {
        const connection = window.Echo?.connector?.pusher?.connection;
        if (!connection?.bind) {
            setRealtimeState(online ? 'unavailable' : 'offline');
            return undefined;
        }

        const handleStateChange = (event) => {
            setRealtimeState(normalizeRealtimeState(event?.current));
        };

        setRealtimeState(normalizeRealtimeState(connection.state));
        connection.bind('state_change', handleStateChange);

        return () => {
            connection.unbind?.('state_change', handleStateChange);
        };
    }, [online]);

    if (!online) {
        return { online, realtimeState: 'offline', syncState: 'offline' };
    }

    return {
        online,
        realtimeState,
        syncState: realtimeState === 'error' ? 'error' : 'live',
    };
}
