import React, { useMemo } from 'react';
import { Head, Link } from '@inertiajs/react';
import ClientNavbar from '../../Components/common/ClientNavbar';
import Footer from '../../Components/common/Footer';
import SmartImage from '../../Components/common/SmartImage';
import { useAuth } from '../../context/AuthContext';

const typeLabels = {
    general: 'Announcement',
    promo: 'Special Offer',
    event_reminder: 'Event Reminder',
    holiday_advisory: 'Holiday Advisory',
    menu_update: 'Menu Update',
    service_notice: 'Service Notice',
    urgent: 'Important Notice',
};

const toneMap = {
    urgent: 'border-red-200 bg-red-50 text-red-900',
    promo: 'border-yellow-200 bg-yellow-50 text-yellow-900',
    service_notice: 'border-blue-200 bg-blue-50 text-blue-900',
    holiday_advisory: 'border-amber-200 bg-amber-50 text-amber-900',
    menu_update: 'border-emerald-200 bg-emerald-50 text-emerald-900',
};

const visibilityLabels = {
    all_customers: 'Homepage and customer dashboard',
    active_clients: 'Customer dashboard for active clients',
    specific_roles: 'Customer dashboard for selected roles',
    specific_users: 'Customer dashboard for selected people',
};

const imageUrl = (announcement) => {
    const path = announcement?.image_url || announcement?.image_path;
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/')) return path;
    return `/storage/${path.replace(/^\/+/, '')}`;
};

const AnnouncementPreview = ({ announcement }) => {
    const { user, logout } = useAuth();
    const image = imageUrl(announcement);
    const label = typeLabels[announcement.type] || 'Announcement';
    const dashboardTone = toneMap[announcement.type] || 'border-[#720101]/15 bg-white text-[#1a1a1a]';
    const summary = announcement.summary || announcement.body || 'Announcement summary will appear here.';
    const body = announcement.body || announcement.summary || '';
    const showHomepage = announcement.visibility === 'all_customers';
    const details = useMemo(() => [
        ['Status', announcement.status || 'draft'],
        ['Audience', visibilityLabels[announcement.visibility] || announcement.visibility || 'All customers'],
        ['Starts', announcement.starts_at ? new Date(announcement.starts_at).toLocaleString() : 'When published'],
        ['Ends', announcement.ends_at ? new Date(announcement.ends_at).toLocaleString() : 'No automatic end'],
    ], [announcement]);

    return (
        <div className="min-h-screen bg-[#f7f4ee] font-sans">
            <Head title={`Preview: ${announcement.title || 'Announcement'}`} />
            <ClientNavbar user={user} logout={logout} activePath="/" />

            <main className="mx-auto max-w-7xl px-5 pb-16 pt-28 sm:px-8">
                <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#720101]/10 bg-white px-5 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[.22em] text-[#9f6500]">Preview mode</p>
                        <h1 className="mt-1 font-display text-3xl font-bold text-[#1a1a1a]">Customer-facing announcement preview</h1>
                        <p className="mt-1 text-sm font-semibold text-slate-500">This is how the announcement reads in customer-facing surfaces. It does not publish or send anything.</p>
                    </div>
                    <Link href="/dashboard/admin" className="inline-flex rounded-full bg-[#720101] px-5 py-3 text-sm font-black text-white hover:bg-[#5a0101]">
                        Back to Admin
                    </Link>
                </div>

                <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
                    <section className="space-y-5">
                        <div className="rounded-3xl border border-[#720101]/10 bg-white p-5 shadow-sm">
                            <p className="text-xs font-black uppercase tracking-[.2em] text-[#720101]">Customer dashboard placement</p>
                            <article className={`mt-4 rounded-3xl border p-5 shadow-sm ${dashboardTone}`}>
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0">
                                        <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-black uppercase tracking-widest">
                                            {label}
                                        </span>
                                        <h2 className="mt-3 font-display text-2xl font-bold">{announcement.title || 'Announcement title'}</h2>
                                        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 opacity-75">{summary}</p>
                                        {body && body !== summary && (
                                            <p className="mt-3 max-w-3xl whitespace-pre-line text-sm font-medium leading-6 opacity-80">{body}</p>
                                        )}
                                        {announcement.cta_label && announcement.cta_url && (
                                            <a href={announcement.cta_url} className="mt-4 inline-flex rounded-xl bg-[#720101] px-4 py-2 text-xs font-black text-white">
                                                {announcement.cta_label}
                                            </a>
                                        )}
                                    </div>
                                    <span className="shrink-0 rounded-xl bg-white/70 px-4 py-2 text-xs font-black">Dismiss</span>
                                </div>
                            </article>
                        </div>

                        <div className="rounded-3xl border border-[#720101]/10 bg-white p-5 shadow-sm">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-[.2em] text-[#720101]">Homepage placement</p>
                                    <h2 className="mt-1 font-display text-2xl font-bold text-[#1a1a1a]">
                                        {showHomepage ? 'Visible on the public homepage' : 'Not shown on the public homepage'}
                                    </h2>
                                </div>
                                {!showHomepage && (
                                    <span className="rounded-full bg-[#fff7e8] px-3 py-1 text-xs font-black uppercase tracking-widest text-[#720101]">
                                        Targeted only
                                    </span>
                                )}
                            </div>

                            {showHomepage ? (
                                <article className="mt-4 overflow-hidden rounded-3xl border border-[#720101]/10 bg-[#fffaf3] shadow-sm">
                                    {image && <SmartImage src={image} alt="" aspectRatio="16 / 9" containerClassName="h-64" />}
                                    <div className="p-6 md:p-8">
                                        <span className="inline-flex rounded-full bg-[#720101]/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#720101]">
                                            {label}
                                        </span>
                                        <h3 className="mt-4 font-display text-2xl font-bold leading-tight text-[#1a1a1a] md:text-3xl">
                                            {announcement.title || 'Announcement title'}
                                        </h3>
                                        <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-gray-600">{summary}</p>
                                        {announcement.cta_label && announcement.cta_url && (
                                            <a href={announcement.cta_url} className="mt-6 inline-flex rounded-full bg-[#720101] px-6 py-3 text-sm font-black uppercase tracking-wider text-white">
                                                {announcement.cta_label}
                                            </a>
                                        )}
                                    </div>
                                </article>
                            ) : (
                                <p className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm font-semibold leading-6 text-slate-500">
                                    This audience setting keeps the announcement inside customer dashboard announcement areas instead of the public homepage.
                                </p>
                            )}
                        </div>
                    </section>

                    <aside className="h-fit rounded-3xl border border-[#720101]/10 bg-white p-5 shadow-sm">
                        <p className="text-xs font-black uppercase tracking-[.2em] text-[#9f6500]">Announcement details</p>
                        <dl className="mt-4 space-y-3">
                            {details.map(([key, value]) => (
                                <div key={key} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                                    <dt className="text-[11px] font-black uppercase tracking-widest text-slate-400">{key}</dt>
                                    <dd className="mt-1 text-sm font-black capitalize text-[#1a1a1a]">{value}</dd>
                                </div>
                            ))}
                        </dl>
                        <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">
                            Drafts and scheduled announcements can be previewed here before customers can see them.
                        </p>
                    </aside>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default AnnouncementPreview;
