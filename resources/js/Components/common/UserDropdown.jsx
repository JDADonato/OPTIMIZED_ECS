import React, { useState, useRef, useEffect } from 'react';
import { Link, router } from '@inertiajs/react';
import { dashboardHrefForUser, isStaffUser } from '../../utils/dashboardLinks';

const UserDropdown = ({ user, dashLink }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const displayName = user.full_name || user.username || 'Account';
    const initial = displayName.charAt(0).toUpperCase();
    const settingsHref = isStaffUser(user) ? `${dashboardHrefForUser(user)}?tab=settings` : '/profile?tab=preferences';

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = (e) => {
        e.preventDefault();
        router.post('/logout');
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 text-white/80 hover:text-white focus:outline-none transition-colors"
            >
                <div className="w-8 h-8 overflow-hidden rounded-full bg-yellow-500 text-red-900 flex items-center justify-center font-bold shadow-md ring-2 ring-white/15">
                    {user.avatar_url ? (
                        <img src={user.avatar_url} alt={`${displayName} profile`} className="h-full w-full object-cover" />
                    ) : (
                        initial
                    )}
                </div>
                <span className="text-sm font-medium">{user.username}</span>
                <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-48 bg-white rounded-xl shadow-xl overflow-hidden z-50 border border-gray-100 py-1" style={{ animation: 'fadeIn .2s ease' }}>
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                        <p className="text-sm font-bold text-gray-900 truncate">{user.username}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    {dashLink && (
                        <Link
                            href={dashLink}
                            className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-900 transition-colors flex items-center"
                            onClick={() => setIsOpen(false)}
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M5 10v10h14V10" /></svg>
                            Dashboard
                        </Link>
                    )}
                    <Link
                        href="/profile"
                        className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-900 transition-colors flex items-center"
                        onClick={() => setIsOpen(false)}
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        My Profile
                    </Link>
                    <Link
                        href={settingsHref}
                        className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-900 transition-colors flex items-center"
                        onClick={() => setIsOpen(false)}
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.607 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Settings
                    </Link>
                    
                    <div className="border-t border-gray-100 my-1"></div>
                    
                    <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 font-medium transition-colors flex items-center"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Sign Out
                    </button>
                </div>
            )}
        </div>
    );
};

export default UserDropdown;
