import React, { useEffect, useMemo, useState } from 'react';
import { usePage } from '@inertiajs/react';
import csrfFetch from '../../utils/csrf';
import PaymentRulesPanel from '../finance/PaymentRulesPanel';

const ROLE_TITLES = {
    admin: ['Admin Settings', 'Manage global rules and your admin workspace preferences.'],
    marketing: ['Marketing Settings', 'Tune your marketing workspace, queue defaults, and notification behavior.'],
    accounting: ['Accounting Settings', 'Tune your finance workspace, refund defaults, exports, and notification behavior.'],
};

const ROLE_DEFAULTS = {
    admin: {
        default_tab: 'today',
        density: 'comfortable',
        sidebar_state: 'expanded',
        sync_feedback: 'quiet',
    },
    marketing: {
        default_tab: 'today',
        density: 'comfortable',
        sidebar_state: 'expanded',
        sync_feedback: 'quiet',
        calendar_view: 'month',
    },
    accounting: {
        default_tab: 'today',
        density: 'comfortable',
        sidebar_state: 'expanded',
        sync_feedback: 'quiet',
        payment_segment: 'needs_verification',
        refund_segment: 'needs_review',
    },
};

const TAB_OPTIONS = {
    admin: [
        ['today', 'Today'],
        ['bookings-intake', 'Bookings & Intake'],
        ['calendar', 'Calendar'],
        ['handoff', 'Handoff'],
        ['tastings', 'Food Tastings'],
        ['finance', 'Finance'],
        ['messages-inquiries', 'Messages & Inquiries'],
        ['public-content', 'Public Content'],
        ['availability', 'Availability'],
        ['accounts', 'Accounts'],
        ['analytics', 'Analytics'],
        ['reports', 'Reports'],
        ['system-audit', 'System & Audit'],
        ['history', 'Event History'],
    ],
    marketing: [
        ['today', 'Today'],
        ['bookings', 'Bookings'],
        ['leads', 'Guest Inquiries'],
        ['tastings', 'Food Tastings'],
        ['calendar', 'Calendar'],
        ['handoff', 'Event Handoff'],
        ['messages', 'Messages'],
        ['public-content', 'Public Content'],
        ['availability', 'Availability'],
        ['history', 'Event History'],
    ],
    accounting: [
        ['today', 'Today'],
        ['payments', 'Payments'],
        ['reconciliation', 'Reconciliation'],
        ['refunds', 'Refunds'],
        ['ledger', 'Ledger & Receipts'],
        ['history', 'Event History'],
    ],
};

const NOTIFICATION_FIELDS = [
    ['booking_updates', 'Booking updates'],
    ['payment_reminders', 'Payment and refund updates'],
    ['message_alerts', 'Customer messages'],
    ['announcements', 'Announcements'],
    ['sound_enabled', 'Notification sounds'],
    ['message_sounds', 'Message sounds'],
    ['booking_update_sounds', 'Booking update sounds'],
    ['payment_update_sounds', 'Payment update sounds'],
    ['staff_update_sounds', 'Staff update sounds'],
    ['quiet_mode', 'Quiet mode'],
];

const BUSINESS_SETTING_KEYS = [
    ['business_name', 'Business name'],
    ['public_email', 'Public email'],
    ['public_phone', 'Public phone'],
    ['business_address', 'Business address'],
    ['reply_to_email', 'Reply-to email'],
];

const WORKSPACE_STORAGE_KEYS = {
    admin: 'ecs:staff-workspace:admin',
    marketing: 'ecs:staff-workspace:marketing',
    accounting: 'ecs:staff-workspace:accounting',
};

const SIDEBAR_STORAGE_KEYS = {
    admin: 'ecs:staff-sidebar:owner-operations:state',
    marketing: 'ecs:staff-sidebar:marketing-team:state',
    accounting: 'ecs:staff-sidebar:finance-team:state',
};

const workspacePreferenceStorageKey = (role) => `ecs:staff-workspace:${role}:preferences`;

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const normalizeRole = (role) => (ROLE_DEFAULTS[String(role).toLowerCase()] ? String(role).toLowerCase() : 'admin');

const normalizeSettingValue = (value) => {
    if (value && typeof value === 'object' && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, 'value')) {
        return value.value ?? '';
    }

    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

const ToggleRow = ({ label, checked, onChange }) => (
    <label className="staff-settings-toggle-row">
        <span>{label}</span>
        <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
    </label>
);

const Field = ({ label, children }) => (
    <label className="staff-settings-field">
        <span>{label}</span>
        {children}
    </label>
);

const sectionButtonLabel = (section) => `${section.label}${section.badge ? ` ${section.badge}` : ''}`;

const RoleSettingsPanel = ({ role = 'admin', onNavigate }) => {
    const { auth } = usePage().props;
    const user = auth?.user || {};
    const normalizedRole = normalizeRole(role);
    const [title, description] = ROLE_TITLES[normalizedRole];
    const profilePreferences = user.profile_preferences || {};
    const profileWorkspace = profilePreferences.staff_workspace?.[normalizedRole] || {};
    const [workspacePrefs, setWorkspacePrefs] = useState({ ...ROLE_DEFAULTS[normalizedRole], ...profileWorkspace });
    const [notificationPrefs, setNotificationPrefs] = useState({
        booking_updates: true,
        payment_reminders: true,
        message_alerts: true,
        announcements: true,
        sound_enabled: false,
        message_sounds: false,
        booking_update_sounds: false,
        payment_update_sounds: false,
        staff_update_sounds: false,
        quiet_mode: false,
        ...(user.notification_preferences || {}),
    });
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(null);
    const [businessSettings, setBusinessSettings] = useState({});
    const [businessLoading, setBusinessLoading] = useState(normalizedRole === 'admin');
    const [businessSaving, setBusinessSaving] = useState(false);
    const [businessStatus, setBusinessStatus] = useState(null);
    const [activeSection, setActiveSection] = useState('workspace');

    useEffect(() => {
        setWorkspacePrefs({ ...ROLE_DEFAULTS[normalizedRole], ...(profilePreferences.staff_workspace?.[normalizedRole] || {}) });
        setNotificationPrefs({
            booking_updates: true,
            payment_reminders: true,
            message_alerts: true,
            announcements: true,
            sound_enabled: false,
            message_sounds: false,
            booking_update_sounds: false,
            payment_update_sounds: false,
            staff_update_sounds: false,
            quiet_mode: false,
            ...(user.notification_preferences || {}),
        });
    }, [normalizedRole, user.id]);

    useEffect(() => {
        if (normalizedRole !== 'admin') return undefined;

        let cancelled = false;
        setBusinessLoading(true);
        fetch('/api/admin/settings', { headers: { Accept: 'application/json' } })
            .then((response) => response.ok ? response.json() : Promise.reject(new Error('Could not load business settings.')))
            .then((payload) => {
                if (cancelled) return;
                const general = payload?.settings?.general || {};
                const normalized = Object.fromEntries(BUSINESS_SETTING_KEYS.map(([key]) => [key, normalizeSettingValue(general[key])]));
                setBusinessSettings(normalized);
            })
            .catch((error) => {
                if (!cancelled) setBusinessStatus({ type: 'error', message: error.message || 'Could not load business settings.' });
            })
            .finally(() => {
                if (!cancelled) setBusinessLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [normalizedRole]);

    const tabOptions = TAB_OPTIONS[normalizedRole] || TAB_OPTIONS.admin;

    const roleSpecificFields = useMemo(() => {
        if (normalizedRole === 'marketing') {
            return [
                ['calendar_view', 'Default calendar view', [['month', 'Month'], ['list', 'List']]],
            ];
        }

        if (normalizedRole === 'accounting') {
            return [
                ['payment_segment', 'Default payment segment', [['needs_verification', 'Needs verification'], ['overdue', 'Overdue'], ['exceptions', 'Exceptions'], ['all', 'All']]],
                ['refund_segment', 'Default refund segment', [['needs_review', 'Needs review'], ['processing', 'Processing'], ['completed', 'Completed'], ['all', 'All']]],
            ];
        }

        return [];
    }, [normalizedRole]);

    const settingSections = useMemo(() => {
        const sections = [
            { id: 'workspace', label: 'Workspace', description: 'Landing tab, density, sidebar, and sync behavior.' },
            { id: 'notifications', label: 'Notifications', description: 'Alert categories, sound, and quiet mode.' },
        ];

        if (roleSpecificFields.length > 0) {
            sections.push({
                id: 'defaults',
                label: normalizedRole === 'accounting' ? 'Finance defaults' : 'Queue defaults',
                description: normalizedRole === 'accounting'
                    ? 'Default finance and refund views.'
                    : 'Default calendar view.',
            });
        }

        if (normalizedRole === 'admin') {
            sections.push(
                { id: 'business', label: 'Business profile', description: 'Public contact and reply-to defaults.' },
                { id: 'payments', label: 'Payment rules', description: 'Admin-owned payment schedule rules.' },
            );
        }

        sections.push({ id: 'related', label: 'Related tools', description: 'Open detailed workspaces when settings are not enough.' });

        return sections;
    }, [normalizedRole, roleSpecificFields.length]);

    useEffect(() => {
        if (!settingSections.some((section) => section.id === activeSection)) {
            setActiveSection('workspace');
        }
    }, [activeSection, settingSections]);

    const updateWorkspacePref = (field, value) => {
        setWorkspacePrefs((current) => ({ ...current, [field]: value }));
        setStatus(null);
    };

    const updateNotificationPref = (field, value) => {
        setNotificationPrefs((current) => ({ ...current, [field]: value }));
        setStatus(null);
    };

    const persistLocalWorkspacePreferences = (nextPrefs) => {
        if (!canUseStorage()) return;

        window.localStorage.setItem(workspacePreferenceStorageKey(normalizedRole), JSON.stringify(nextPrefs));
        if (WORKSPACE_STORAGE_KEYS[normalizedRole] && nextPrefs.default_tab) {
            window.localStorage.setItem(`${WORKSPACE_STORAGE_KEYS[normalizedRole]}:tab`, nextPrefs.default_tab);
        }
        if (SIDEBAR_STORAGE_KEYS[normalizedRole] && nextPrefs.sidebar_state) {
            window.localStorage.setItem(SIDEBAR_STORAGE_KEYS[normalizedRole], nextPrefs.sidebar_state);
        }
        window.dispatchEvent(new CustomEvent('staff-workspace-preferences-changed', {
            detail: { roleKey: normalizedRole, preferences: nextPrefs },
        }));
    };

    const saveWorkspaceSettings = async (event) => {
        event.preventDefault();
        if (!user.id) return;

        setSaving(true);
        setStatus(null);

        const nextProfilePreferences = {
            ...profilePreferences,
            staff_workspace: {
                ...(profilePreferences.staff_workspace || {}),
                [normalizedRole]: workspacePrefs,
            },
        };

        try {
            const response = await csrfFetch('/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: user.full_name || '',
                    username: user.username || '',
                    email: user.email || '',
                    phone: user.phone || '',
                    preferred_contact_method: user.preferred_contact_method || 'email',
                    notification_preferences: notificationPrefs,
                    profile_preferences: nextProfilePreferences,
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.message || 'Could not save workspace settings.');
            }

            persistLocalWorkspacePreferences(workspacePrefs);
            setStatus({ type: 'success', message: 'Settings saved. Reloading is not required.' });
        } catch (error) {
            setStatus({ type: 'error', message: error.message || 'Could not save workspace settings.' });
        } finally {
            setSaving(false);
        }
    };

    const resetWorkspaceSettings = () => {
        const nextPrefs = { ...ROLE_DEFAULTS[normalizedRole] };
        setWorkspacePrefs(nextPrefs);
        setNotificationPrefs({
            booking_updates: true,
            payment_reminders: true,
            message_alerts: true,
            announcements: true,
            sound_enabled: false,
            message_sounds: false,
            booking_update_sounds: false,
            payment_update_sounds: false,
            staff_update_sounds: false,
            quiet_mode: false,
        });
        setStatus({ type: 'info', message: 'Defaults restored locally. Save changes to keep them.' });
    };

    const saveBusinessSettings = async (event) => {
        event.preventDefault();
        setBusinessSaving(true);
        setBusinessStatus(null);

        try {
            const response = await csrfFetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ group: 'general', settings: businessSettings }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || payload.message || 'Could not save business settings.');
            setBusinessStatus({ type: 'success', message: 'Business settings saved.' });
        } catch (error) {
            setBusinessStatus({ type: 'error', message: error.message || 'Could not save business settings.' });
        } finally {
            setBusinessSaving(false);
        }
    };

    const renderWorkspaceSection = () => (
        <section className="staff-settings-surface">
            <div className="staff-settings-section-header">
                <div>
                    <p className="staff-settings-kicker">Workspace</p>
                    <h4>Interface preferences</h4>
                    <span>Control where this dashboard opens and how dense the work surface feels.</span>
                </div>
                <div className="staff-settings-actions">
                    <button type="button" onClick={resetWorkspaceSettings}>Reset</button>
                </div>
            </div>

            <form onSubmit={saveWorkspaceSettings} className="staff-settings-form-block">
                <div className="staff-settings-form-grid">
                    <Field label="Default landing tab">
                        <select value={workspacePrefs.default_tab} onChange={(event) => updateWorkspacePref('default_tab', event.target.value)}>
                            {tabOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    </Field>
                    <Field label="List density">
                        <select value={workspacePrefs.density} onChange={(event) => updateWorkspacePref('density', event.target.value)}>
                            <option value="comfortable">Comfortable</option>
                            <option value="compact">Compact</option>
                        </select>
                    </Field>
                    <Field label="Sidebar default">
                        <select value={workspacePrefs.sidebar_state} onChange={(event) => updateWorkspacePref('sidebar_state', event.target.value)}>
                            <option value="expanded">Open</option>
                            <option value="collapsed">Collapsed</option>
                        </select>
                    </Field>
                    <Field label="Sync feedback">
                        <select value={workspacePrefs.sync_feedback} onChange={(event) => updateWorkspacePref('sync_feedback', event.target.value)}>
                            <option value="quiet">Only show issues</option>
                            <option value="detailed">Show all states</option>
                        </select>
                    </Field>
                </div>

                {status && <p className={`staff-settings-status is-${status.type}`}>{status.message}</p>}

                <div className="staff-settings-form-actions">
                    <button type="submit" disabled={saving} className="staff-button-primary">
                        {saving ? 'Saving...' : 'Save changes'}
                    </button>
                </div>
            </form>
        </section>
    );

    const renderNotificationsSection = () => {
        const notificationGroups = [
            {
                label: 'Alert categories',
                fields: ['booking_updates', 'payment_reminders', 'message_alerts', 'announcements'],
            },
            {
                label: 'Sound behavior',
                fields: ['sound_enabled', 'message_sounds', 'booking_update_sounds', 'payment_update_sounds', 'staff_update_sounds'],
            },
            {
                label: 'Quiet mode',
                fields: ['quiet_mode'],
            },
        ];

        return (
            <section className="staff-settings-surface">
                <div className="staff-settings-section-header">
                    <div>
                        <p className="staff-settings-kicker">Notifications</p>
                        <h4>Alerts and sounds</h4>
                        <span>Choose what should actively interrupt you. These preferences are shared with the notification bell.</span>
                    </div>
                </div>

                <form onSubmit={saveWorkspaceSettings} className="staff-settings-form-block">
                    <div className="staff-settings-grouped-toggles">
                        {notificationGroups.map((group) => (
                            <section key={group.label} className="staff-settings-toggle-panel">
                                <h5>{group.label}</h5>
                                <div className="staff-settings-toggle-grid">
                                    {group.fields.map((field) => {
                                        const config = NOTIFICATION_FIELDS.find(([key]) => key === field);
                                        if (!config) return null;
                                        const [, label] = config;

                                        return (
                                            <ToggleRow
                                                key={field}
                                                label={label}
                                                checked={notificationPrefs[field]}
                                                onChange={(value) => updateNotificationPref(field, value)}
                                            />
                                        );
                                    })}
                                </div>
                            </section>
                        ))}
                    </div>

                    {status && <p className={`staff-settings-status is-${status.type}`}>{status.message}</p>}

                    <div className="staff-settings-form-actions">
                        <button type="submit" disabled={saving} className="staff-button-primary">
                            {saving ? 'Saving...' : 'Save notification settings'}
                        </button>
                    </div>
                </form>
            </section>
        );
    };

    const renderDefaultsSection = () => (
        <section className="staff-settings-surface">
            <div className="staff-settings-section-header">
                <div>
                    <p className="staff-settings-kicker">{normalizedRole === 'accounting' ? 'Finance defaults' : 'Queue defaults'}</p>
                    <h4>{normalizedRole === 'accounting' ? 'Default finance views' : 'Default workflow views'}</h4>
                    <span>These choices set the first view shown when you enter role-specific work areas.</span>
                </div>
            </div>

            <form onSubmit={saveWorkspaceSettings} className="staff-settings-form-block">
                <div className="staff-settings-form-grid">
                    {roleSpecificFields.map(([field, label, options]) => (
                        <Field key={field} label={label}>
                            <select value={workspacePrefs[field] || ROLE_DEFAULTS[normalizedRole][field]} onChange={(event) => updateWorkspacePref(field, event.target.value)}>
                                {options.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                            </select>
                        </Field>
                    ))}
                </div>

                {status && <p className={`staff-settings-status is-${status.type}`}>{status.message}</p>}

                <div className="staff-settings-form-actions">
                    <button type="submit" disabled={saving} className="staff-button-primary">
                        {saving ? 'Saving...' : 'Save defaults'}
                    </button>
                </div>
            </form>
        </section>
    );

    const renderBusinessSection = () => (
        <section className="staff-settings-surface">
            <div className="staff-settings-section-header">
                <div>
                    <p className="staff-settings-kicker">Business</p>
                    <h4>Business profile defaults</h4>
                    <span>Public-facing contact and reply-to information used by operational documents and communication.</span>
                </div>
            </div>
            <form onSubmit={saveBusinessSettings} className="staff-settings-form-block">
                {businessLoading ? (
                    <p className="staff-settings-muted">Loading business settings...</p>
                ) : (
                    <div className="staff-settings-form-grid">
                        {BUSINESS_SETTING_KEYS.map(([key, label]) => (
                            <Field key={key} label={label}>
                                <input
                                    value={businessSettings[key] || ''}
                                    onChange={(event) => setBusinessSettings((current) => ({ ...current, [key]: event.target.value }))}
                                />
                            </Field>
                        ))}
                    </div>
                )}
                {businessStatus && <p className={`staff-settings-status is-${businessStatus.type}`}>{businessStatus.message}</p>}
                <div className="staff-settings-form-actions">
                    <button type="submit" disabled={businessSaving || businessLoading} className="staff-button-primary">
                        {businessSaving ? 'Saving...' : 'Save business settings'}
                    </button>
                </div>
            </form>
        </section>
    );

    const renderRelatedSection = () => (
        <section className="staff-settings-surface">
            <div className="staff-settings-section-header">
                <div>
                    <p className="staff-settings-kicker">Related tools</p>
                    <h4>Open the workspace area for detailed work</h4>
                    <span>These are shortcuts only. Actual settings stay in the sections on the left.</span>
                </div>
            </div>
            <div className="staff-settings-related">
                {(normalizedRole === 'admin' ? [['public-content', 'Public content'], ['finance', 'Finance'], ['system-audit', 'System & Audit']]
                    : normalizedRole === 'marketing' ? [['public-content', 'Public content'], ['leads', 'Guest inquiries'], ['tastings', 'Food tastings']]
                        : [['payments', 'Payments'], ['refunds', 'Refunds'], ['ledger', 'Ledger']]).map(([tab, label]) => (
                    <button key={tab} type="button" onClick={() => onNavigate?.(tab)}>Open {label}</button>
                ))}
            </div>
        </section>
    );

    const renderActiveSection = () => {
        if (activeSection === 'notifications') return renderNotificationsSection();
        if (activeSection === 'defaults') return renderDefaultsSection();
        if (activeSection === 'business') return renderBusinessSection();
        if (activeSection === 'payments') return <section className="staff-settings-surface"><PaymentRulesPanel embedded /></section>;
        if (activeSection === 'related') return renderRelatedSection();

        return renderWorkspaceSection();
    };

    return (
        <div className="staff-settings-page animate-fadeIn">
            <section className="staff-settings-hero">
                <div>
                    <p className="staff-settings-kicker">Settings</p>
                    <h3>{title}</h3>
                    <p>{description}</p>
                </div>
                <a href="/profile" className="staff-settings-profile-link">Open profile</a>
            </section>
            <div className="staff-settings-layout">
                <aside className="staff-settings-nav" aria-label={`${title} sections`}>
                    {settingSections.map((section) => (
                        <button
                            key={section.id}
                            type="button"
                            onClick={() => setActiveSection(section.id)}
                            className={activeSection === section.id ? 'is-active' : ''}
                            title={sectionButtonLabel(section)}
                        >
                            <strong>{section.label}</strong>
                            <span>{section.description}</span>
                        </button>
                    ))}
                </aside>
                <div className="staff-settings-content">
                    {renderActiveSection()}
                </div>
            </div>
        </div>
    );
};

export default RoleSettingsPanel;
