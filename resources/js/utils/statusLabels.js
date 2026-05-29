const settledPaymentStatuses = ['Paid', 'Verified', 'Refunded'];

export const paymentTypeLabel = (type) => ({
    Reservation: 'Reservation Fee',
    DownPayment: 'Down Payment',
    Downpayment: 'Down Payment',
    Final: 'Final Payment',
}[type] || type || 'Payment');

export const paymentMethodLabel = (method) => {
    const raw = String(method || '').trim();
    const normalized = raw.toLowerCase();

    if (!raw || normalized === 'pending') return 'Pending';
    if (normalized.includes('gcash')) return normalized.includes('paymongo') ? 'GCash via PayMongo' : 'GCash';
    if (normalized.includes('paymaya') || normalized.includes('maya')) return normalized.includes('paymongo') ? 'Maya via PayMongo' : 'Maya';
    if (normalized.includes('card')) return normalized.includes('paymongo') ? 'Card via PayMongo' : 'Card';
    if (normalized.includes('bank')) return 'Bank Transfer';
    if (normalized.includes('cash')) return 'Cash';
    if (normalized.includes('paymongo') || normalized.includes('online checkout')) return 'PayMongo Checkout';
    if (normalized.includes('manual')) return 'Manual Payment';

    return raw;
};

export const isSettledPaymentStatus = (status) => ['Paid', 'Verified'].includes(status);

export const customerBookingStatus = (status) => {
    const normalized = String(status || '').toLowerCase();

    if (normalized === 'confirmed' || normalized === 'reserved') {
        return { label: 'Approved', tone: 'success' };
    }
    if (normalized === 'cancelled' || normalized === 'canceled') {
        return { label: 'Cancelled', tone: 'danger' };
    }
    if (normalized === 'completed') {
        return { label: 'Completed', tone: 'neutral' };
    }
    if (normalized === 'pending' || normalized === 'pending review') {
        return { label: 'Being Reviewed', tone: 'warning' };
    }

    return { label: status || 'Being Reviewed', tone: 'warning' };
};

export const customerPaymentStatus = (status, dueDate = null) => {
    const normalized = String(status || '').toLowerCase();
    const isOverdue = dueDate && new Date(dueDate) < new Date() && !settledPaymentStatuses.map(item => item.toLowerCase()).includes(normalized);

    if (isOverdue) {
        return { label: 'Overdue', tone: 'danger' };
    }
    if (normalized === 'paid' || normalized === 'verified') {
        return { label: 'Paid', tone: 'success' };
    }
    if (normalized === 'refunded') {
        return { label: 'Refunded', tone: 'neutral' };
    }
    if (normalized === 'rejected' || normalized === 'failed') {
        return { label: 'Needs Review', tone: 'danger' };
    }
    if (normalized === 'pending review') {
        return { label: 'Being Checked', tone: 'warning' };
    }

    return { label: 'Payment Due', tone: 'warning' };
};

export const staffPaymentStatus = (status, dueDate = null) => {
    const normalized = String(status || '').toLowerCase();
    const isOverdue = dueDate && new Date(dueDate) < new Date() && !settledPaymentStatuses.map(item => item.toLowerCase()).includes(normalized);

    if (isOverdue) {
        return { label: 'Overdue', tone: 'danger' };
    }
    if (normalized === 'paid') {
        return { label: 'Paid Online', tone: 'success' };
    }
    if (normalized === 'verified') {
        return { label: 'Verified', tone: 'success' };
    }
    if (normalized === 'refunded') {
        return { label: 'Refunded', tone: 'neutral' };
    }
    if (normalized === 'rejected') {
        return { label: 'Rejected', tone: 'neutral' };
    }
    if (normalized === 'failed') {
        return { label: 'Failed', tone: 'danger' };
    }

    return { label: 'Pending', tone: 'warning' };
};

export const bookingStatusLabel = (status) => {
    const normalized = String(status || '').toLowerCase();

    if (normalized === 'pending') return { label: 'Awaiting review', tone: 'warning' };
    if (normalized === 'submitted') return { label: 'Submitted for review', tone: 'warning' };
    if (normalized === 'under review') return { label: 'Under review', tone: 'warning' };
    if (normalized === 'needs customer details') return { label: 'Needs customer details', tone: 'danger' };
    if (normalized === 'clarification received') return { label: 'Customer replied', tone: 'warning' };
    if (normalized === 'confirmed' || normalized === 'reserved') return { label: 'Confirmed', tone: 'success' };
    if (normalized === 'completed') return { label: 'Completed', tone: 'neutral' };
    if (normalized === 'cancelled' || normalized === 'canceled' || normalized === 'rejected') return { label: 'Cancelled', tone: 'danger' };

    return { label: status || 'Awaiting review', tone: 'warning' };
};

export const reviewStatusLabel = (status) => {
    const normalized = String(status || '').toLowerCase();

    if (!normalized || normalized === 'submitted') return { label: 'Submitted for review', tone: 'warning' };
    if (normalized === 'under review') return { label: 'Under review', tone: 'warning' };
    if (normalized === 'needs customer details') return { label: 'Needs customer details', tone: 'danger' };
    if (normalized === 'clarification received') return { label: 'Customer replied', tone: 'warning' };
    if (normalized === 'approved' || normalized === 'confirmed') return { label: 'Approved', tone: 'success' };
    if (normalized === 'completed') return { label: 'Completed', tone: 'neutral' };
    if (normalized === 'rejected' || normalized === 'cancelled' || normalized === 'canceled') return { label: 'Rejected', tone: 'danger' };

    return { label: status, tone: 'warning' };
};

export const liveStatusLabel = (status) => {
    const normalized = String(status || '').toLowerCase();

    if (!normalized || normalized === 'not started') return { label: 'Not started', tone: 'neutral' };
    if (normalized === 'on the way') return { label: 'On the way', tone: 'warning' };
    if (normalized === 'preparing') return { label: 'Preparing', tone: 'warning' };
    if (normalized === 'serving') return { label: 'Serving', tone: 'success' };
    if (normalized === 'completed') return { label: 'Completed', tone: 'neutral' };

    return { label: status, tone: 'neutral' };
};

export const ownershipStatusLabel = (booking, currentUser = null) => {
    const ownerId = booking?.owner_id || booking?.assigned_to;
    const currentUserId = currentUser?.id;

    if (!ownerId) return { label: 'Available to claim', tone: 'warning' };
    if (currentUserId && Number(ownerId) === Number(currentUserId)) return { label: 'Owned by you', tone: 'success' };
    if (booking?.can_accept_transfer) return { label: 'Transfer offered to you', tone: 'warning' };

    return { label: 'Owned by another staff member', tone: 'neutral' };
};

export const feedbackStatusLabel = (status) => {
    const normalized = String(status || '').toLowerCase();

    if (!normalized || normalized === 'none') return { label: 'No feedback', tone: 'neutral' };
    if (normalized === 'open') return { label: 'Open follow-up', tone: 'warning' };
    if (normalized === 'needs follow up') return { label: 'Needs follow-up', tone: 'danger' };
    if (normalized === 'in progress') return { label: 'Follow-up in progress', tone: 'warning' };
    if (normalized === 'resolved' || normalized === 'closed') return { label: 'Closed', tone: 'success' };

    return { label: status, tone: 'neutral' };
};

export const refundStatusLabel = (status) => {
    const normalized = String(status || '').toLowerCase();

    if (!normalized || normalized === 'none') return { label: 'No refund case', tone: 'neutral' };
    if (normalized.includes('pending')) return { label: 'Refund pending', tone: 'warning' };
    if (normalized.includes('processing')) return { label: 'Refund processing', tone: 'warning' };
    if (normalized.includes('completed') || normalized.includes('refunded')) return { label: 'Refund completed', tone: 'success' };
    if (normalized.includes('rejected') || normalized.includes('failed')) return { label: 'Refund needs review', tone: 'danger' };

    return { label: status, tone: 'neutral' };
};

export const preparationStatusLabel = (status) => {
    const normalized = String(status || '').toLowerCase();

    if (!normalized || normalized === 'no tasks yet') return { label: 'No tasks yet', tone: 'neutral' };
    if (normalized === 'done' || normalized === 'completed' || normalized === 'ready') return { label: 'Ready', tone: 'success' };
    if (normalized === 'blocked' || normalized === 'needs attention') return { label: 'Needs attention', tone: 'danger' };
    if (normalized === 'in progress' || normalized === 'pending') return { label: 'In progress', tone: 'warning' };

    return { label: status, tone: 'neutral' };
};

export const statusToneClasses = {
    success: {
        light: 'bg-green-100 text-green-700',
        dark: 'text-green-300',
    },
    warning: {
        light: 'bg-yellow-100 text-yellow-700',
        dark: 'text-[#f0aa0b]',
    },
    danger: {
        light: 'bg-red-100 text-red-700',
        dark: 'text-red-300',
    },
    neutral: {
        light: 'bg-slate-100 text-slate-600',
        dark: 'text-white/65',
    },
};
