import React, { useEffect, useState } from 'react';

const PromptModal = ({
    isOpen,
    title,
    message,
    label,
    placeholder = '',
    initialValue = '',
    confirmText = 'Submit',
    cancelText = 'Cancel',
    minLength = 0,
    busy = false,
    onCancel,
    onConfirm,
}) => {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        if (isOpen) setValue(initialValue);
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    const trimmed = value.trim();
    const canSubmit = trimmed.length >= minLength && !busy;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#720101]/10 bg-[#fffaf3] shadow-2xl">
                <div className="px-7 pt-7">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#fff7e8] text-[#720101] ring-1 ring-[#720101]/12">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M8 10h8M8 14h5m8-2a9 9 0 1 1-4.2-7.61" />
                        </svg>
                    </div>
                    <h3 className="text-center font-display text-xl font-bold text-slate-950">{title}</h3>
                    {message && <p className="mt-3 text-center text-sm font-medium leading-6 text-slate-500">{message}</p>}
                    <label className="mt-5 block text-xs font-black uppercase tracking-wider text-slate-500">{label}</label>
                    <textarea
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        placeholder={placeholder}
                        rows={5}
                        autoFocus
                        className="mt-2 w-full resize-none rounded-xl border border-[#720101]/10 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-[#720101]/30 focus:ring-2 focus:ring-[#720101]/15"
                    />
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
                        onClick={() => canSubmit && onConfirm(trimmed)}
                        disabled={!canSubmit}
                        className="rounded-xl bg-[#720101] px-4 py-3 text-sm font-black text-white transition hover:bg-[#5a0101] disabled:opacity-60"
                    >
                        {busy ? 'Working...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PromptModal;
