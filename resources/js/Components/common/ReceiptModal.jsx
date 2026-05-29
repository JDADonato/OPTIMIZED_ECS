import React from 'react';
import { paymentMethodLabel } from '../../utils/statusLabels';
import { Download, Printer, CheckCircle, FileText } from 'lucide-react';

const ReceiptModal = ({ isOpen, onClose, payment, booking }) => {
    if (!isOpen || !payment || !booking) return null;

    const handlePrint = () => {
        window.print();
    };

    const handleDownload = () => {
        window.location.href = `/documents/payments/${payment.id}/receipt.pdf`;
    };

    const formatMoney = (value) => {
        return Number(value || 0).toLocaleString('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    const isOnlinePayment = payment.payment_method === 'PayMongo' || !!payment.paymongo_payment_id;
    const paymentDate = new Date(payment.verified_at || payment.payment_date || payment.created_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const totalCost = Number(booking.total_cost || booking.budget);
    const transportFee = Number(booking.transport_fee || 0);
    const laborSurcharge = Number(booking.labor_surcharge || 0);
    const discount = Number(booking.discount_value || 0);
    const baseBudget = Number(booking.budget || totalCost - transportFee - laborSurcharge + discount);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Print Section */}
                <div id="receipt-print-area" className="p-8 md:p-10 bg-white overflow-y-auto custom-scrollbar">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-8 border-b-2 border-gray-100 pb-6">
                        <div>
                            <h2 className="text-3xl font-black text-primary-900 tracking-tight">ELOQUENTE</h2>
                            <p className="text-xs font-bold tracking-widest text-primary-600 uppercase mt-1">Catering Services</p>
                            <div className="mt-4 text-xs text-gray-500 space-y-1">
                                <p>123 Culinary Ave, Metro Manila</p>
                                <p>+63 917 123 4567 • info@eloquente.com</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg border border-emerald-200 uppercase tracking-widest font-black text-xs">
                                <CheckCircle className="w-4 h-4" />
                                Official Receipt
                            </div>
                            <div className="mt-4 text-sm text-gray-600">
                                <p><span className="font-bold text-gray-400 uppercase text-xs">Receipt No.</span></p>
                                <p className="font-mono font-bold text-gray-900">#RCPT-{booking.id}-{payment.id}</p>
                            </div>
                            <div className="mt-2 text-sm text-gray-600">
                                <p><span className="font-bold text-gray-400 uppercase text-xs">Date</span></p>
                                <p className="font-medium text-gray-900">{paymentDate}</p>
                            </div>
                        </div>
                    </div>

                    {/* Client Info */}
                    <div className="grid grid-cols-2 gap-8 mb-8 bg-gray-50 p-6 rounded-xl border border-gray-100">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Billed To</p>
                            <p className="font-bold text-gray-900 text-lg">{booking.client_full_name || booking.username}</p>
                            <p className="text-sm text-gray-600 mt-1">{booking.client_email}</p>
                            <p className="text-sm text-gray-600">{booking.client_phone}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Event Details</p>
                            <p className="font-bold text-gray-900">{booking.event_display_name || booking.event_name || booking.event_type || booking.package_name || 'Catering Event'}</p>
                            <p className="text-sm text-gray-600 mt-1">Date: <span className="font-medium">{new Date(booking.event_date).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span></p>
                            <p className="text-sm text-gray-600">Guests: <span className="font-medium">{booking.pax} pax</span></p>
                        </div>
                    </div>

                    {/* Cost Breakdown */}
                    <div className="mb-8">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 border-b pb-2">Event Cost Breakdown</p>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between text-gray-600">
                                <span>Base Package Contract</span>
                                <span>₱{formatMoney(baseBudget)}</span>
                            </div>
                            {transportFee > 0 && (
                                <div className="flex justify-between text-gray-600">
                                    <span>Logistics & Transport</span>
                                    <span>₱{formatMoney(transportFee)}</span>
                                </div>
                            )}
                            {laborSurcharge > 0 && (
                                <div className="flex justify-between text-gray-600">
                                    <span>Labor Surcharge</span>
                                    <span>₱{formatMoney(laborSurcharge)}</span>
                                </div>
                            )}
                            {discount > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span>Discount Applied</span>
                                    <span>-₱{formatMoney(discount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between font-bold text-gray-900 pt-3 border-t">
                                <span>Total Event Cost</span>
                                <span>₱{formatMoney(totalCost)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Payment Information */}
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 border-b pb-2">Payment Transaction</p>
                        <div className="bg-primary-50/50 p-5 rounded-xl border border-primary-100">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <p className="text-xs font-medium text-gray-500">Payment Type</p>
                                    <p className="font-bold text-gray-900">{payment.payment_type}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-medium text-gray-500">Method</p>
                                    <p className="font-bold text-gray-900">{paymentMethodLabel(payment.payment_method_label || payment.payment_method)}</p>
                                </div>
                            </div>
                            
                            {isOnlinePayment && payment.paymongo_reference_number && (
                                <div className="mb-4 pt-4 border-t border-primary-100/50">
                                    <p className="text-xs font-medium text-gray-500">Reference Number</p>
                                    <p className="font-mono text-sm font-bold text-primary-700">{payment.paymongo_reference_number || payment.paymongo_payment_id}</p>
                                </div>
                            )}

                            <div className="flex justify-between items-end pt-4 border-t border-primary-100/50">
                                <span className="font-bold text-gray-700 uppercase tracking-widest text-sm">Amount Paid</span>
                                <span className="text-3xl font-black text-primary-700">₱{formatMoney(payment.amount)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 text-center text-xs text-gray-400 border-t pt-6">
                        <p className="font-medium">This is a computer-generated receipt. No signature required.</p>
                        <p className="mt-1">Thank you for trusting Eloquente Catering with your special event!</p>
                    </div>
                </div>

                {/* Actions (Not Printed) */}
                <div className="bg-gray-50 px-6 py-5 flex justify-end gap-3 border-t print:hidden">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={handlePrint}
                        className="px-6 py-2.5 text-sm font-bold text-primary-700 bg-white border border-primary-200 rounded-xl hover:bg-primary-50 transition-colors flex items-center gap-2"
                    >
                        <Printer className="w-4 h-4" />
                        Print
                    </button>
                    <button
                        onClick={handleDownload}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors flex items-center gap-2 shadow-lg shadow-primary-600/20"
                    >
                        <Download className="w-4 h-4" />
                        Download PDF
                    </button>
                </div>
            </div>

            <style jsx="true">{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #receipt-print-area, #receipt-print-area * {
                        visibility: visible;
                    }
                    #receipt-print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        padding: 20px;
                        background: white;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default ReceiptModal;
