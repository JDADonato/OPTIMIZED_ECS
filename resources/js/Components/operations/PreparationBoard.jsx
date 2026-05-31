import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import StaffDrawer from '../staff/StaffDrawer';
import StaffSkeleton from '../staff/StaffSkeleton';
import { getListData, getPaginationMeta } from '../../utils/apiResponses';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import csrfFetch from '../../utils/csrf';
import { bookingContactName, customerAccountName, hasDifferentBookingContact } from '../../utils/customerIdentity';

const readinessLabels = {
    payment: 'Accounting: payment clearance',
    menu: 'Customer: final menu',
    venue: 'Service prep: venue access',
    headcount: 'Customer: final headcount',
    tasting: 'Marketing: tasting outcome',
    customer_messages: 'Marketing: customer messages',
};

const responsibleArea = (taskOrDepartment) => {
    const department = typeof taskOrDepartment === 'object'
        ? (taskOrDepartment?.responsible_area || taskOrDepartment?.department || taskOrDepartment?.raw_department)
        : taskOrDepartment;

    return ['Operations', 'Admin', 'Service prep', undefined, null, ''].includes(department)
        ? 'Service prep'
        : department;
};

const formatDate = (value) => {
    if (!value) return 'Date TBD';
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (value) => value || 'Time TBD';

const bookingRef = (booking) => `#BK-${String(booking?.id || '').padStart(4, '0')}`;

const eventName = (booking) => booking?.event_name || booking?.event_type || `Booking #${booking?.id}`;

const readinessClass = (ready) => ready ? 'staff-status staff-status-good' : 'staff-status staff-status-danger';

const actionToneClass = (tone) => {
    if (tone === 'danger') return 'border-red-100 bg-red-50 text-red-800';
    if (tone === 'good') return 'border-emerald-100 bg-emerald-50 text-emerald-800';
    if (tone === 'muted') return 'border-slate-100 bg-slate-50 text-slate-700';
    return 'border-amber-100 bg-[#fffaf3] text-amber-900';
};

const taskStatusClass = (task) => {
    if (task.status === 'Done') return 'staff-status staff-status-good';
    if (task.due_state === 'Overdue') return 'staff-status staff-status-danger';
    if (task.due_state === 'Due soon') return 'staff-status staff-status-warn';
    return 'staff-status staff-status-muted';
};

const mergeRowsByBookingId = (currentRows = [], nextRows = []) => {
    const byBooking = new Map(currentRows.map((row) => [row.booking?.id, row]));
    nextRows.forEach((row) => {
        if (row.booking?.id) byBooking.set(row.booking.id, row);
    });

    return Array.from(byBooking.values());
};

const summarizeReadiness = (readiness = {}) => {
    const entries = Object.entries(readiness);
    const blocked = entries.filter(([, ready]) => !ready);
    return {
        total: entries.length,
        ready: entries.length - blocked.length,
        blocked,
    };
};

const readinessPercent = (row) => {
    if (row?.readiness_progress?.percent !== undefined) return row.readiness_progress.percent;
    const readiness = summarizeReadiness(row?.readiness || {});
    return readiness.total > 0 ? Math.round((readiness.ready / readiness.total) * 100) : 0;
};

const fallbackTaskGroups = (tasks = []) => {
    const groups = tasks.reduce((carry, task) => {
        const owner = responsibleArea(task);
        if (!carry[owner]) carry[owner] = [];
        carry[owner].push(task);
        return carry;
    }, {});

    return Object.entries(groups).map(([owner, groupTasks]) => ({
        owner,
        completed: groupTasks.filter((task) => task.status === 'Done').length,
        total: groupTasks.length,
        tasks: groupTasks,
    }));
};

const PreparationBoard = ({ surfaceMode = 'default' }) => {
    const isAdminSurface = surfaceMode === 'admin-full';
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingTaskId, setUpdatingTaskId] = useState(null);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [attentionFilter, setAttentionFilter] = useState('all');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [pagination, setPagination] = useState(null);
    const [summary, setSummary] = useState(null);
    const [departmentOptions, setDepartmentOptions] = useState([]);
    const [selectedBookingId, setSelectedBookingId] = useState(null);
    const [selectedRowDetail, setSelectedRowDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const debouncedQuery = useDebouncedValue(query, 250);
    const boardRequestRef = useRef(null);
    const detailRequestRef = useRef(null);
    const boardCacheRef = useRef(new Map());
    const detailCacheRef = useRef(new Map());
    const lastBoardListKeyRef = useRef('');
    const boardListKey = useMemo(() => JSON.stringify({
        perPage,
        search: debouncedQuery.trim(),
        attention: attentionFilter,
        department: departmentFilter,
    }), [attentionFilter, debouncedQuery, departmentFilter, perPage]);

    const buildBoardParams = useCallback((targetPage) => new URLSearchParams({
        paginated: '1',
        lightweight: '1',
        page: String(targetPage),
        per_page: String(perPage),
        search: debouncedQuery.trim(),
        attention: attentionFilter,
        department: departmentFilter,
    }), [attentionFilter, debouncedQuery, departmentFilter, perPage]);

    const applyBoardPayload = useCallback((data, { append = false } = {}) => {
        const nextRows = getListData(data);
        setRows((current) => append ? mergeRowsByBookingId(current, nextRows) : nextRows);
        setPagination(getPaginationMeta(data));
        setSummary(data?.meta?.summary || null);
        setDepartmentOptions(Array.isArray(data?.meta?.departments) ? data.meta.departments : []);
    }, []);

    const fetchBoard = useCallback(async ({ silent = false, targetPage = page, append = targetPage > 1, force = false } = {}) => {
        if (!silent) setLoading(true);
        let controller = null;
        const params = buildBoardParams(targetPage);
        const cacheKey = params.toString();
        const cached = boardCacheRef.current.get(cacheKey);
        if (cached && !force) {
            applyBoardPayload(cached, { append });
            if (!silent) setLoading(false);
        }

        try {
            boardRequestRef.current?.abort();
            controller = new AbortController();
            boardRequestRef.current = controller;

            const response = await fetch(`/api/operations/preparation-board?${params.toString()}`, {
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Could not load preparation board.');
            boardCacheRef.current.set(cacheKey, data);
            applyBoardPayload(data, { append });
            setError('');
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error(err);
            setError(err.message || 'Could not load preparation board.');
        } finally {
            if (controller && boardRequestRef.current === controller) {
                boardRequestRef.current = null;
                if (!silent) setLoading(false);
            }
        }
    }, [applyBoardPayload, buildBoardParams, page]);

    useEffect(() => {
        const listChanged = lastBoardListKeyRef.current !== boardListKey;
        if (listChanged) {
            lastBoardListKeyRef.current = boardListKey;
            setRows([]);
            setPagination(null);
            setSelectedBookingId(null);
            setSelectedRowDetail(null);
            if (page !== 1) {
                setPage(1);
                return;
            }
        }

        fetchBoard({ targetPage: page, append: !listChanged && page > 1 });
    }, [boardListKey, fetchBoard, page]);

    useEffect(() => () => {
        boardRequestRef.current?.abort();
        detailRequestRef.current?.abort();
    }, []);

    const selectedListRow = useMemo(() => {
        return rows.find((row) => row.booking?.id === selectedBookingId) || null;
    }, [rows, selectedBookingId]);

    const selectedRow = selectedRowDetail || selectedListRow;
    const departments = useMemo(() => departmentOptions.length ? departmentOptions : ['Marketing', 'Accounting', 'Service prep', 'Customer'], [departmentOptions]);
    const hasMoreRows = Boolean(pagination?.last_page && page < pagination.last_page);

    const fetchHandoffDetail = useCallback(async (bookingId, { force = false, silent = false } = {}) => {
        if (!bookingId) return null;
        const cacheKey = String(bookingId);
        const cached = detailCacheRef.current.get(cacheKey);
        if (cached && !force) {
            setSelectedRowDetail(cached);
            return cached;
        }

        if (!silent) {
            setDetailLoading(true);
            setDetailError('');
        }

        let controller = null;
        try {
            detailRequestRef.current?.abort();
            controller = new AbortController();
            detailRequestRef.current = controller;
            const response = await fetch(`/api/operations/preparation-board/${bookingId}`, {
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Could not load handoff details.');
            detailCacheRef.current.set(cacheKey, data);
            setSelectedRowDetail(data);
            setRows((current) => current.map((row) => row.booking?.id === data.booking?.id
                ? {
                    ...row,
                    readiness: data.readiness,
                    readiness_progress: data.readiness_progress,
                    task_progress: data.task_progress,
                    attention_flags: data.attention_flags,
                }
                : row));
            return data;
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error(err);
                setDetailError(err.message || 'Could not load handoff details.');
            }
            return null;
        } finally {
            if (controller && detailRequestRef.current === controller) {
                detailRequestRef.current = null;
                if (!silent) setDetailLoading(false);
            }
        }
    }, []);

    const openHandoff = (bookingId) => {
        setSelectedBookingId(bookingId);
        setSelectedRowDetail(null);
        fetchHandoffDetail(bookingId);
    };

    const applyTaskPatch = (row, updatedTask) => {
        if (!row || !updatedTask) return row;
        const updateTask = (task) => task.id === updatedTask.id
            ? { ...task, ...updatedTask, responsible_area: responsibleArea(updatedTask), raw_department: updatedTask.department }
            : task;
        const nextTasks = (row.tasks || []).map(updateTask);
        const nextGroups = (row.task_groups || []).map((group) => ({
            ...group,
            tasks: (group.tasks || []).map(updateTask),
            completed: (group.tasks || []).map(updateTask).filter((task) => task.status === 'Done').length,
        }));
        const completed = nextTasks.filter((task) => task.status === 'Done').length;
        const total = nextTasks.length || row.task_progress?.total || 0;

        return {
            ...row,
            tasks: nextTasks,
            task_groups: nextGroups,
            task_progress: {
                completed,
                total,
                percent: total > 0 ? Math.round((completed / total) * 100) : 0,
            },
        };
    };

    const toggleTask = async (task) => {
        const nextStatus = task.status === 'Done' ? 'Pending' : 'Done';
        if (task.can_update === false) {
            setError(task.action_hint || `${responsibleArea(task)} is responsible for this handoff task.`);
            return;
        }
        setUpdatingTaskId(task.id);
        try {
            const response = await csrfFetch(`/api/operations/preparation-tasks/${task.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ status: nextStatus }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Could not update task.');
            setSelectedRowDetail((current) => {
                const next = applyTaskPatch(current, data.task);
                if (next?.booking?.id) detailCacheRef.current.set(String(next.booking.id), next);
                return next;
            });
            const refreshed = await fetchHandoffDetail(selectedBookingId, { silent: true, force: true });
            if (refreshed) {
                boardCacheRef.current.clear();
            }
        } catch (err) {
            console.error(err);
            setError(err.message || 'Could not update task.');
        } finally {
            setUpdatingTaskId(null);
        }
    };

    return (
        <div className={isAdminSurface ? 'admin-embedded-surface' : 'space-y-4'}>
            {error && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
            )}

            <div className={isAdminSurface ? 'admin-embedded-workspace' : 'staff-work-surface'}>
                {summary && (
                    <div className={isAdminSurface ? 'admin-stat-strip admin-handoff-stat-strip' : 'mb-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-5'}>
                        {[
                            ['Upcoming', summary.upcoming],
                            ['Needs attention', summary.needs_attention],
                            ['Accounting blockers', summary.payment_not_clear],
                            ['Menu needed', summary.menu_missing],
                            ['Venue access needed', summary.venue_missing],
                        ].map(([label, value]) => (
                            <div key={label} className={isAdminSurface ? 'admin-stat-chip' : 'rounded-xl border border-[#ead8cc] bg-[#fbf8f2] px-4 py-3'}>
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
                                <strong className="mt-1 block text-2xl font-black text-slate-950">{Number(value || 0)}</strong>
                            </div>
                        ))}
                    </div>
                )}
                <div className={isAdminSurface ? 'admin-command-strip admin-handoff-command-strip' : 'staff-filter-bar'}>
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        className="staff-control"
                        placeholder="Search customer, event, or booking ID"
                    />
                    <select value={attentionFilter} onChange={(event) => setAttentionFilter(event.target.value)} className="staff-control">
                        <option value="all">All readiness</option>
                        <option value="needs_attention">Needs attention</option>
                        <option value="payment">Accounting: payment pending</option>
                        <option value="menu">Customer: final menu needed</option>
                        <option value="headcount">Customer: headcount needed</option>
                        <option value="customer_messages">Marketing: open messages</option>
                    </select>
                    <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="staff-control">
                        <option value="all">All responsible areas</option>
                        {departments.map((department) => <option key={department} value={department}>{department}</option>)}
                    </select>
                    <button
                        type="button"
                        onClick={() => {
                            boardCacheRef.current.clear();
                            if (page !== 1) {
                                setRows([]);
                                setPage(1);
                                return;
                            }
                            fetchBoard({ targetPage: 1, append: false, force: true });
                        }}
                        className={isAdminSurface ? 'admin-icon-action admin-refresh-action' : 'staff-row-action admin-refresh-action'}
                        aria-label="Refresh preparation board"
                        title="Refresh preparation board"
                    >
                        <RefreshCw className="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>

                {loading && rows.length === 0 ? (
                    <StaffSkeleton rows={7} label="Loading preparation board" />
                ) : rows.length === 0 ? (
                    <div className="staff-empty-compact">No approved event handoffs match the current filters.</div>
                ) : (
                    <>
                        {loading && <div className="mb-3"><StaffSkeleton rows={1} label="Refreshing preparation board" /></div>}
                        <div className={isAdminSurface ? 'staff-table-wrap admin-surface-grid admin-responsive-table custom-scrollbar' : 'staff-table-wrap custom-scrollbar'}>
                            <table className="staff-table">
                                <thead>
                                    <tr>
                                        <th>Event date</th>
                                        <th>Booking</th>
                                        <th>Readiness</th>
                                        <th>Tasks</th>
                                        <th>Blockers</th>
                                        <th className="text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => {
                                        const readiness = summarizeReadiness(row.readiness);

                                        return (
                                        <tr key={row.booking.id}>
                                            <td className="whitespace-nowrap">
                                                <div className="font-black text-slate-950">{formatDate(row.booking.event_date)}</div>
                                                <div className="mt-0.5 text-xs font-bold text-slate-400">Next 30 days</div>
                                            </td>
                                            <td>
                                                <div className="font-black text-slate-950">{eventName(row.booking)}</div>
                                                <div className="mt-0.5 text-xs font-bold text-slate-500">Booking contact: {bookingContactName(row.booking)} / {row.booking.pax || 0} pax</div>
                                                {hasDifferentBookingContact(row.booking) && (
                                                    <div className="text-xs font-bold text-amber-700">Account: {customerAccountName(row.booking)}</div>
                                                )}
                                            </td>
                                            <td>
                                                <div className="staff-readiness-cell">
                                                    <strong>{readiness.ready}/{readiness.total} clear</strong>
                                                    {readiness.blocked.length > 0 ? (
                                                        <div>
                                                            {readiness.blocked.slice(0, 3).map(([key]) => (
                                                                <span key={key}>{readinessLabels[key] || key}</span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <em>All readiness checks clear</em>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="font-black text-slate-950">{row.task_progress?.completed || 0}/{row.task_progress?.total || 0}</div>
                                                <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-amber-50">
                                                    <div className="h-full rounded-full bg-[#720101]" style={{ width: `${row.task_progress?.percent || 0}%` }} />
                                                </div>
                                            </td>
                                            <td>
                                                {row.attention_flags?.length > 0 ? (
                                                    <span className="staff-status staff-status-danger">{row.attention_flags.length} flag{row.attention_flags.length === 1 ? '' : 's'}</span>
                                                ) : (
                                                    <span className="staff-status staff-status-good">Ready</span>
                                                )}
                                            </td>
                                            <td className="text-right">
                                                <button type="button" onClick={() => openHandoff(row.booking.id)} className="staff-row-action staff-row-action-primary">
                                                    Open handoff
                                                </button>
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                                Showing {rows.length} of {pagination?.total || rows.length}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                                <select value={perPage} onChange={(event) => setPerPage(Number(event.target.value))} className="staff-control max-w-[9rem]">
                                    {[10, 25, 50].map((option) => <option key={option} value={option}>{option} per load</option>)}
                                </select>
                                {hasMoreRows && (
                                    <button
                                        type="button"
                                        onClick={() => setPage((current) => current + 1)}
                                        disabled={loading}
                                        className="staff-row-action staff-row-action-primary"
                                    >
                                        {loading ? 'Loading...' : 'Show more'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            <StaffDrawer
                isOpen={Boolean(selectedBookingId)}
                title="Event Handoff Brief"
                eyebrow={selectedRow ? eventName(selectedRow.booking) : 'Preparation handoff'}
                onClose={() => {
                    setSelectedBookingId(null);
                    setSelectedRowDetail(null);
                    setDetailError('');
                }}
                footer={selectedRowDetail ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs font-bold text-slate-500">
                            {selectedRow.next_action?.label || 'Review the event handoff before closing.'}
                        </p>
                        <div className="flex flex-wrap justify-end gap-2">
                            <button type="button" onClick={() => setSelectedBookingId(null)} className="staff-row-action">
                                Close
                            </button>
                            {selectedRow.next_action?.primary_action_url && (
                                <a href={selectedRow.next_action.primary_action_url} className="staff-row-action staff-row-action-primary">
                                    {selectedRow.next_action.primary_action_label || 'Open'}
                                </a>
                            )}
                        </div>
                    </div>
                ) : null}
            >
                {detailLoading && !selectedRowDetail ? (
                    <StaffSkeleton rows={6} label="Loading handoff details" />
                ) : detailError ? (
                    <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{detailError}</div>
                ) : selectedRowDetail && (
                    <div className="space-y-4">
                        <section className="rounded-xl border border-amber-100 bg-white p-4">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="marketing-kicker">{bookingRef(selectedRow.booking)}</p>
                                    <h3 className="mt-1 text-xl font-black text-slate-950">{eventName(selectedRow.booking)}</h3>
                                    <p className="mt-2 text-sm font-semibold text-slate-500">
                                        Booking contact: {bookingContactName(selectedRow.booking)} / {selectedRow.booking.status}
                                    </p>
                                </div>
                                <div className="min-w-[8rem] text-left sm:text-right">
                                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Readiness</p>
                                    <p className="mt-1 text-2xl font-black text-slate-950">
                                        {readinessPercent(selectedRow)}%
                                    </p>
                                </div>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                {[
                                    ['Schedule', `${formatDate(selectedRow.booking.event_date)} / ${formatTime(selectedRow.booking.event_time)}`],
                                    ['Customer account', hasDifferentBookingContact(selectedRow.booking) ? customerAccountName(selectedRow.booking) : 'Same as booking contact'],
                                    ['Guests', `${selectedRow.booking.pax || 0} pax`],
                                    ['Venue', selectedRow.booking.venue_address_line || selectedRow.booking.venue_city || 'Venue TBD'],
                                    ['Owner', selectedRow.booking.owner_name || 'Unassigned'],
                                ].map(([label, value]) => (
                                    <div key={label} className="rounded-lg bg-[#fffaf3] px-3 py-2">
                                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
                                        <p className="mt-1 text-sm font-black text-slate-800">{value}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-amber-50">
                                <div
                                    className="h-full rounded-full bg-[#720101]"
                                    style={{ width: `${readinessPercent(selectedRow)}%` }}
                                />
                            </div>
                        </section>

                        <section className={`rounded-xl border p-4 ${actionToneClass(selectedRow.next_action?.tone)}`}>
                            <p className="text-xs font-black uppercase tracking-[0.16em] opacity-70">Next action</p>
                            <h3 className="mt-2 text-lg font-black">{selectedRow.next_action?.label || 'Review this handoff'}</h3>
                            <p className="mt-1 text-sm font-semibold opacity-85">
                                {selectedRow.next_action?.description || 'Check readiness and complete the remaining tasks.'}
                            </p>
                            {selectedRow.next_action?.owner_department && (
                                <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] opacity-70">
                                    Owned by {selectedRow.next_action.owner_department}
                                </p>
                            )}
                        </section>

                        {selectedRow.blocking_items?.length > 0 && (
                            <section className="rounded-xl border border-red-100 bg-white p-4">
                                <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-red-700">Blockers</p>
                                <div className="grid gap-2">
                                    {selectedRow.blocking_items.map((item) => (
                                        <div key={item.key} className="rounded-lg bg-red-50 px-3 py-2">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-sm font-black text-red-800">{item.label || readinessLabels[item.key] || item.key}</span>
                                                <span className="staff-status staff-status-danger">Needs attention</span>
                                            </div>
                                            <p className="mt-1 text-xs font-semibold text-red-700">{item.action_hint}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        <section className="rounded-xl border border-amber-100 bg-white p-4">
                            <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Readiness checklist</p>
                            <div className="grid gap-2">
                                {(selectedRow.readiness_details || Object.entries(selectedRow.readiness || {}).map(([key, ready]) => ({ key, ready }))).map((item) => (
                                    <div key={item.key} className="rounded-lg border border-slate-100 bg-[#fffaf3] px-3 py-2">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-sm font-bold text-slate-700">{item.label || readinessLabels[item.key] || item.key}</span>
                                            <span className={readinessClass(item.ready)}>{item.ready ? 'Ready' : 'Needs attention'}</span>
                                        </div>
                                        {!item.ready && item.action_hint && (
                                            <p className="mt-1 text-xs font-semibold text-slate-500">{item.action_hint}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-xl border border-amber-100 bg-white p-4">
                            <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Tasks by owner</p>
                            <div className="space-y-4">
                                {(selectedRow.task_groups?.length ? selectedRow.task_groups : fallbackTaskGroups(selectedRow.tasks)).map((group) => (
                                    <div key={group.owner} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                                        <div className="mb-2 flex items-center justify-between gap-3">
                                            <p className="text-sm font-black text-slate-950">{group.owner}</p>
                                            <span className="staff-status staff-status-muted">{group.completed || 0}/{group.total || 0} done</span>
                                        </div>
                                        <div className="space-y-2">
                                            {(group.tasks || []).map((task) => {
                                                const done = task.status === 'Done';
                                                return (
                                                    <button
                                                        key={task.id}
                                                        type="button"
                                                        onClick={() => toggleTask(task)}
                                                        disabled={updatingTaskId === task.id || task.can_update === false}
                                                        className={`w-full rounded-lg border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-70 ${done ? 'border-emerald-100 bg-emerald-50' : task.can_update === false ? 'border-slate-100 bg-white' : 'border-amber-100 bg-white hover:bg-[#fffaf3]'}`}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <p className="text-sm font-black text-slate-950">{task.label}</p>
                                                                <p className="mt-1 text-xs font-bold uppercase text-slate-400">
                                                                    {task.due_state || 'Pending'}
                                                                </p>
                                                                {task.action_hint && (
                                                                    <p className="mt-1 text-xs font-semibold normal-case text-slate-500">{task.action_hint}</p>
                                                                )}
                                                            </div>
                                                            <span className={taskStatusClass(task)}>{done ? 'Done' : task.due_state || 'Pending'}</span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {selectedRow.contextual_actions?.length > 0 && (
                            <section className="rounded-xl border border-amber-100 bg-white p-4">
                                <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Useful links</p>
                                <div className="flex flex-wrap gap-2">
                                    {selectedRow.contextual_actions.map((action) => (
                                        <a
                                            key={action.key}
                                            href={action.url}
                                            className={action.key === selectedRow.next_action?.kind ? 'staff-row-action staff-row-action-primary' : 'staff-row-action'}
                                        >
                                            {action.label}
                                        </a>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                )}
            </StaffDrawer>
        </div>
    );
};

export default PreparationBoard;
