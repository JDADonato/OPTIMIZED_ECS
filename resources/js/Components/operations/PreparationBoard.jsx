import React, { useEffect, useMemo, useRef, useState } from 'react';
import StaffDrawer from '../staff/StaffDrawer';
import StaffPagination from '../staff/StaffPagination';
import StaffSkeleton from '../staff/StaffSkeleton';
import { getListData, getPaginationMeta } from '../../utils/apiResponses';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import csrfFetch from '../../utils/csrf';

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
    const [selectedBookingId, setSelectedBookingId] = useState(null);
    const debouncedQuery = useDebouncedValue(query, 250);
    const boardRequestRef = useRef(null);

    const fetchBoard = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        let controller = null;
        try {
            boardRequestRef.current?.abort();
            controller = new AbortController();
            boardRequestRef.current = controller;
            const params = new URLSearchParams({
                paginated: '1',
                page: String(page),
                per_page: String(perPage),
                search: debouncedQuery.trim(),
                attention: attentionFilter,
                department: departmentFilter,
            });

            const response = await fetch(`/api/operations/preparation-board?${params.toString()}`, {
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Could not load preparation board.');
            setRows(getListData(data));
            setPagination(getPaginationMeta(data));
            setSummary(data?.meta?.summary || null);
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
    };

    useEffect(() => {
        fetchBoard();
    }, [page, perPage, debouncedQuery, attentionFilter, departmentFilter]);

    useEffect(() => {
        setPage(1);
    }, [debouncedQuery, attentionFilter, departmentFilter, perPage]);

    const selectedRow = useMemo(() => {
        return rows.find((row) => row.booking?.id === selectedBookingId) || null;
    }, [rows, selectedBookingId]);

    const departments = useMemo(() => {
        return Array.from(new Set(rows.flatMap((row) => (row.tasks || []).map((task) => responsibleArea(task))).filter(Boolean))).sort();
    }, [rows]);

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
            await fetchBoard({ silent: true });
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
                    <div className={isAdminSurface ? 'admin-stat-strip' : 'mb-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-5'}>
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
                <div className={isAdminSurface ? 'admin-command-strip' : 'staff-filter-bar'}>
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
                    <button type="button" onClick={() => fetchBoard()} className="staff-row-action">Refresh</button>
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
                                                <div className="mt-0.5 text-xs font-bold text-slate-500">{row.booking.client_full_name || 'Customer'} / {row.booking.pax || 0} pax</div>
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
                                                <button type="button" onClick={() => setSelectedBookingId(row.booking.id)} className="staff-row-action staff-row-action-primary">
                                                    Open handoff
                                                </button>
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <StaffPagination
                            page={page}
                            perPage={perPage}
                            total={pagination?.total || rows.length}
                            onPageChange={setPage}
                            onPerPageChange={setPerPage}
                            perPageOptions={[10, 25, 50]}
                        />
                    </>
                )}
            </div>

            <StaffDrawer
                isOpen={Boolean(selectedRow)}
                title="Event Handoff Brief"
                eyebrow={selectedRow ? eventName(selectedRow.booking) : 'Preparation handoff'}
                onClose={() => setSelectedBookingId(null)}
                footer={selectedRow ? (
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
                {selectedRow && (
                    <div className="space-y-4">
                        <section className="rounded-xl border border-amber-100 bg-white p-4">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="marketing-kicker">{bookingRef(selectedRow.booking)}</p>
                                    <h3 className="mt-1 text-xl font-black text-slate-950">{eventName(selectedRow.booking)}</h3>
                                    <p className="mt-2 text-sm font-semibold text-slate-500">
                                        {selectedRow.booking.client_full_name || 'Customer'} / {selectedRow.booking.status}
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
