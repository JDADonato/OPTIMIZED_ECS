import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import useSmartRefresh from '../../hooks/useSmartRefresh';
import useRealtimeStatus from '../../hooks/useRealtimeStatus';
import ConfirmModal from './ConfirmModal';
import { LiveSyncIndicator, SoftRefreshBoundary } from './LiveFeedback';
import { customerBookingStatus } from '../../utils/statusLabels';
import csrfFetch from '../../utils/csrf';
import { operationalChannelsForUser } from '../../utils/liveChannels';
import { getChatModerationFeedback, getChatModerationIssue } from '../../utils/chatModeration';

const CHAT_CACHE_TTL_MS = 60000;
const BOOKING_CACHE_TTL_MS = 180000;
const createClientTempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const localTimeLabel = (date = new Date()) => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const sortMessagesOldestFirst = (items = []) => [...items].sort((a, b) => {
    const left = Number(a.id) || new Date(a.created_at || 0).getTime();
    const right = Number(b.id) || new Date(b.created_at || 0).getTime();
    return left - right;
});

const ChatBubble = ({ user, openOnMount = false }) => {
    const hasRealtime = typeof window !== 'undefined' && Boolean(window.Echo);
    const { syncState: realtimeSyncState } = useRealtimeStatus();
    const liveChannels = useMemo(() => operationalChannelsForUser(user), [user?.id, user?.role]);
    const [isOpen, setIsOpen] = useState(Boolean(openOnMount));
    const [conversation, setConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [unreadTotal, setUnreadTotal] = useState(0);
    const [bookings, setBookings] = useState([]);
    const [chatTopic, setChatTopic] = useState(null);
    const [topicWarning, setTopicWarning] = useState('');
    const [moderationNotice, setModerationNotice] = useState(null);
    const [showBookingPicker, setShowBookingPicker] = useState(false);
    const [staffTyping, setStaffTyping] = useState(false);
    const [loadingConv, setLoadingConv] = useState(false);
    const [backgroundSyncing, setBackgroundSyncing] = useState(false);
    const [hasOlderMessages, setHasOlderMessages] = useState(false);
    const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editingText, setEditingText] = useState('');
    const [openActionMessageId, setOpenActionMessageId] = useState(null);
    const [deleteConfirmModal, setDeleteConfirmModal] = useState({ isOpen: false, message: null, busy: false });
    const messagesEndRef = useRef(null);
    const shouldScrollToBottomRef = useRef(false);
    const echoChannelRef = useRef(null);
    const conversationRef = useRef(null);
    const messagesRef = useRef([]);
    const lastConversationLoadedAtRef = useRef(0);
    const lastMessagesLoadedAtRef = useRef(0);
    const messagesLoadedForRef = useRef(null);
    const lastBookingsLoadedAtRef = useRef(0);
    const openedOnMountRef = useRef(false);
    const moderationAttemptsRef = useRef(0);

    // Keep ref in sync
    useEffect(() => { conversationRef.current = conversation; }, [conversation]);
    useEffect(() => { messagesRef.current = messages; }, [messages]);

    // ─── Fetch Data ───

    const fetchUnreadCount = useCallback(async () => {
        try {
            const res = await fetch('/api/chat/unread-count');
            if (res.ok) { const d = await res.json(); setUnreadTotal(d.count); }
        } catch (e) { /* silent */ }
    }, []);

    const fetchConversation = useCallback(async ({ force = false } = {}) => {
        const cachedConversation = conversationRef.current;
        const isFresh = Date.now() - lastConversationLoadedAtRef.current < CHAT_CACHE_TTL_MS;

        if (!force && cachedConversation && isFresh) {
            return cachedConversation;
        }

        try {
            const res = await fetch('/api/chat/conversations?limit=1');
            if (res.ok) {
                const d = await res.json();
                const convList = d.conversations || [];
                lastConversationLoadedAtRef.current = Date.now();
                if (convList.length > 0) {
                    setConversation(convList[0]); // Client has one active conversation
                    return convList[0];
                }
            }
        } catch (e) { /* silent */ }
        return null;
    }, []);

    const normalizeMessagesResponse = (payload) => {
        if (Array.isArray(payload)) {
            return { data: sortMessagesOldestFirst(payload), pagination: { has_more: false } };
        }

        return {
            data: sortMessagesOldestFirst(Array.isArray(payload?.data) ? payload.data : []),
            pagination: payload?.pagination || { has_more: false },
        };
    };

    const mergeMessageIntoList = useCallback((items, incoming) => {
        const list = Array.isArray(items) ? items : [];
        const clientTempId = incoming?.client_temp_id;
        const existingIndex = list.findIndex((item) => (
            (clientTempId && item.client_temp_id === clientTempId)
            || (incoming?.id && item.id === incoming.id)
        ));

        if (existingIndex >= 0) {
            const next = [...list];
            next[existingIndex] = {
                ...next[existingIndex],
                ...incoming,
                optimistic_status: incoming.optimistic_status || 'sent',
            };
            return sortMessagesOldestFirst(next);
        }

        return sortMessagesOldestFirst([...list, incoming]);
    }, []);

    const optimisticMessageFor = useCallback((conversationId, message, clientTempId) => {
        const createdAt = new Date();

        return {
            id: clientTempId,
            client_temp_id: clientTempId,
            conversation_id: conversationId,
            sender_id: user?.id,
            sender_name: user?.username || user?.full_name || 'You',
            sender_role: user?.role || 'Client',
            message,
            is_mine: true,
            read_at: null,
            created_at: createdAt.toISOString(),
            time: localTimeLabel(createdAt),
            optimistic_status: 'sending',
        };
    }, [user?.full_name, user?.id, user?.role, user?.username]);

    const fetchMessages = useCallback(async (convId, { force = false } = {}) => {
        const isSameConversation = messagesLoadedForRef.current === convId;
        const isFresh = Date.now() - lastMessagesLoadedAtRef.current < CHAT_CACHE_TTL_MS;

        if (!force && isSameConversation && messagesRef.current.length > 0 && isFresh) {
            return messagesRef.current;
        }

        try {
            const res = await fetch(`/api/chat/conversations/${convId}/messages?limit=30`);
            if (res.ok) {
                const d = normalizeMessagesResponse(await res.json());
                shouldScrollToBottomRef.current = true;
                setMessages(d.data);
                setHasOlderMessages(Boolean(d.pagination?.has_more));
                messagesLoadedForRef.current = convId;
                lastMessagesLoadedAtRef.current = Date.now();
                fetchUnreadCount();
                return d.data;
            }
        } catch (e) { /* silent */ }
        return [];
    }, [fetchUnreadCount]);

    const loadOlderMessages = useCallback(async () => {
        if (!conversation?.id || !messages.length || loadingOlderMessages) return;
        setLoadingOlderMessages(true);

        try {
            const res = await fetch(`/api/chat/conversations/${conversation.id}/messages?limit=30&before_id=${messages[0].id}`);
            if (res.ok) {
                const d = normalizeMessagesResponse(await res.json());
                setMessages(prev => sortMessagesOldestFirst([...d.data, ...prev]));
                setHasOlderMessages(Boolean(d.pagination?.has_more));
            }
        } catch (e) { /* silent */ }
        finally { setLoadingOlderMessages(false); }
    }, [conversation?.id, messages, loadingOlderMessages]);

    const fetchBookings = useCallback(async ({ force = false } = {}) => {
        if (!force && bookings.length > 0 && Date.now() - lastBookingsLoadedAtRef.current < BOOKING_CACHE_TTL_MS) {
            return bookings;
        }

        try {
            const res = await fetch('/api/chat/my-bookings');
            if (res.ok) {
                const data = await res.json();
                setBookings(data);
                if (data.length <= 1 && chatTopic === null) {
                    setChatTopic(data.length === 1 ? String(data[0].id) : 'general');
                }
                lastBookingsLoadedAtRef.current = Date.now();
                return data;
            }
        } catch (e) { /* silent */ }
        return [];
    }, [bookings]);

    // ─── Unread Count Poll (global, even when closed) ───

    useEffect(() => {
        if (!user) return;
        fetchUnreadCount();
    }, [user, fetchUnreadCount]);

    useSmartRefresh({
        enabled: Boolean(user),
        interval: hasRealtime ? (isOpen ? 60000 : 120000) : (isOpen ? 15000 : 30000),
        idleAfter: 180000,
        refresh: async () => {
            setBackgroundSyncing(true);
            try {
                await fetchUnreadCount();
                if (isOpen) {
                    const conv = await fetchConversation({ force: true });
                    if (conv?.id) {
                        await fetchMessages(conv.id, { force: true });
                    }
                    await fetchBookings({ force: true });
                }
            } finally {
                setBackgroundSyncing(false);
            }
        },
        channels: liveChannels,
        resources: ['chat', 'bookings', 'finance'],
    });

    // ─── Echo: Subscribe When Conversation Exists ───

    useEffect(() => {
        if (!conversation?.id || !window.Echo) return;

        const channelName = `conversation.${conversation.id}`;

        // Avoid double-subscribe
        if (echoChannelRef.current === channelName) return;

        // Leave old channel
        if (echoChannelRef.current) {
            window.Echo.leave(echoChannelRef.current);
        }

        window.Echo.private(channelName)
            .listen('.message.sent', (e) => {
                // Skip our own messages — they're already added from the HTTP response
                if (e.messageData.sender_id === user?.id) return;

                if (conversationRef.current?.id === e.conversationId) {
                    setMessages(prev => {
                        if (prev.find(m => m.id === e.messageData.id)) return prev;
                        shouldScrollToBottomRef.current = true;
                        return sortMessagesOldestFirst([...prev, { ...e.messageData, is_mine: false }]);
                    });

                    setStaffTyping(false);
                }
                fetchUnreadCount();
            })
            .listen('.conversation.claimed', (e) => {
                // Update the local conversation to reflect the claim
                setConversation(prev => prev ? { ...prev, staff_id: e.conversationData.staff_id, staff_name: e.conversationData.staff_name } : prev);
            });

        echoChannelRef.current = channelName;

        return () => {
            // Don't leave on re-render, only on unmount
        };
    }, [conversation?.id, fetchUnreadCount]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (echoChannelRef.current && window.Echo) {
                window.Echo.leave(echoChannelRef.current);
                echoChannelRef.current = null;
            }
        };
    }, []);

    // Auto-scroll
    useEffect(() => {
        if (!shouldScrollToBottomRef.current) return;
        shouldScrollToBottomRef.current = false;
        if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ─── Actions ───

    const handleOpen = async () => {
        setIsOpen(true);
        setShowBookingPicker(false);

        const cachedConversation = conversationRef.current;
        const hasCachedMessages = messagesRef.current.length > 0;
        const messagesAreFresh = Date.now() - lastMessagesLoadedAtRef.current < CHAT_CACHE_TTL_MS;

        fetchBookings();

        if (cachedConversation && hasCachedMessages) {
            setLoadingConv(false);
            if (!messagesAreFresh) {
                fetchMessages(cachedConversation.id, { force: true });
            }
            return;
        }

        setLoadingConv(true);
        const conv = await fetchConversation({ force: !cachedConversation });
        if (conv) {
            await fetchMessages(conv.id, { force: true });
        }
        setLoadingConv(false);
    };

    const handleClose = () => {
        setIsOpen(false);
        setShowBookingPicker(false);
    };

    useEffect(() => {
        if (!openOnMount || openedOnMountRef.current) return;
        openedOnMountRef.current = true;
        handleOpen();
    }, [openOnMount]);

    const showModerationFeedback = useCallback((serverPayload = null) => {
        const attempts = Number(serverPayload?.moderation?.attempts || moderationAttemptsRef.current + 1);
        moderationAttemptsRef.current = attempts;
        setModerationNotice(getChatModerationFeedback(attempts, serverPayload));
    }, []);

    const handleMessageInputChange = (event) => {
        const value = event.target.value;
        setNewMessage(value);
        if (moderationNotice && !getChatModerationIssue(value)) {
            setModerationNotice(null);
        }
    };

    const blockIfModerated = (message) => {
        if (!getChatModerationIssue(message)) return false;
        showModerationFeedback();
        return true;
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;
        const outgoingMessage = newMessage.trim();
        if (blockIfModerated(outgoingMessage)) return;

        const clientTempId = createClientTempId();
        const optimistic = optimisticMessageFor(conversation?.id || clientTempId, outgoingMessage, clientTempId);
        setSending(true);
        setNewMessage('');
        shouldScrollToBottomRef.current = true;
        setMessages(prev => mergeMessageIntoList(prev, optimistic));

        try {
            if (conversation) {
                // Send to existing conversation
                const res = await csrfFetch(`/api/chat/conversations/${conversation.id}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ message: outgoingMessage, client_temp_id: clientTempId }),
                });
                const payload = await res.json().catch(() => ({}));
                if (!res.ok) {
                    if (payload?.moderation?.blocked) {
                        setMessages(prev => prev.filter(item => item.client_temp_id !== clientTempId));
                        setNewMessage(outgoingMessage);
                        showModerationFeedback(payload);
                        return;
                    }
                    throw new Error(payload.error || 'Message could not be sent.');
                }
                shouldScrollToBottomRef.current = true;
                setMessages(prev => mergeMessageIntoList(prev, { ...payload, optimistic_status: 'sent' }));
                setModerationNotice(null);
            } else {
                const latestBookings = bookings.length ? bookings : await fetchBookings({ force: true });
                if (latestBookings.length > 1 && chatTopic === null) {
                    setMessages(prev => prev.filter(item => item.client_temp_id !== clientTempId));
                    setNewMessage(outgoingMessage);
                    setTopicWarning('Choose a booking or General inquiry before sending.');
                    setSending(false);
                    return;
                }
                // Start new conversation
                const res = await csrfFetch('/api/chat/conversations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        message: outgoingMessage,
                        client_temp_id: clientTempId,
                        ...(chatTopic && chatTopic !== 'general' ? { booking_id: Number(chatTopic) } : {}),
                    }),
                });
                const payload = await res.json().catch(() => ({}));
                if (!res.ok) {
                    if (payload?.moderation?.blocked) {
                        setMessages(prev => prev.filter(item => item.client_temp_id !== clientTempId));
                        setNewMessage(outgoingMessage);
                        showModerationFeedback(payload);
                        return;
                    }
                    throw new Error(payload.error || 'Message could not be sent.');
                }
                setConversation(payload.conversation);
                shouldScrollToBottomRef.current = true;
                setMessages(prev => mergeMessageIntoList(prev, { ...payload.message, optimistic_status: 'sent' }));
                setTopicWarning('');
                setModerationNotice(null);
            }
        } catch (e) {
            setMessages(prev => prev.map(item => item.client_temp_id === clientTempId
                ? { ...item, optimistic_status: 'failed', error: e.message || 'Message could not be sent.' }
                : item));
            setTopicWarning(e.message || 'Message could not be sent.');
        }
        finally { setSending(false); }
    };

    const removeFailedMessage = (msg) => {
        if (!msg?.client_temp_id) return;
        setMessages(prev => prev.filter(item => item.client_temp_id !== msg.client_temp_id));
    };

    const retryFailedMessage = async (msg) => {
        if (!msg?.message || sending) return;
        const clientTempId = msg.client_temp_id || createClientTempId();
        setSending(true);
        setMessages(prev => mergeMessageIntoList(prev, { ...msg, client_temp_id: clientTempId, optimistic_status: 'sending', error: null }));

        try {
            if (conversation) {
                const res = await csrfFetch(`/api/chat/conversations/${conversation.id}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ message: msg.message, client_temp_id: clientTempId }),
                });
                const payload = await res.json().catch(() => ({}));
                if (!res.ok) {
                    if (payload?.moderation?.blocked) {
                        removeFailedMessage({ client_temp_id: clientTempId });
                        setNewMessage(msg.message);
                        showModerationFeedback(payload);
                        return;
                    }
                    throw new Error(payload.error || 'Message could not be sent.');
                }
                shouldScrollToBottomRef.current = true;
                setMessages(prev => mergeMessageIntoList(prev, { ...payload, optimistic_status: 'sent' }));
            } else {
                const res = await csrfFetch('/api/chat/conversations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        message: msg.message,
                        client_temp_id: clientTempId,
                        ...(chatTopic && chatTopic !== 'general' ? { booking_id: Number(chatTopic) } : {}),
                    }),
                });
                const payload = await res.json().catch(() => ({}));
                if (!res.ok) {
                    if (payload?.moderation?.blocked) {
                        removeFailedMessage({ client_temp_id: clientTempId });
                        setNewMessage(msg.message);
                        showModerationFeedback(payload);
                        return;
                    }
                    throw new Error(payload.error || 'Message could not be sent.');
                }
                setConversation(payload.conversation);
                shouldScrollToBottomRef.current = true;
                setMessages(prev => mergeMessageIntoList(prev, { ...payload.message, optimistic_status: 'sent' }));
            }
            setTopicWarning('');
            setModerationNotice(null);
        } catch (e) {
            setMessages(prev => prev.map(item => item.client_temp_id === clientTempId
                ? { ...item, optimistic_status: 'failed', error: e.message || 'Message could not be sent.' }
                : item));
            setTopicWarning(e.message || 'Message could not be sent.');
        } finally {
            setSending(false);
        }
    };

    const shareBooking = async (booking) => {
        if (sending) return;
        setSending(true);
        const text = JSON.stringify({
            type: 'booking_details',
            booking: {
                id: booking.id,
                title: booking.event_name || booking.event_type || `Booking #${booking.id}`,
                date: booking.event_date,
                time: booking.event_time || 'TBD',
                event_type: booking.event_type,
                pax: booking.pax,
                venue: booking.venue_city || 'TBD',
                total: Number(booking.total_cost || 0),
                status: customerBookingStatus(booking.status).label,
            },
        });
        const clientTempId = createClientTempId();
        const optimistic = optimisticMessageFor(conversation?.id || clientTempId, text, clientTempId);
        shouldScrollToBottomRef.current = true;
        setMessages(prev => mergeMessageIntoList(prev, optimistic));
        setShowBookingPicker(false);

        try {
            if (conversation) {
                const res = await csrfFetch(`/api/chat/conversations/${conversation.id}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ message: text, client_temp_id: clientTempId }),
                });
                if (res.ok) {
                    const msg = await res.json();
                    shouldScrollToBottomRef.current = true;
                    setMessages(prev => mergeMessageIntoList(prev, { ...msg, optimistic_status: 'sent' }));
                } else {
                    throw new Error('Booking details could not be sent.');
                }
            } else {
                const res = await csrfFetch('/api/chat/conversations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ message: text, client_temp_id: clientTempId }),
                });
                if (res.ok) {
                    const d = await res.json();
                    setConversation(d.conversation);
                    shouldScrollToBottomRef.current = true;
                    setMessages(prev => mergeMessageIntoList(prev, { ...d.message, optimistic_status: 'sent' }));
                } else {
                    throw new Error('Booking details could not be sent.');
                }
            }
        } catch (e) {
            setMessages(prev => prev.map(item => item.client_temp_id === clientTempId
                ? { ...item, optimistic_status: 'failed', error: e.message || 'Booking details could not be sent.' }
                : item));
        }
        finally { setSending(false); }
    };

    // ─── Rendering Helpers ───

    const parseBookingCard = (text) => {
        if (!text) return null;
        try {
            const parsed = JSON.parse(text);
            if (parsed?.type === 'booking_details' && parsed.booking) return parsed.booking;
        } catch (e) {
            // Keep supporting older text-based booking cards.
        }
        if (!text.startsWith('📋 BOOKING DETAILS')) return null;
        const lines = text.split('\n').filter(l => l.trim() && !l.includes('━'));
        return {
            title: lines[3]?.replace(/^.*Event:\s*/, '') || 'Booking details',
            date: lines[1]?.replace(/^.*Date:\s*/, '') || 'TBD',
            time: lines[2]?.replace(/^.*Time:\s*/, '') || 'TBD',
            pax: lines[4]?.replace(/^.*Guests:\s*/, '') || 'TBD',
            venue: lines[5]?.replace(/^.*Venue:\s*/, '') || 'TBD',
            total: Number(String(lines[6] || '').replace(/[^\d.]/g, '')) || 0,
            status: lines[7]?.replace(/^.*Status:\s*/, '') || 'Shared',
        };
    };

    const isBookingCard = (text) => Boolean(parseBookingCard(text));

    const renderBookingCard = (text, isMine) => {
        const booking = parseBookingCard(text);
        return (
            <div className={`overflow-hidden rounded-2xl border ${isMine ? 'border-white/20 bg-white/10' : 'border-amber-100 bg-white shadow-sm'}`}>
                <div className={`px-4 py-3 ${isMine ? 'bg-white/10 text-white' : 'bg-[#fff7e8] text-[#720101]'}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Booking details</p>
                    <p className="mt-1 text-sm font-black">{booking.title || booking.event_type || 'Eloquente event'}</p>
                </div>
                <div className={`grid grid-cols-2 gap-2 px-4 py-3 text-xs ${isMine ? 'text-white/85' : 'text-slate-600'}`}>
                    <p><span className="block font-black uppercase opacity-60">Date</span>{booking.date || 'TBD'}</p>
                    <p><span className="block font-black uppercase opacity-60">Time</span>{booking.time || 'TBD'}</p>
                    <p><span className="block font-black uppercase opacity-60">Guests</span>{booking.pax || 'TBD'}{Number(booking.pax) ? ' pax' : ''}</p>
                    <p><span className="block font-black uppercase opacity-60">Venue</span>{booking.venue || 'TBD'}</p>
                    <p><span className="block font-black uppercase opacity-60">Total</span>PHP {Number(booking.total || 0).toLocaleString()}</p>
                    <p><span className="block font-black uppercase opacity-60">Status</span>{booking.status || 'Shared'}</p>
                </div>
            </div>
        );
    };

    const canEditMessage = (msg) => {
        if (msg?.optimistic_status) return false;
        if (!msg?.is_mine || msg.deleted_at || isBookingCard(msg.message)) return false;
        return Date.now() - new Date(msg.created_at || 0).getTime() <= 15 * 60 * 1000;
    };

    const canDeleteMessage = (msg) => {
        if (msg?.optimistic_status) return false;
        if (!msg?.is_mine || msg.deleted_at) return false;
        return Date.now() - new Date(msg.created_at || 0).getTime() <= 15 * 60 * 1000;
    };

    const startEditMessage = (msg) => {
        setOpenActionMessageId(null);
        setEditingMessageId(msg.id);
        setEditingText(msg.message);
    };

    const cancelEditMessage = () => {
        setOpenActionMessageId(null);
        setEditingMessageId(null);
        setEditingText('');
    };

    const saveEditedMessage = async (msg) => {
        const outgoingMessage = editingText.trim();
        if (!outgoingMessage) return;
        if (blockIfModerated(outgoingMessage)) return;

        try {
            const res = await csrfFetch(`/api/chat/messages/${msg.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: outgoingMessage }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (payload?.moderation?.blocked) {
                    showModerationFeedback(payload);
                    return;
                }
                throw new Error(payload.error || 'Could not edit message.');
            }
            setMessages(prev => prev.map(item => item.id === msg.id ? payload : item));
            setModerationNotice(null);
            cancelEditMessage();
        } catch (e) {
            setTopicWarning(e.message || 'Could not edit message.');
        }
    };

    const deleteMessage = async (msg) => {
        setOpenActionMessageId(null);
        setDeleteConfirmModal({ isOpen: true, message: msg, busy: false });
    };

    const confirmDeleteMessage = async () => {
        const msg = deleteConfirmModal.message;
        if (!msg) return;
        setDeleteConfirmModal(prev => ({ ...prev, busy: true }));
        try {
            const res = await csrfFetch(`/api/chat/messages/${msg.id}`, { method: 'DELETE' });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'Could not delete message.');
            setMessages(prev => prev.map(item => item.id === msg.id ? payload.data : item));
            setDeleteConfirmModal({ isOpen: false, message: null, busy: false });
        } catch (e) {
            setDeleteConfirmModal(prev => ({ ...prev, busy: false }));
            setTopicWarning(e.message || 'Could not delete message.');
        }
    };

    if (!user) return null;

    return (
        <>
            {/* Floating Bubble Button */}
            {!isOpen && (
                <div id="chat-bubble" className="fixed bottom-5 right-5 z-50">
                    <button
                        onClick={handleOpen}
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
            )}

            {/* Chat Panel */}
            {isOpen && (
                <div className="fixed bottom-5 right-5 z-50 flex h-[min(560px,calc(100vh-2.5rem))] w-[calc(100%-2rem)] max-w-[390px] flex-col overflow-hidden rounded-[22px] border border-[#ead8cc] bg-[#fffaf3] shadow-xl shadow-slate-950/20" style={{ animation: 'fadeIn .2s ease' }}>
                    {/* Header */}
                    <div className="flex flex-shrink-0 items-center justify-between border-b border-[#ead8cc] bg-white px-4 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff4df] text-[#720101]">
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9f6500]">Support</p>
                                <h3 className="text-base font-black leading-tight text-[#720101]">Eloquente Catering</h3>
                                <p className="text-xs font-semibold text-slate-500">
                                    {conversation?.staff_name
                                        ? `Currently with ${conversation.staff_name}`
                                        : (conversation ? 'Waiting for staff...' : 'Send a message to get started')}
                                </p>
                                <div className="mt-1">
                                    <LiveSyncIndicator
                                        state={backgroundSyncing ? 'syncing' : realtimeSyncState}
                                        compact
                                        onRetry={() => {
                                            fetchUnreadCount();
                                            if (conversation?.id) fetchMessages(conversation.id, { force: true });
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                        <button onClick={handleClose} className="rounded-full border border-[#ead8cc] bg-[#fffaf3] p-2 text-[#720101] transition-colors hover:bg-[#fff4df]" aria-label="Minimize chat">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M20 12H4" /></svg>
                        </button>
                    </div>

                    {/* Messages Body */}
                    <div className="flex-1 overflow-y-auto bg-[#fffaf3]">
                        {loadingConv ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[#720101] border-t-transparent"></div>
                                    <p className="text-xs font-bold text-slate-500">Opening chat...</p>
                                </div>
                            </div>
                        ) : (
                            <SoftRefreshBoundary className="h-full" refreshing={backgroundSyncing} stale={realtimeSyncState === 'stale' || realtimeSyncState === 'reconnecting'} staleMessage="Viewing saved chat. New messages will appear when the connection catches up.">
                            <div className="flex flex-col h-full">
                                <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: 'calc(560px - 142px)' }}>
                                    {/* Status Indicator */}
                                    {!conversation && (
                                        <div className="text-center py-6">
                                            <div className="w-16 h-16 bg-[#720101]/5 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <svg className="w-8 h-8 text-[#720101]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                            </div>
                                            <p className="text-sm font-black text-slate-800">How can we help?</p>
                                            <p className="mt-1 text-xs font-semibold text-slate-500">Send a message and our team will respond shortly.</p>
                                        </div>
                                    )}

                                    {!conversation && bookings.length > 1 && (
                                        <div className="rounded-2xl border border-amber-200 bg-white p-3 text-left">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-[#9f6500]">Message topic</label>
                                            <select value={chatTopic ?? ''} onChange={(event) => { setChatTopic(event.target.value || null); setTopicWarning(''); }} className="mt-2 w-full rounded-xl border border-amber-100 bg-[#fffaf3] px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-[#720101]">
                                                <option value="">Choose a booking or General inquiry</option>
                                                <option value="general">General inquiry</option>
                                                {bookings.map((booking) => (
                                                    <option key={booking.id} value={booking.id}>
                                                        #{booking.id} - {booking.event_name || booking.event_type || 'Booking'} ({booking.event_date})
                                                    </option>
                                                ))}
                                            </select>
                                            {topicWarning && <p className="mt-2 text-xs font-bold text-amber-700">{topicWarning}</p>}
                                        </div>
                                    )}

                                    {conversation && messages.length === 0 && (
                                        <div className="text-center py-8">
                                            <p className="text-sm text-gray-400">No messages yet</p>
                                            <p className="text-xs text-gray-300 mt-1">Say hello! 👋</p>
                                        </div>
                                    )}

                                    {conversation && hasOlderMessages && (
                                        <div className="flex justify-center">
                                            <button
                                                type="button"
                                                onClick={loadOlderMessages}
                                                disabled={loadingOlderMessages}
                                                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-bold text-[#720101] transition-colors hover:bg-[#fff8ec] disabled:text-gray-400"
                                            >
                                                {loadingOlderMessages ? 'Loading...' : 'Load earlier messages'}
                                            </button>
                                        </div>
                                    )}

                                    {messages.map(msg => (
                                        <div key={msg.client_temp_id || msg.id} className={`flex ${msg.is_mine ? 'justify-end' : 'justify-start'}`}>
                                            <div className="group flex max-w-[92%] items-start gap-2">
                                                {(canEditMessage(msg) || canDeleteMessage(msg)) && editingMessageId !== msg.id && (
                                                    <div className={`relative mt-2 flex h-7 w-7 flex-shrink-0 transition-opacity ${openActionMessageId === msg.id ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'}`}>
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                setOpenActionMessageId(openActionMessageId === msg.id ? null : msg.id);
                                                            }}
                                                            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-black leading-none text-slate-600 shadow-md shadow-slate-950/10 transition hover:border-[#720101]/30 hover:text-[#720101]"
                                                            aria-label="Message actions"
                                                            aria-expanded={openActionMessageId === msg.id}
                                                        >
                                                            ...
                                                        </button>
                                                        {openActionMessageId === msg.id && (
                                                            <div className="absolute right-0 top-9 z-40 min-w-[8.5rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-xl shadow-slate-950/15">
                                                                {canEditMessage(msg) && (
                                                                    <button type="button" onClick={() => startEditMessage(msg)} className="block w-full px-3 py-2 text-left text-xs font-black text-slate-700 transition hover:bg-slate-50">
                                                                        Edit message
                                                                    </button>
                                                                )}
                                                                {canDeleteMessage(msg) && (
                                                                    <button type="button" onClick={() => deleteMessage(msg)} className="block w-full px-3 py-2 text-left text-xs font-black text-red-700 transition hover:bg-red-50">
                                                                        Delete message
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <div className={`relative max-w-full rounded-2xl border px-3.5 py-2.5 ${msg.is_mine ? 'rounded-br-md border-[#720101] bg-[#720101] text-white' : 'rounded-bl-md border-[#ead8cc] bg-white text-slate-800'}`}>
                                                {!msg.is_mine && msg.sender_name && (
                                                    <p className="text-[10px] font-bold text-[#720101] mb-0.5">{msg.sender_name}</p>
                                                )}
                                                {editingMessageId === msg.id ? (
                                                    <div className="space-y-2">
                                                        <textarea value={editingText} onChange={(event) => setEditingText(event.target.value)} rows={3} className="w-64 rounded-xl border border-white/40 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none" />
                                                        <div className="flex justify-end gap-2">
                                                            <button type="button" onClick={cancelEditMessage} className="text-[11px] font-black text-white/70">Cancel</button>
                                                            <button type="button" onClick={() => saveEditedMessage(msg)} className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#720101]">Save</button>
                                                        </div>
                                                    </div>
                                                ) : isBookingCard(msg.message) ? renderBookingCard(msg.message, msg.is_mine) : (
                                                    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{msg.message}</p>
                                                )}
                                                <div className="mt-1 flex items-center justify-end gap-2">
                                                    {msg.edited_at && !msg.deleted_at && <span className={`text-[10px] font-semibold ${msg.is_mine ? 'text-white/50' : 'text-slate-400'}`}>edited</span>}
                                                    <p className={`text-[10px] font-semibold ${msg.is_mine ? 'text-white/60' : 'text-slate-400'}`}>
                                                        {msg.time}{msg.optimistic_status === 'sending' ? ' / Sending...' : ''}{msg.optimistic_status === 'failed' ? ' / Failed' : ''}
                                                    </p>
                                                </div>
                                                {msg.optimistic_status === 'failed' && (
                                                    <div className="mt-2 flex justify-end gap-2">
                                                        <button type="button" onClick={() => retryFailedMessage(msg)} className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#720101]">
                                                            Retry
                                                        </button>
                                                        <button type="button" onClick={() => removeFailedMessage(msg)} className="text-[11px] font-black text-white/70">
                                                            Remove
                                                        </button>
                                                    </div>
                                                )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Typing indicator */}
                                    {staffTyping && (
                                        <div className="flex justify-start">
                                            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-2.5">
                                                <div className="flex gap-1">
                                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Booking Picker Popup */}
                                {showBookingPicker && (
                                    <div className="border-t border-gray-100 bg-gray-50 max-h-44 overflow-y-auto">
                                        <div className="px-3 py-2 flex items-center justify-between">
                                            <p className="text-xs font-bold text-gray-600">Share a Booking</p>
                                            <button onClick={() => setShowBookingPicker(false)} className="text-gray-400 hover:text-gray-600">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                        {bookings.length === 0 ? (
                                            <p className="text-xs text-gray-400 text-center py-4">No bookings found</p>
                                        ) : (
                                            <div className="px-2 pb-2 space-y-1.5">
                                                {bookings.map(b => (
                                                    <button key={b.id} onClick={() => shareBooking(b)} disabled={sending}
                                                        className="w-full flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50/30 transition-all text-left">
                                                        <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                                                            <span className="text-base">🎉</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold text-gray-900 truncate">{b.event_type}</p>
                                                            <p className="text-[10px] text-gray-400">{b.event_date} • {b.pax} pax • <span className={b.status === 'Confirmed' ? 'text-green-600' : b.status === 'Pending' ? 'text-amber-500' : 'text-gray-500'}>{b.status}</span></p>
                                                        </div>
                                                        <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            </SoftRefreshBoundary>
                        )}
                    </div>

                    {/* Input bar — always visible (no staff picker needed) */}
                    <form onSubmit={handleSend} className="staff-chat-composer-form flex-shrink-0 border-t border-[#ead8cc] bg-white px-3 py-3">
                        {moderationNotice && (
                            <div className="staff-chat-moderation-notice" role="alert">
                                <strong>{moderationNotice.message}</strong>
                                {moderationNotice.warning && <span>{moderationNotice.warning}</span>}
                            </div>
                        )}
                        <div className="staff-chat-composer-row gap-2">
                            {bookings.length > 0 && (
                                <button type="button" onClick={() => { fetchBookings(); setShowBookingPicker(!showBookingPicker); }}
                                    title="Share booking details"
                                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${showBookingPicker ? 'border-[#720101] bg-[#720101] text-white' : 'border-[#ead8cc] bg-[#fffaf3] text-slate-500 hover:bg-[#fff4df]'}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </button>
                            )}
                            <input type="text" value={newMessage} onChange={handleMessageInputChange}
                                placeholder="Type a message..."
                                className="flex-1 rounded-full border border-[#ead8cc] bg-[#fffaf3] px-3 py-2.5 text-sm font-semibold outline-none transition-all placeholder:text-slate-500 focus:border-[#720101]/40 focus:bg-white focus:ring-2 focus:ring-[#720101]/10"
                                maxLength={2000} autoFocus />
                            <button type="submit" disabled={!newMessage.trim() || sending}
                                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#720101] text-white transition-colors hover:bg-[#5a0101] disabled:border disabled:border-slate-400 disabled:bg-slate-200 disabled:text-slate-700">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            </button>
                        </div>
                    </form>
                </div>
            )}
            <ConfirmModal
                isOpen={deleteConfirmModal.isOpen}
                title="Delete this message?"
                message="The message will be replaced with Message deleted."
                confirmText="Delete"
                tone="danger"
                busy={deleteConfirmModal.busy}
                onCancel={() => setDeleteConfirmModal({ isOpen: false, message: null, busy: false })}
                onConfirm={confirmDeleteMessage}
            />
        </>
    );
};

export default ChatBubble;
