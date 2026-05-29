import React, { useEffect, useState } from 'react';
import csrfFetch from '../../utils/csrf';
import StaffSkeleton from '../staff/StaffSkeleton';

const defaultRules = {
    reservation_fee_percentage: 10,
    downpayment_percentage: 70,
    final_payment_percentage: 20,
    reservation_validity_hours: 24,
    downpayment_due_days: 30,
    final_payment_due_days: 14,
};

const numberField = (value) => value === null || value === undefined ? '' : String(value);

const PaymentRulesPanel = ({ onToast, embedded = false }) => {
    const [rules, setRules] = useState(defaultRules);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const notify = (message, type = 'success') => {
        if (onToast) onToast(message, type);
    };

    const loadRules = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/admin/payment-rules', { headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error('Could not load payment rules.');
            const data = await response.json();
            setRules({ ...defaultRules, ...(data || {}) });
        } catch (error) {
            notify(error.message || 'Could not load payment rules.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRules();
    }, []);

    const updateField = (field, value) => {
        setRules((current) => ({ ...current, [field]: value }));
    };

    const saveRules = async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
            const payload = Object.fromEntries(Object.entries(rules).map(([key, value]) => [key, Number(value)]));
            const response = await csrfFetch('/api/admin/payment-rules', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || data.message || 'Could not save payment rules.');
            setRules({ ...defaultRules, ...(data.rules || payload) });
            notify('Payment rules updated.');
        } catch (error) {
            notify(error.message || 'Could not save payment rules.', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <StaffSkeleton rows={4} label="Loading payment rules" />;
    }

    const total = Number(rules.reservation_fee_percentage || 0) + Number(rules.downpayment_percentage || 0) + Number(rules.final_payment_percentage || 0);

    return (
        <section className={embedded ? 'staff-settings-form-block' : 'admin-panel p-5'}>
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <p className="admin-kicker">Finance configuration</p>
                    <h3 className="mt-1 text-lg font-black text-slate-950">Payment rules</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">Control booking payment tranche percentages and due-date windows.</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${Math.round(total * 100) / 100 === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    Total {total.toFixed(2)}%
                </span>
            </div>

            <form onSubmit={saveRules} className="grid gap-4 lg:grid-cols-3">
                {[
                    ['reservation_fee_percentage', 'Reservation fee %'],
                    ['downpayment_percentage', 'Down payment %'],
                    ['final_payment_percentage', 'Final payment %'],
                    ['reservation_validity_hours', 'Reservation validity hours'],
                    ['downpayment_due_days', 'Down payment due days'],
                    ['final_payment_due_days', 'Final payment due days'],
                ].map(([field, label]) => (
                    <label key={field} className="block">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</span>
                        <input
                            type="number"
                            min="0"
                            step={field.includes('percentage') ? '0.01' : '1'}
                            value={numberField(rules[field])}
                            onChange={(event) => updateField(field, event.target.value)}
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#720101] focus:ring-4 focus:ring-[#720101]/10"
                        />
                    </label>
                ))}
                <div className="flex items-end lg:col-span-3">
                    <button type="submit" disabled={saving} className="admin-button-primary px-5 py-3 text-sm font-black">
                        {saving ? 'Saving...' : 'Save payment rules'}
                    </button>
                </div>
            </form>
        </section>
    );
};

export default PaymentRulesPanel;
