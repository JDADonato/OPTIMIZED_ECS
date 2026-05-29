import React from 'react';

const toneStyles = {
    default: {
        iconWrap: 'bg-[#fff7e8] text-[#720101] ring-[#720101]/12',
        confirm: 'bg-[#720101] hover:bg-[#5a0101]',
    },
    danger: {
        iconWrap: 'bg-red-50 text-red-600 ring-red-100',
        confirm: 'bg-red-600 hover:bg-red-700',
    },
};

const ConfirmModal = ({
    isOpen,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    tone = 'default',
    onCancel,
    onConfirm,
    busy = false,
    children,
}) => {
    if (!isOpen) return null;

    const styles = toneStyles[tone] || toneStyles.default;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#720101]/10 bg-[#fffaf3] shadow-2xl">
                <div className="px-7 pt-7 text-center">
                    <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl ring-1 ${styles.iconWrap}`}>
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                        </svg>
                    </div>
                    <h3 className="font-display text-xl font-bold text-slate-950">{title}</h3>
                    <p className="mt-3 text-sm font-medium leading-6 text-slate-500">{message}</p>
                    {children && <div className="mt-4 text-left">{children}</div>}
                </div>
                <div className="grid grid-cols-2 gap-3 p-6">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="rounded-xl border border-[#720101]/10 bg-white px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-[#fff7e8] disabled:opacity-60"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={busy}
                        className={`rounded-xl px-4 py-3 text-sm font-black text-white transition disabled:opacity-60 ${styles.confirm}`}
                    >
                        {busy ? 'Working...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
