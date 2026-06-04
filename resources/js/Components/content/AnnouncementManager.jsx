import React, { useEffect, useMemo, useState } from 'react';
import {
    Archive,
    ChevronDown,
    Eye,
    Filter,
    Mail,
    Pencil,
    Save,
    Search,
    Send,
    Trash2,
    X,
} from 'lucide-react';
import StaffSkeleton from '../staff/StaffSkeleton';

const emptyForm = {
    title: '',
    summary: '',
    body: '',
    type: 'general',
    visibility: 'all_customers',
    visibility_roles: ['Client'],
    specific_user_ids: [],
    status: 'draft',
    starts_at: '',
    ends_at: '',
    send_email: false,
    email_subject: '',
    email_body: '',
    cta_label: '',
    cta_url: '',
    image_path: '',
};

const typeLabels = {
    general: 'General',
    promo: 'Promo',
    event_reminder: 'Event Reminder',
    holiday_advisory: 'Holiday Advisory',
    menu_update: 'Menu Update',
    service_notice: 'Service Notice',
    urgent: 'Urgent Notice',
};

const visibilityLabels = {
    all_customers: 'Homepage and all customers',
    active_clients: 'Customers with bookings',
    specific_roles: 'Selected roles',
    specific_users: 'Selected people',
};

const tabs = [
    { id: 'all', label: 'All' },
    { id: 'draft', label: 'Drafts' },
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'published', label: 'Published' },
    { id: 'sent', label: 'Sent History' },
    { id: 'archived', label: 'Archived' },
];

const roleOptions = ['Client', 'Marketing', 'Accounting', 'Admin'];
const typeOptions = ['all', ...Object.keys(typeLabels)];
const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
const isFutureDate = (value) => value && new Date(value).getTime() > Date.now();

const formatDate = (value) => {
    if (!value) return 'Not set';
    return new Date(value).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

const firstValidationMessage = (payload) => {
    if (payload?.errors) {
        const first = Object.values(payload.errors).flat()[0];
        if (first) return first;
    }

    return payload?.message || 'Request failed. Please check the announcement details.';
};

const statusCopy = (item) => {
    if (item.status === 'scheduled') return `Scheduled for ${formatDate(item.starts_at)}`;
    if (item.status === 'published') return `Live since ${formatDate(item.published_at || item.starts_at)}`;
    if (item.status === 'archived') return 'Hidden from customers';
    return 'Draft only';
};

const AnnouncementManager = ({ variant = 'marketing', user }) => {
    const [announcements, setAnnouncements] = useState([]);
    const [filters, setFilters] = useState({ tab: 'all', type: 'all', search: '' });
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [testEmail, setTestEmail] = useState(user?.email || '');
    const [audienceSearch, setAudienceSearch] = useState('');
    const [audienceUsers, setAudienceUsers] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [composerOpen, setComposerOpen] = useState(false);

    const isAdminVariant = variant === 'admin';
    const shellClass = isAdminVariant ? 'admin-content-flat admin-announcement-panel' : 'marketing-panel';
    const primaryClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#720101] px-4 py-3 text-sm font-black text-white transition hover:bg-[#5a0101] disabled:opacity-60';
    const secondaryClass = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[#720101]/15 bg-white px-4 py-3 text-sm font-black text-[#720101] transition hover:bg-[#fff7e8] disabled:opacity-60';
    const publishLabel = isFutureDate(form.starts_at) ? 'Schedule Announcement' : 'Publish Now';

    const stats = useMemo(() => announcements.reduce((acc, item) => {
        acc.total += 1;
        acc[item.status] = (acc[item.status] || 0) + 1;
        acc.homepage += item.status === 'published' && item.visibility === 'all_customers' ? 1 : 0;
        acc.sent += Number(item.sent_count || 0);
        acc.failed += Number(item.failed_count || 0);
        acc.read += Number(item.read_count || 0);
        return acc;
    }, { total: 0, draft: 0, scheduled: 0, published: 0, archived: 0, homepage: 0, sent: 0, failed: 0, read: 0 }), [announcements]);

    const filteredItems = useMemo(() => {
        const search = filters.search.trim().toLowerCase();

        return announcements.filter((item) => {
            const tabMatch = filters.tab === 'all'
                || item.status === filters.tab
                || (filters.tab === 'sent' && Number(item.sent_count || 0) + Number(item.failed_count || 0) > 0);
            const typeMatch = filters.type === 'all' || item.type === filters.type;
            const searchMatch = !search || [item.title, item.summary, item.body, item.email_subject]
                .filter(Boolean)
                .some((value) => value.toLowerCase().includes(search));

            return tabMatch && typeMatch && searchMatch;
        });
    }, [announcements, filters]);

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    useEffect(() => {
        if (form.visibility !== 'specific_users') return;

        const timer = window.setTimeout(() => {
            fetchAudienceUsers(audienceSearch);
        }, 220);

        return () => window.clearTimeout(timer);
    }, [audienceSearch, form.visibility]);

    const requestJson = async (url, options = {}) => {
        const response = await fetch(url, {
            ...options,
            headers: {
                Accept: 'application/json',
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                'X-CSRF-TOKEN': csrfToken(),
                ...(options.headers || {}),
            },
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(firstValidationMessage(payload));
        }

        return payload;
    };

    const flash = (text, type = 'success') => {
        setMessage({ text, type });
        window.setTimeout(() => setMessage(null), 3200);
    };

    const fetchAnnouncements = async () => {
        setLoading(true);
        try {
            const payload = await requestJson('/api/admin/announcements?paginated=1&per_page=75');
            setAnnouncements(Array.isArray(payload) ? payload : (payload.data || []));
        } catch (error) {
            flash(error.message || 'Unable to load announcements.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchAudienceUsers = async (query = '') => {
        try {
            const params = new URLSearchParams({ q: query });
            setAudienceUsers(await requestJson(`/api/admin/announcement-audience-users?${params.toString()}`));
        } catch {
            setAudienceUsers([]);
        }
    };

    const resetForm = () => {
        setForm(emptyForm);
        setEditingId(null);
        setSelectedUsers([]);
        setAudienceSearch('');
    };

    const openNewAnnouncement = () => {
        resetForm();
        setComposerOpen(true);
    };

    const closeComposer = () => {
        setComposerOpen(false);
        resetForm();
    };

    const updateField = (field, value) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const addAudienceUser = (person) => {
        if (form.specific_user_ids.includes(person.id)) return;
        setSelectedUsers((current) => [...current, person]);
        updateField('specific_user_ids', [...form.specific_user_ids, person.id]);
        setAudienceSearch('');
    };

    const removeAudienceUser = (id) => {
        setSelectedUsers((current) => current.filter((person) => person.id !== id));
        updateField('specific_user_ids', form.specific_user_ids.filter((value) => value !== id));
    };

    const startEdit = (item) => {
        const ids = Array.isArray(item.specific_user_ids) ? item.specific_user_ids.map(Number) : [];

        setEditingId(item.id);
        setForm({
            title: item.title || '',
            summary: item.summary || '',
            body: item.body || '',
            type: item.type || 'general',
            visibility: item.visibility || 'all_customers',
            visibility_roles: item.visibility_roles?.length ? item.visibility_roles : ['Client'],
            specific_user_ids: ids,
            status: item.status || 'draft',
            starts_at: item.starts_at ? item.starts_at.slice(0, 16) : '',
            ends_at: item.ends_at ? item.ends_at.slice(0, 16) : '',
            send_email: Boolean(item.send_email),
            email_subject: item.email_subject || '',
            email_body: item.email_body || '',
            cta_label: item.cta_label || '',
            cta_url: item.cta_url || '',
            image_path: item.image_path || '',
        });
        setSelectedUsers(ids.map((id) => ({ id, username: `User #${id}`, email: '', role: '' })));
        setComposerOpen(true);
    };

    const openCustomerPreview = (item) => {
        if (!item?.id) {
            flash('Save the announcement first, then preview it as a customer.', 'error');
            return;
        }

        window.open(`/preview/announcements/${item.id}`, '_blank', 'noopener,noreferrer');
    };

    const payloadFromForm = () => ({
        ...form,
        status: form.status || 'draft',
        summary: form.summary || null,
        body: form.body || null,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        email_subject: form.email_subject || null,
        email_body: form.email_body || null,
        cta_label: form.cta_label || null,
        cta_url: form.cta_url || null,
        image_path: form.image_path || null,
        visibility_roles: form.visibility === 'specific_roles' ? form.visibility_roles : [],
        specific_user_ids: form.visibility === 'specific_users' ? form.specific_user_ids : [],
    });

    const saveAnnouncement = async () => {
        const url = editingId ? `/api/admin/announcements/${editingId}` : '/api/admin/announcements';
        const method = editingId ? 'PATCH' : 'POST';
        return requestJson(url, { method, body: JSON.stringify(payloadFromForm()) });
    };

    const submit = async (event, mode = 'draft') => {
        event.preventDefault();
        setSaving(true);

        try {
            const saved = await saveAnnouncement();

            if (mode === 'publish') {
                await requestJson(`/api/admin/announcements/${saved.id}/publish`, { method: 'POST' });
                flash(isFutureDate(form.starts_at) ? 'Announcement scheduled.' : 'Announcement published.');
            } else {
                flash(editingId ? 'Announcement updated.' : 'Announcement saved as draft.');
            }

            setComposerOpen(false);
            resetForm();
            await fetchAnnouncements();
        } catch (error) {
            flash(error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const runAction = async (item, actionName) => {
        setSaving(true);
        try {
            await requestJson(`/api/admin/announcements/${item.id}/${actionName}`, { method: 'POST' });
            flash(actionName === 'publish' ? 'Announcement published.' : 'Announcement archived.');
            await fetchAnnouncements();
        } catch (error) {
            flash(error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const deleteAnnouncement = async (item) => {
        setSaving(true);
        try {
            await requestJson(`/api/admin/announcements/${item.id}`, { method: 'DELETE' });
            if (editingId === item.id) {
                setComposerOpen(false);
                resetForm();
            }
            setDeleteTarget(null);
            flash('Announcement discarded.');
            await fetchAnnouncements();
        } catch (error) {
            flash(error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const sendTest = async (item) => {
        if (!testEmail) {
            flash('Enter a test email first.', 'error');
            return;
        }

        setSaving(true);
        try {
            await requestJson(`/api/admin/announcements/${item.id}/send-test`, {
                method: 'POST',
                body: JSON.stringify({ email: testEmail }),
            });
            flash('Test email queued.');
        } catch (error) {
            flash(error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const metricCards = [
        ['Drafts', stats.draft],
        ['Scheduled', stats.scheduled],
        ['Published', stats.published],
        ['Emails sent', stats.sent],
        ['Reads', stats.read],
    ];

    return (
        <div className={isAdminVariant ? 'admin-content-surface admin-announcement-surface' : 'space-y-5'}>
            {composerOpen && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm">
                    <form onSubmit={(event) => submit(event, 'draft')} className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.35rem] border border-[#720101]/15 bg-white shadow-2xl">
                        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#720101]/10 bg-[#fffaf3] px-5 py-4 lg:px-6">
                            <div>
                                <p className="marketing-kicker">{editingId ? 'Editing' : 'Composer'}</p>
                                <h3 className="mt-1 text-2xl font-black text-[#111827]">{editingId ? 'Update announcement' : 'New announcement'}</h3>
                            </div>
                            <div className="flex flex-wrap justify-end gap-2">
                                {editingId && (
                                    <button type="button" onClick={() => openCustomerPreview({ id: editingId })} className={secondaryClass}>
                                        <Eye size={16} />
                                        Preview as customer
                                    </button>
                                )}
                                <button type="button" aria-label="Close announcement composer" onClick={closeComposer} className="rounded-xl border border-[#720101]/15 bg-white p-3 text-[#720101] hover:bg-[#fff7e8]">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 lg:px-6">
                            <div className="grid gap-4 lg:grid-cols-2">
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 lg:col-span-2">
                                    Title
                                    <input required value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="Short, customer-friendly headline" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none focus:border-[#720101] focus:ring-4 focus:ring-[#720101]/10" />
                                </label>

                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 lg:col-span-2">
                                    Short summary
                                    <textarea value={form.summary} onChange={(event) => updateField('summary', event.target.value)} placeholder="One or two lines customers can scan quickly." rows={2} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold normal-case tracking-normal outline-none focus:border-[#720101] focus:ring-4 focus:ring-[#720101]/10" />
                                </label>

                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 lg:col-span-2">
                                    Full message
                                    <textarea value={form.body} onChange={(event) => updateField('body', event.target.value)} placeholder="Add the full update, advisory, promo, or reminder." rows={5} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold normal-case tracking-normal outline-none focus:border-[#720101] focus:ring-4 focus:ring-[#720101]/10" />
                                </label>

                                <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                                    Type
                                    <select value={form.type} onChange={(event) => updateField('type', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none">
                                        {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                    </select>
                                </label>
                                <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                                    Audience
                                    <select value={form.visibility} onChange={(event) => updateField('visibility', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none">
                                        {Object.entries(visibilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                    </select>
                                </label>

                                {form.visibility === 'specific_roles' && (
                                    <div className="rounded-xl border border-[#720101]/10 bg-[#fff7e8] p-4 lg:col-span-2">
                                        <p className="text-xs font-black uppercase tracking-widest text-[#9f6500]">Choose roles</p>
                                        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                                            {roleOptions.map((role) => (
                                                <label key={role} className="flex items-center gap-2 rounded-lg border border-[#720101]/10 bg-white px-3 py-2 text-sm font-bold text-slate-700">
                                                    <input
                                                        type="checkbox"
                                                        checked={form.visibility_roles.includes(role)}
                                                        onChange={(event) => {
                                                            const next = event.target.checked
                                                                ? [...form.visibility_roles, role]
                                                                : form.visibility_roles.filter((item) => item !== role);
                                                            updateField('visibility_roles', next);
                                                        }}
                                                    />
                                                    {role}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {form.visibility === 'specific_users' && (
                                    <div className="rounded-xl border border-[#720101]/10 bg-[#fff7e8] p-4 lg:col-span-2">
                                        <p className="text-xs font-black uppercase tracking-widest text-[#9f6500]">Choose people</p>
                                        <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                                            <Search size={16} className="text-slate-400" />
                                            <input value={audienceSearch} onChange={(event) => setAudienceSearch(event.target.value)} placeholder="Search name, email, or role" className="w-full text-sm font-bold outline-none" />
                                        </label>
                                        {audienceSearch && audienceUsers.length > 0 && (
                                            <div className="mt-2 max-h-48 overflow-auto rounded-xl border border-slate-200 bg-white">
                                                {audienceUsers.map((person) => (
                                                    <button key={person.id} type="button" onClick={() => addAudienceUser(person)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-bold hover:bg-[#fff7e8]">
                                                        <span>
                                                            {person.username}
                                                            <span className="block text-xs font-semibold text-slate-500">{person.email}</span>
                                                        </span>
                                                        <span className="text-xs font-black uppercase text-[#9f6500]">{person.role}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {selectedUsers.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {selectedUsers.map((person) => (
                                                    <span key={person.id} className="inline-flex items-center gap-2 rounded-lg border border-[#720101]/12 bg-white px-3 py-2 text-xs font-black text-slate-700">
                                                        {person.username}
                                                        <button type="button" aria-label={`Remove ${person.username}`} onClick={() => removeAudienceUser(person.id)} className="text-[#720101]">
                                                            <X size={13} />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                                    Publish from
                                    <input type="datetime-local" value={form.starts_at} onChange={(event) => updateField('starts_at', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none" />
                                </label>
                                <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                                    Hide after (optional)
                                    <input type="datetime-local" value={form.ends_at} onChange={(event) => updateField('ends_at', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none" />
                                    <span className="mt-2 block text-[11px] font-semibold normal-case leading-5 tracking-normal text-slate-500">
                                        Leave blank to keep it visible until staff manually archives it.
                                    </span>
                                </label>

                                <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                                    Button text
                                    <input value={form.cta_label} onChange={(event) => updateField('cta_label', event.target.value)} placeholder="Optional" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none" />
                                </label>
                                <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                                    Button link
                                    <input value={form.cta_url} onChange={(event) => updateField('cta_url', event.target.value)} placeholder="/book" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none" />
                                </label>

                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 lg:col-span-2">
                                    Image URL or storage path
                                    <input value={form.image_path} onChange={(event) => updateField('image_path', event.target.value)} placeholder="Optional" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal outline-none" />
                                </label>

                                <label className="flex items-center justify-between rounded-xl border border-[#720101]/10 bg-[#fff7e8] px-4 py-3 lg:col-span-2">
                                    <span className="text-sm font-black text-[#111827]">Send by email when published</span>
                                    <input type="checkbox" checked={form.send_email} onChange={(event) => updateField('send_email', event.target.checked)} className="h-5 w-5" />
                                </label>

                                {form.send_email && (
                                    <div className="space-y-3 rounded-xl border border-[#720101]/10 bg-white p-4 lg:col-span-2">
                                        <input value={form.email_subject} onChange={(event) => updateField('email_subject', event.target.value)} placeholder="Email subject. Leave blank to use the title." className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-[#720101]" />
                                        <textarea value={form.email_body} onChange={(event) => updateField('email_body', event.target.value)} placeholder="Email message. Leave blank to reuse the announcement." rows={3} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#720101]" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid shrink-0 gap-3 border-t border-[#720101]/10 bg-[#fffaf3] px-5 py-4 sm:grid-cols-[1fr_1fr_auto] lg:px-6">
                            <button type="submit" disabled={saving} className={secondaryClass}>
                                <Save size={16} />
                                {editingId ? 'Save changes' : 'Save draft'}
                            </button>
                            <button type="button" disabled={saving} onClick={(event) => submit(event, 'publish')} className={primaryClass}>
                                <Send size={16} />
                                {saving ? 'Saving...' : publishLabel}
                            </button>
                            <button type="button" onClick={closeComposer} className={secondaryClass}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {deleteTarget && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-[1.5rem] border border-[#720101]/15 bg-[#fffaf3] p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="marketing-kicker">Discard Draft</p>
                                <h3 className="mt-2 text-2xl font-black text-[#111827]">Discard this announcement?</h3>
                            </div>
                            <button type="button" aria-label="Close" onClick={() => setDeleteTarget(null)} className="rounded-xl border border-[#720101]/15 bg-white p-2 text-[#720101]">
                                <X size={18} />
                            </button>
                        </div>
                        <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
                            "{deleteTarget.title}" will be discarded from drafts. Published announcements should be archived instead so the team keeps a record.
                        </p>
                        <div className="mt-6 grid gap-3 sm:grid-cols-2">
                            <button type="button" onClick={() => setDeleteTarget(null)} className={secondaryClass}>
                                Keep it
                            </button>
                            <button type="button" disabled={saving} onClick={() => deleteAnnouncement(deleteTarget)} className="inline-flex items-center justify-center rounded-xl bg-[#720101] px-4 py-3 text-sm font-black text-white transition hover:bg-[#5a0101] disabled:opacity-60">
                                {saving ? 'Discarding...' : 'Discard announcement'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {message && (
                <div className={`rounded-xl border px-4 py-3 text-sm font-bold ${message.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-[#720101]/15 bg-[#fff7e8] text-[#720101]'}`}>
                    {message.text}
                </div>
            )}

            <section className={isAdminVariant ? 'admin-announcement-toolbar' : `${shellClass} p-4`}>
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="admin-announcement-metrics">
                        {metricCards.map(([label, value]) => (
                            <span key={label}>
                                <strong>{value}</strong>
                                {label}
                            </span>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {editingId && (
                            <button type="button" onClick={() => openCustomerPreview({ id: editingId })} className={secondaryClass}>
                                <Eye size={16} />
                                Preview as customer
                            </button>
                        )}
                        <button type="button" onClick={openNewAnnouncement} className={secondaryClass}>
                            New announcement
                        </button>
                    </div>
                </div>
            </section>

            <div className={isAdminVariant ? 'admin-content-workspace' : 'grid gap-5'}>
                <section className={`${shellClass} overflow-hidden`}>
                    <div className="border-b border-[#720101]/10 p-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <p className="marketing-kicker">Publishing Desk</p>
                            <button onClick={() => setFiltersOpen((open) => !open)} className={secondaryClass}>
                                <Filter size={16} />
                                Filters
                            </button>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setFilters((current) => ({ ...current, tab: tab.id }))}
                                    className={`rounded-xl border px-4 py-2 text-sm font-black transition ${filters.tab === tab.id ? 'border-[#720101] bg-[#720101] text-white' : 'border-[#720101]/12 bg-white text-[#720101] hover:bg-[#fff7e8]'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {filtersOpen && (
                            <div className="mt-4 grid gap-3 rounded-xl border border-[#720101]/10 bg-[#fff7e8] p-4 lg:grid-cols-[1fr_220px]">
                                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                                    <Search size={16} className="text-slate-400" />
                                    <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search announcements" className="w-full text-sm font-bold outline-none" />
                                </label>
                                <select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none">
                                    {typeOptions.map((type) => <option key={type} value={type}>{type === 'all' ? 'All types' : typeLabels[type]}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="p-5">
                            <StaffSkeleton rows={5} label="Loading announcements" />
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="p-8 text-center text-sm font-bold text-slate-400">No announcements match this view.</div>
                    ) : (
                        <div className="divide-y divide-[#720101]/10">
                            {filteredItems.map((item) => {
                                const canDelete = ['draft', 'scheduled'].includes(item.status);
                                const emailTotal = Number(item.sent_count || 0) + Number(item.failed_count || 0) + Number(item.pending_count || 0);

                                return (
                                    <article key={item.id} className="p-5 transition hover:bg-[#fffaf3]">
                                        <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-start">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-3 text-xs font-black uppercase tracking-widest">
                                                    <span className="text-[#9f6500]">{typeLabels[item.type] || item.type}</span>
                                                    <span className="text-slate-400">{visibilityLabels[item.visibility] || item.visibility}</span>
                                                    <span className="text-[#720101]">{statusCopy(item)}</span>
                                                </div>
                                                <h4 className="mt-2 truncate text-xl font-black text-[#111827]">{item.title}</h4>
                                                <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-slate-500">{item.summary || item.body || 'No summary yet.'}</p>
                                                <div className="mt-3 grid gap-2 text-xs font-black uppercase tracking-wider text-slate-400 sm:grid-cols-4">
                                                    <span>{item.sent_count || 0} sent</span>
                                                    <span>{item.failed_count || 0} failed</span>
                                                    <span>{item.read_count || 0} reads</span>
                                                    <span>{emailTotal} email records</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 xl:justify-end">
                                                <button type="button" onClick={() => openCustomerPreview(item)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-[#fff7e8]">
                                                    <Eye size={14} className="inline" /> Preview as customer
                                                </button>
                                                <button type="button" onClick={() => startEdit(item)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-[#fff7e8]">
                                                    <Pencil size={14} className="inline" /> Edit
                                                </button>
                                                {item.send_email && (
                                                    <button type="button" disabled={saving} onClick={() => sendTest(item)} className="rounded-xl border border-[#9f6500]/20 bg-[#fff7e8] px-3 py-2 text-xs font-black text-[#9f6500] hover:bg-white">
                                                        <Mail size={14} className="inline" /> Test
                                                    </button>
                                                )}
                                                {item.status !== 'published' && item.status !== 'archived' && (
                                                    <button type="button" disabled={saving} onClick={() => runAction(item, 'publish')} className="rounded-xl bg-[#720101] px-3 py-2 text-xs font-black text-white hover:bg-[#5a0101]">
                                                        <Send size={14} className="inline" /> Publish
                                                    </button>
                                                )}
                                                {item.status === 'published' && (
                                                    <button type="button" disabled={saving} onClick={() => runAction(item, 'archive')} className="rounded-xl border border-[#720101]/15 bg-white px-3 py-2 text-xs font-black text-[#720101] hover:bg-[#fff7e8]">
                                                        <Archive size={14} className="inline" /> Archive
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button type="button" disabled={saving} onClick={() => setDeleteTarget(item)} className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-700 hover:bg-red-50">
                                                        <Trash2 size={14} className="inline" /> Discard
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}

                    <div className="border-t border-[#720101]/10 bg-[#fffaf3] p-5">
                        <div className="grid gap-3 xl:grid-cols-[1fr_280px] xl:items-center">
                            <details className="group rounded-xl border border-[#720101]/10 bg-white p-4">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-[#111827]">
                                    How publishing works
                                    <ChevronDown size={16} className="transition group-open:rotate-180" />
                                </summary>
                                <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                                    Save as draft while writing. Choose a future publish date to schedule it. Published homepage announcements appear publicly; targeted announcements appear in customer dashboards.
                                </p>
                            </details>
                            <input value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="Test email address" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#720101]" />
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default AnnouncementManager;
