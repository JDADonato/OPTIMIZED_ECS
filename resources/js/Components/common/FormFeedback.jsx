import React from 'react';

const errorText = (message) => Array.isArray(message) ? message[0] : message;

export const FieldError = ({ message }) => {
    const text = errorText(message);
    return text ? <p className="mt-1.5 text-xs font-bold text-[#720101]">{text}</p> : null;
};

export const FormErrorSummary = ({ errors = {}, message }) => {
    const items = Object.values(errors || {}).flat().filter(Boolean);
    if (!message && items.length === 0) return null;

    return (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-[#720101]" role="alert">
            <p>{message || 'Please review the highlighted fields before continuing.'}</p>
            {items.length > 1 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                    {items.slice(0, 4).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                </ul>
            )}
        </div>
    );
};

export const FormField = ({ label, name, error, children, className = '' }) => (
    <label className={`block ${className}`} data-field={name}>
        {label && <span className="text-xs font-black uppercase tracking-widest text-gray-500">{label}</span>}
        {children}
        <FieldError message={error} />
    </label>
);

export default FormField;
