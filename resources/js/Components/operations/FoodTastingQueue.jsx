import React, { useEffect, useMemo, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { RefreshCw, Search } from 'lucide-react';
import useLiveResource from '../../hooks/useLiveResource';
import csrfFetch from '../../utils/csrf';
import { operationalChannelsForUser } from '../../utils/liveChannels';
import { LiveSyncIndicator, SoftRefreshBoundary, UpdatedRowPulse } from '../common/LiveFeedback';
import StaffEmptyState from '../staff/StaffEmptyState';
import StaffPagination from '../staff/StaffPagination';
import StaffSkeleton from '../staff/StaffSkeleton';

const STATUS_OPTIONS = ['All', 'Pending', 'Contacted', 'Approved', 'Confirmed', 'Completed', 'Cancelled', 'Rescheduled', 'Archived', 'Spam'];
const STATUS_FILTER_OPTIONS = [
    { value: 'all', label: 'All tasting work', statuses: [] },
    { value: 'needs-action', label: 'Needs action', statuses: ['Pending', 'Contacted', 'Approved', 'Rescheduled'] },
    { value: 'scheduled', label: 'Scheduled', statuses: ['Confirmed'] },
    { value: 'completed', label: 'Completed', statuses: ['Completed'] },
    { value: 'closed', label: 'Closed / spam', statuses: ['Cancelled', 'Archived', 'Spam'] },
];

const formatDate = (value) => {
    if (!value) return 'Date pending';
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const FoodTastingQueue = ({ onToast, surfaceMode = 'default' }) => {
    const { auth } = usePage().props;
    const isAdminSurface = surfaceMode === 'admin-full';
    const [rows, setRows] = useState([]);
    const [savingId, setSavingId] = useState(null);
    const [filters, setFilters] = useState({
        search: '',
        statusGroup: 'all',
        dateWindow: 'all',
        sort: 'date-asc',
    });
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);

    const query = useMemo(() => {
        const params = new URLSearchParams({ paginated: '1', per_page: '100' });
        return params.toString();
    }, []);
    const liveChannels = useMemo(() => operationalChannelsForUser(auth?.user), [auth?.user?.id, auth?.user?.role]);
    const tastingResource = useLiveResource(`/api/marketing/food-tastings${query ? `?${query}` : ''}`, {
        cacheKey: 'food-tastings',
        channels: liveChannels,
        resources: ['food_tastings'],
        interval: 45000,
        select: (payload) => Array.isArray(payload) ? payload : (payload?.data || []),
    });

    const notify = (message, type = 'success') => {
        if (onToast) onToast(message, type);
    };

    const loadRows = async ({ silent = false } = {}) => {
        const data = await tastingResource.refetch({ silent, force: true, reason: 'manual' });
        if (Array.isArray(data)) setRows(data);
    };

    useEffect(() => {
        if (Array.isArray(tastingResource.data)) setRows(tastingResource.data);
    }, [tastingResource.data]);

    const visibleRows = useMemo(() => {
        const queryText = filters.search.trim().toLowerCase();
        const selectedStatusGroup = STATUS_FILTER_OPTIONS.find((option) => option.value === filters.statusGroup);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const filteredRows = rows.filter((row) => {
            const rowStatus = row.status || 'Pending';
            const preferredDate = row.preferred_date ? new Date(row.preferred_date) : null;
            const matchesSearch = !queryText || [
                row.client_name,
                row.client_email,
                row.client_phone,
                row.preferred_date,
                row.preferred_time,
                row.status,
                row.notes,
                row.outcome_notes,
            ].some((value) => String(value || '').toLowerCase().includes(queryText));
            const matchesStatus = !selectedStatusGroup?.statuses?.length || selectedStatusGroup.statuses.includes(rowStatus);
            const matchesDate = filters.dateWindow === 'all'
                || (filters.dateWindow === 'upcoming' && preferredDate && preferredDate >= today)
                || (filters.dateWindow === 'past' && preferredDate && preferredDate < today)
                || (filters.dateWindow === 'unscheduled' && !preferredDate);

            return matchesSearch && matchesStatus && matchesDate;
        });

        return [...filteredRows].sort((a, b) => {
            const aDate = a.preferred_date ? new Date(a.preferred_date).getTime() : Number.MAX_SAFE_INTEGER;
            const bDate = b.preferred_date ? new Date(b.preferred_date).getTime() : Number.MAX_SAFE_INTEGER;

            if (filters.sort === 'date-desc') return bDate - aDate;
            if (filters.sort === 'recent') return Number(b.id || 0) - Number(a.id || 0);
            if (filters.sort === 'name') return String(a.client_name || '').localeCompare(String(b.client_name || ''));
            return aDate - bDate;
        });
    }, [filters, rows]);

    useEffect(() => {
        setPage(1);
    }, [filters, perPage]);

    const pageCount = Math.max(1, Math.ceil(visibleRows.length / perPage));
    const safePage = Math.min(page, pageCount);
    const paginatedRows = useMemo(() => {
        const start = (safePage - 1) * perPage;
        return visibleRows.slice(start, start + perPage);
    }, [perPage, safePage, visibleRows]);

    const updateStatus = async (row, status) => {
        setSavingId(row.id);
        try {
            const response = await csrfFetch(`/api/marketing/food-tastings/${row.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status,
                    preferred_date: row.preferred_date,
                    preferred_time: row.preferred_time,
                    notes: row.notes || '',
                    outcome_notes: row.outcome_notes || '',
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || payload.error || 'Could not update tasting.');
            notify('Food tasting updated.');
            tastingResource.markChanged(row.id);
            loadRows({ silent: true });
        } catch (error) {
            notify(error.message || 'Could not update tasting.', 'error');
        } finally {
            setSavingId(null);
        }
    };

    return (
        <section className={isAdminSurface ? 'admin-embedded-surface' : 'staff-work-surface'}>
            {!isAdminSurface && (
                <div className="staff-surface-head">
                    <div>
                        <p className="marketing-kicker">Customer experience</p>
                        <h3 className="mt-1 text-lg font-black text-slate-950">Food tasting queue</h3>
                        <p className="mt-1 text-sm font-semibold text-slate-500">Review tasting requests, confirm schedules, and close completed tasting outcomes.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <LiveSyncIndicator
                            state={tastingResource.syncState}
                            refreshing={tastingResource.refreshing}
                            lastSyncedAt={tastingResource.lastSyncedAt}
                            error={tastingResource.error}
                            onRetry={tastingResource.refetch}
                            compact
                            visibility={isAdminSurface ? 'exceptions' : 'always'}
                        />
                        <button
                            type="button"
                            onClick={() => loadRows()}
                            className="staff-row-action admin-refresh-action"
                            aria-label="Refresh food tastings"
                            title="Refresh food tastings"
                        >
                            <RefreshCw className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            )}

            <div className={isAdminSurface ? 'admin-command-strip food-tasting-command-strip' : 'food-tasting-command-strip border-b border-slate-100 p-4'}>
                <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input
                        value={filters.search}
                        onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                        placeholder="Search client, email, phone, notes, date, or status"
                        className="staff-control w-full pl-12"
                    />
                </div>
                <select value={filters.statusGroup} onChange={(event) => setFilters((current) => ({ ...current, statusGroup: event.target.value }))} className="staff-control">
                    {STATUS_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <select value={filters.dateWindow} onChange={(event) => setFilters((current) => ({ ...current, dateWindow: event.target.value }))} className="staff-control">
                    <option value="all">All dates</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="past">Past dates</option>
                    <option value="unscheduled">Date pending</option>
                </select>
                <select value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))} className="staff-control">
                    <option value="date-asc">Soonest first</option>
                    <option value="date-desc">Latest date first</option>
                    <option value="recent">Newest request</option>
                    <option value="name">Client A-Z</option>
                </select>
                {isAdminSurface && (
                    <div className="flex items-center justify-end gap-2">
                        <span className="inline-flex h-10 items-center rounded-xl border border-[#720101]/10 bg-[#fbf8f2] px-3 text-xs font-black uppercase tracking-wider text-[#720101]">
                            {visibleRows.length} shown
                        </span>
                        <LiveSyncIndicator
                            state={tastingResource.syncState}
                            refreshing={tastingResource.refreshing}
                            lastSyncedAt={tastingResource.lastSyncedAt}
                            error={tastingResource.error}
                            onRetry={tastingResource.refetch}
                            compact
                            visibility="exceptions"
                        />
                        <button
                            type="button"
                            onClick={() => loadRows()}
                            className="admin-icon-action admin-refresh-action"
                            aria-label="Refresh food tastings"
                            title="Refresh food tastings"
                        >
                            <RefreshCw className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>
                )}
            </div>

            {tastingResource.loading && rows.length === 0 ? (
                <StaffSkeleton rows={5} label="Loading food tastings" />
            ) : visibleRows.length === 0 ? (
                <StaffEmptyState title={rows.length === 0 ? 'No food tastings found' : 'No food tastings match these filters'} message={rows.length === 0 ? 'New tasting requests from public and customer forms will appear here.' : 'Try a broader search, status group, or date filter.'} />
            ) : (
                <SoftRefreshBoundary
                    loading={tastingResource.loading}
                    refreshing={tastingResource.refreshing}
                    hasData={visibleRows.length > 0}
                    className={isAdminSurface ? 'admin-surface-grid admin-responsive-table' : 'overflow-x-auto'}
                >
                    <table className="staff-table">
                        <thead>
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Client</th>
                                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Preferred Slot</th>
                                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Notes</th>
                                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedRows.map((row) => (
                                <UpdatedRowPulse key={row.id} as="tr" watchKey={`${row.id}:${row.status}:${row.preferred_date}:${row.preferred_time}`} active={tastingResource.changedKeys.has(row.id)}>
                                    <td className="px-6 py-4">
                                        <div className="font-black text-slate-950">{row.client_name || 'Guest'}</div>
                                        <div className="text-xs font-bold text-slate-500">{row.client_email || 'No email'} / {row.client_phone || 'No phone'}</div>
                                        {row.duplicate_customer && (
                                            <div className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-700">
                                                {row.duplicate_customer.is_deactivated ? 'Matches deactivated customer' : 'Matches customer'}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-bold text-slate-700">{formatDate(row.preferred_date)} / {row.preferred_time || 'Time pending'}</td>
                                    <td className="max-w-md px-6 py-4 text-sm font-semibold text-slate-600">{row.outcome_notes || row.notes || 'No notes yet.'}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end">
                                            <select disabled={savingId === row.id} value={row.status || 'Pending'} onChange={(event) => updateStatus(row, event.target.value)} className="staff-control max-w-[170px] text-xs">
                                                {STATUS_OPTIONS.filter((status) => status !== 'All').map((status) => <option key={status} value={status}>{status}</option>)}
                                            </select>
                                        </div>
                                    </td>
                                </UpdatedRowPulse>
                            ))}
                        </tbody>
                    </table>
                </SoftRefreshBoundary>
            )}

            {visibleRows.length > 0 && (
                <StaffPagination
                    page={safePage}
                    perPage={perPage}
                    total={visibleRows.length}
                    onPageChange={setPage}
                    onPerPageChange={setPerPage}
                    perPageOptions={[10, 25, 50]}
                />
            )}
        </section>
    );
};

export default FoodTastingQueue;
