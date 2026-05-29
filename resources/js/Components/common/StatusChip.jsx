import React from 'react';

const toneClasses = {
    neutral: 'border-slate-200 bg-slate-50 text-slate-700',
    success: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-100 bg-amber-50 text-amber-700',
    danger: 'border-red-100 bg-red-50 text-red-700',
    brand: 'border-[#720101]/10 bg-[#fff7e8] text-[#720101]',
    dark: 'border-[#1a1a1a]/10 bg-[#1a1a1a] text-white',
};

const StatusChip = ({ tone = 'neutral', children, className = '' }) => (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${toneClasses[tone] || toneClasses.neutral} ${className}`}>
        {children}
    </span>
);

export default StatusChip;
