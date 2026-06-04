import React, { useEffect, useMemo, useState } from 'react';

const defaultTermName = (index) => {
    if (index === 0) return 'Reservation';
    if (index === 1) return 'DownPayment';
    if (index === 2) return 'Final';
    return `Payment ${index + 1}`;
};

const formatDateInput = (value) => {
    if (!value) return '';
    return String(value).slice(0, 10);
};

const PaymentTermEditorModal = ({ isOpen, onClose, booking, payment, onSuccess }) => {
    const [terms, setTerms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const bookingTotal = useMemo(() => {
        return Number(booking?.totalCost ?? booking?.total_cost ?? booking?.budget ?? 0);
    }, [booking]);

    useEffect(() => {
        if (!booking) return;

        const payments = Array.isArray(booking.payments) ? booking.payments : (payment ? [payment] : []);
        const nextTerms = payments.map((item, index) => ({
            id: item.id,
            payment_type: item.payment_type || defaultTermName(index),
            percentage: bookingTotal > 0 ? Number(((Number(item.amount || 0) / bookingTotal) * 100).toFixed(2)) : 0,
            due_date: formatDateInput(item.due_date),
            status: item.status || 'Pending',
        }));

        setTerms(nextTerms.length > 0 ? nextTerms : [{
            id: null,
            payment_type: 'Reservation',
            percentage: 100,
            due_date: '',
            status: 'Pending',
        }]);
        setError(null);
    }, [booking, bookingTotal, payment]);

    const totalPercentage = terms.reduce((sum, term) => sum + Number(term.percentage || 0), 0);
    const percentIsValid = Math.abs(totalPercentage - 100) < 0.01;
    const canSave = bookingTotal > 0 && percentIsValid && terms.every(term => term.payment_type && term.due_date);

    if (!isOpen || !booking) return null;

    const updateTerm = (index, updates) => {
        setTerms(prev => prev.map((term, termIndex) => termIndex === index ? { ...term, ...updates } : term));
        setError(null);
    };

    const addTerm = () => {
        setTerms(prev => [
            ...prev,
            {
                id: null,
                payment_type: defaultTermName(prev.length),
                percentage: 0,
                due_date: '',
                status: 'Pending',
            },
        ]);
        setError(null);
    };

    const removeTerm = (index) => {
        if (terms.length === 1) {
            setError('At least one payment term is required.');
            return;
        }
        setTerms(prev => prev.filter((_, termIndex) => termIndex !== index));
        setError(null);
    };

    const calculatedAmount = (percentage, index) => {
        if (index === terms.length - 1) {
            const previous = terms
                .slice(0, -1)
                .reduce((sum, term) => sum + Math.round(bookingTotal * (Number(term.percentage || 0) / 100) * 100) / 100, 0);
            return Math.max(bookingTotal - previous, 0);
        }

        return bookingTotal * (Number(percentage || 0) / 100);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!canSave) {
            setError('Payment percentages must total 100%, and every term needs a name and due date.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/accounting/bookings/${booking.id}/payment-terms`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                    terms: terms.map(term => ({
                        id: term.id,
                        payment_type: term.payment_type,
                        percentage: Number(term.percentage || 0),
                        due_date: term.due_date,
                    })),
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                onSuccess(data);
            } else {
                setError(data.error || 'We could not save the payment schedule.');
            }
        } catch (err) {
            setError('We could not save the payment schedule. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[130] flex flex-col items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm animate-fadeIn">
            <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-[#720101]/10 bg-white px-5 py-4 sm:px-6">
                    <div>
                        <p className="marketing-kicker">Payment schedule</p>
                        <h3 className="mt-1 text-2xl font-black leading-tight text-slate-950">Edit payment terms</h3>
                        <p className="mt-1 text-sm font-bold text-slate-500">Only unpaid or rejected terms can be changed.</p>
                    </div>
                    <button type="button" onClick={onClose} className="staff-icon-button" aria-label="Close payment terms editor">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 overflow-y-auto bg-[#fbf8f2] p-4 custom-scrollbar sm:p-5">
                        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#720101]/10 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                            <div className="grid flex-1 gap-2 sm:grid-cols-3">
                                <section className="rounded-lg bg-[#fbf8f2] px-3 py-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Booking total</p>
                                    <p className="mt-0.5 text-lg font-black leading-tight text-slate-950">PHP {bookingTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </section>
                                <section className={`rounded-lg px-3 py-2 ${percentIsValid ? 'bg-emerald-50' : 'bg-[#fff7e8]'}`}>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Percent total</p>
                                    <p className={`mt-0.5 text-lg font-black leading-tight ${percentIsValid ? 'text-emerald-700' : 'text-[#720101]'}`}>{totalPercentage.toFixed(2)}%</p>
                                </section>
                                <section className="rounded-lg bg-[#fbf8f2] px-3 py-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Terms</p>
                                    <p className="mt-0.5 text-lg font-black leading-tight text-slate-950">{terms.length}</p>
                                </section>
                            </div>
                            <button
                                type="button"
                                onClick={addTerm}
                                className="admin-button-secondary inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-black lg:self-stretch"
                            >
                                <span aria-hidden="true">+</span>
                                Add split
                            </button>
                        </div>

                        {!percentIsValid && (
                            <div className="mb-4 rounded-xl border border-amber-100 bg-[#fff7e8] px-4 py-3 text-sm font-bold text-[#720101]">
                                Percentages must total exactly 100% before saving.
                            </div>
                        )}

                        {error && (
                            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">
                                <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                {error}
                            </div>
                        )}

                        <div className="overflow-hidden rounded-xl border border-[#720101]/10 bg-white shadow-sm">
                            <div className="hidden grid-cols-[minmax(12rem,1.35fr)_7rem_minmax(9rem,0.85fr)_10rem_3rem] gap-3 border-b border-[#720101]/10 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 xl:grid">
                                <span>Term</span>
                                <span>Percent</span>
                                <span>Amount</span>
                                <span>Due date</span>
                                <span className="text-right">Action</span>
                            </div>

                            <div className="divide-y divide-[#720101]/10">
                                {terms.map((term, index) => {
                                    const amount = calculatedAmount(term.percentage, index);
                                    const locked = ['Verified', 'Paid', 'Refunded'].includes(term.status);

                                    return (
                                        <div key={term.id || `new-${index}`} className="bg-white p-3 sm:p-4">
                                            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(12rem,1.35fr)_7rem_minmax(9rem,0.85fr)_10rem_3rem] xl:items-center">
                                        <label>
                                            <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400 xl:hidden">Term</span>
                                            <input
                                                type="text"
                                                required
                                                disabled={locked}
                                                value={term.payment_type}
                                                onChange={(e) => updateTerm(index, { payment_type: e.target.value })}
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-black text-slate-950 outline-none transition focus:border-[#720101] focus:ring-2 focus:ring-[#720101]/10 disabled:bg-slate-100 disabled:text-slate-500"
                                            />
                                        </label>
                                        <label>
                                            <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400 xl:hidden">Percent</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                max="100"
                                                required
                                                disabled={locked}
                                                value={term.percentage}
                                                onChange={(e) => updateTerm(index, { percentage: e.target.value })}
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-black text-slate-950 outline-none transition focus:border-[#720101] focus:ring-2 focus:ring-[#720101]/10 disabled:bg-slate-100 disabled:text-slate-500"
                                            />
                                        </label>
                                        <div>
                                            <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400 xl:hidden">Amount</span>
                                            <div className="w-full rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm font-black text-slate-950">
                                                PHP {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                        <label>
                                            <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400 xl:hidden">Due date</span>
                                            <input
                                                type="date"
                                                required
                                                disabled={locked}
                                                value={term.due_date}
                                                onChange={(e) => updateTerm(index, { due_date: e.target.value })}
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-950 outline-none transition focus:border-[#720101] focus:ring-2 focus:ring-[#720101]/10 disabled:bg-slate-100 disabled:text-slate-500"
                                            />
                                        </label>
                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                disabled={locked}
                                                onClick={() => removeTerm(index)}
                                                className="staff-icon-button h-10 w-10 bg-red-50 text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                                                aria-label={`Remove ${term.payment_type || 'payment term'}`}
                                            >
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M9 7V5h6v2m-8 0l1 12h8l1-12" /></svg>
                                            </button>
                                        </div>
                                            </div>
                                            {locked && <p className="mt-2 text-xs font-bold text-slate-500">This term is locked because it is already {term.status.toLowerCase()}.</p>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-[#720101]/10 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <p className="text-xs font-bold text-slate-500">Saved changes recalculate unpaid payment terms only. Paid, verified, and refunded terms stay locked.</p>
                        <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="admin-button-secondary px-5 py-2.5 text-sm font-black"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !canSave}
                            className="admin-button-primary flex min-w-[150px] items-center justify-center px-6 py-2.5 text-sm font-black disabled:opacity-60"
                        >
                            {loading ? 'Saving...' : 'Save Terms'}
                        </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PaymentTermEditorModal;
