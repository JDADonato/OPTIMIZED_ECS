import React from 'react';

const Modal = ({ isOpen, onClose, title, message, type = 'info', onConfirm, confirmText }) => {
    if (!isOpen) return null;

    const isSuccess = type === 'success';
    const isError = type === 'error';

    return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md overflow-hidden rounded-[1.75rem] border border-[#720101]/10 bg-[#fffaf3] shadow-2xl transform transition-all scale-100 animate-scaleIn">
                <div className="px-7 pt-8 text-center">
                    <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${isSuccess ? 'bg-[#fff7e8] text-[#720101] ring-1 ring-[#720101]/12' : isError ? 'bg-red-50 text-red-600 ring-1 ring-red-100' : 'bg-[#fff7e8] text-[#9f6500] ring-1 ring-[#720101]/10'}`}>
                        {isSuccess && (
                            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                        {isError && (
                            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                        {!isSuccess && !isError && (
                            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                    </div>
                    <h3 className="font-display text-2xl font-bold text-[#111827]">{title}</h3>
                    <p className="mt-3 text-sm font-medium leading-6 text-slate-500">{message}</p>
                </div>
                <div className="bg-[#fffaf3] p-6">
                    <button
                        onClick={() => {
                            if (onConfirm) onConfirm();
                            onClose();
                        }}
                        className={`w-full rounded-xl px-4 py-3.5 font-black text-white transition-colors active:scale-[0.99] ${isError ? 'bg-red-600 hover:bg-red-700' : 'bg-[#720101] hover:bg-[#5a0101]'}`}
                    >
                        {confirmText || (isSuccess ? 'Great!' : isError ? 'Try Again' : 'Okay')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Modal;
