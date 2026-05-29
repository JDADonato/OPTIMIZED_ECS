import React from 'react';
import { Head, router } from '@inertiajs/react';
import { ArrowRight, XCircle, AlertTriangle, RefreshCw, LockKeyhole } from 'lucide-react';
import logoImg from '../../../images/ECS_LOGO.png';

const PaymentCancelled = () => {
    return (
        <>
            <Head title="Payment Not Completed" />
            <main className="min-h-screen bg-white text-slate-950">
                <section className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-8 sm:px-8">
                    <header className="flex items-center justify-between">
                        <img src={logoImg} alt="ECS" className="h-12 w-auto" />
                        <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">
                            <LockKeyhole className="h-4 w-4" />
                            <span>Checkout</span>
                        </div>
                    </header>

                    <div className="flex flex-1 items-center justify-center py-12">
                        <div className="w-full max-w-2xl text-center">
                            {/* Icon */}
                            <div className="cancelled-ring mx-auto mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-amber-50">
                                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-400 text-white shadow-xl shadow-amber-200">
                                    <XCircle className="h-11 w-11" strokeWidth={2.5} />
                                </div>
                            </div>

                            <p className="mb-3 text-sm font-black uppercase tracking-widest text-amber-600">
                                Payment Not Completed
                            </p>
                            <h1 className="text-3xl font-black tracking-normal text-slate-950 sm:text-5xl">
                                Payment Not Completed.
                            </h1>
                            <p className="mx-auto mt-5 max-w-xl text-base font-medium leading-7 text-slate-600">
                                Your payment was not processed. This can happen if you cancelled the payment,
                                the session expired, or the transaction failed. <strong>Your booking is still saved</strong> — no charges were made.
                            </p>

                            {/* Info cards */}
                            <div className="mx-auto mt-10 grid max-w-xl gap-3 sm:grid-cols-3">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                    <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-amber-500" />
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">Payment</p>
                                    <p className="mt-1 text-sm font-bold text-slate-950">Not Charged</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                    <RefreshCw className="mx-auto mb-3 h-6 w-6 text-amber-500" />
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">Booking</p>
                                    <p className="mt-1 text-sm font-bold text-slate-950">Still Active</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                    <LockKeyhole className="mx-auto mb-3 h-6 w-6 text-amber-500" />
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">Status</p>
                                    <p className="mt-1 text-sm font-bold text-slate-950">Payment Due</p>
                                </div>
                            </div>

                            <p className="mx-auto mt-8 max-w-md text-sm font-medium text-slate-500">
                                You can retry the payment from your dashboard at any time. If you believe this
                                was an error, please contact our team.
                            </p>

                            {/* Actions */}
                            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                                <button
                                    type="button"
                                    onClick={() => router.visit('/dashboard/client')}
                                    className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-lg bg-[#720101] px-8 text-sm font-black text-white shadow-lg shadow-[#720101]/20 transition-colors hover:bg-[#5c0101] sm:w-auto"
                                >
                                    <span>Return to Dashboard</span>
                                    <ArrowRight className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <style>{`
                    .cancelled-ring {
                        animation: cancelled-pop 520ms cubic-bezier(0.2, 0.9, 0.25, 1.25) both;
                    }

                    @keyframes cancelled-pop {
                        0% {
                            opacity: 0;
                            transform: scale(0.72);
                        }
                        70% {
                            opacity: 1;
                            transform: scale(1.08);
                        }
                        100% {
                            transform: scale(1);
                        }
                    }
                `}</style>
            </main>
        </>
    );
};

export default PaymentCancelled;
