import React from 'react';

const toneClasses = {
    primary: 'bg-[#720101] text-white hover:bg-[#5a0101] border-[#720101]',
    secondary: 'border-[#720101]/15 bg-white text-[#720101] hover:bg-[#fff7e8]',
    neutral: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    danger: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
    dark: 'border-[#1a1a1a] bg-[#1a1a1a] text-white hover:bg-black',
};

const sizeClasses = {
    sm: 'px-3 py-2 text-xs',
    md: 'px-4 py-3 text-sm',
    lg: 'px-5 py-3.5 text-sm',
};

export const ActionButton = ({ as: Component = 'button', tone = 'primary', size = 'md', icon: Icon, children, className = '', ...props }) => (
    <Component
        className={`inline-flex items-center justify-center gap-2 rounded-xl border font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${toneClasses[tone] || toneClasses.primary} ${sizeClasses[size] || sizeClasses.md} ${className}`}
        {...props}
    >
        {Icon && <Icon className="h-4 w-4" />}
        {children}
    </Component>
);

export const IconActionButton = ({ label, icon: Icon, tone = 'neutral', className = '', ...props }) => (
    <button
        type="button"
        aria-label={label}
        title={label}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${toneClasses[tone] || toneClasses.neutral} ${className}`}
        {...props}
    >
        {Icon && <Icon className="h-4 w-4" />}
    </button>
);

export default ActionButton;
