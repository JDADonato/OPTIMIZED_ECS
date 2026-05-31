import React from 'react';
import { Link } from '@inertiajs/react';
import { Eye } from 'lucide-react';
import { dashboardHrefForUser, isStaffUser } from '../../utils/dashboardLinks';

const StaffPreviewBanner = ({ user, label = 'customer-facing page' }) => {
    if (!isStaffUser(user)) {
        return null;
    }

    return (
        <div className="fixed inset-x-0 top-[68px] z-40 border-b border-[#ead8d8] bg-[#fff8e7]/95 px-4 py-2 shadow-sm backdrop-blur">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#6b4b00]">
                <span className="inline-flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Staff preview: you are viewing a {label}.
                </span>
                <Link href={dashboardHrefForUser(user)} className="font-black text-[#720101] underline-offset-4 hover:underline">
                    Return to your dashboard
                </Link>
            </div>
        </div>
    );
};

export default StaffPreviewBanner;
