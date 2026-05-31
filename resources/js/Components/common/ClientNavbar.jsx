import React, { useState } from 'react';
import { Link } from '@inertiajs/react';
import UserDropdown from './UserDropdown';
import NotificationBell from './NotificationBell';
import logoImg from '../../../images/ECS_LOGO.png';
import { dashboardHrefForUser } from '../../utils/dashboardLinks';

const ClientNavbar = ({ user, logout, activePath }) => {
    const [mob, setMob] = useState(false);
    const path = activePath || window.location.pathname;
    const links = [
        { n: 'Home', p: '/' },
        { n: 'About', p: '/about' },
        { n: 'Amenities', p: '/amenities' },
        { n: 'Menu', p: '/menu' },
        { n: 'Book Now', p: '/book' },
        { n: 'Contact', p: '/contact' },
    ];
    const dash = () => dashboardHrefForUser(user, '/');

    return (
        <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#720101]/95 shadow-lg shadow-black/10 backdrop-blur">
            <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-5 sm:px-8">
                <Link href="/" prefetch="hover" className="flex items-center gap-3">
                    <img src={logoImg} alt="ECS" className="h-12 w-auto" />
                </Link>
                <div className="hidden items-center gap-6 md:flex">
                    {links.map(l => {
                        const active = path === l.p || (l.p === '/' && path === '/');
                        return (
                            <Link key={l.n} href={l.p} prefetch="hover" className={`rounded-full px-3 py-2 text-[12px] font-bold uppercase tracking-widest transition-colors ${active ? 'bg-[#f0aa0b] text-[#1a1a1a]' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
                                {l.n}
                            </Link>
                        );
                    })}
                    {user ? (
                        <div className="flex items-center gap-2">
                            <Link href={dash()} prefetch="hover" className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest shadow-sm transition-colors ${path.startsWith('/dashboard') ? 'bg-[#f0aa0b] text-[#1a1a1a]' : 'bg-white text-[#720101] hover:bg-[#f0aa0b] hover:text-[#1a1a1a]'}`}>
                                Dashboard
                            </Link>
                            <NotificationBell variant="light" />
                            <UserDropdown user={user} dashLink={dash()} />
                        </div>
                    ) : (
                        <Link href="/login" prefetch="hover" className="rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#720101]">Login</Link>
                    )}
                </div>
                <button onClick={() => setMob(!mob)} className="md:hidden text-white">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">{mob ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>}</svg>
                </button>
            </div>
            {mob && (
                <div className="border-t border-white/10 bg-[#5a0101] px-5 py-3 md:hidden">
                    {links.map(l => <Link key={l.n} href={l.p} prefetch="hover" className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/10">{l.n}</Link>)}
                    {user ? (
                        <>
                            <Link href={dash()} prefetch="hover" className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Dashboard</Link>
                            <Link href="/profile?tab=preferences" prefetch="hover" className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Settings</Link>
                            {logout && <button onClick={logout} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-white hover:bg-white/10">Logout</button>}
                        </>
                    ) : (
                        <Link href="/login" prefetch="hover" className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Login</Link>
                    )}
                </div>
            )}
        </nav>
    );
};

export default ClientNavbar;
