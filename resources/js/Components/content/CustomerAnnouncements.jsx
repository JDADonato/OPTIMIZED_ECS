import React, { useEffect, useMemo, useState } from 'react';

const toneMap = {
    urgent: 'border-red-200 bg-red-50 text-red-900',
    promo: 'border-yellow-200 bg-yellow-50 text-yellow-900',
    service_notice: 'border-blue-200 bg-blue-50 text-blue-900',
    holiday_advisory: 'border-amber-200 bg-amber-50 text-amber-900',
    menu_update: 'border-emerald-200 bg-emerald-50 text-emerald-900',
};

const labelMap = {
    general: 'Announcement',
    promo: 'Promo',
    event_reminder: 'Reminder',
    holiday_advisory: 'Holiday Advisory',
    menu_update: 'Menu Update',
    service_notice: 'Service Notice',
    urgent: 'Urgent',
};

const CustomerAnnouncements = () => {
    const [items, setItems] = useState([]);
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        fetch('/api/customer/announcements')
            .then((res) => (res.ok ? res.json() : []))
            .then(setItems)
            .catch(() => setItems([]));
    }, []);

    const visible = useMemo(() => items.filter((item) => !item.is_read).slice(0, 3), [items]);

    const markRead = async (item) => {
        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, is_read: true } : entry));
        await fetch(`/api/customer/announcements/${item.id}/read`, {
            method: 'POST',
            headers: { Accept: 'application/json' },
        }).catch(() => {});
    };

    if (visible.length === 0) return null;

    return (
        <section className="mb-6 grid gap-3">
            {visible.map((item) => {
                const tone = toneMap[item.type] || 'border-[#720101]/15 bg-white text-[#1a1a1a]';
                const expanded = expandedId === item.id;

                return (
                    <article key={item.id} className={`rounded-3xl border p-5 shadow-sm ${tone}`}>
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-black uppercase tracking-widest">
                                    {labelMap[item.type] || 'Announcement'}
                                </span>
                                <h3 className="mt-3 text-xl font-display font-bold">{item.title}</h3>
                                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 opacity-75">{item.summary || item.body}</p>
                                {expanded && item.body && (
                                    <p className="mt-3 max-w-3xl whitespace-pre-line text-sm font-medium leading-6 opacity-80">{item.body}</p>
                                )}
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {item.body && (
                                        <button onClick={() => setExpandedId(expanded ? null : item.id)} className="rounded-xl bg-white/70 px-4 py-2 text-xs font-black">
                                            {expanded ? 'Show Less' : 'Read More'}
                                        </button>
                                    )}
                                    {item.cta_label && item.cta_url && (
                                        <a href={item.cta_url} className="rounded-xl bg-[#720101] px-4 py-2 text-xs font-black text-white">
                                            {item.cta_label}
                                        </a>
                                    )}
                                </div>
                            </div>
                            <button onClick={() => markRead(item)} className="shrink-0 rounded-xl bg-white/70 px-4 py-2 text-xs font-black hover:bg-white">
                                Dismiss
                            </button>
                        </div>
                    </article>
                );
            })}
        </section>
    );
};

export default CustomerAnnouncements;
