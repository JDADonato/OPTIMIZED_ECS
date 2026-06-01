import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import useLiveResource from '../../hooks/useLiveResource';
import ConfirmModal from './ConfirmModal';
import ErrorModal from './ErrorModal';
import PromptModal from './PromptModal';
import StaffSkeleton from '../staff/StaffSkeleton';
import csrfFetch from '../../utils/csrf';
import { operationalChannelsForUser } from '../../utils/liveChannels';
import { getChatModerationFeedback, getChatModerationIssue } from '../../utils/chatModeration';
import { describeCustomerIdentity } from '../../utils/customerIdentity';
import { chatMessageStore } from '../../utils/chatMessageStore';
import { LiveSyncIndicator, SoftRefreshBoundary, UpdatedRowPulse } from './LiveFeedback';
import {
    CalendarDays,
    ClipboardList,
    Clock3,
    CreditCard,
    History,
    Mail,
    MoreHorizontal,
    MoreVertical,
    NotebookPen,
    Phone,
    RefreshCw,
    Search,
    UserRound,
    X,
} from 'lucide-react';

/**
 * Phase 2: Staff Messaging — WebSocket-powered Ticket/Claiming System.
 *
 * Sidebar split into two tabs:
 *  1. "Unassigned Inquiries" — conversations waiting to be claimed
 *  2. "My Active Chats" — conversations claimed by this staff member
 *
 * When viewing an unassigned inquiry: shows a "Claim Conversation" button.
 * When viewing a claimed chat: shows the text input + "Resolve" button.
 *
 * Preserves existing UI design and Tailwind classes from original StaffMessaging.
 */
const sortMessagesOldestFirst = (items = []) => [...items].sort((a, b) => {
    const leftTime = new Date(a.created_at || 0).getTime();
    const rightTime = new Date(b.created_at || 0).getTime();
    const safeLeftTime = Number.isNaN(leftTime) ? 0 : leftTime;
    const safeRightTime = Number.isNaN(rightTime) ? 0 : rightTime;

    if (safeLeftTime !== safeRightTime) return safeLeftTime - safeRightTime;

    return (Number(a.id) || 0) - (Number(b.id) || 0);
});
const MESSAGE_CACHE_LIMIT = 20;
const MESSAGE_CACHE_TTL_MS = 120000;
const MESSAGE_PAGE_LIMIT = 20;
const createClientTempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const localTimeLabel = (date = new Date()) => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const messageDate = (message) => {
    const value = message?.created_at ? new Date(message.created_at) : null;
    return value && !Number.isNaN(value.getTime()) ? value : null;
};
const sameLocalDay = (left, right) => (
    left && right
    && left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
);
const localDateKey = (date, fallback = 'unknown') => {
    if (!date) return fallback;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};
const formatChatDateLabel = (date) => {
    if (!date) return 'Conversation';
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (sameLocalDay(date, today)) return 'Today';
    if (sameLocalDay(date, yesterday)) return 'Yesterday';

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
};
const minutesBetweenMessages = (left, right) => {
    const leftDate = messageDate(left);
    const rightDate = messageDate(right);
    if (!leftDate || !rightDate) return Number.POSITIVE_INFINITY;

    return Math.abs(rightDate.getTime() - leftDate.getTime()) / 60000;
};
const shouldStartNewMessageGroup = (message, previous) => {
    if (!previous) return true;
    if (Boolean(message?.is_mine) !== Boolean(previous?.is_mine)) return true;
    if (String(message?.sender_id || '') !== String(previous?.sender_id || '')) return true;
    if (!sameLocalDay(messageDate(message), messageDate(previous))) return true;

    return minutesBetweenMessages(message, previous) > 6;
};
const buildMessageSections = (items = []) => {
    const sections = [];

    sortMessagesOldestFirst(items).forEach((message) => {
        const currentDate = messageDate(message);
        let section = sections[sections.length - 1];

        if (!section || !sameLocalDay(currentDate, section.date)) {
            section = {
                id: localDateKey(currentDate, `unknown-${sections.length}`),
                date: currentDate,
                label: formatChatDateLabel(currentDate),
                groups: [],
            };
            sections.push(section);
        }

        const previousGroup = section.groups[section.groups.length - 1];
        const previousMessage = previousGroup?.messages?.[previousGroup.messages.length - 1];

        if (!previousGroup || shouldStartNewMessageGroup(message, previousMessage)) {
            section.groups.push({
                id: `${section.id}-${message.sender_id || 'system'}-${message.client_temp_id || message.id || section.groups.length}`,
                isMine: Boolean(message.is_mine),
                senderId: message.sender_id,
                senderName: message.sender_name || 'Unknown',
                senderRole: message.sender_role || 'Customer',
                messages: [message],
            });
            return;
        }

        previousGroup.messages.push(message);
    });

    return sections;
};
const bookingReferenceLabel = (bookingId) => {
    if (!bookingId) return '';
    const raw = String(bookingId);
    return raw.startsWith('BK-') || raw.startsWith('#BK-') ? raw.replace(/^#?/, '#') : `#BK-${raw}`;
};
const formatRelativeMessageAge = (message, now = Date.now()) => {
    if (message?.optimistic_status === 'sending') return 'sending';
    if (message?.optimistic_status === 'failed') return 'failed';

    const sentAt = messageDate(message);
    if (!sentAt) return message?.time || '';

    const seconds = Math.max(0, Math.floor((now - sentAt.getTime()) / 1000));
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;

    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;

    return sentAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const conversationMemoryKeyFor = (user, variant, surfaceMode, memoryScope = '') => {
    if (!user?.id) return '';
    const scopedSuffix = memoryScope ? `:${memoryScope}` : '';
    return `ecs:staff-messaging:selected:${user.id}:${variant}:${surfaceMode}${scopedSuffix}`;
};

const filterMemoryKeyFor = (user, variant, surfaceMode, memoryScope = '') => {
    if (!user?.id) return '';
    const scopedSuffix = memoryScope ? `:${memoryScope}` : '';
    return `ecs:staff-messaging:filter:${user.id}:${variant}:${surfaceMode}${scopedSuffix}`;
};

const StaffMessaging = ({ variant = 'staff', refreshToken = 0, onMetricsChange = null, surfaceMode = 'default', targetConversationId = null, onAdminContextNavigate = null, onStaffContextNavigate = null, memoryScope = '', customerId = null, defaultAdminFilter = null }) => {
    const { user } = useAuth();
    const hasRealtime = typeof window !== 'undefined' && Boolean(window.Echo);
    const isAdminOversight = variant === 'admin-oversight' && user?.role === 'Admin';
    const isAdminFullSurface = isAdminOversight && surfaceMode === 'admin-full';
    const staffContextNavigate = onStaffContextNavigate || onAdminContextNavigate;
    const requestedAdminFilter = String(defaultAdminFilter || '').trim();
    const defaultSidebarTab = isAdminOversight
        ? (['needs-attention', 'all-active', 'unassigned', 'resolved'].includes(requestedAdminFilter) ? requestedAdminFilter : 'needs-attention')
        : 'unassigned';
    const customerFilterId = String(customerId || '').trim();
    const [sidebarTab, setSidebarTab] = useState(defaultSidebarTab);
    const [conversationSearch, setConversationSearch] = useState('');
    const [conversationVisibleLimit, setConversationVisibleLimit] = useState(24);
    const [unassigned, setUnassigned] = useState([]);
    const [myChats, setMyChats] = useState([]);
    const [adminNeedsAttention, setAdminNeedsAttention] = useState([]);
    const [adminAllActive, setAdminAllActive] = useState([]);
    const [adminResolved, setAdminResolved] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [messages, setMessages] = useState([]);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [loading, setLoading] = useState(true);
    const [availableStaff, setAvailableStaff] = useState([]);
    const [showTransfer, setShowTransfer] = useState(false);
    const [transferring, setTransferring] = useState(false);
    const [hasOlderMessages, setHasOlderMessages] = useState(false);
    const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
    const [resolveConfirmOpen, setResolveConfirmOpen] = useState(false);
    const [errorModal, setErrorModal] = useState({ isOpen: false, message: '' });
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editingText, setEditingText] = useState('');
    const [openActionMessageId, setOpenActionMessageId] = useState(null);
    const [showAdminActions, setShowAdminActions] = useState(false);
    const [showContextDrawer, setShowContextDrawer] = useState(false);
    const [copiedHelper, setCopiedHelper] = useState('');
    const [relativeNow, setRelativeNow] = useState(Date.now());
    const [moderationNotice, setModerationNotice] = useState(null);
    const [internalNoteModal, setInternalNoteModal] = useState({ isOpen: false, conversation: null, busy: false });
    const [deleteConfirmModal, setDeleteConfirmModal] = useState({ isOpen: false, message: null, busy: false });
    const [moderationDeleteModal, setModerationDeleteModal] = useState({ isOpen: false, message: null, busy: false });
    const messagesContainerRef = useRef(null);
    const shouldScrollToBottomRef = useRef(false);
    const preserveOlderScrollRef = useRef(null);
    const echoChannelsRef = useRef({});
    const selectedConvRef = useRef(null);
    const messageCacheRef = useRef(new Map());
    const messageFetchRequestRef = useRef(0);
    const moderationAttemptsRef = useRef(0);
    const conversationRefreshTimerRef = useRef(null);
    const conversationMemoryKey = useMemo(() => conversationMemoryKeyFor(user, variant, surfaceMode, memoryScope), [memoryScope, surfaceMode, user?.id, variant]);
    const filterMemoryKey = useMemo(() => filterMemoryKeyFor(user, variant, surfaceMode, memoryScope), [memoryScope, surfaceMode, user?.id, variant]);
    const validSidebarTabs = useMemo(() => (
        isAdminOversight
            ? ['needs-attention', 'all-active', 'unassigned', 'resolved']
            : ['unassigned', 'my-chats']
    ), [isAdminOversight]);
    const conversationMatchesCustomerFilter = useCallback((conversation) => {
        if (!customerFilterId) return true;

        return [
            conversation?.client_id,
            conversation?.customer_id,
            conversation?.customer_account?.id,
            conversation?.client?.id,
        ].some((value) => String(value || '') === customerFilterId);
    }, [customerFilterId]);
    const scopeConversationsToCustomer = useCallback((items = []) => (
        customerFilterId ? items.filter(conversationMatchesCustomerFilter) : items
    ), [conversationMatchesCustomerFilter, customerFilterId]);

    const readRememberedConversation = useCallback(() => {
        if (!conversationMemoryKey || typeof window === 'undefined') return null;

        try {
            return JSON.parse(window.localStorage.getItem(conversationMemoryKey) || 'null');
        } catch (error) {
            return null;
        }
    }, [conversationMemoryKey]);

    const rememberSelectedConversation = useCallback((conversation, tab = sidebarTab) => {
        if (!conversationMemoryKey || typeof window === 'undefined' || !conversation?.id) return;

        window.localStorage.setItem(conversationMemoryKey, JSON.stringify({
            id: conversation.id,
            tab,
            updatedAt: Date.now(),
        }));
    }, [conversationMemoryKey, sidebarTab]);

    const clearRememberedConversation = useCallback(() => {
        if (!conversationMemoryKey || typeof window === 'undefined') return;
        window.localStorage.removeItem(conversationMemoryKey);
    }, [conversationMemoryKey]);

    const readRememberedFilter = useCallback(() => {
        if (!filterMemoryKey || typeof window === 'undefined') return '';
        return window.localStorage.getItem(filterMemoryKey) || '';
    }, [filterMemoryKey]);

    const rememberSidebarFilter = useCallback((tab) => {
        if (!filterMemoryKey || typeof window === 'undefined' || !validSidebarTabs.includes(tab)) return;
        window.localStorage.setItem(filterMemoryKey, tab);
    }, [filterMemoryKey, validSidebarTabs]);

    const applySidebarTab = useCallback((tab, { persist = true } = {}) => {
        const nextTab = validSidebarTabs.includes(tab) ? tab : defaultSidebarTab;
        setSidebarTab(nextTab);
        if (persist) rememberSidebarFilter(nextTab);
    }, [defaultSidebarTab, rememberSidebarFilter, validSidebarTabs]);

    // Keep ref in sync for use in Echo callbacks
    useEffect(() => { selectedConvRef.current = selectedConv; }, [selectedConv]);

    useEffect(() => {
        if (!customerFilterId || !selectedConv || conversationMatchesCustomerFilter(selectedConv)) return;

        selectedConvRef.current = null;
        setSelectedConv(null);
        setMessages([]);
        setHasOlderMessages(false);
        setMessagesLoading(false);
    }, [conversationMatchesCustomerFilter, customerFilterId, selectedConv]);

    useEffect(() => {
        const rememberedTab = readRememberedFilter();
        applySidebarTab(validSidebarTabs.includes(rememberedTab) ? rememberedTab : defaultSidebarTab, { persist: false });
    }, [applySidebarTab, defaultSidebarTab, readRememberedFilter, validSidebarTabs]);

    useEffect(() => {
        setConversationSearch('');
        setConversationVisibleLimit(24);
    }, [sidebarTab]);

    useEffect(() => {
        setConversationVisibleLimit(24);
    }, [conversationSearch]);

    useEffect(() => {
        const timer = window.setInterval(() => setRelativeNow(Date.now()), 10000);
        return () => window.clearInterval(timer);
    }, []);

    // ─── Data Fetching ───

    const liveChannels = useMemo(() => operationalChannelsForUser(user), [user?.id, user?.role]);
    const conversationsResource = useLiveResource('/api/chat/conversations', {
        cacheKey: 'chat:conversations',
        channels: liveChannels,
        eventNames: ['.operational.resource.changed', '.conversation.created', '.conversation.claimed'],
        resources: ['chat'],
        interval: hasRealtime ? 60000 : 15000,
        select: (payload) => payload,
    });

    const applyConversationsPayload = useCallback((d) => {
        if (!d || d.data === null) return;
        setUnassigned(d.unassigned || []);
        setMyChats(d.my_chats || []);
        setAdminNeedsAttention(d.needs_attention || []);
        setAdminAllActive(d.all_active || d.all_chats || []);
        setAdminResolved(d.resolved || []);
        if (typeof onMetricsChange === 'function') {
            onMetricsChange({
                open: d.summary?.open_conversations ?? (d.all_active || d.all_chats || []).length,
                needsAttention: d.summary?.needs_attention ?? (d.needs_attention || []).length,
                unassigned: d.summary?.unassigned ?? (d.unassigned || []).length,
                resolvedToday: d.summary?.resolved_today ?? (d.resolved || []).length,
            });
        }
        setLoading(false);
    }, [onMetricsChange]);

    const fetchConversations = useCallback(async ({ silent = true, force = true } = {}) => {
        const payload = await conversationsResource.refetch({ silent, force, reason: 'manual' });
        applyConversationsPayload(payload);
        setLoading(false);
        return payload;
    }, [applyConversationsPayload, conversationsResource.refetch]);

    const patchConversationPreview = useCallback((conversationId, message) => {
        if (!conversationId || !message) return;
        const updater = (conv) => {
            if (String(conv.id) !== String(conversationId)) return conv;

            return {
                ...conv,
                last_message: message.deleted_at ? 'Message deleted' : message.message,
                last_message_id: message.id && !String(message.id).startsWith('tmp-') ? message.id : conv.last_message_id,
                last_message_created_at: message.created_at || conv.last_message_created_at,
                last_message_time: message.optimistic_status === 'sending' ? 'sending...' : 'just now',
            };
        };

        setUnassigned((items) => items.map(updater));
        setMyChats((items) => items.map(updater));
        setAdminNeedsAttention((items) => items.map(updater));
        setAdminAllActive((items) => items.map(updater));
        setAdminResolved((items) => items.map(updater));
        setSelectedConv((conv) => conv && String(conv.id) === String(conversationId) ? updater(conv) : conv);
    }, []);

    const scheduleConversationsRefresh = useCallback((delay = 1200) => {
        window.clearTimeout(conversationRefreshTimerRef.current);
        conversationRefreshTimerRef.current = window.setTimeout(() => {
            fetchConversations({ silent: true, force: true });
        }, delay);
    }, [fetchConversations]);

    const normalizeMessagesResponse = useCallback((payload) => {
        if (Array.isArray(payload)) {
            return { data: sortMessagesOldestFirst(payload), pagination: { has_more: false } };
        }

        return {
            data: sortMessagesOldestFirst(Array.isArray(payload?.data) ? payload.data : []),
            pagination: payload?.pagination || { has_more: false },
        };
    }, []);

    const getConversationCacheMarker = useCallback((conversation, latestMessage = null) => {
        if (!conversation) return '';
        const latestId = latestMessage?.id ?? conversation.last_message_id ?? '';
        const latestCreatedAt = latestMessage?.created_at ?? conversation.last_message_created_at ?? '';
        if (latestId) return String(latestId);

        return [
            latestCreatedAt,
            latestMessage?.message ?? conversation.last_message ?? '',
        ].join('|');
    }, []);

    const rememberMessages = useCallback((conversationId, nextMessages, hasMore, marker = '') => {
        if (!conversationId) return;

        const key = String(conversationId);
        messageCacheRef.current.delete(key);
        messageCacheRef.current.set(String(conversationId), {
            messages: sortMessagesOldestFirst(nextMessages),
            hasOlderMessages: Boolean(hasMore),
            marker,
            cachedAt: Date.now(),
        });
        chatMessageStore.set(conversationId, {
            messages: sortMessagesOldestFirst(nextMessages),
            hasOlderMessages: Boolean(hasMore),
            marker,
        });

        while (messageCacheRef.current.size > MESSAGE_CACHE_LIMIT) {
            const oldestKey = messageCacheRef.current.keys().next().value;
            messageCacheRef.current.delete(oldestKey);
        }
    }, []);

    const cacheIsUsable = useCallback((cached, marker = '', force = false) => {
        if (!cached || force) return false;
        const isFresh = Date.now() - Number(cached.cachedAt || 0) < MESSAGE_CACHE_TTL_MS;

        return isFresh && (!marker || cached.marker === marker);
    }, []);

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
            sender_role: user?.role || 'Staff',
            message,
            is_mine: true,
            read_at: null,
            created_at: createdAt.toISOString(),
            time: localTimeLabel(createdAt),
            optimistic_status: 'sending',
        };
    }, [user?.full_name, user?.id, user?.role, user?.username]);

    const patchCachedMessages = useCallback((conversationId, updater) => {
        const key = String(conversationId || '');
        const cached = messageCacheRef.current.get(key);
        if (!cached) return null;
        const nextMessages = updater(cached.messages || []);
        rememberMessages(key, nextMessages, cached.hasOlderMessages, cached.marker);
        return nextMessages;
    }, [rememberMessages]);

    const fetchMessages = useCallback(async (conversation, { force = false, prefetch = false } = {}) => {
        const conversationId = typeof conversation === 'object' ? conversation?.id : conversation;
        if (!conversationId) return;

        const cacheKey = String(conversationId);
        const marker = typeof conversation === 'object' ? getConversationCacheMarker(conversation) : '';
        let cached = messageCacheRef.current.get(cacheKey);

        if (!cached) {
            const stored = await chatMessageStore.get(cacheKey);
            if (stored?.messages?.length) {
                messageCacheRef.current.set(cacheKey, stored);
                cached = stored;
            }
        }

        const cacheIsFresh = cacheIsUsable(cached, marker, force);
        const shouldShowLoading = !cached || (!cacheIsFresh && (cached.messages || []).length === 0);

        if (cached) {
            if (!prefetch) {
                shouldScrollToBottomRef.current = true;
                setMessages(cached.messages);
                setHasOlderMessages(cached.hasOlderMessages);
                setMessagesLoading(shouldShowLoading);
            }

            if (cacheIsFresh) {
                return cached.messages;
            }
        } else if (!prefetch) {
            setMessages([]);
            setHasOlderMessages(false);
            setMessagesLoading(shouldShowLoading);
        }

        const requestId = prefetch ? messageFetchRequestRef.current : messageFetchRequestRef.current + 1;
        if (!prefetch) {
            messageFetchRequestRef.current = requestId;
        }

        try {
            const latestServerId = chatMessageStore.latestServerMessageId(cached?.messages || []);
            const params = new URLSearchParams({ limit: String(MESSAGE_PAGE_LIMIT) });
            if (latestServerId > 0 && cached?.messages?.length) {
                params.set('after_id', String(latestServerId));
            }

            const res = await fetch(`/api/chat/conversations/${conversationId}/messages?${params.toString()}`);
            if (res.ok) {
                const d = normalizeMessagesResponse(await res.json());
                const baseMessages = cached?.messages?.length && latestServerId > 0 ? cached.messages : [];
                const nextMessages = d.data.reduce((items, message) => mergeMessageIntoList(items, message), baseMessages);
                const hasMore = latestServerId > 0 && cached?.messages?.length
                    ? Boolean(cached.hasOlderMessages)
                    : Boolean(d.pagination?.has_more);
                rememberMessages(conversationId, nextMessages, hasMore, getConversationCacheMarker(conversation, nextMessages[nextMessages.length - 1]) || marker);

                if (prefetch) {
                    return nextMessages;
                }

                if (messageFetchRequestRef.current !== requestId || String(selectedConvRef.current?.id || '') !== cacheKey) {
                    return;
                }

                shouldScrollToBottomRef.current = true;
                setMessages(nextMessages);
                setHasOlderMessages(hasMore);
            }
        } catch (e) { /* silent */ }
        finally {
            if (!prefetch && shouldShowLoading && messageFetchRequestRef.current === requestId && String(selectedConvRef.current?.id || '') === cacheKey) {
                setMessagesLoading(false);
            }
        }
    }, [cacheIsUsable, getConversationCacheMarker, mergeMessageIntoList, normalizeMessagesResponse, rememberMessages]);

    const prefetchMessages = useCallback((conversation) => {
        if (!conversation?.id) return;
        fetchMessages(conversation, { prefetch: true });
    }, [fetchMessages]);

    const loadOlderMessages = useCallback(async () => {
        if (!selectedConv?.id || !messages.length || loadingOlderMessages) return;
        setLoadingOlderMessages(true);
        let prependedOlderMessages = false;
        if (messagesContainerRef.current) {
            preserveOlderScrollRef.current = {
                scrollTop: messagesContainerRef.current.scrollTop,
                scrollHeight: messagesContainerRef.current.scrollHeight,
            };
        }

        try {
            const res = await fetch(`/api/chat/conversations/${selectedConv.id}/messages?limit=${MESSAGE_PAGE_LIMIT}&before_id=${messages[0].id}`);
            if (res.ok) {
                const d = normalizeMessagesResponse(await res.json());
                prependedOlderMessages = true;
                const hasMore = Boolean(d.pagination?.has_more);
                setMessages(prev => {
                    const next = sortMessagesOldestFirst([...d.data, ...prev]);
                    rememberMessages(selectedConv.id, next, hasMore, getConversationCacheMarker(selectedConv));
                    return next;
                });
                setHasOlderMessages(hasMore);
            }
        } catch (e) { /* silent */ }
        finally {
            if (!prependedOlderMessages) preserveOlderScrollRef.current = null;
            setLoadingOlderMessages(false);
        }
    }, [getConversationCacheMarker, loadingOlderMessages, messages, normalizeMessagesResponse, rememberMessages, selectedConv]);

    // ─── Initial Load + Echo Setup ───

    useEffect(() => {
        applyConversationsPayload(conversationsResource.data);
    }, [applyConversationsPayload, conversationsResource.data]);

    useEffect(() => {
        if (!conversationsResource.loading) setLoading(false);
    }, [conversationsResource.loading]);

    useEffect(() => {
        if (refreshToken > 0) {
            fetchConversations();
        }
    }, [refreshToken, fetchConversations]);

    // ─── Subscribe to Conversation Channel When Selected ───

    useEffect(() => {
        if (!selectedConv || !window.Echo) return;

        const channelName = `conversation.${selectedConv.id}`;

        // Leave previous channel if different
        Object.keys(echoChannelsRef.current).forEach(ch => {
            if (ch !== channelName) {
                window.Echo.leave(ch);
                delete echoChannelsRef.current[ch];
            }
        });

        // Subscribe to new conversation channel
        if (!echoChannelsRef.current[channelName]) {
            const channel = window.Echo.private(channelName)
                .listen('.message.sent', (e) => {
                    // Skip our own messages — already added from HTTP response
                    if (e.messageData.sender_id === user?.id) return;

                    if (selectedConvRef.current?.id === e.conversationId) {
                        setMessages(prev => {
                            shouldScrollToBottomRef.current = true;
                            const next = mergeMessageIntoList(prev, { ...e.messageData, is_mine: false });
                            const cached = messageCacheRef.current.get(String(e.conversationId));
                            rememberMessages(e.conversationId, next, cached?.hasOlderMessages ?? hasOlderMessages, getConversationCacheMarker(selectedConvRef.current, e.messageData));
                            return next;
                        });
                    }
                    patchConversationPreview(e.conversationId, e.messageData);
                    scheduleConversationsRefresh();
                });
            echoChannelsRef.current[channelName] = channel;
        }

        return () => {
            // Cleanup on unmount
        };
    }, [getConversationCacheMarker, hasOlderMessages, mergeMessageIntoList, patchConversationPreview, rememberMessages, scheduleConversationsRefresh, selectedConv, user?.id]);

    useEffect(() => () => {
        window.clearTimeout(conversationRefreshTimerRef.current);
    }, []);

    // Keep scrolling scoped to the message list so parent panels and headers never get pulled out of view.
    useLayoutEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        if (preserveOlderScrollRef.current) {
            const previous = preserveOlderScrollRef.current;
            preserveOlderScrollRef.current = null;
            container.scrollTop = container.scrollHeight - previous.scrollHeight + previous.scrollTop;
            return;
        }

        if (!shouldScrollToBottomRef.current) return;
        shouldScrollToBottomRef.current = false;
        container.scrollTop = container.scrollHeight;
    }, [messages]);

    // ─── Actions ───

    const selectConversation = useCallback((conv, options = {}) => {
        const isSameConversation = String(selectedConvRef.current?.id || '') === String(conv.id);
        const cached = messageCacheRef.current.get(String(conv.id));
        const cacheIsFresh = cacheIsUsable(cached, getConversationCacheMarker(conv));
        const tabToRemember = options.tab || sidebarTab;
        selectedConvRef.current = conv;
        setSelectedConv(conv);
        rememberSelectedConversation(conv, tabToRemember);
        setShowAdminActions(false);
        setShowTransfer(false);
        setShowContextDrawer(false);
        setModerationNotice(null);

        if ((isSameConversation || cacheIsFresh) && cached) {
            setMessages(cached.messages);
            setHasOlderMessages(cached.hasOlderMessages);
            setMessagesLoading(false);
            if (cacheIsFresh) return;
        }

        fetchMessages(conv);
    }, [cacheIsUsable, fetchMessages, getConversationCacheMarker, rememberSelectedConversation, sidebarTab]);

    useEffect(() => {
        const targetId = String(targetConversationId || '').trim();
        if (!targetId || String(selectedConvRef.current?.id || '') === targetId) return;

        const conversationBuckets = isAdminOversight
            ? [
                ['needs-attention', adminNeedsAttention],
                ['all-active', adminAllActive],
                ['unassigned', unassigned],
                ['resolved', adminResolved],
            ]
            : [
                ['unassigned', unassigned],
                ['my-chats', myChats],
            ];
        const match = conversationBuckets
            .map(([tab, conversations]) => {
                const index = conversations.findIndex((conv) => String(conv.id) === targetId);
                return [tab, conversations[index], index];
            })
            .find(([, conversation]) => Boolean(conversation));

        if (!match) return;

        applySidebarTab(match[0]);
        setConversationVisibleLimit((limit) => Math.max(limit, Number(match[2] || 0) + 1, 24));
        selectConversation(match[1], { tab: match[0] });
    }, [adminAllActive, adminNeedsAttention, adminResolved, applySidebarTab, isAdminOversight, myChats, selectConversation, targetConversationId, unassigned]);

    useEffect(() => {
        if (String(targetConversationId || '').trim() || selectedConvRef.current?.id) return;

        const remembered = readRememberedConversation();
        const rememberedId = String(remembered?.id || '').trim();
        if (!rememberedId) return;

        const conversationBuckets = isAdminOversight
            ? [
                ['needs-attention', adminNeedsAttention],
                ['all-active', adminAllActive],
                ['unassigned', unassigned],
                ['resolved', adminResolved],
            ]
            : [
                ['unassigned', unassigned],
                ['my-chats', myChats],
            ];
        const match = conversationBuckets
            .map(([tab, conversations]) => {
                const index = conversations.findIndex((conv) => String(conv.id) === rememberedId);
                return [tab, conversations[index], index];
            })
            .find(([, conversation]) => Boolean(conversation));

        if (!match) return;

        const rememberedFilter = readRememberedFilter();
        if (!validSidebarTabs.includes(rememberedFilter)) {
            applySidebarTab(match[0], { persist: false });
        }
        setConversationVisibleLimit((limit) => Math.max(limit, Number(match[2] || 0) + 1, 24));
        selectConversation(match[1], { tab: match[0] });
    }, [adminAllActive, adminNeedsAttention, adminResolved, applySidebarTab, isAdminOversight, myChats, readRememberedConversation, readRememberedFilter, selectConversation, targetConversationId, unassigned, validSidebarTabs]);

    const handleClaim = async () => {
        if (!selectedConv || claiming) return;
        setClaiming(true);
        try {
            const res = await csrfFetch(`/api/chat/conversations/${selectedConv.id}/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            });
            if (res.ok) {
                const d = await res.json();
                setSelectedConv({ ...selectedConv, ...d.conversation });
                applySidebarTab(isAdminOversight ? 'all-active' : 'my-chats');
                fetchConversations();
            } else {
                const err = await res.json();
                setErrorModal({ isOpen: true, message: err.error || 'Failed to claim conversation.' });
            }
        } catch (e) {
            console.error('Claim failed:', e);
            setErrorModal({ isOpen: true, message: 'Failed to claim conversation.' });
        }
        finally { setClaiming(false); }
    };

    const handleAdminJoin = async () => {
        if (!selectedConv || claiming) return;
        setClaiming(true);
        try {
            const res = await csrfFetch(`/api/chat/conversations/${selectedConv.id}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'Failed to join conversation.');
            setSelectedConv(payload.conversation || selectedConv);
            fetchConversations();
        } catch (e) {
            setErrorModal({ isOpen: true, message: e.message || 'Failed to join conversation.' });
        } finally {
            setClaiming(false);
        }
    };

    const handleResolve = async () => {
        if (!selectedConv) return;
        setResolveConfirmOpen(true);
    };

    const confirmResolve = async () => {
        if (!selectedConv) return;
        try {
            const res = await csrfFetch(`/api/chat/conversations/${selectedConv.id}/resolve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            });
            if (res.ok) {
                clearRememberedConversation();
                selectedConvRef.current = null;
                setSelectedConv(null);
                setMessages([]);
                fetchConversations();
            }
        } catch (e) {
            console.error('Resolve failed:', e);
            setErrorModal({ isOpen: true, message: 'Failed to resolve conversation.' });
        } finally {
            setResolveConfirmOpen(false);
        }
    };

    const fetchAvailableStaff = async () => {
        try {
            const res = await fetch('/api/chat/staff/available');
            if (res.ok) setAvailableStaff(await res.json());
        } catch (e) { console.error(e); }
    };

    const handleTransfer = async (staffId) => {
        if (!selectedConv || transferring) return;
        setTransferring(true);
        try {
            const res = await csrfFetch(`/api/chat/conversations/${selectedConv.id}/transfer-owner`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ new_staff_id: staffId })
            });
            if (res.ok) {
                setShowTransfer(false);
                setShowAdminActions(false);
                clearRememberedConversation();
                selectedConvRef.current = null;
                setSelectedConv(null);
                setMessages([]);
                fetchConversations();
            } else {
                const err = await res.json();
                setErrorModal({ isOpen: true, message: err.error || 'Failed to transfer.' });
            }
        } catch (e) {
            console.error('Transfer failed');
            setErrorModal({ isOpen: true, message: 'Failed to transfer.' });
        }
        finally { setTransferring(false); }
    };

    const handleInvite = async (staffId) => {
        if (!selectedConv || transferring) return;
        setTransferring(true);
        try {
            const res = await csrfFetch(`/api/chat/conversations/${selectedConv.id}/collaborators`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ user_id: staffId })
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'Failed to invite staff.');
            setShowTransfer(false);
            setShowAdminActions(false);
            setSelectedConv(payload.conversation || selectedConv);
            fetchConversations();
        } catch (e) {
            setErrorModal({ isOpen: true, message: e.message || 'Failed to invite staff.' });
        }
        finally { setTransferring(false); }
    };

    const handleLeave = async () => {
        if (!selectedConv || !user?.id) return;
        try {
            const res = await csrfFetch(`/api/chat/conversations/${selectedConv.id}/collaborators/${user.id}`, {
                method: 'DELETE',
                headers: { 'Accept': 'application/json' },
            });
            if (res.ok) {
                clearRememberedConversation();
                selectedConvRef.current = null;
                setSelectedConv(null);
                setMessages([]);
                fetchConversations();
            }
        } catch (e) {
            setErrorModal({ isOpen: true, message: 'Failed to leave chat.' });
        }
    };

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

    const sendOptimisticMessage = async (conversation, outgoingMessage, clientTempId) => {
        try {
            const res = await csrfFetch(`/api/chat/conversations/${conversation.id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ message: outgoingMessage, client_temp_id: clientTempId }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (payload?.moderation?.blocked) {
                    patchCachedMessages(conversation.id, (items) => items.filter((item) => item.client_temp_id !== clientTempId));
                    setMessages((prev) => prev.filter((item) => item.client_temp_id !== clientTempId));
                    setNewMessage(outgoingMessage);
                    showModerationFeedback(payload);
                    return;
                }
                throw new Error(payload.error || 'Message could not be sent.');
            }
            shouldScrollToBottomRef.current = true;
            setMessages(prev => {
                const next = mergeMessageIntoList(prev, { ...payload, optimistic_status: 'sent' });
                rememberMessages(conversation.id, next, hasOlderMessages, getConversationCacheMarker(conversation, payload));
                return next;
            });
            patchConversationPreview(conversation.id, payload);
            setModerationNotice(null);
            scheduleConversationsRefresh();
        } catch (error) {
            setMessages(prev => {
                const next = prev.map((item) => item.client_temp_id === clientTempId
                    ? { ...item, optimistic_status: 'failed', error: error.message || 'Message could not be sent.' }
                    : item);
                rememberMessages(conversation.id, next, hasOlderMessages, getConversationCacheMarker(conversation));
                return next;
            });
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || sending || !selectedConv) return;
        const outgoingMessage = newMessage.trim();
        if (blockIfModerated(outgoingMessage)) return;

        const clientTempId = createClientTempId();
        const optimistic = optimisticMessageFor(selectedConv.id, outgoingMessage, clientTempId);
        setSending(true);
        setNewMessage('');
        shouldScrollToBottomRef.current = true;
        setMessages(prev => {
            const next = mergeMessageIntoList(prev, optimistic);
            rememberMessages(selectedConv.id, next, hasOlderMessages, getConversationCacheMarker(selectedConv, optimistic));
            return next;
        });
        patchConversationPreview(selectedConv.id, optimistic);

        await sendOptimisticMessage(selectedConv, outgoingMessage, clientTempId);
        setSending(false);
    };

    const retryFailedMessage = (msg) => {
        if (!selectedConv || !msg?.message) return;
        const clientTempId = msg.client_temp_id || createClientTempId();
        const retryMessage = { ...msg, client_temp_id: clientTempId, optimistic_status: 'sending', error: null };
        shouldScrollToBottomRef.current = true;
        setMessages(prev => {
            const next = mergeMessageIntoList(prev, retryMessage);
            rememberMessages(selectedConv.id, next, hasOlderMessages, getConversationCacheMarker(selectedConv, retryMessage));
            return next;
        });
        sendOptimisticMessage(selectedConv, msg.message, clientTempId);
    };

    const removeFailedMessage = (msg) => {
        if (!selectedConv || !msg?.client_temp_id) return;
        setMessages(prev => {
            const next = prev.filter((item) => item.client_temp_id !== msg.client_temp_id);
            rememberMessages(selectedConv.id, next, hasOlderMessages, getConversationCacheMarker(selectedConv));
            return next;
        });
    };

    // ─── Booking Card Rendering (preserved from original) ───

    const parseBookingCard = (text) => {
        if (!text) return null;
        try {
            const parsed = JSON.parse(text);
            if (parsed?.type === 'booking_details' && parsed.booking) return parsed.booking;
        } catch (e) {
            // Legacy text cards still render.
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
        if (!msg || msg.deleted_at) return false;
        const ownRecent = msg.is_mine && Date.now() - new Date(msg.created_at || 0).getTime() <= 15 * 60 * 1000;
        return ownRecent || user?.role === 'Admin' || (user?.role === 'Marketing' && selectedConv?.staff_id === user?.id);
    };

    const startEditMessage = (msg) => {
        setOpenActionMessageId(null);
        setEditingMessageId(msg.id);
        setEditingText(msg.message);
    };

    const handleInternalNote = () => {
        if (!selectedConv) return;
        setShowAdminActions(false);
        setInternalNoteModal({ isOpen: true, conversation: selectedConv, busy: false });
    };

    const closeInternalNoteModal = () => {
        setInternalNoteModal({ isOpen: false, conversation: null, busy: false });
    };

    const saveInternalNote = async (note) => {
        const conversation = internalNoteModal.conversation;
        if (!conversation) return;

        setInternalNoteModal(prev => ({ ...prev, busy: true }));
        try {
            const res = await csrfFetch(`/api/chat/conversations/${conversation.id}/internal-notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ internal_notes: note }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'Failed to save internal note.');
            setSelectedConv(prev => prev ? { ...prev, internal_notes: payload.internal_notes || note } : prev);
            closeInternalNoteModal();
            fetchConversations();
        } catch (e) {
            setInternalNoteModal(prev => ({ ...prev, busy: false }));
            setErrorModal({ isOpen: true, message: e.message || 'Failed to save internal note.' });
        }
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
            setMessages(prev => {
                const next = prev.map(item => item.id === msg.id ? payload : item);
                if (selectedConv?.id) {
                    rememberMessages(selectedConv.id, next, hasOlderMessages, getConversationCacheMarker(selectedConv));
                }
                return next;
            });
            setModerationNotice(null);
            cancelEditMessage();
            patchConversationPreview(selectedConv?.id, payload);
            scheduleConversationsRefresh();
        } catch (e) {
            setErrorModal({ isOpen: true, message: e.message || 'Could not edit message.' });
        }
    };

    const requestDeleteMessage = (msg) => {
        setOpenActionMessageId(null);
        if (msg.is_mine) {
            setDeleteConfirmModal({ isOpen: true, message: msg, busy: false });
            return;
        }
        setModerationDeleteModal({ isOpen: true, message: msg, busy: false });
    };

    const deleteMessage = async (msg, reason = '') => {
        try {
            const res = await csrfFetch(`/api/chat/messages/${msg.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'Could not delete message.');
            setMessages(prev => {
                const next = prev.map(item => item.id === msg.id ? payload.data : item);
                if (selectedConv?.id) {
                    rememberMessages(selectedConv.id, next, hasOlderMessages, getConversationCacheMarker(selectedConv));
                }
                return next;
            });
            setDeleteConfirmModal({ isOpen: false, message: null, busy: false });
            setModerationDeleteModal({ isOpen: false, message: null, busy: false });
            patchConversationPreview(selectedConv?.id, payload.data);
            scheduleConversationsRefresh();
        } catch (e) {
            setDeleteConfirmModal(prev => prev.isOpen ? { ...prev, busy: false } : prev);
            setModerationDeleteModal(prev => prev.isOpen ? { ...prev, busy: false } : prev);
            setErrorModal({ isOpen: true, message: e.message || 'Could not delete message.' });
        }
    };

    const confirmOwnMessageDelete = () => {
        const msg = deleteConfirmModal.message;
        if (!msg) return;
        setDeleteConfirmModal(prev => ({ ...prev, busy: true }));
        deleteMessage(msg);
    };

    const confirmModerationDelete = (reason) => {
        const msg = moderationDeleteModal.message;
        if (!msg) return;
        setModerationDeleteModal(prev => ({ ...prev, busy: true }));
        deleteMessage(msg, reason);
    };

    // ─── Sidebar Helpers ───

    const adminMessageSections = useMemo(() => buildMessageSections(messages), [messages]);
    const latestAdminMessageKey = useMemo(() => {
        const sortedMessages = sortMessagesOldestFirst(messages);
        const latest = sortedMessages[sortedMessages.length - 1];
        return latest ? String(latest.client_temp_id || latest.id) : '';
    }, [messages]);
    const selectedContextPayload = useMemo(() => {
        if (!selectedConv) return null;
        const identity = describeCustomerIdentity(selectedConv);

        return {
            conversationId: selectedConv.id,
            customerId: selectedConv.client_id,
            customerName: identity.customerAccountName,
            customerEmail: identity.customerAccountEmail,
            customerPhone: identity.customerAccountPhone,
            customerHandle: identity.customerAccountHandle,
            bookingContactName: identity.bookingContactName,
            bookingContactEmail: identity.bookingContactEmail,
            bookingContactPhone: identity.bookingContactPhone,
            hasDifferentBookingContact: identity.hasDifferentBookingContact,
            bookingId: selectedConv.booking_id,
            bookingRef: bookingReferenceLabel(selectedConv.booking_id),
            bookingLabel: selectedConv.booking_label,
        };
    }, [selectedConv]);

    const navigateAdminContext = useCallback((workspace, tab, options = {}) => {
        if (!selectedContextPayload || typeof staffContextNavigate !== 'function') return;
        staffContextNavigate({
            ...selectedContextPayload,
            ...options,
            workspace,
            role: workspace,
            tab,
        });
        setShowContextDrawer(false);
    }, [selectedContextPayload, staffContextNavigate]);

    const copyContextValue = useCallback(async (key, value) => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            setCopiedHelper(key);
            window.setTimeout(() => setCopiedHelper(''), 1400);
        } catch {
            setErrorModal({ isOpen: true, message: 'Could not copy this value. You can still select it manually.' });
        }
    }, []);

    const messageStatusText = (msg) => {
        const parts = [msg.time].filter(Boolean);
        if (msg.edited_at && !msg.deleted_at) parts.push('edited');
        if (msg.is_mine && msg.read_at) parts.push('read');
        if (msg.optimistic_status === 'sending') parts.push('sending');
        if (msg.optimistic_status === 'failed') parts.push('failed');
        return parts.join(' / ');
    };

    const renderAdminMessageBubble = (msg, group, index = 0) => {
        const messageKey = String(msg.client_temp_id || msg.id);
        const isLatestMessage = messageKey === latestAdminMessageKey;
        const actionMenuOpen = openActionMessageId === msg.id;
        const canUseActions = (canEditMessage(msg) || canDeleteMessage(msg)) && editingMessageId !== msg.id;
        const exactMetaText = messageStatusText(msg);
        const groupSize = group?.messages?.length || 1;
        const positionClass = groupSize <= 1
            ? 'is-single'
            : index === 0
                ? 'is-first'
                : index === groupSize - 1
                    ? 'is-last'
                    : 'is-middle';

        return (
            <div key={msg.client_temp_id || msg.id} className={`admin-chat-message ${msg.is_mine ? 'is-mine' : 'is-theirs'} ${positionClass} ${msg.optimistic_status === 'failed' ? 'is-failed' : ''}`}>
                <div className="admin-chat-message-unit">
                    <div className="admin-chat-message-row">
                        <div className="admin-chat-message-bubble">
                            {editingMessageId === msg.id ? (
                                <div className="admin-chat-message-edit">
                                    <textarea value={editingText} onChange={(event) => setEditingText(event.target.value)} rows={3} />
                                    <div>
                                        <button type="button" onClick={cancelEditMessage}>Cancel</button>
                                        <button type="button" onClick={() => saveEditedMessage(msg)}>Save</button>
                                    </div>
                                </div>
                            ) : isBookingCard(msg.message) ? renderBookingCard(msg.message, msg.is_mine) : (
                                <p className="admin-chat-message-text">{msg.message}</p>
                            )}
                        </div>
                        {canUseActions && (
                            <div className={`admin-chat-message-actions ${actionMenuOpen ? 'is-open' : ''}`}>
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setOpenActionMessageId(actionMenuOpen ? null : msg.id);
                                    }}
                                    aria-label="Message actions"
                                    aria-expanded={actionMenuOpen}
                                >
                                    <MoreVertical aria-hidden="true" />
                                </button>
                                {actionMenuOpen && (
                                    <div className="admin-chat-message-menu">
                                        {canEditMessage(msg) && (
                                            <button type="button" onClick={() => startEditMessage(msg)}>Edit message</button>
                                        )}
                                        {canDeleteMessage(msg) && (
                                            <button type="button" className="is-danger" onClick={() => requestDeleteMessage(msg)}>Delete message</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        <span className="admin-chat-message-hover-time">{exactMetaText}</span>
                    </div>
                    {isLatestMessage && (
                        <p className="admin-chat-message-meta">{formatRelativeMessageAge(msg, relativeNow)}</p>
                    )}
                    {msg.optimistic_status === 'failed' && (
                        <div className="admin-chat-message-retry">
                            <button type="button" onClick={() => retryFailedMessage(msg)}>Retry</button>
                            <button type="button" onClick={() => removeFailedMessage(msg)}>Remove</button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const adminLists = {
        'needs-attention': scopeConversationsToCustomer(adminNeedsAttention),
        'all-active': scopeConversationsToCustomer(adminAllActive),
        unassigned: scopeConversationsToCustomer(unassigned),
        resolved: scopeConversationsToCustomer(adminResolved),
    };
    const currentList = isAdminOversight
        ? (adminLists[sidebarTab] || adminLists['needs-attention'])
        : (sidebarTab === 'unassigned' ? unassigned : myChats);
    const allVisibleConversations = isAdminOversight
        ? [...adminLists['needs-attention'], ...adminLists['all-active'], ...adminLists.unassigned, ...adminLists.resolved]
        : [...unassigned, ...myChats];
    const totalUnread = Array.from(new Map(allVisibleConversations.map((conv) => [conv.id, conv])).values())
        .reduce((sum, c) => sum + (c.unread_count || 0), 0);
    const canReply = Boolean(selectedConv?.can_reply);
    const canTransfer = Boolean(selectedConv?.can_transfer);
    const canResolve = Boolean(selectedConv?.can_resolve);
    const canInvite = Boolean(selectedConv?.can_invite);
    const isCollaborator = Boolean(selectedConv?.collaborators?.some((member) => member.id === user?.id));
    const adminJoined = Boolean(selectedConv?.admin_observers?.some((member) => member.id === user?.id));
    const isClaimedByMe = canReply;
    const selectedOwnerName = selectedConv?.owner?.name || selectedConv?.staff_name;
    const getConversationOwnerLabel = (conv) => {
        if (conv.client_is_deactivated) return 'Archived due to deactivation';
        if (conv.status === 'resolved') return 'Resolved';
        if (conv.admin_observers?.length) return 'Admin joined';
        if (conv.owner?.name || conv.staff_name) return `Handled by ${conv.owner?.name || conv.staff_name}`;
        return 'Unassigned';
    };
    const getAdminConversationChips = (conv) => {
        const chips = [];
        if (!conv) return chips;
        if (conv.client_is_deactivated) {
            chips.push(['Deactivated customer', 'bg-slate-100 text-slate-700 border-slate-200']);
        }
        if (conv.status === 'resolved') {
            chips.push(['Resolved', 'bg-emerald-50 text-emerald-700 border-emerald-100']);
        } else if (!conv.staff_id) {
            chips.push(['Unassigned', 'bg-amber-50 text-amber-700 border-amber-100']);
        } else {
            chips.push([conv.admin_observers?.length ? 'Admin joined' : 'Marketing owned', conv.admin_observers?.length ? 'bg-primary-50 text-primary-700 border-primary-100' : 'bg-slate-50 text-slate-600 border-slate-200']);
        }
        if ((conv.unread_count || 0) > 0) {
            chips.push(['Needs attention', 'bg-red-50 text-red-700 border-red-100']);
        }
        return chips;
    };
    const conversationMatchesSearch = (conv, term) => {
        if (!term) return true;
        const identity = describeCustomerIdentity(conv);

        return [
            identity.customerAccountName,
            identity.customerAccountHandle,
            identity.customerAccountEmail,
            identity.customerAccountPhone,
            identity.bookingContactName,
            identity.bookingContactEmail,
            identity.bookingContactPhone,
            conv.booking_label,
            conv.booking_reference,
            conv.booking_status,
            conv.conversation_context,
            conv.last_message,
            conv.status,
            conv.owner?.name,
            conv.staff_name,
            getConversationOwnerLabel(conv),
        ].some((value) => String(value || '').toLowerCase().includes(term));
    };
    const getEmptyText = () => {
        if (!isAdminOversight) {
            return sidebarTab === 'unassigned'
                ? ['No unassigned inquiries', 'New client messages will appear here']
                : ['No active chats', 'Claim an inquiry to start chatting'];
        }
        const messages = {
            'needs-attention': ['No conversations need Admin attention', 'Unread, overdue, and escalated chats will appear here.'],
            'all-active': ['No active conversations', 'Current customer conversations will appear here.'],
            unassigned: ['No unassigned conversations', 'New conversations waiting for staff assignment will appear here.'],
            resolved: ['No recently resolved conversations', 'Closed conversations stay preserved for archive search and review.'],
        };
        return messages[sidebarTab] || messages['needs-attention'];
    };
    const emptyText = getEmptyText();
    const canUseStaffContextNavigation = typeof staffContextNavigate === 'function' && Boolean(selectedContextPayload?.customerId || selectedContextPayload?.bookingId || selectedContextPayload?.customerName || selectedContextPayload?.customerEmail);
    const staffContextSearchText = selectedContextPayload?.bookingRef || selectedContextPayload?.bookingContactName || selectedContextPayload?.customerName || selectedContextPayload?.customerEmail || '';
    const staffContextRole = String(user?.role || '').toLowerCase() === 'accounting' ? 'accounting' : 'marketing';
    const staffContextDefaultTab = staffContextRole === 'accounting' ? 'payments' : 'bookings';
    const openStaffContext = (target = {}) => {
        if (!canUseStaffContextNavigation) return;
        staffContextNavigate({
            ...selectedContextPayload,
            ...target,
            searchText: target.searchText || staffContextSearchText,
        });
        setShowContextDrawer(false);
    };
    const copySelectedEmail = () => copyContextValue('email', selectedContextPayload?.customerEmail || selectedContextPayload?.bookingContactEmail);
    const copySelectedPhone = () => copyContextValue('phone', selectedContextPayload?.customerPhone || selectedContextPayload?.bookingContactPhone);

    // ─── Render ───

    if (isAdminOversight) {
        const adminFilterOptions = [
            ['needs-attention', 'Needs attention', adminLists['needs-attention'].length],
            ['all-active', 'Active', adminLists['all-active'].length],
            ['unassigned', 'Unassigned', adminLists.unassigned.length],
            ['resolved', 'Recent resolved', adminLists.resolved.length],
        ];
        const selectedIdentity = selectedConv ? describeCustomerIdentity(selectedConv) : null;
        const selectedChips = getAdminConversationChips(selectedConv);
        const selectedOwnerLabel = selectedConv?.status === 'resolved'
            ? 'Resolved'
            : selectedOwnerName
                ? `Handled by ${selectedOwnerName}`
                : 'Unassigned';
        const conversationSearchTerm = conversationSearch.trim().toLowerCase();
        const filteredCurrentList = currentList.filter((conv) => conversationMatchesSearch(conv, conversationSearchTerm));
        const visibleConversationList = filteredCurrentList.slice(0, conversationVisibleLimit);
        const hasMoreConversations = filteredCurrentList.length > conversationVisibleLimit;
        const visibleCountLabel = conversationSearchTerm
            ? `${filteredCurrentList.length} of ${currentList.length}`
            : hasMoreConversations
                ? `${visibleConversationList.length} of ${filteredCurrentList.length}`
                : `${filteredCurrentList.length} shown`;
        const canUseContextNavigation = typeof staffContextNavigate === 'function' && Boolean(selectedContextPayload?.customerId);
        const contextSearchText = selectedContextPayload?.bookingRef || selectedContextPayload?.bookingContactName || selectedContextPayload?.customerName || selectedContextPayload?.customerEmail || '';
        const contextHelperActions = [
            {
                id: 'open-customer',
                label: 'Open customer',
                icon: UserRound,
                disabled: !canUseContextNavigation,
                onClick: () => navigateAdminContext('customer', 'dashboard'),
            },
            {
                id: 'bookings',
                label: 'Bookings',
                icon: ClipboardList,
                disabled: !canUseContextNavigation,
                onClick: () => navigateAdminContext('marketing', 'bookings', { searchText: contextSearchText }),
            },
            {
                id: 'payments',
                label: 'Payments',
                icon: CreditCard,
                disabled: !canUseContextNavigation,
                onClick: () => navigateAdminContext('accounting', 'payments', { financeSegment: 'payments', searchText: contextSearchText }),
            },
            {
                id: 'history',
                label: 'History',
                icon: History,
                disabled: !canUseContextNavigation,
                onClick: () => navigateAdminContext('customer', 'history'),
            },
            {
                id: 'event-details',
                label: 'Event details',
                icon: CalendarDays,
                hidden: !selectedContextPayload?.bookingId,
                disabled: !canUseContextNavigation,
                onClick: () => navigateAdminContext('customer', 'details'),
            },
            {
                id: 'copy-email',
                label: copiedHelper === 'email' ? 'Email copied' : 'Copy email',
                icon: Mail,
                disabled: !selectedContextPayload?.customerEmail,
                onClick: () => copyContextValue('email', selectedContextPayload?.customerEmail),
            },
            {
                id: 'copy-phone',
                label: copiedHelper === 'phone' ? 'Phone copied' : 'Copy phone',
                icon: Phone,
                hidden: !selectedContextPayload?.customerPhone,
                disabled: !selectedContextPayload?.customerPhone,
                onClick: () => copyContextValue('phone', selectedContextPayload?.customerPhone),
            },
            {
                id: 'internal-note',
                label: 'Internal note',
                icon: NotebookPen,
                onClick: handleInternalNote,
            },
        ].filter(action => !action.hidden);

        const containerClass = isAdminFullSurface
            ? 'admin-full-chat overflow-hidden bg-white'
            : 'overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm';
        const containerStyle = isAdminFullSurface ? undefined : { height: '640px' };
        const listRailClass = isAdminFullSurface
            ? 'admin-chat-list-rail flex min-h-0 w-[18rem] flex-shrink-0 flex-col border-r border-gray-200 bg-white'
            : 'flex min-h-0 w-[19rem] flex-shrink-0 flex-col border-r border-gray-200 bg-white';
        const listHeaderClass = isAdminFullSurface
            ? 'admin-conversation-rail-head border-b border-gray-100 bg-white px-5 py-4'
            : 'admin-conversation-rail-head border-b border-gray-100 bg-gray-50/80 px-4 py-3';
        const threadClass = isAdminFullSurface
            ? 'admin-chat-thread flex min-h-0 min-w-0 flex-1 flex-col bg-white'
            : 'flex min-h-0 min-w-0 flex-1 flex-col bg-gray-50/30';
        const emptyCardClass = isAdminFullSurface
            ? 'max-w-md text-center'
            : 'max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm';
        const messagePaneClass = isAdminFullSurface
            ? 'admin-chat-messages-pane min-h-0 flex-1 space-y-4 overflow-y-auto bg-white px-8 py-7'
            : 'min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-6';
        const contextRailClass = isAdminFullSurface
            ? `admin-context-rail w-[19rem] flex-shrink-0 ${showContextDrawer ? 'is-open' : ''}`
            : 'min-h-0 w-72 flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-white p-4';

        return (
            <div className={containerClass} style={containerStyle}>
                <div className="flex h-full min-h-0">
                    <aside className={listRailClass}>
                        <div className={listHeaderClass}>
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-sm font-black text-gray-950">Conversation oversight</h3>
                                <div className="flex items-center gap-2">
                                    <LiveSyncIndicator
                                        state={conversationsResource.syncState}
                                        refreshing={conversationsResource.refreshing}
                                        lastSyncedAt={conversationsResource.lastSyncedAt}
                                        error={conversationsResource.error}
                                        onRetry={conversationsResource.refetch}
                                        compact
                                        visibility={conversationsResource.refreshing ? 'always' : 'exceptions'}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fetchConversations({ silent: false, force: true })}
                                        disabled={loading || conversationsResource.refreshing}
                                        className="admin-conversation-header-refresh"
                                        aria-label="Refresh conversations"
                                        title="Refresh conversations"
                                    >
                                        <RefreshCw className={conversationsResource.refreshing ? 'animate-spin' : ''} aria-hidden="true" />
                                    </button>
                                    {totalUnread > 0 && (
                                        <span className="rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-black text-white">{totalUnread} new</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="admin-conversation-filter-panel">
                            <div className="admin-conversation-filter-grid" role="tablist" aria-label="Conversation filters">
                                {adminFilterOptions.map(([id, label, count]) => {
                                    const isSelected = sidebarTab === id;

                                    return (
                                        <button
                                            key={id}
                                            type="button"
                                            role="tab"
                                            aria-selected={isSelected}
                                            onClick={() => applySidebarTab(id)}
                                            className={`admin-conversation-filter-card ${isSelected ? 'is-active' : ''}`}
                                        >
                                            <span className="admin-conversation-filter-main">
                                                <span className="admin-conversation-filter-label">{label}</span>
                                                <span className="admin-conversation-filter-count">{count}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {!loading && currentList.length > 0 && (
                            <div className="admin-conversation-list-tools">
                                <label className="admin-conversation-list-search">
                                    <Search aria-hidden="true" />
                                    <input
                                        type="search"
                                        value={conversationSearch}
                                        onChange={(event) => setConversationSearch(event.target.value)}
                                        placeholder="Search this queue"
                                        aria-label="Search conversations"
                                    />
                                </label>
                                <span className="admin-conversation-list-count">{visibleCountLabel}</span>
                            </div>
                        )}

                        <SoftRefreshBoundary
                            loading={loading}
                            refreshing={conversationsResource.refreshing}
                            hasData={currentList.length > 0}
                            showRefreshBar={!isAdminFullSurface}
                            className="min-h-0 flex-1 overflow-y-auto"
                        >
                            {loading ? (
                                <div className="p-4">
                                    <StaffSkeleton rows={5} label="Loading conversations" />
                                </div>
                            ) : currentList.length === 0 ? (
                                <div className="admin-conversation-empty-state">
                                    <span className="admin-conversation-empty-icon" aria-hidden="true">
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8 10h.01M12 10h.01M16 10h.01M21 11.5c0 4.142-4.03 7.5-9 7.5a10.7 10.7 0 0 1-3.602-.61L3 20l1.72-4.02A6.64 6.64 0 0 1 3 11.5C3 7.358 7.03 4 12 4s9 3.358 9 7.5Z" />
                                        </svg>
                                    </span>
                                    <span className="admin-conversation-empty-kicker">All clear</span>
                                    <p className="admin-conversation-empty-title">{emptyText[0]}</p>
                                    <p className="admin-conversation-empty-copy">{emptyText[1]}</p>
                                </div>
                            ) : filteredCurrentList.length === 0 ? (
                                <div className="admin-conversation-empty-state">
                                    <span className="admin-conversation-empty-icon" aria-hidden="true">
                                        <Search />
                                    </span>
                                    <span className="admin-conversation-empty-kicker">No match</span>
                                    <p className="admin-conversation-empty-title">No conversations found</p>
                                    <p className="admin-conversation-empty-copy">Try a customer name, email, booking reference, owner, or message text.</p>
                                </div>
                            ) : (
                                <div className="admin-conversation-list">
                                    {visibleConversationList.map(conv => {
                                        const identity = describeCustomerIdentity(conv);
                                        return (
                                            <UpdatedRowPulse
                                                key={conv.id}
                                                as="button"
                                                watchKey={`${conv.id}:${conv.last_message_time}:${conv.unread_count}:${conv.status}:${conv.staff_id || ''}`}
                                                active={conversationsResource.changedKeys.has(conv.id)}
                                                type="button"
                                                onClick={() => selectConversation(conv)}
                                                onMouseEnter={() => prefetchMessages(conv)}
                                                onFocus={() => prefetchMessages(conv)}
                                                className={`admin-conversation-row ${selectedConv?.id === conv.id ? 'is-active' : ''} ${conv.unread_count > 0 ? 'has-unread' : ''}`}
                                            >
                                                <span className="admin-conversation-avatar" aria-hidden="true">
                                                    {conv.unread_count > 0 && <span className="admin-conversation-unread-dot" />}
                                                    <span>
                                                        {identity.customerAccountName?.charAt(0).toUpperCase()}
                                                    </span>
                                                </span>
                                                <span className="admin-conversation-row-body">
                                                    <span className="admin-conversation-row-head">
                                                        <span className="admin-conversation-row-name">{identity.customerAccountName || 'Unknown customer'}</span>
                                                        <span className="admin-conversation-row-time">{conv.last_message_time || 'No activity'}</span>
                                                    </span>
                                                    <span className="admin-conversation-row-meta">
                                                        {identity.customerAccountEmail || conv.booking_label || 'No email on file'}
                                                    </span>
                                                    {identity.hasDifferentBookingContact && (
                                                        <span className="admin-conversation-row-meta">
                                                            Booking contact: {identity.bookingContactName}
                                                        </span>
                                                    )}
                                                    <span className="admin-conversation-row-chips">
                                                        {getAdminConversationChips(conv).slice(0, 3).map(([label, className]) => (
                                                            <span key={label} className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${className}`}>{label}</span>
                                                        ))}
                                                    </span>
                                                    <span className="admin-conversation-row-preview">{conv.last_message || 'No messages yet'}</span>
                                                </span>
                                            </UpdatedRowPulse>
                                        );
                                    })}
                                    {hasMoreConversations && (
                                        <button
                                            type="button"
                                            className="admin-conversation-load-more"
                                            onClick={() => setConversationVisibleLimit((limit) => limit + 24)}
                                        >
                                            Show more conversations
                                        </button>
                                    )}
                                </div>
                            )}
                        </SoftRefreshBoundary>
                    </aside>

                    <main className={threadClass}>
                        {!selectedConv ? (
                            <div className="flex flex-1 items-center justify-center p-8">
                                <div className={emptyCardClass}>
                                    <svg className="mx-auto mb-4 h-12 w-12 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                    <p className="text-base font-black text-gray-900">Select a conversation to monitor</p>
                                    <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">Review ownership, read the thread, and step in only when escalation is needed.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex min-h-0 flex-1">
                                    <section className="admin-chat-thread-main flex min-h-0 min-w-0 flex-1 flex-col">
                                        <div className="admin-chat-selected-head flex shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white px-7 py-4">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-black text-primary-700">{selectedIdentity?.customerAccountName?.charAt(0).toUpperCase()}</div>
                                                <div className="admin-chat-selected-identity min-w-0">
                                                    <p className="truncate text-base font-black text-gray-950">{selectedIdentity?.customerAccountName}</p>
                                                    {selectedIdentity?.customerAccountHandle && (
                                                        <p className="truncate text-xs font-bold text-slate-400">{selectedIdentity.customerAccountHandle}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-shrink-0 items-center gap-2">
                                                {selectedChips.length > 0 && (
                                                    <div className="admin-chat-selected-status" aria-label="Conversation status">
                                                        {selectedChips.map(([label, className]) => (
                                                            <span key={label} className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${className}`}>{label}</span>
                                                        ))}
                                                    </div>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setShowContextDrawer(true)}
                                                    className="admin-thread-context-toggle"
                                                    aria-label="Open customer helper"
                                                >
                                                    <UserRound aria-hidden="true" />
                                                    <span>Customer helper</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div ref={messagesContainerRef} className={messagePaneClass}>
                                            {hasOlderMessages && (
                                                <div className="flex justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={loadOlderMessages}
                                                        disabled={loadingOlderMessages}
                                                        className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-primary-700 transition-colors hover:bg-primary-50 disabled:text-gray-400"
                                                    >
                                                        {loadingOlderMessages ? 'Loading...' : 'Load earlier messages'}
                                                    </button>
                                                </div>
                                            )}

                                            {messages.length === 0 ? (
                                                <div className="py-12 text-center">
                                                    <p className="text-sm font-semibold text-gray-400">
                                                        {messagesLoading ? 'Fetching messages...' : 'No messages yet'}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="admin-chat-message-sections">
                                                    {adminMessageSections.map(section => (
                                                        <section key={section.id} className="admin-chat-message-section">
                                                            <div className="admin-chat-date-separator">
                                                                <span>{section.label}</span>
                                                            </div>
                                                            {section.groups.map(group => (
                                                                <div key={group.id} className={`admin-chat-message-group ${group.isMine ? 'is-mine' : 'is-theirs'}`}>
                                                                    <div className="admin-chat-message-group-label">
                                                                        <span>{group.isMine ? 'Admin' : group.senderName}</span>
                                                                        <em>{group.isMine ? 'Support reply' : group.senderRole}</em>
                                                                    </div>
                                                                    <div className="admin-chat-message-stack">
                                                                        {group.messages.map((msg, index) => renderAdminMessageBubble(msg, group, index))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </section>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {selectedConv.client_is_deactivated ? (
                                            <div className="admin-chat-composer shrink-0 border-t border-gray-200 bg-white px-7 py-4">
                                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                                    <p className="text-sm font-black text-slate-700">Archived due to deactivation.</p>
                                                    <p className="mt-1 text-xs font-semibold text-slate-500">This conversation is preserved for review. Replies and ownership changes are disabled.</p>
                                                </div>
                                            </div>
                                        ) : canReply ? (
                                            <form onSubmit={handleSend} className="admin-chat-composer staff-chat-composer-form shrink-0 border-t border-gray-200 bg-white px-7 py-4">
                                                {moderationNotice && (
                                                    <div className="staff-chat-moderation-notice" role="alert">
                                                        <strong>{moderationNotice.message}</strong>
                                                        {moderationNotice.warning && <span>{moderationNotice.warning}</span>}
                                                    </div>
                                                )}
                                                <div className="staff-chat-composer-row">
                                                    <input type="text" value={newMessage} onChange={handleMessageInputChange}
                                                        placeholder="Type your reply..." maxLength={2000} autoFocus={!isAdminFullSurface}
                                                        className="staff-chat-reply-input flex-1 rounded-xl px-4 py-2.5 text-sm outline-none transition-all" />
                                                    <button type="submit" disabled={!newMessage.trim() || sending}
                                                        className="staff-chat-send-button flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-colors">
                                                        Send
                                                    </button>
                                                </div>
                                            </form>
                                        ) : (
                                            <div className="admin-chat-composer shrink-0 border-t border-gray-200 bg-white px-7 py-4">
                                                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                                                    <p className="text-sm font-bold text-amber-800">Monitoring only. Join to reply.</p>
                                                    {selectedConv?.staff_id ? (
                                                        <button onClick={handleAdminJoin} disabled={claiming || selectedConv?.status === 'resolved'}
                                                            className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-black text-white transition hover:bg-primary-700 disabled:bg-gray-300">
                                                            {claiming ? 'Joining...' : 'Join'}
                                                        </button>
                                                    ) : (
                                                        <button onClick={handleClaim} disabled={claiming || selectedConv?.status === 'resolved'}
                                                            className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-black text-white transition hover:bg-primary-700 disabled:bg-gray-300">
                                                            {claiming ? 'Taking over...' : 'Take over'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </section>

                                    {showContextDrawer && (
                                        <button
                                            type="button"
                                            className="admin-context-backdrop"
                                            aria-label="Close customer helper"
                                            onClick={() => setShowContextDrawer(false)}
                                        />
                                    )}
                                    <aside className={contextRailClass} aria-label="Customer helper">
                                        <div className={isAdminFullSurface ? 'admin-context-head flex items-start justify-between gap-3' : 'flex items-start justify-between gap-3'}>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Customer helper</p>
                                                <h4 className="mt-1 text-sm font-black text-gray-950">{selectedOwnerLabel}</h4>
                                            </div>
                                            <div className="relative">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAdminActions(!showAdminActions)}
                                                    className="admin-context-more-button"
                                                    aria-label="More conversation actions"
                                                    aria-expanded={showAdminActions}
                                                >
                                                    <MoreHorizontal aria-hidden="true" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowContextDrawer(false)}
                                                    className="admin-context-close-button"
                                                    aria-label="Close customer helper"
                                                >
                                                    <X aria-hidden="true" />
                                                </button>
                                                {showAdminActions && (
                                                    <div className="admin-context-menu">
                                                        {(canTransfer || canInvite) && (
                                                            <button type="button" onClick={() => { setShowTransfer(!showTransfer); if (!showTransfer) fetchAvailableStaff(); }}>
                                                                Assign staff
                                                            </button>
                                                        )}
                                                        <button type="button" onClick={handleInternalNote}>
                                                            Internal note
                                                        </button>
                                                        {canResolve && selectedConv.status !== 'resolved' && (
                                                            <button type="button" onClick={handleResolve} className="is-danger">
                                                                Resolve conversation
                                                            </button>
                                                        )}
                                                        {showTransfer && (
                                                            <div className="admin-context-staff-list">
                                                                {availableStaff.length === 0 ? (
                                                                    <div>No staff available</div>
                                                                ) : (
                                                                    availableStaff.map(staff => (
                                                                        <button key={staff.id} type="button" onClick={() => handleTransfer(staff.id)} disabled={transferring}>
                                                                            {staff.username}
                                                                            <span>{staff.role}</span>
                                                                        </button>
                                                                    ))
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="admin-context-stack">
                                            <section className="admin-context-card admin-context-card-primary">
                                                <p className="admin-context-label">Customer account</p>
                                                <p className="admin-context-value">{selectedIdentity?.customerAccountName}</p>
                                                {selectedIdentity?.customerAccountHandle && <p className="admin-context-note">{selectedIdentity.customerAccountHandle}</p>}
                                                <p className="admin-context-note">{selectedConv.client_is_deactivated ? 'Deactivated customer' : (selectedIdentity?.customerAccountEmail || 'No email on file')}</p>
                                                {selectedIdentity?.customerAccountPhone && <p className="admin-context-note">{selectedIdentity.customerAccountPhone}</p>}
                                            </section>
                                            {selectedIdentity?.hasDifferentBookingContact && (
                                                <section className="admin-context-card">
                                                    <p className="admin-context-label">Booking contact</p>
                                                    <p className="admin-context-value">{selectedIdentity.bookingContactName}</p>
                                                    <p className="admin-context-note">{selectedIdentity.bookingContactEmail || 'No booking email'}</p>
                                                    {selectedIdentity.bookingContactPhone && <p className="admin-context-note">{selectedIdentity.bookingContactPhone}</p>}
                                                </section>
                                            )}
                                            <div className="admin-context-mini-grid">
                                                <section className="admin-context-card">
                                                    <p className="admin-context-label">Conversation</p>
                                                    <p className="admin-context-value">{selectedConv.status === 'resolved' ? 'Resolved' : selectedConv.conversation_context || 'Active'}</p>
                                                    <p className="admin-context-note"><Clock3 aria-hidden="true" />{selectedConv.last_message_time}</p>
                                                </section>
                                                <section className="admin-context-card">
                                                    <p className="admin-context-label">Booking</p>
                                                    <p className="admin-context-value">{selectedConv.booking_label || 'General inquiry'}</p>
                                                    <p className="admin-context-note">{[selectedContextPayload?.bookingRef, selectedConv.booking_status].filter(Boolean).join(' / ') || 'No booking status'}</p>
                                                </section>
                                            </div>
                                            <section className="admin-context-card admin-context-actions-card">
                                                <p className="admin-context-label">Quick lookup</p>
                                                <div className="admin-context-action-grid">
                                                    {contextHelperActions.map((action) => {
                                                        const Icon = action.icon;
                                                        return (
                                                            <button key={action.id} type="button" onClick={action.onClick} disabled={action.disabled}>
                                                                <Icon aria-hidden="true" />
                                                                <span>{action.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </section>
                                            <section className="admin-context-card admin-context-note-card">
                                                <p className="admin-context-label">Internal note</p>
                                                <p className="admin-context-note">{selectedConv.internal_notes || 'No internal note yet.'}</p>
                                            </section>
                                        </div>
                                    </aside>
                                </div>
                            </>
                        )}
                    </main>
                </div>
                <ConfirmModal
                    isOpen={resolveConfirmOpen}
                    title="Resolve conversation?"
                    message="This will close the conversation and remove it from active support queues."
                    confirmText="Resolve"
                    onCancel={() => setResolveConfirmOpen(false)}
                    onConfirm={confirmResolve}
                />
                <ErrorModal
                    isOpen={errorModal.isOpen}
                    title="Chat action failed"
                    message={errorModal.message}
                    onClose={() => setErrorModal({ isOpen: false, message: '' })}
                />
                <PromptModal
                    isOpen={internalNoteModal.isOpen}
                    title="Internal note"
                    message="Keep private context for staff reviewing this conversation."
                    label="Internal note for staff only"
                    placeholder="Add booking context, customer preferences, or follow-up reminders."
                    initialValue={internalNoteModal.conversation?.internal_notes || ''}
                    confirmText="Save note"
                    busy={internalNoteModal.busy}
                    onCancel={closeInternalNoteModal}
                    onConfirm={saveInternalNote}
                />
                <ConfirmModal
                    isOpen={deleteConfirmModal.isOpen}
                    title="Delete this message?"
                    message="The message will be replaced with Message deleted."
                    confirmText="Delete"
                    tone="danger"
                    busy={deleteConfirmModal.busy}
                    onCancel={() => setDeleteConfirmModal({ isOpen: false, message: null, busy: false })}
                    onConfirm={confirmOwnMessageDelete}
                />
                <PromptModal
                    isOpen={moderationDeleteModal.isOpen}
                    title="Delete message as moderation?"
                    message="Add a short reason for the audit trail before removing another person's message."
                    label="Moderation reason"
                    placeholder="Example: Removed inappropriate language."
                    minLength={3}
                    confirmText="Delete message"
                    busy={moderationDeleteModal.busy}
                    onCancel={() => setModerationDeleteModal({ isOpen: false, message: null, busy: false })}
                    onConfirm={confirmModerationDelete}
                />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden" style={{ height: '600px' }}>
            <div className="flex h-full min-h-0">
                {/* Sidebar */}
                <div className="w-80 border-r border-gray-200 flex flex-col flex-shrink-0 min-h-0">
                    {/* Sidebar Header */}
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-bold text-gray-900">{isAdminOversight ? 'Conversation Oversight' : 'Client Messages'}</h3>
                            <div className="flex items-center gap-2">
                                <LiveSyncIndicator
                                    state={conversationsResource.syncState}
                                    refreshing={conversationsResource.refreshing}
                                    lastSyncedAt={conversationsResource.lastSyncedAt}
                                    error={conversationsResource.error}
                                    onRetry={conversationsResource.refetch}
                                    compact
                                    visibility="exceptions"
                                />
                                {totalUnread > 0 && (
                                    <span className="bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{totalUnread} new</span>
                                )}
                            </div>
                        </div>
                        {/* Tab Switcher */}
                        <div className={`grid gap-1 bg-gray-100 rounded-lg p-0.5 ${isAdminOversight ? 'grid-cols-2' : 'grid-cols-2'}`}>
                            {(isAdminOversight
                                ? [
                                    ['needs-attention', 'Needs', adminNeedsAttention.length],
                                    ['all-active', 'Active', adminAllActive.length],
                                    ['unassigned', 'Unassigned', unassigned.length],
                                    ['resolved', 'Recent resolved', adminResolved.length],
                                ]
                                : [
                                    ['unassigned', 'Unassigned', unassigned.length],
                                    ['my-chats', 'My Chats', myChats.length],
                                ]
                            ).map(([id, label, count]) => (
                                <button
                                    key={id}
                                    onClick={() => applySidebarTab(id)}
                                    className={`py-1.5 text-[11px] font-semibold rounded-md transition-all ${sidebarTab === id ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {label}
                                    {count > 0 && (
                                        <span className="ml-1 bg-amber-100 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">{count}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Conversation List */}
                    <SoftRefreshBoundary
                        loading={loading}
                        refreshing={conversationsResource.refreshing}
                        hasData={currentList.length > 0}
                        className="flex-1 overflow-y-auto"
                    >
                        {loading ? (
                            <div className="p-4">
                                <StaffSkeleton rows={5} label="Loading conversations" />
                            </div>
                        ) : currentList.length === 0 ? (
                            <div className="p-8 text-center">
                                <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                <p className="text-sm text-gray-400">{emptyText[0]}</p>
                                <p className="text-xs text-gray-300 mt-1">{emptyText[1]}</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {currentList.map(conv => {
                                    const identity = describeCustomerIdentity(conv);
                                    return (
                                        <UpdatedRowPulse
                                            key={conv.id}
                                            as="button"
                                            type="button"
                                            watchKey={`${conv.id}:${conv.last_message_time}:${conv.unread_count}:${conv.status}:${conv.staff_id || ''}`}
                                            active={conversationsResource.changedKeys.has(conv.id)}
                                            onClick={() => selectConversation(conv)}
                                            onMouseEnter={() => prefetchMessages(conv)}
                                            onFocus={() => prefetchMessages(conv)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${selectedConv?.id === conv.id ? 'bg-primary-50 border-l-[3px] border-l-primary-500' : 'hover:bg-gray-50'}`}>
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${conv.unread_count > 0 ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {identity.customerAccountName?.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <p className={`text-sm truncate ${conv.unread_count > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{identity.customerAccountName}</p>
                                                    <span className="text-[10px] text-gray-400 ml-2 flex-shrink-0">{conv.last_message_time}</span>
                                                </div>
                                                {identity.customerAccountEmail && <p className="text-[10px] text-gray-400 truncate">{identity.customerAccountEmail}</p>}
                                                {identity.hasDifferentBookingContact && <p className="text-[10px] text-amber-700 truncate">Booking contact: {identity.bookingContactName}</p>}
                                                {isAdminOversight && (
                                                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 truncate">{getConversationOwnerLabel(conv)}</p>
                                                )}
                                                <p className="text-xs text-gray-400 truncate mt-0.5">{conv.last_message || 'No messages'}</p>
                                            </div>
                                            {conv.unread_count > 0 && (
                                                <span className="min-w-[20px] h-[20px] flex items-center justify-center bg-primary-600 text-white text-[10px] font-bold rounded-full px-1 flex-shrink-0">{conv.unread_count}</span>
                                            )}
                                        </UpdatedRowPulse>
                                    );
                                })}
                            </div>
                        )}
                    </SoftRefreshBoundary>
                </div>

                {/* Chat Area */}
                <div className="flex-1 flex min-h-0 flex-col">
                    {!selectedConv ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                <p className="text-gray-400 font-medium">{isAdminOversight ? 'Select a conversation to monitor' : 'Select a conversation'}</p>
                                <p className="text-xs text-gray-300 mt-1">{isAdminOversight ? 'Open a thread to review status, join only when needed, or assign staff.' : 'Choose a client from the left panel to start messaging'}</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Chat Header */}
                            <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex shrink-0 items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm">{selectedConv.client_name?.charAt(0).toUpperCase()}</div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">{selectedConv.client_name}</p>
                                        {isAdminOversight && (
                                            <p className="text-[11px] text-gray-400">
                                                {selectedConv.status === 'resolved'
                                                    ? <span className="font-medium text-emerald-600">Resolved</span>
                                                    : adminJoined
                                                        ? <span className="font-medium text-primary-700">Admin joined</span>
                                                        : selectedOwnerName
                                                            ? <span className="font-medium text-slate-500">Monitoring - handled by {selectedOwnerName}</span>
                                                            : <span className="font-medium text-amber-600">Unassigned - take over or assign staff</span>}
                                            </p>
                                        )}
                                        <p className={`text-[11px] text-gray-400 ${isAdminOversight ? 'hidden' : ''}`}>
                                            {isClaimedByMe ? 'Claimed by you' : (
                                                <span className="text-amber-600 font-medium">⏳ Unassigned — Claim to reply</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                {/* Actions (only when claimed) */}
                                {isAdminOversight && selectedConv && (
                                    <div className="flex items-center gap-2">
                                        {!selectedConv.client_is_deactivated && !canReply && selectedConv.status !== 'resolved' && selectedConv.staff_id && (
                                            <button onClick={handleAdminJoin} disabled={claiming}
                                                className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-bold text-primary-700 transition-colors hover:bg-primary-100">
                                                {claiming ? 'Joining...' : 'Join conversation'}
                                            </button>
                                        )}
                                        {!selectedConv.client_is_deactivated && !selectedConv.staff_id && selectedConv.status !== 'resolved' && (
                                            <button onClick={handleClaim} disabled={claiming}
                                                className="rounded-lg border border-primary-200 bg-primary-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-primary-700">
                                                {claiming ? 'Taking over...' : 'Take over'}
                                            </button>
                                        )}
                                        {(canTransfer || canInvite) && <div className="relative">
                                            <button onClick={() => { setShowTransfer(!showTransfer); if (!showTransfer) fetchAvailableStaff(); }}
                                                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700">
                                                Assign
                                            </button>
                                            {showTransfer && (
                                                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1">
                                                    <div className="px-3 py-2 border-b border-gray-100"><p className="text-xs font-bold text-gray-500">Assign staff</p></div>
                                                    {availableStaff.length === 0 ? (
                                                        <div className="px-3 py-2 text-xs text-gray-400">No staff available</div>
                                                    ) : (
                                                        availableStaff.map(staff => (
                                                            <button key={staff.id} type="button" onClick={() => handleTransfer(staff.id)} disabled={transferring} className="block w-full px-3 py-2 text-left text-sm font-bold text-gray-700 transition hover:bg-primary-50">
                                                                {staff.username}
                                                                <span className="ml-2 text-[10px] font-semibold text-gray-400">{staff.role}</span>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>}
                                        <button onClick={handleInternalNote}
                                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 transition-colors hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700">
                                            Note
                                        </button>
                                        {canResolve && selectedConv.status !== 'resolved' && <button onClick={handleResolve}
                                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                                            Resolve
                                        </button>}
                                    </div>
                                )}
                                {!isAdminOversight && isClaimedByMe && (
                                    <div className="flex items-center gap-2">
                                        {canUseStaffContextNavigation && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => openStaffContext({ role: staffContextRole, tab: staffContextDefaultTab })}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg border border-gray-200 hover:border-primary-200 transition-colors"
                                                >
                                                    Booking
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => openStaffContext({ role: staffContextRole, tab: staffContextDefaultTab })}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg border border-gray-200 hover:border-primary-200 transition-colors"
                                                >
                                                    Customer
                                                </button>
                                                {(selectedContextPayload?.customerEmail || selectedContextPayload?.bookingContactEmail) && (
                                                    <button
                                                        type="button"
                                                        onClick={copySelectedEmail}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg border border-gray-200 hover:border-amber-200 transition-colors"
                                                    >
                                                        {copiedHelper === 'email' ? 'Copied' : 'Email'}
                                                    </button>
                                                )}
                                                {(selectedContextPayload?.customerPhone || selectedContextPayload?.bookingContactPhone) && (
                                                    <button
                                                        type="button"
                                                        onClick={copySelectedPhone}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg border border-gray-200 hover:border-amber-200 transition-colors"
                                                    >
                                                        {copiedHelper === 'phone' ? 'Copied' : 'Phone'}
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        {(canTransfer || canInvite) && <div className="relative">
                                            <button onClick={() => { setShowTransfer(!showTransfer); if (!showTransfer) fetchAvailableStaff(); }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg border border-gray-200 hover:border-primary-200 transition-colors">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                                Staff
                                            </button>
                                            {showTransfer && (
                                                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1">
                                                    <div className="px-3 py-2 border-b border-gray-100"><p className="text-xs font-bold text-gray-500">Select Staff</p></div>
                                                    {availableStaff.length === 0 ? (
                                                        <div className="px-3 py-2 text-xs text-gray-400">No staff available</div>
                                                    ) : (
                                                        availableStaff.map(staff => (
                                                            <div key={staff.id} className="px-3 py-2">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-sm font-bold text-gray-700">{staff.username}</span>
                                                                    <span className="text-[10px] text-gray-400">{staff.role}</span>
                                                                </div>
                                                                <div className="mt-2 flex gap-2">
                                                                    {canInvite && <button type="button" onClick={() => handleInvite(staff.id)} disabled={transferring} className="flex-1 rounded-md bg-primary-50 px-2 py-1 text-[11px] font-bold text-primary-700 hover:bg-primary-100">Invite</button>}
                                                                    {canTransfer && <button type="button" onClick={() => handleTransfer(staff.id)} disabled={transferring} className="flex-1 rounded-md bg-gray-50 px-2 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-100">Transfer</button>}
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>}
                                        {isCollaborator && <button onClick={handleLeave}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg border border-gray-200 hover:border-amber-200 transition-colors">
                                            Leave chat
                                        </button>}
                                        {canResolve && <button onClick={handleResolve}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-gray-200 hover:border-red-200 transition-colors">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            Resolve
                                        </button>}
                                    </div>
                                )}
                            </div>

                            {/* Messages */}
                            <div ref={messagesContainerRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-6 space-y-3 bg-gray-50/30">
                                {hasOlderMessages && (
                                    <div className="flex justify-center">
                                        <button
                                            type="button"
                                            onClick={loadOlderMessages}
                                            disabled={loadingOlderMessages}
                                            className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-primary-700 transition-colors hover:bg-primary-50 disabled:text-gray-400"
                                        >
                                            {loadingOlderMessages ? 'Loading...' : 'Load earlier messages'}
                                        </button>
                                    </div>
                                )}

                                {messages.length === 0 ? (
                                    <div className="text-center py-12">
                                        <p className="text-sm text-gray-400">
                                            {messagesLoading ? 'Fetching messages...' : 'No messages yet'}
                                        </p>
                                    </div>
                                ) : (
                                    messages.map(msg => (
                                        <div key={msg.client_temp_id || msg.id} className={`group flex ${msg.is_mine ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`relative max-w-[60%] rounded-2xl px-4 py-2.5 ${msg.is_mine ? 'bg-primary-600 text-white rounded-br-md' : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-100'}`}>
                                                {!msg.is_mine && <p className="text-[10px] font-bold text-primary-600 mb-0.5">{msg.sender_name}</p>}
                                                {editingMessageId === msg.id ? (
                                                    <div className="space-y-2">
                                                        <textarea value={editingText} onChange={(event) => setEditingText(event.target.value)} rows={3} className="w-72 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none" />
                                                        <div className="flex justify-end gap-2">
                                                            <button type="button" onClick={cancelEditMessage} className={`text-[11px] font-black ${msg.is_mine ? 'text-white/70' : 'text-slate-500'}`}>Cancel</button>
                                                            <button type="button" onClick={() => saveEditedMessage(msg)} className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-primary-700 shadow-sm">Save</button>
                                                        </div>
                                                    </div>
                                                ) : isBookingCard(msg.message) ? renderBookingCard(msg.message, msg.is_mine) : (
                                                    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{msg.message}</p>
                                                )}
                                                <p className={`text-[10px] mt-1 ${msg.is_mine ? 'text-white/50' : 'text-gray-400'}`}>
                                                    {msg.time}{msg.edited_at && !msg.deleted_at ? ' / edited' : ''}{msg.is_mine && msg.read_at && ' / Read'}{msg.optimistic_status === 'sending' ? ' / Sending...' : ''}{msg.optimistic_status === 'failed' ? ' / Failed' : ''}
                                                </p>
                                                {msg.optimistic_status === 'failed' && (
                                                    <div className="mt-2 flex justify-end gap-2">
                                                        <button type="button" onClick={() => retryFailedMessage(msg)} className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-primary-700">
                                                            Retry
                                                        </button>
                                                        <button type="button" onClick={() => removeFailedMessage(msg)} className="text-[11px] font-black text-white/70">
                                                            Remove
                                                        </button>
                                                    </div>
                                                )}
                                                {(canEditMessage(msg) || canDeleteMessage(msg)) && editingMessageId !== msg.id && (
                                                    <div className={`absolute top-2 z-30 ${msg.is_mine ? '-left-10' : '-right-10'} ${openActionMessageId === msg.id ? 'block' : 'hidden group-hover:block group-focus-within:block'}`}>
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                setOpenActionMessageId(openActionMessageId === msg.id ? null : msg.id);
                                                            }}
                                                            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-black leading-none text-slate-600 shadow-md shadow-slate-950/10 transition hover:border-primary-300 hover:text-primary-700"
                                                            aria-label="Message actions"
                                                            aria-expanded={openActionMessageId === msg.id}
                                                        >
                                                            ...
                                                        </button>
                                                        {openActionMessageId === msg.id && (
                                                            <div className={`absolute top-9 min-w-[8.75rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-xl shadow-slate-950/15 ${msg.is_mine ? 'right-0' : 'left-0'}`}>
                                                                {canEditMessage(msg) && (
                                                                    <button type="button" onClick={() => startEditMessage(msg)} className="block w-full px-3 py-2 text-left text-xs font-black text-slate-700 transition hover:bg-slate-50">
                                                                        Edit message
                                                                    </button>
                                                                )}
                                                                {canDeleteMessage(msg) && (
                                                                    <button type="button" onClick={() => requestDeleteMessage(msg)} className="block w-full px-3 py-2 text-left text-xs font-black text-red-700 transition hover:bg-red-50">
                                                                        Delete message
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Input Area OR Claim Button */}
                            {selectedConv.client_is_deactivated ? (
                                <div className="shrink-0 border-t border-gray-200 px-4 py-4 bg-slate-50">
                                    <p className="text-center text-sm font-bold text-slate-600">Archived due to deactivation. Replies are disabled.</p>
                                </div>
                            ) : isClaimedByMe ? (
                                <form onSubmit={handleSend} className="staff-chat-composer-form shrink-0 border-t border-gray-200 bg-white px-4 py-3">
                                    {moderationNotice && (
                                        <div className="staff-chat-moderation-notice" role="alert">
                                            <strong>{moderationNotice.message}</strong>
                                            {moderationNotice.warning && <span>{moderationNotice.warning}</span>}
                                        </div>
                                    )}
                                    <div className="staff-chat-composer-row">
                                        <input type="text" value={newMessage} onChange={handleMessageInputChange}
                                            placeholder="Type your reply..." maxLength={2000} autoFocus
                                            className="staff-chat-reply-input flex-1 rounded-lg px-4 py-2.5 text-sm outline-none transition-all" />
                                        <button type="submit" disabled={!newMessage.trim() || sending}
                                            className="staff-chat-send-button flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                            Send
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="shrink-0 border-t border-gray-200 px-4 py-4 bg-amber-50/50">
                                    {isAdminOversight && selectedConv?.staff_id ? (
                                        <>
                                            <button onClick={handleAdminJoin} disabled={claiming || selectedConv?.status === 'resolved'}
                                                className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white py-3 rounded-lg font-bold text-sm transition-colors shadow-sm">
                                                {claiming ? 'Joining...' : 'Join conversation to reply'}
                                            </button>
                                            <p className="text-center text-[11px] text-amber-700/60 mt-2">Admin is monitoring only until joining this thread.</p>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={handleClaim} disabled={claiming || selectedConv?.status === 'resolved'}
                                                className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white py-3 rounded-lg font-bold text-sm transition-colors shadow-sm">
                                                {claiming ? (
                                                    <>
                                                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                                                        {isAdminOversight ? 'Taking over...' : 'Claiming...'}
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                        {isAdminOversight ? 'Take Over Conversation' : 'Claim This Conversation'}
                                                    </>
                                                )}
                                            </button>
                                            <p className="text-center text-[11px] text-amber-700/60 mt-2">{isAdminOversight ? 'Take over only when staff escalation is needed.' : 'You must claim this conversation before you can reply'}</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            <ConfirmModal
                isOpen={resolveConfirmOpen}
                title="Resolve conversation?"
                message="This will close the conversation and remove it from your active chat queue."
                confirmText="Resolve"
                onCancel={() => setResolveConfirmOpen(false)}
                onConfirm={confirmResolve}
            />
            <ErrorModal
                isOpen={errorModal.isOpen}
                title="Chat action failed"
                message={errorModal.message}
                onClose={() => setErrorModal({ isOpen: false, message: '' })}
            />
            <PromptModal
                isOpen={internalNoteModal.isOpen}
                title="Internal note"
                message="Keep private context for staff reviewing this conversation."
                label="Internal note for staff only"
                placeholder="Add booking context, customer preferences, or follow-up reminders."
                initialValue={internalNoteModal.conversation?.internal_notes || ''}
                confirmText="Save note"
                busy={internalNoteModal.busy}
                onCancel={closeInternalNoteModal}
                onConfirm={saveInternalNote}
            />
            <ConfirmModal
                isOpen={deleteConfirmModal.isOpen}
                title="Delete this message?"
                message="The message will be replaced with Message deleted."
                confirmText="Delete"
                tone="danger"
                busy={deleteConfirmModal.busy}
                onCancel={() => setDeleteConfirmModal({ isOpen: false, message: null, busy: false })}
                onConfirm={confirmOwnMessageDelete}
            />
            <PromptModal
                isOpen={moderationDeleteModal.isOpen}
                title="Delete message as moderation?"
                message="Add a short reason for the audit trail before removing another person's message."
                label="Moderation reason"
                placeholder="Example: Removed inappropriate language."
                minLength={3}
                confirmText="Delete message"
                busy={moderationDeleteModal.busy}
                onCancel={() => setModerationDeleteModal({ isOpen: false, message: null, busy: false })}
                onConfirm={confirmModerationDelete}
            />
        </div>
    );
};

export default StaffMessaging;
