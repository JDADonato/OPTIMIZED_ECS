import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import useLiveResource from '../../hooks/useLiveResource';
import ConfirmModal from './ConfirmModal';
import ErrorModal from './ErrorModal';
import PromptModal from './PromptModal';
import StaffSkeleton from '../staff/StaffSkeleton';
import csrfFetch from '../../utils/csrf';
import { operationalChannelsForUser } from '../../utils/liveChannels';
import { LiveSyncIndicator, SoftRefreshBoundary, UpdatedRowPulse } from './LiveFeedback';

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
    const left = Number(a.id) || new Date(a.created_at || 0).getTime();
    const right = Number(b.id) || new Date(b.created_at || 0).getTime();
    return left - right;
});

const StaffMessaging = ({ variant = 'staff', refreshToken = 0, onMetricsChange = null, surfaceMode = 'default' }) => {
    const { user } = useAuth();
    const hasRealtime = typeof window !== 'undefined' && Boolean(window.Echo);
    const isAdminOversight = variant === 'admin-oversight' && user?.role === 'Admin';
    const isAdminFullSurface = isAdminOversight && surfaceMode === 'admin-full';
    const [sidebarTab, setSidebarTab] = useState(isAdminOversight ? 'needs-attention' : 'unassigned');
    const [unassigned, setUnassigned] = useState([]);
    const [myChats, setMyChats] = useState([]);
    const [adminNeedsAttention, setAdminNeedsAttention] = useState([]);
    const [adminAllActive, setAdminAllActive] = useState([]);
    const [adminResolved, setAdminResolved] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [messages, setMessages] = useState([]);
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
    const [internalNoteModal, setInternalNoteModal] = useState({ isOpen: false, conversation: null, busy: false });
    const [deleteConfirmModal, setDeleteConfirmModal] = useState({ isOpen: false, message: null, busy: false });
    const [moderationDeleteModal, setModerationDeleteModal] = useState({ isOpen: false, message: null, busy: false });
    const messagesContainerRef = useRef(null);
    const shouldScrollToBottomRef = useRef(false);
    const preserveOlderScrollRef = useRef(null);
    const echoChannelsRef = useRef({});
    const selectedConvRef = useRef(null);

    // Keep ref in sync for use in Echo callbacks
    useEffect(() => { selectedConvRef.current = selectedConv; }, [selectedConv]);

    useEffect(() => {
        setSidebarTab(isAdminOversight ? 'needs-attention' : 'unassigned');
    }, [isAdminOversight]);

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

    const normalizeMessagesResponse = (payload) => {
        if (Array.isArray(payload)) {
            return { data: sortMessagesOldestFirst(payload), pagination: { has_more: false } };
        }

        return {
            data: sortMessagesOldestFirst(Array.isArray(payload?.data) ? payload.data : []),
            pagination: payload?.pagination || { has_more: false },
        };
    };

    const fetchMessages = useCallback(async (conversationId) => {
        try {
            const res = await fetch(`/api/chat/conversations/${conversationId}/messages?limit=30`);
            if (res.ok) {
                const d = normalizeMessagesResponse(await res.json());
                shouldScrollToBottomRef.current = true;
                setMessages(d.data);
                setHasOlderMessages(Boolean(d.pagination?.has_more));
            }
        } catch (e) { /* silent */ }
    }, []);

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
            const res = await fetch(`/api/chat/conversations/${selectedConv.id}/messages?limit=30&before_id=${messages[0].id}`);
            if (res.ok) {
                const d = normalizeMessagesResponse(await res.json());
                prependedOlderMessages = true;
                setMessages(prev => sortMessagesOldestFirst([...d.data, ...prev]));
                setHasOlderMessages(Boolean(d.pagination?.has_more));
            }
        } catch (e) { /* silent */ }
        finally {
            if (!prependedOlderMessages) preserveOlderScrollRef.current = null;
            setLoadingOlderMessages(false);
        }
    }, [selectedConv?.id, messages, loadingOlderMessages]);

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
                            if (prev.find(m => m.id === e.messageData.id)) return prev;
                            shouldScrollToBottomRef.current = true;
                            return sortMessagesOldestFirst([...prev, { ...e.messageData, is_mine: false }]);
                        });
                    }
                    fetchConversations();
                });
            echoChannelsRef.current[channelName] = channel;
        }

        return () => {
            // Cleanup on unmount
        };
    }, [selectedConv, fetchConversations]);

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

    const selectConversation = (conv) => {
        setSelectedConv(conv);
        setHasOlderMessages(false);
        setShowAdminActions(false);
        setShowTransfer(false);
        fetchMessages(conv.id);
    };

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
                setSidebarTab(isAdminOversight ? 'all-active' : 'my-chats');
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
                setSelectedConv(null);
                setMessages([]);
                fetchConversations();
            }
        } catch (e) {
            setErrorModal({ isOpen: true, message: 'Failed to leave chat.' });
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || sending || !selectedConv) return;
        setSending(true);
        try {
            const res = await csrfFetch(`/api/chat/conversations/${selectedConv.id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ message: newMessage.trim() }),
            });
            if (res.ok) {
                const msg = await res.json();
                shouldScrollToBottomRef.current = true;
                setMessages(prev => sortMessagesOldestFirst([...prev, msg]));
                setNewMessage('');
                fetchConversations();
            }
        } catch (e) { console.error('Send failed'); }
        finally { setSending(false); }
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
        if (!msg?.is_mine || msg.deleted_at || isBookingCard(msg.message)) return false;
        return Date.now() - new Date(msg.created_at || 0).getTime() <= 15 * 60 * 1000;
    };

    const canDeleteMessage = (msg) => {
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
        if (!editingText.trim()) return;
        try {
            const res = await csrfFetch(`/api/chat/messages/${msg.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: editingText.trim() }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'Could not edit message.');
            setMessages(prev => prev.map(item => item.id === msg.id ? payload : item));
            cancelEditMessage();
            fetchConversations();
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
            setMessages(prev => prev.map(item => item.id === msg.id ? payload.data : item));
            setDeleteConfirmModal({ isOpen: false, message: null, busy: false });
            setModerationDeleteModal({ isOpen: false, message: null, busy: false });
            fetchConversations();
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

    const adminLists = {
        'needs-attention': adminNeedsAttention,
        'all-active': adminAllActive,
        unassigned,
        resolved: adminResolved,
    };
    const currentList = isAdminOversight
        ? (adminLists[sidebarTab] || adminNeedsAttention)
        : (sidebarTab === 'unassigned' ? unassigned : myChats);
    const allVisibleConversations = isAdminOversight
        ? [...adminNeedsAttention, ...adminAllActive, ...unassigned, ...adminResolved]
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
    const getDisplayOwnerName = (conv) => conv?.owner?.name || conv?.staff_name || null;
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
            resolved: ['No recently resolved conversations', 'Closed conversations will appear here for review.'],
        };
        return messages[sidebarTab] || messages['needs-attention'];
    };
    const emptyText = getEmptyText();

    // ─── Render ───

    if (isAdminOversight) {
        const adminFilterOptions = [
            ['needs-attention', 'Needs attention', adminNeedsAttention.length],
            ['all-active', 'Active', adminAllActive.length],
            ['unassigned', 'Unassigned', unassigned.length],
            ['resolved', 'Resolved', adminResolved.length],
        ];
        const selectedChips = getAdminConversationChips(selectedConv);
        const selectedOwnerLabel = selectedConv?.status === 'resolved'
            ? 'Resolved'
            : selectedOwnerName
                ? `Handled by ${selectedOwnerName}`
                : 'Unassigned';

        const containerClass = isAdminFullSurface
            ? 'admin-full-chat overflow-hidden bg-white'
            : 'overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm';
        const containerStyle = isAdminFullSurface ? undefined : { height: '640px' };
        const listRailClass = isAdminFullSurface
            ? 'admin-chat-list-rail flex min-h-0 w-[18rem] flex-shrink-0 flex-col border-r border-gray-200 bg-white'
            : 'flex min-h-0 w-[19rem] flex-shrink-0 flex-col border-r border-gray-200 bg-white';
        const listHeaderClass = isAdminFullSurface
            ? 'border-b border-gray-100 bg-white px-5 py-4'
            : 'border-b border-gray-100 bg-gray-50/80 px-4 py-3';
        const threadClass = isAdminFullSurface
            ? 'admin-chat-thread flex min-h-0 min-w-0 flex-1 flex-col bg-white'
            : 'flex min-h-0 min-w-0 flex-1 flex-col bg-gray-50/30';
        const emptyCardClass = isAdminFullSurface
            ? 'max-w-md text-center'
            : 'max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm';
        const messagePaneClass = isAdminFullSurface
            ? 'min-h-0 flex-1 space-y-4 overflow-y-auto bg-white px-8 py-7'
            : 'min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-6';
        const contextRailClass = isAdminFullSurface
            ? 'admin-context-rail w-[19rem] flex-shrink-0'
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
                                    />
                                    {totalUnread > 0 && (
                                        <span className="rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-black text-white">{totalUnread} new</span>
                                    )}
                                </div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                {adminFilterOptions.map(([id, label, count]) => (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => setSidebarTab(id)}
                                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-[11px] font-black transition ${sidebarTab === id ? 'border-amber-200 bg-white text-primary-700 shadow-sm' : 'border-transparent bg-transparent text-slate-500 hover:bg-white hover:text-slate-700'}`}
                                    >
                                        <span className="truncate">{label}</span>
                                        {count > 0 && <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-700">{count}</span>}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <SoftRefreshBoundary
                            loading={loading}
                            refreshing={conversationsResource.refreshing}
                            hasData={currentList.length > 0}
                            className="min-h-0 flex-1 overflow-y-auto"
                        >
                            {loading ? (
                                <div className="p-4">
                                    <StaffSkeleton rows={5} label="Loading conversations" />
                                </div>
                            ) : currentList.length === 0 ? (
                                <div className="px-5 py-10 text-center">
                                    <svg className="mx-auto mb-3 h-10 w-10 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                    <p className="text-sm font-bold text-slate-400">{emptyText[0]}</p>
                                    <p className="mt-1 text-xs text-slate-300">{emptyText[1]}</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {currentList.map(conv => (
                                        <UpdatedRowPulse
                                            key={conv.id}
                                            as="button"
                                            watchKey={`${conv.id}:${conv.last_message_time}:${conv.unread_count}:${conv.status}:${conv.staff_id || ''}`}
                                            active={conversationsResource.changedKeys.has(conv.id)}
                                            type="button"
                                            onClick={() => selectConversation(conv)}
                                            className={`w-full px-5 py-4 text-left transition ${selectedConv?.id === conv.id ? 'bg-[#fff8e8]' : 'hover:bg-gray-50'}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-black ${conv.unread_count > 0 ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-slate-500'}`}>
                                                    {conv.client_name?.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className={`truncate text-sm ${conv.unread_count > 0 ? 'font-black text-gray-950' : 'font-bold text-gray-800'}`}>{conv.client_name}</p>
                                                        <span className="flex-shrink-0 text-[10px] font-semibold text-slate-400">{conv.last_message_time}</span>
                                                    </div>
                                                    <p className="truncate text-[11px] font-semibold text-slate-400">{conv.client_email || conv.booking_label || 'No email on file'}</p>
                                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                                        {getAdminConversationChips(conv).slice(0, 2).map(([label, className]) => (
                                                            <span key={label} className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${className}`}>{label}</span>
                                                        ))}
                                                    </div>
                                                    <p className="mt-1 truncate text-xs text-slate-500">{conv.last_message || 'No messages yet'}</p>
                                                </div>
                                            </div>
                                        </UpdatedRowPulse>
                                    ))}
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
                                <div className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white px-7 py-4">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-black text-primary-700">{selectedConv.client_name?.charAt(0).toUpperCase()}</div>
                                        <div className="min-w-0">
                                            <p className="truncate text-base font-black text-gray-950">{selectedConv.client_name}</p>
                                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                {selectedChips.map(([label, className]) => (
                                                    <span key={label} className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${className}`}>{label}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-shrink-0 items-center gap-2">
                                        {!selectedConv.client_is_deactivated && !canReply && selectedConv.status !== 'resolved' && selectedConv.staff_id && (
                                            <button onClick={handleAdminJoin} disabled={claiming}
                                                className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-2 text-xs font-black text-primary-700 transition hover:bg-primary-100 disabled:opacity-60">
                                                {claiming ? 'Joining...' : 'Join conversation'}
                                            </button>
                                        )}
                                        {!selectedConv.client_is_deactivated && !selectedConv.staff_id && selectedConv.status !== 'resolved' && (
                                            <button onClick={handleClaim} disabled={claiming}
                                                className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-black text-white transition hover:bg-primary-700 disabled:opacity-60">
                                                {claiming ? 'Taking over...' : 'Take over'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex min-h-0 flex-1">
                                    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
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
                                                    <p className="text-sm font-semibold text-gray-400">No messages yet</p>
                                                </div>
                                            ) : (
                                                messages.map(msg => (
                                                    <div key={msg.id} className={`group flex ${msg.is_mine ? 'justify-end' : 'justify-start'}`}>
                                                        <div className={`relative max-w-[76%] rounded-2xl px-5 py-3 ${msg.is_mine ? 'bg-primary-600 text-white rounded-br-md' : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-100'}`}>
                                                            {!msg.is_mine && <p className="mb-0.5 text-[10px] font-bold text-primary-600">{msg.sender_name}</p>}
                                                            {editingMessageId === msg.id ? (
                                                                <div className="space-y-2">
                                                                    <textarea value={editingText} onChange={(event) => setEditingText(event.target.value)} rows={3} className="w-72 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none" />
                                                                    <div className="flex justify-end gap-2">
                                                                        <button type="button" onClick={cancelEditMessage} className={`text-[11px] font-black ${msg.is_mine ? 'text-white/70' : 'text-slate-500'}`}>Cancel</button>
                                                                        <button type="button" onClick={() => saveEditedMessage(msg)} className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-primary-700 shadow-sm">Save</button>
                                                                    </div>
                                                                </div>
                                                            ) : isBookingCard(msg.message) ? renderBookingCard(msg.message, msg.is_mine) : (
                                                                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{msg.message}</p>
                                                            )}
                                                            <p className={`mt-1 text-[10px] ${msg.is_mine ? 'text-white/50' : 'text-gray-400'}`}>
                                                                {msg.time}{msg.edited_at && !msg.deleted_at ? ' / edited' : ''}{msg.is_mine && msg.read_at && ' / Read'}
                                                            </p>
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

                                        {selectedConv.client_is_deactivated ? (
                                            <div className="shrink-0 border-t border-gray-200 bg-white px-7 py-4">
                                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                                    <p className="text-sm font-black text-slate-700">Archived due to deactivation.</p>
                                                    <p className="mt-1 text-xs font-semibold text-slate-500">This conversation is preserved for review. Replies and ownership changes are disabled.</p>
                                                </div>
                                            </div>
                                        ) : canReply ? (
                                            <form onSubmit={handleSend} className="flex shrink-0 items-center gap-3 border-t border-gray-200 bg-white px-7 py-4">
                                                <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                                                    placeholder="Type your reply..." maxLength={2000} autoFocus
                                                    className="flex-1 rounded-xl border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm outline-none transition-all focus:border-primary-300 focus:bg-white focus:ring-2 focus:ring-primary-500/20" />
                                                <button type="submit" disabled={!newMessage.trim() || sending}
                                                    className="flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-700 disabled:bg-gray-300">
                                                    Send
                                                </button>
                                            </form>
                                        ) : (
                                            <div className="shrink-0 border-t border-gray-200 bg-white px-7 py-4">
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

                                    <aside className={contextRailClass}>
                                        <div className={isAdminFullSurface ? 'admin-context-head flex items-start justify-between gap-3' : 'flex items-start justify-between gap-3'}>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Admin context</p>
                                                <h4 className="mt-1 text-sm font-black text-gray-950">{selectedOwnerLabel}</h4>
                                            </div>
                                            <div className="relative">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAdminActions(!showAdminActions)}
                                                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-sm font-black text-slate-600 transition hover:border-primary-200 hover:text-primary-700"
                                                    aria-label="More conversation actions"
                                                >
                                                    ...
                                                </button>
                                                {showAdminActions && (
                                                    <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl shadow-slate-950/15">
                                                        {(canTransfer || canInvite) && (
                                                            <button type="button" onClick={() => { setShowTransfer(!showTransfer); if (!showTransfer) fetchAvailableStaff(); }} className="block w-full px-3 py-2 text-left text-xs font-black text-slate-700 transition hover:bg-slate-50">
                                                                Assign staff
                                                            </button>
                                                        )}
                                                        <button type="button" onClick={handleInternalNote} className="block w-full px-3 py-2 text-left text-xs font-black text-slate-700 transition hover:bg-slate-50">
                                                            Internal note
                                                        </button>
                                                        {canResolve && selectedConv.status !== 'resolved' && (
                                                            <button type="button" onClick={handleResolve} className="block w-full px-3 py-2 text-left text-xs font-black text-red-700 transition hover:bg-red-50">
                                                                Resolve conversation
                                                            </button>
                                                        )}
                                                        {showTransfer && (
                                                            <div className="border-t border-gray-100 py-1">
                                                                {availableStaff.length === 0 ? (
                                                                    <div className="px-3 py-2 text-xs text-gray-400">No staff available</div>
                                                                ) : (
                                                                    availableStaff.map(staff => (
                                                                        <button key={staff.id} type="button" onClick={() => handleTransfer(staff.id)} disabled={transferring} className="block w-full px-3 py-2 text-left text-xs font-bold text-gray-700 transition hover:bg-primary-50">
                                                                            {staff.username}
                                                                            <span className="ml-2 text-[10px] font-semibold text-gray-400">{staff.role}</span>
                                                                        </button>
                                                                    ))
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {isAdminFullSurface ? (
                                            <div>
                                                <div className="admin-context-section">
                                                    <p className="admin-context-label">Conversation</p>
                                                    <p className="admin-context-value">{selectedConv.status === 'resolved' ? 'Resolved' : selectedConv.conversation_context || 'Active'}</p>
                                                    <p className="admin-context-note">{selectedConv.last_message_time}</p>
                                                </div>
                                                <div className="admin-context-section">
                                                    <p className="admin-context-label">Customer</p>
                                                    <p className="admin-context-value truncate">{selectedConv.client_name}</p>
                                                    <p className="admin-context-note truncate">{selectedConv.client_is_deactivated ? 'Deactivated customer' : (selectedConv.client_email || 'No email on file')}</p>
                                                </div>
                                                <div className="admin-context-section">
                                                    <p className="admin-context-label">Booking context</p>
                                                    <p className="admin-context-value">{selectedConv.booking_label || 'General inquiry'}</p>
                                                    <p className="admin-context-note">{selectedConv.booking_status || 'No booking status'}</p>
                                                </div>
                                                <div className="admin-context-section">
                                                    <p className="admin-context-label">Internal note</p>
                                                    <p className="admin-context-note">{selectedConv.internal_notes || 'No internal note yet.'}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mt-4 space-y-3">
                                                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Conversation</p>
                                                    <p className="mt-1 text-sm font-black text-gray-900">{selectedConv.status === 'resolved' ? 'Resolved' : selectedConv.conversation_context || 'Active'}</p>
                                                    <p className="mt-1 text-xs font-semibold text-slate-500">{selectedConv.last_message_time}</p>
                                                </div>
                                                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer</p>
                                                    <p className="mt-1 truncate text-sm font-black text-gray-900">{selectedConv.client_name}</p>
                                                    <p className="mt-1 truncate text-xs font-semibold text-slate-500">{selectedConv.client_is_deactivated ? 'Deactivated customer' : (selectedConv.client_email || 'No email on file')}</p>
                                                </div>
                                                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Booking context</p>
                                                    <p className="mt-1 text-sm font-black text-gray-900">{selectedConv.booking_label || 'General inquiry'}</p>
                                                    <p className="mt-1 text-xs font-semibold text-slate-500">{selectedConv.booking_status || 'No booking status'}</p>
                                                </div>
                                                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Internal note</p>
                                                    <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">{selectedConv.internal_notes || 'No internal note yet.'}</p>
                                                </div>
                                            </div>
                                        )}
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
                                    ['resolved', 'Resolved', adminResolved.length],
                                ]
                                : [
                                    ['unassigned', 'Unassigned', unassigned.length],
                                    ['my-chats', 'My Chats', myChats.length],
                                ]
                            ).map(([id, label, count]) => (
                                <button
                                    key={id}
                                    onClick={() => setSidebarTab(id)}
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
                                {currentList.map(conv => (
                                    <UpdatedRowPulse
                                        key={conv.id}
                                        as="button"
                                        type="button"
                                        watchKey={`${conv.id}:${conv.last_message_time}:${conv.unread_count}:${conv.status}:${conv.staff_id || ''}`}
                                        active={conversationsResource.changedKeys.has(conv.id)}
                                        onClick={() => selectConversation(conv)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${selectedConv?.id === conv.id ? 'bg-primary-50 border-l-[3px] border-l-primary-500' : 'hover:bg-gray-50'}`}>
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${conv.unread_count > 0 ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {conv.client_name?.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className={`text-sm truncate ${conv.unread_count > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{conv.client_name}</p>
                                                <span className="text-[10px] text-gray-400 ml-2 flex-shrink-0">{conv.last_message_time}</span>
                                            </div>
                                            {conv.client_email && <p className="text-[10px] text-gray-400 truncate">{conv.client_email}</p>}
                                            {isAdminOversight && (
                                                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 truncate">{getConversationOwnerLabel(conv)}</p>
                                            )}
                                            <p className="text-xs text-gray-400 truncate mt-0.5">{conv.last_message || 'No messages'}</p>
                                        </div>
                                        {conv.unread_count > 0 && (
                                            <span className="min-w-[20px] h-[20px] flex items-center justify-center bg-primary-600 text-white text-[10px] font-bold rounded-full px-1 flex-shrink-0">{conv.unread_count}</span>
                                        )}
                                    </UpdatedRowPulse>
                                ))}
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
                                        <p className="text-sm text-gray-400">No messages yet</p>
                                    </div>
                                ) : (
                                    messages.map(msg => (
                                        <div key={msg.id} className={`group flex ${msg.is_mine ? 'justify-end' : 'justify-start'}`}>
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
                                                    {msg.time}{msg.edited_at && !msg.deleted_at ? ' / edited' : ''}{msg.is_mine && msg.read_at && ' / Read'}
                                                </p>
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
                                <form onSubmit={handleSend} className="shrink-0 border-t border-gray-200 px-4 py-3 flex items-center gap-3 bg-white">
                                    <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="Type your reply..." maxLength={2000} autoFocus
                                        className="flex-1 text-sm px-4 py-2.5 rounded-lg bg-gray-100 focus:bg-white focus:ring-2 focus:ring-primary-500/20 border border-gray-200 focus:border-primary-300 outline-none transition-all" />
                                    <button type="submit" disabled={!newMessage.trim() || sending}
                                        className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                        Send
                                    </button>
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
