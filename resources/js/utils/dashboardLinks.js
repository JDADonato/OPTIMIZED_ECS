const DASHBOARD_BY_ROLE = {
    Client: '/dashboard/client',
    Marketing: '/dashboard/marketing',
    Accounting: '/dashboard/accounting',
    Admin: '/dashboard/admin',
};

export const dashboardHrefForRole = (role, fallback = '/') => DASHBOARD_BY_ROLE[role] || fallback;

export const dashboardHrefForUser = (user, fallback = '/') => dashboardHrefForRole(user?.role, fallback);

export const isStaffUser = (user) => ['Admin', 'Marketing', 'Accounting'].includes(user?.role);
