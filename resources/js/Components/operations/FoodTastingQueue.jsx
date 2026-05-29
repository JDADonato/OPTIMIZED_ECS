import React, { useEffect, useMemo, useState } from 'react';
import { usePage } from '@inertiajs/react';
import useLiveResource from '../../hooks/useLiveResource';
import csrfFetch from '../../utils/csrf';
import { operationalChannelsForUser } from '../../utils/liveChannels';
import { LiveSyncIndicator, SoftRefreshBoundary, UpdatedRowPulse } from '../common/LiveFeedback';
import StaffEmptyState from '../staff/StaffEmptyState';
import StaffSkeleton from '../staff/StaffSkeleton';

const STATUS_OPTIONS = ['All', 'Pending', 'Contacted', 'Approved', 'Confirmed', 'Completed', 'Cancelled', 'Rescheduled', 'Archived', 'Spam'];

const formatDate = (value) => {
    if (!value) return 'Date pending';
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const FoodTastingQueue = ({ onToast, surfaceMode = 'default' }) => {
    const { auth } = usePage().props;
    const isAdminSurface = surfaceMode === 'admin-full';
    const [rows, setRows] = useState([]);
    const [savingId, setSavingId] = useState(null);
    const [filters, setFilters] = useState({ status: 'All', from: '', to: '' });

    const query = useMemo(() => {
        const params = new URLSearchParams({ paginated: '1', per_page: '50' });
        Object.entries(filters).forEach(([key, value]) => {
            if (value && value !== 'All') params.set(key, value);
        });
        return params.toString();
    }, [filters]);
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
                        <button type="button" onClick={() => loadRows()} className="staff-row-action">Refresh</button>
                    </div>
                </div>
            )}

            <div className={isAdminSurface ? 'admin-command-strip md:grid md:grid-cols-[minmax(10rem,16rem)_minmax(12rem,1fr)_minmax(12rem,1fr)_auto]' : 'grid gap-3 border-b border-slate-100 p-4 md:grid-cols-3'}>
                <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="staff-control">
                    {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} className="staff-control" />
                <input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} className="staff-control" />
                {isAdminSurface && (
                    <div className="flex items-center justify-end gap-2">
                        <LiveSyncIndicator
                            state={tastingResource.syncState}
                            refreshing={tastingResource.refreshing}
                            lastSyncedAt={tastingResource.lastSyncedAt}
                            error={tastingResource.error}
                            onRetry={tastingResource.refetch}
                            compact
                            visibility="exceptions"
                        />
                        <button type="button" onClick={() => loadRows()} className="admin-button-secondary px-4 py-2 text-sm font-black">Refresh</button>
                    </div>
                )}
            </div>

            {tastingResource.loading && rows.length === 0 ? (
                <StaffSkeleton rows={5} label="Loading food tastings" />
            ) : rows.length === 0 ? (
                <StaffEmptyState title="No food tastings found" message="New tasting requests from public and customer forms will appear here." />
            ) : (
                <SoftRefreshBoundary
                    loading={tastingResource.loading}
                    refreshing={tastingResource.refreshing}
                    hasData={rows.length > 0}
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
                            {rows.map((row) => (
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
        </section>
    );
};

export default FoodTastingQueue;
