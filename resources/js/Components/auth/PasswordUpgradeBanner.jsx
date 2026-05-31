import React, { useMemo, useState } from 'react';
import { Link } from '@inertiajs/react';
import { ShieldCheck, X } from 'lucide-react';

const storageKeyFor = (user) => `ecs:password-upgrade-dismissed:${user?.id || 'guest'}:${user?.password_policy_version || 1}`;

const PasswordUpgradeBanner = ({ user, className = '', variant = 'banner' }) => {
    const shouldRecommend = Boolean(user?.password_upgrade_recommended) && !user?.must_change_password;
    const storageKey = useMemo(() => storageKeyFor(user), [user?.id, user?.password_policy_version]);
    const [dismissed, setDismissed] = useState(() => {
        if (!shouldRecommend || typeof window === 'undefined') return false;
        try {
            return window.sessionStorage.getItem(storageKey) === '1';
        } catch (error) {
            return false;
        }
    });

    if (!shouldRecommend || dismissed) return null;

    const dismiss = () => {
        setDismissed(true);
        try {
            window.sessionStorage.setItem(storageKey, '1');
        } catch (error) {
            // Session storage is only a convenience.
        }
    };

    const isCompact = variant === 'compact';

    return (
        <div className={`${isCompact ? 'password-upgrade-compact' : 'mb-4 flex flex-col gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between'} ${className}`.trim()}>
            <div className="flex min-w-0 items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                    <p className="font-black">Strengthen your password when you have a moment.</p>
                    {!isCompact && <p className="mt-0.5 text-xs font-semibold leading-5 text-amber-800">Your current password still works, but newer accounts use stronger password rules.</p>}
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <Link href="/profile" className="rounded-lg bg-[#720101] px-3 py-2 text-xs font-black text-white hover:bg-[#5a0101]">
                    Update password
                </Link>
                <button type="button" onClick={dismiss} className="rounded-lg p-2 text-amber-800 hover:bg-amber-100" aria-label="Dismiss password reminder">
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

export default PasswordUpgradeBanner;
