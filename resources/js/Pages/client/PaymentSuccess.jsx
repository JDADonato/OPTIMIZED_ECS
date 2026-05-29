import React from 'react';
import { Head, router } from '@inertiajs/react';
import { ArrowRight, Check, FileCheck2, LockKeyhole, ReceiptText } from 'lucide-react';
import logoImg from '../../../images/ECS_LOGO.png';
import { customerPaymentStatus, isSettledPaymentStatus } from '../../utils/statusLabels';

const PaymentSuccess = ({ paymentStatus = 'Pending', syncMessage = 'Payment is still pending PayMongo confirmation.' }) => {
    const isConfirmed = isSettledPaymentStatus(paymentStatus);
    const displayStatus = customerPaymentStatus(paymentStatus);

    return (
        <>
            <Head title={isConfirmed ? 'Payment Confirmed' : 'Payment Pending'} />
            <main className="min-h-screen bg-white text-slate-950">
                <section className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-8 sm:px-8">
                    <header className="flex items-center justify-between">
                        <img src={logoImg} alt="ECS" className="h-12 w-auto" />
                        <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
                            <LockKeyhole className="h-4 w-4" />
                            <span>Checkout</span>
                        </div>
                    </header>

                    <div className="flex flex-1 items-center justify-center py-12">
                        <div className="w-full max-w-2xl text-center">
                            <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-emerald-50">
                                <div className="success-ring flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-200">
                                    <Check className="success-check h-11 w-11" strokeWidth={3} />
                                </div>
                            </div>

                            <p className={`mb-3 text-sm font-black uppercase tracking-widest ${isConfirmed ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {isConfirmed ? 'Authorization complete' : 'Awaiting confirmation'}
                            </p>
                            <h1 className="text-3xl font-black tracking-normal text-slate-950 sm:text-5xl">
                                {isConfirmed ? 'Payment Authorized Successfully.' : 'Payment Authorization Received.'}
                            </h1>
                            <p className="mx-auto mt-5 max-w-xl text-base font-medium leading-7 text-slate-600">
                                {syncMessage}
                            </p>

                            <div className="mx-auto mt-10 grid max-w-xl gap-3 sm:grid-cols-3">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                    <ReceiptText className="mx-auto mb-3 h-6 w-6 text-[#720101]" />
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">Receipt</p>
                                    <p className="mt-1 text-sm font-bold text-slate-950">Recorded</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                    <FileCheck2 className="mx-auto mb-3 h-6 w-6 text-[#720101]" />
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">Booking</p>
                                    <p className="mt-1 text-sm font-bold text-slate-950">Confirmed</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                    <LockKeyhole className="mx-auto mb-3 h-6 w-6 text-[#720101]" />
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">Status</p>
                                    <p className="mt-1 text-sm font-bold text-slate-950">{displayStatus.label}</p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => router.visit('/dashboard/client')}
                                className="mt-10 inline-flex h-14 items-center justify-center gap-3 rounded-lg bg-[#720101] px-8 text-sm font-black text-white shadow-lg shadow-[#720101]/20 transition-colors hover:bg-[#5c0101]"
                            >
                                <span>Return to Dashboard</span>
                                <ArrowRight className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </section>

                <style>{`
                    .success-ring {
                        animation: success-pop 520ms cubic-bezier(0.2, 0.9, 0.25, 1.25) both;
                    }

                    .success-check {
                        stroke-dasharray: 56;
                        stroke-dashoffset: 56;
                        animation: success-draw 620ms ease-out 220ms forwards;
                    }

                    @keyframes success-pop {
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

                    @keyframes success-draw {
                        to {
                            stroke-dashoffset: 0;
                        }
                    }
                `}</style>
            </main>
        </>
    );
};

export default PaymentSuccess;
