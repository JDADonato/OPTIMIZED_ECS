export const operationalChannelsForUser = (user) => {
    if (!user?.role) return [];

    const role = String(user.role).toLowerCase();
    const channels = [];

    if (role === 'admin') {
        channels.push('admin.dashboard', 'staff.queue', 'marketing.dashboard', 'accounting.dashboard');
    } else if (role === 'marketing') {
        channels.push('staff.queue', 'marketing.dashboard');
    } else if (role === 'accounting') {
        channels.push('accounting.dashboard');
    } else if (role === 'client' && user.id) {
        channels.push(`client.${user.id}`);
    }

    return [...new Set(channels)];
};
