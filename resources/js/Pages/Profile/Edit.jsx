import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Bell, Check, Clock, Crop, Grip, KeyRound, MailCheck, RotateCcw, ShieldCheck, Timer, Upload, X } from 'lucide-react';
import DefaultLayout from '../../Layouts/DefaultLayout';
import ClientNavbar from '../../Components/common/ClientNavbar';
import PasswordStrengthField, { PasswordMatchHint } from '../../Components/auth/PasswordStrengthField';
import { evaluatePassword } from '../../utils/passwordPolicy';

const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

const FieldError = ({ message }) => message ? <p className="mt-2 text-sm font-bold text-red-700">{message}</p> : null;

const notificationLabels = {
    booking_updates: 'Booking updates',
    payment_reminders: 'Payment reminders',
    message_alerts: 'Message alerts',
    announcements: 'Announcements',
    sound_enabled: 'Notification sounds',
    message_sounds: 'Message sounds',
    booking_update_sounds: 'Booking update sounds',
    payment_update_sounds: 'Payment update sounds',
    staff_update_sounds: 'Staff update sounds',
    quiet_mode: 'Quiet mode',
};

const contactLabels = {
    email: 'Email',
    phone: 'Phone',
    dashboard: 'Dashboard messages',
};

const TabButton = ({ active, children, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`whitespace-nowrap border-b-2 px-2 py-4 text-sm font-black transition sm:px-5 ${
            active
                ? 'border-[#720101] text-[#720101]'
                : 'border-transparent text-slate-500 hover:border-[#ead8cc] hover:text-[#720101]'
        }`}
    >
        {children}
    </button>
);

const InfoRow = ({ label, value }) => (
    <div className="border-b border-[#f1e2d8] py-4 last:border-0">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <p className="mt-1 text-base font-black text-slate-950">{value || 'Not set'}</p>
    </div>
);

const DetailTile = ({ eyebrow, title, text, tone = 'neutral' }) => {
    const styles = {
        neutral: 'border-[#ead8cc] bg-white',
        warm: 'border-[#f5dfad] bg-[#fffaf0]',
        success: 'border-emerald-200 bg-emerald-50',
        danger: 'border-red-200 bg-red-50',
    };

    return (
        <div className={`rounded-2xl border p-5 ${styles[tone] || styles.neutral}`}>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
            <p className="mt-2 text-xl font-black text-slate-950">{title || 'Not set'}</p>
            {text && <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{text}</p>}
        </div>
    );
};

const PanelHeader = ({ eyebrow, title, text, action }) => (
    <div className="flex flex-col gap-4 border-b border-[#ead8cc] py-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#9f6500]">{eyebrow}</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-slate-950">{title}</h2>
            {text && <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">{text}</p>}
        </div>
        {action}
    </div>
);

const EditActions = ({ onCancel, onSave, processing, saveLabel = 'Save changes' }) => (
    <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50">
            Cancel
        </button>
        <button type="button" onClick={onSave} disabled={processing} className="rounded-xl bg-[#720101] px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-[#5a0101] disabled:opacity-60">
            {processing ? 'Saving...' : saveLabel}
        </button>
    </div>
);

const ToggleSwitch = ({ checked, disabled, onChange }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={`relative h-7 w-12 rounded-full p-1 transition ${checked ? 'bg-emerald-500' : 'bg-slate-300'} disabled:opacity-60`}
    >
        <span className={`block h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
);

const ProfileEdit = () => {
    const { auth, flash } = usePage().props;
    const user = auth?.user || {};
    const fileInputRef = useRef(null);
    const cropImageRef = useRef(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [preferenceSection, setPreferenceSection] = useState('planning');
    const [editing, setEditing] = useState(null);
    const [activity, setActivity] = useState([]);
    const [showPasswords, setShowPasswords] = useState(false);
    const [photoModalOpen, setPhotoModalOpen] = useState(false);
    const [photoDraftUrl, setPhotoDraftUrl] = useState(null);
    const [photoDraftName, setPhotoDraftName] = useState('profile-photo.jpg');
    const [photoZoom, setPhotoZoom] = useState(1);
    const [photoOffsetX, setPhotoOffsetX] = useState(0);
    const [photoOffsetY, setPhotoOffsetY] = useState(0);
    const [photoRotation, setPhotoRotation] = useState(0);
    const [photoDragStart, setPhotoDragStart] = useState(null);
    const [showPhotoHint, setShowPhotoHint] = useState(false);
    const [passwordCodeSent, setPasswordCodeSent] = useState(false);
    const [passwordCodeMessage, setPasswordCodeMessage] = useState('');
    const [passwordCodeError, setPasswordCodeError] = useState('');
    const [sendingPasswordCode, setSendingPasswordCode] = useState(false);
    const [passwordCodeExpiresAt, setPasswordCodeExpiresAt] = useState(null);
    const [passwordCodeSecondsRemaining, setPasswordCodeSecondsRemaining] = useState(0);
    const [pendingNotificationToggle, setPendingNotificationToggle] = useState(null);
    const [deleteForm, setDeleteForm] = useState({ password: '', confirmation: '', reason: '' });
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    const displayName = user.full_name || user.username || 'Profile';
    const initial = displayName.charAt(0).toUpperCase();
    const isClient = user.role === 'Client';
    const verified = Boolean(user.email_verified_at);
    const notificationPrefs = user.notification_preferences || {};
    const profilePrefs = user.profile_preferences || {};
    const activeNotificationLabels = isClient ? notificationLabels : {
        booking_updates: 'Booking assignments',
        payment_reminders: 'Payment and refund updates',
        message_alerts: 'Customer messages',
        announcements: 'Staff announcements',
        sound_enabled: 'Notification sounds',
        message_sounds: 'Message sounds',
        booking_update_sounds: 'Booking update sounds',
        payment_update_sounds: 'Payment update sounds',
        staff_update_sounds: 'Staff update sounds',
        quiet_mode: 'Quiet mode',
    };

    const { data, setData, post, processing, errors, reset, isDirty, transform } = useForm({
        _method: 'PUT',
        full_name: user.full_name || '',
        username: user.username || '',
        email: user.email || '',
        phone: user.phone || '',
        preferred_contact_method: user.preferred_contact_method || 'email',
        notification_preferences: {
            booking_updates: notificationPrefs.booking_updates ?? true,
            payment_reminders: notificationPrefs.payment_reminders ?? true,
            message_alerts: notificationPrefs.message_alerts ?? true,
            announcements: notificationPrefs.announcements ?? true,
            sound_enabled: notificationPrefs.sound_enabled ?? false,
            message_sounds: notificationPrefs.message_sounds ?? false,
            booking_update_sounds: notificationPrefs.booking_update_sounds ?? false,
            payment_update_sounds: notificationPrefs.payment_update_sounds ?? false,
            staff_update_sounds: notificationPrefs.staff_update_sounds ?? false,
            quiet_mode: notificationPrefs.quiet_mode ?? false,
        },
        profile_preferences: {
            default_event_city: profilePrefs.default_event_city || '',
            default_guest_count: profilePrefs.default_guest_count || '',
            planning_notes: profilePrefs.planning_notes || '',
        },
        current_password: '',
        new_password: '',
        new_password_confirmation: '',
        password_verification_code: '',
        avatar: null,
        remove_avatar: false,
    });

    useEffect(() => {
        if (!isClient && preferenceSection !== 'notifications') {
            setPreferenceSection('notifications');
        }
    }, [isClient, preferenceSection]);

    useEffect(() => {
        fetch('/api/profile/activity', { headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrfToken() } })
            .then((response) => response.ok ? response.json() : { data: [] })
            .then((payload) => setActivity(payload.data || []))
            .catch(() => setActivity([]));
    }, []);

    useEffect(() => {
        if (!photoModalOpen) return undefined;

        setShowPhotoHint(true);
        const timeout = window.setTimeout(() => setShowPhotoHint(false), 3200);

        return () => window.clearTimeout(timeout);
    }, [photoModalOpen, photoDraftUrl]);

    useEffect(() => {
        if (!passwordCodeExpiresAt) return undefined;

        const updateRemaining = () => {
            const remaining = Math.max(0, Math.ceil((new Date(passwordCodeExpiresAt).getTime() - Date.now()) / 1000));
            setPasswordCodeSecondsRemaining(remaining);
            if (remaining === 0) {
                setPasswordCodeSent(false);
                setPasswordCodeMessage('Verification code expired. Send a new code to continue.');
            }
        };

        updateRemaining();
        const interval = window.setInterval(updateRemaining, 1000);

        return () => window.clearInterval(interval);
    }, [passwordCodeExpiresAt]);

    const dashboardHref = user.role === 'Client'
        ? '/dashboard/client'
        : user.role === 'Marketing'
            ? '/dashboard/marketing'
            : user.role === 'Accounting'
                ? '/dashboard/accounting'
                : '/dashboard/admin';
    const readinessItems = useMemo(() => {
        const items = [
            { key: 'full_name', label: 'Full name', detail: 'Used on contracts, receipts, and staff follow-ups.', complete: Boolean(data.full_name) },
            { key: 'username', label: 'Username', detail: 'Keeps your account easy to identify.', complete: Boolean(data.username) },
            { key: 'email', label: 'Email address', detail: 'Required for booking and payment notices.', complete: Boolean(data.email) },
            { key: 'phone', label: 'Phone number', detail: 'Helps staff reach you for urgent event updates.', complete: Boolean(data.phone) },
            { key: 'contact', label: 'Preferred contact', detail: 'Tells the team where you want updates first.', complete: Boolean(data.preferred_contact_method) },
        ];

        if (isClient) {
            items.push({
                key: 'default_city',
                label: 'Default event city',
                detail: 'Helps future inquiries start with better location context.',
                complete: Boolean(data.profile_preferences.default_event_city),
            });
        }

        return items;
    }, [data, isClient]);

    const completion = useMemo(() => Math.round((readinessItems.filter((item) => item.complete).length / readinessItems.length) * 100), [readinessItems]);
    const missingReadiness = readinessItems.filter((item) => !item.complete);
    const passwordCodeExpired = Boolean(passwordCodeExpiresAt) && passwordCodeSecondsRemaining === 0;
    const passwordCodeCountdown = `${Math.floor(passwordCodeSecondsRemaining / 60)}:${String(passwordCodeSecondsRemaining % 60).padStart(2, '0')}`;
    const passwordEvaluation = useMemo(
        () => evaluatePassword(data.new_password, { username: data.username, email: data.email }),
        [data.new_password, data.username, data.email],
    );

    const selectedAvatarUrl = useMemo(() => data.avatar ? URL.createObjectURL(data.avatar) : null, [data.avatar]);
    const persistedAvatarUrl = user.avatar_url || null;
    const avatarPreview = selectedAvatarUrl || (data.remove_avatar ? null : persistedAvatarUrl);

    useEffect(() => () => {
        if (selectedAvatarUrl) {
            URL.revokeObjectURL(selectedAvatarUrl);
        }
    }, [selectedAvatarUrl]);

    const resetPhotoEditor = () => {
        setPhotoZoom(1);
        setPhotoOffsetX(0);
        setPhotoOffsetY(0);
        setPhotoRotation(0);
        setPhotoDragStart(null);
        setShowPhotoHint(true);
    };

    const chooseAvatar = () => fileInputRef.current?.click();

    const openPhotoModal = () => {
        if (avatarPreview) {
            setPhotoDraftUrl(avatarPreview);
            setPhotoDraftName(data.avatar?.name || 'profile-photo.jpg');
            resetPhotoEditor();
            setShowPhotoHint(true);
            setPhotoModalOpen(true);
            return;
        }

        chooseAvatar();
    };

    const clearAvatar = () => {
        setData('avatar', null);
        setData('remove_avatar', Boolean(persistedAvatarUrl));
        if (fileInputRef.current) fileInputRef.current.value = '';
        setPhotoModalOpen(false);
        setPhotoDraftUrl(null);
        resetPhotoEditor();
    };

    const saveNotificationPreferences = (nextPreferences) => {
        setData('notification_preferences', nextPreferences);
        transform((formData) => ({
            ...formData,
            notification_preferences: nextPreferences,
        }));
        post('/profile', {
            forceFormData: true,
            preserveScroll: true,
            onFinish: () => transform((formData) => formData),
        });
    };

    const requestNotificationToggle = (key) => {
        const nextValue = !data.notification_preferences[key];

        if (!nextValue) {
            setPendingNotificationToggle(key);
            return;
        }

        saveNotificationPreferences({ ...data.notification_preferences, [key]: true });
    };

    const confirmNotificationOff = () => {
        if (!pendingNotificationToggle) return;

        saveNotificationPreferences({
            ...data.notification_preferences,
            [pendingNotificationToggle]: false,
        });
        setPendingNotificationToggle(null);
    };

    const loadAvatarFile = (file) => {
        if (!file) return;

        setPhotoDraftUrl(URL.createObjectURL(file));
        setPhotoDraftName(file.name || 'profile-photo.jpg');
        resetPhotoEditor();
        setShowPhotoHint(true);
        setPhotoModalOpen(true);
    };

    const movePhoto = (deltaX, deltaY) => {
        setPhotoOffsetX((value) => Math.max(-140, Math.min(140, value + deltaX)));
        setPhotoOffsetY((value) => Math.max(-140, Math.min(140, value + deltaY)));
    };

    const handlePhotoKeyDown = (event) => {
        const distance = event.shiftKey ? 10 : 4;
        const moves = {
            ArrowLeft: [-distance, 0],
            ArrowRight: [distance, 0],
            ArrowUp: [0, -distance],
            ArrowDown: [0, distance],
        };

        if (!moves[event.key]) return;

        event.preventDefault();
        setShowPhotoHint(false);
        movePhoto(...moves[event.key]);
    };

    const saveEditedAvatar = () => {
        const image = cropImageRef.current;
        if (!image) return;

        const canvas = document.createElement('canvas');
        const size = 720;
        const scale = size / 320;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        context.fillStyle = '#720101';
        context.fillRect(0, 0, size, size);
        context.translate(size / 2, size / 2);
        context.rotate((photoRotation * Math.PI) / 180);
        context.scale(photoZoom, photoZoom);

        const imageRatio = image.naturalWidth / image.naturalHeight;
        const baseWidth = imageRatio >= 1 ? size * imageRatio : size;
        const baseHeight = imageRatio >= 1 ? size : size / imageRatio;
        context.drawImage(
            image,
            -baseWidth / 2 + photoOffsetX * scale,
            -baseHeight / 2 + photoOffsetY * scale,
            baseWidth,
            baseHeight,
        );

        canvas.toBlob((blob) => {
            if (!blob) return;
            const editedFile = new File([blob], photoDraftName.replace(/\.[^.]+$/, '') + '-profile.jpg', { type: 'image/jpeg' });
            setData('avatar', editedFile);
            setData('remove_avatar', false);
            transform((formData) => ({
                ...formData,
                avatar: editedFile,
                remove_avatar: false,
            }));
            post('/profile', {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => {
                    setEditing(null);
                    reset('avatar', 'remove_avatar');
                    setPhotoModalOpen(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                },
                onFinish: () => transform((formData) => formData),
            });
        }, 'image/jpeg', 0.9);
    };

    const sendPasswordCode = async () => {
        setSendingPasswordCode(true);
        setPasswordCodeError('');
        setPasswordCodeMessage('');

        try {
            const response = await fetch('/profile/password-code', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken(),
                },
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload.message || 'We could not send the verification code.');
            }

            setPasswordCodeSent(true);
            setPasswordCodeExpiresAt(payload.expires_at || null);
            setPasswordCodeSecondsRemaining(payload.expires_in_seconds || 600);
            setPasswordCodeMessage(payload.message || 'Verification code sent to your email.');
        } catch (error) {
            setPasswordCodeError(error.message || 'We could not send the verification code.');
        } finally {
            setSendingPasswordCode(false);
        }
    };

    const submit = () => {
        if (data.profile_preferences.default_guest_count === '') {
            setData('profile_preferences', { ...data.profile_preferences, default_guest_count: null });
        }

        if (editing === 'security' && data.new_password) {
            if (!passwordEvaluation.valid || data.new_password !== data.new_password_confirmation) {
                setPasswordCodeError('Complete the password requirements and confirmation before saving.');
                return;
            }
        }

        post('/profile', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setEditing(null);
                reset('current_password', 'new_password', 'new_password_confirmation', 'password_verification_code', 'avatar', 'remove_avatar');
                setPasswordCodeSent(false);
                setPasswordCodeMessage('');
                setPasswordCodeError('');
                setPasswordCodeExpiresAt(null);
                setPasswordCodeSecondsRemaining(0);
                if (fileInputRef.current) fileInputRef.current.value = '';
            },
        });
    };

    const deactivateAccount = async () => {
        if (!isClient || deletingAccount) return;
        setDeletingAccount(true);
        setDeleteError('');

        try {
            const response = await fetch('/profile/account', {
                method: 'DELETE',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken(),
                },
                body: JSON.stringify(deleteForm),
            });

            if (response.redirected) {
                window.location.href = response.url;
                return;
            }

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(Object.values(payload.errors || {})?.[0]?.[0] || payload.message || 'Could not deactivate account.');
            }

            window.location.href = '/';
        } catch (error) {
            setDeleteError(error.message || 'Could not deactivate account.');
        } finally {
            setDeletingAccount(false);
        }
    };

    const cancelEdit = () => {
        setEditing(null);
        reset();
        if (fileInputRef.current) fileInputRef.current.value = '';
        setPhotoModalOpen(false);
        setPasswordCodeSent(false);
        setPasswordCodeMessage('');
        setPasswordCodeError('');
        setPasswordCodeExpiresAt(null);
        setPasswordCodeSecondsRemaining(0);
    };

    const tabs = [
        ['overview', 'Overview'],
        ['personal', 'Personal'],
        ['preferences', isClient ? 'Planning' : 'Preferences'],
        ['security', 'Security'],
        ['activity', 'Activity'],
    ];

    const renderOverview = () => (
        <>
            <PanelHeader
                eyebrow="Account overview"
                title="Profile status"
                text="A short view of what is ready, what staff can rely on, and what still needs attention."
                action={<Link href={dashboardHref} className="rounded-xl border border-[#720101]/15 bg-white px-5 py-3 text-sm font-black text-[#720101] hover:bg-[#fff7e8]">Open dashboard</Link>}
            />
            <div className="grid gap-5 py-6 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-2xl border border-[#ead8cc] bg-[#fffaf3] p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9f6500]">Readiness checklist</p>
                            <p className="mt-2 text-3xl font-black text-[#720101]">{completion}%</p>
                        </div>
                        <p className="text-sm font-bold text-slate-500">{missingReadiness.length === 0 ? 'Every required profile detail is ready.' : `${missingReadiness.length} item${missingReadiness.length === 1 ? '' : 's'} left for 100%.`}</p>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {readinessItems.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => {
                                    setActiveTab(item.key === 'default_city' ? 'preferences' : 'personal');
                                    setEditing(item.key === 'default_city' ? 'preferences' : 'personal');
                                }}
                                className={`rounded-2xl border px-4 py-3 text-left transition ${item.complete ? 'border-emerald-200 bg-white text-slate-700' : 'border-[#f5dfad] bg-white text-slate-950 hover:border-[#f0aa0b]'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${item.complete ? 'bg-emerald-100 text-emerald-700' : 'bg-[#fff1c2] text-[#9f6500]'}`}>
                                        {item.complete ? <Check className="h-4 w-4" strokeWidth={3} /> : '!'}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="font-black">{item.label}</p>
                                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.complete ? 'Complete' : item.detail}</p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                    <DetailTile
                        eyebrow="Email status"
                        title={verified ? 'Verified' : 'Needs verification'}
                        text={verified ? 'Account notices can reach you.' : 'Verify to keep account recovery reliable.'}
                        tone={verified ? 'success' : 'warm'}
                    />
                    <DetailTile
                        eyebrow="Preferred contact"
                        title={contactLabels[user.preferred_contact_method || 'email']}
                        text={`${user.role || 'Account'} workspace updates use this preference.`}
                    />
                </div>
            </div>
        </>
    );

    const renderPersonal = () => (
        <>
            <PanelHeader
                eyebrow="Identity and contact"
                title="Personal details"
                text="Keep this tidy so bookings, messages, and staff follow-ups use the right information."
                action={editing !== 'personal' && <button type="button" onClick={() => setEditing('personal')} className="rounded-xl bg-[#720101] px-5 py-3 text-sm font-black text-white">Edit details</button>}
            />
            <div className="py-6">
                {editing === 'personal' ? (
                    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
                        <div className="flex w-full max-w-[200px] justify-self-center self-start">
                            <div className="w-full text-center">
                            <button
                                type="button"
                                onClick={openPhotoModal}
                                className="group relative mx-auto h-32 w-32 overflow-hidden rounded-[1.75rem] bg-[#720101] text-white shadow-md"
                                aria-label="Choose a new profile photo"
                            >
                                {avatarPreview ? <img src={avatarPreview} alt={`${displayName} profile`} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-5xl font-black">{initial}</div>}
                                <span className="absolute inset-0 flex items-center justify-center bg-black/55 px-3 text-center text-xs font-black uppercase tracking-widest opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                                    Change photo
                                </span>
                            </button>
                            <div className="mt-4 text-center">
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9f6500]">Profile photo</p>
                                <p className="mt-2 text-sm font-bold leading-6 text-slate-500">Click to upload or change.</p>
                                <p className="mt-1 text-xs font-bold text-slate-400">JPG, PNG, or WEBP up to 2MB.</p>
                            </div>
                            {(data.avatar || persistedAvatarUrl) && (
                                <button
                                    type="button"
                                    onClick={clearAvatar}
                                    className="mt-4 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 transition hover:bg-red-100"
                                >
                                    {data.avatar ? 'Clear selected photo' : 'Remove photo'}
                                </button>
                            )}
                            <FieldError message={errors.avatar} />
                            </div>
                        </div>
                        <div className="grid content-start gap-5 sm:grid-cols-2">
                            <label>
                                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Full name</span>
                                <input value={data.full_name} onChange={(e) => setData('full_name', e.target.value)} className="mt-2 h-14 w-full rounded-xl border border-slate-200 px-4 text-sm font-bold shadow-sm transition focus:border-[#720101] focus:outline-none focus:ring-2 focus:ring-[#720101]/10" />
                                <FieldError message={errors.full_name} />
                            </label>
                            <label>
                                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Email</span>
                                <input type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} className="mt-2 h-14 w-full rounded-xl border border-slate-200 px-4 text-sm font-bold shadow-sm transition focus:border-[#720101] focus:outline-none focus:ring-2 focus:ring-[#720101]/10" />
                                <FieldError message={errors.email} />
                            </label>
                            <label>
                                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Username</span>
                                <input value={data.username} onChange={(e) => setData('username', e.target.value)} className="mt-2 h-14 w-full rounded-xl border border-slate-200 px-4 text-sm font-bold shadow-sm transition focus:border-[#720101] focus:outline-none focus:ring-2 focus:ring-[#720101]/10" />
                                <FieldError message={errors.username} />
                            </label>
                            <label>
                                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Phone</span>
                                <input value={data.phone} onChange={(e) => setData('phone', e.target.value)} className="mt-2 h-14 w-full rounded-xl border border-slate-200 px-4 text-sm font-bold shadow-sm transition focus:border-[#720101] focus:outline-none focus:ring-2 focus:ring-[#720101]/10" />
                                <FieldError message={errors.phone} />
                            </label>
                            <label className="sm:col-span-2">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Preferred contact method</span>
                                <select value={data.preferred_contact_method} onChange={(e) => setData('preferred_contact_method', e.target.value)} className="mt-2 h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold shadow-sm transition focus:border-[#720101] focus:outline-none focus:ring-2 focus:ring-[#720101]/10">
                                    <option value="email">Email</option>
                                    <option value="phone">Phone</option>
                                    <option value="dashboard">Dashboard messages</option>
                                </select>
                            </label>
                            <div className="sm:col-span-2">
                                <EditActions onCancel={cancelEdit} onSave={submit} processing={processing} />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
                        <div className="flex w-full max-w-[200px] justify-self-center self-start">
                            <div className="w-full text-center">
                            <div className="relative mx-auto h-32 w-32 overflow-hidden rounded-[1.75rem] bg-[#720101] text-white shadow-md">
                                {avatarPreview ? <img src={avatarPreview} alt={`${displayName} profile`} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-5xl font-black">{initial}</div>}
                            </div>
                            <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-[#9f6500]">Profile photo</p>
                            <p className="mt-2 text-sm font-bold leading-6 text-slate-500">Edit your details to update this photo.</p>
                            </div>
                        </div>
                        <div className="grid content-start gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
                            <InfoRow label="Full name" value={user.full_name} />
                            <InfoRow label="Username" value={user.username} />
                            <InfoRow label="Email" value={user.email} />
                            <InfoRow label="Phone" value={user.phone} />
                            <InfoRow label="Preferred contact" value={contactLabels[user.preferred_contact_method || 'email']} />
                            <InfoRow label="Verification" value={verified ? 'Verified email' : 'Verification needed'} />
                        </div>
                    </div>
                )}
            </div>
        </>
    );

    const renderPreferences = () => {
        const preferenceSections = isClient
            ? [['planning', 'Planning defaults'], ['notifications', 'Notifications']]
            : [['notifications', 'Notifications']];
        const showPlanning = isClient && preferenceSection === 'planning';
        const showNotifications = !isClient || preferenceSection === 'notifications';

        return (
            <>
                <PanelHeader
                    eyebrow={isClient ? 'Preferences' : 'Communication'}
                    title={isClient ? 'Planning and alerts' : 'Notification preferences'}
                    text={isClient ? 'Use the section switcher to edit one kind of preference at a time.' : 'Choose which staff notifications should actively reach you.'}
                    action={showPlanning && editing !== 'preferences' && (
                        <button type="button" onClick={() => setEditing('preferences')} className="rounded-xl bg-[#720101] px-5 py-3 text-sm font-black text-white">Set default event details</button>
                    )}
                />

                {preferenceSections.length > 1 && (
                    <div className="mt-5 inline-flex max-w-full flex-wrap gap-2 rounded-2xl border border-[#ead8cc] bg-[#fffaf3] p-1.5">
                        {preferenceSections.map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setPreferenceSection(key)}
                                className={`rounded-xl px-4 py-2 text-sm font-black transition ${
                                    preferenceSection === key
                                        ? 'bg-white text-[#720101] shadow-sm'
                                        : 'text-slate-500 hover:bg-white/70 hover:text-[#720101]'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}

                <div className="py-6">
                    {showPlanning && (
                        <div className="rounded-2xl border border-[#ead8cc] bg-[#fffaf3] p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9f6500]">Event defaults</p>
                                    <h3 className="mt-1 text-xl font-black text-slate-950">Your usual setup</h3>
                                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">These details help new inquiries start faster.</p>
                                </div>
                                {editing !== 'preferences' && (
                                    <button type="button" onClick={() => setEditing('preferences')} className="rounded-xl border border-[#720101]/15 bg-white px-4 py-2.5 text-sm font-black text-[#720101] hover:bg-[#fff7e8]">
                                        Edit
                                    </button>
                                )}
                            </div>
                            {editing === 'preferences' ? (
                                <div className="mt-5 grid gap-4 md:grid-cols-2">
                                    <label>
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Default event city</span>
                                        <input value={data.profile_preferences.default_event_city} onChange={(e) => setData('profile_preferences', { ...data.profile_preferences, default_event_city: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold" />
                                    </label>
                                    <label>
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Usual guest count</span>
                                        <input type="number" min="1" value={data.profile_preferences.default_guest_count || ''} onChange={(e) => setData('profile_preferences', { ...data.profile_preferences, default_guest_count: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold" />
                                    </label>
                                    <label className="md:col-span-2">
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Planning notes</span>
                                        <textarea rows={4} value={data.profile_preferences.planning_notes} onChange={(e) => setData('profile_preferences', { ...data.profile_preferences, planning_notes: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold" />
                                    </label>
                                    <div className="md:col-span-2">
                                        <EditActions onCancel={cancelEdit} onSave={submit} processing={processing} saveLabel="Save event defaults" />
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-5 divide-y divide-[#f1e2d8]">
                                    <InfoRow label="Default city" value={profilePrefs.default_event_city} />
                                    <InfoRow label="Usual pax" value={profilePrefs.default_guest_count} />
                                    <InfoRow label="Planning notes" value={profilePrefs.planning_notes} />
                                </div>
                            )}
                        </div>
                    )}

                    {showNotifications && (
                        <div className="rounded-2xl border border-[#ead8cc] bg-white p-5">
                            <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff1c2] text-[#9f6500]">
                                    <Bell className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9f6500]">Alert preferences</p>
                                    <h3 className="mt-1 text-xl font-black text-slate-950">Notifications and reminders</h3>
                                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">These switches save immediately. Turning off an alert asks for confirmation first.</p>
                                </div>
                            </div>
                            <div className="mt-5 grid gap-3 md:grid-cols-2">
                                {Object.entries(activeNotificationLabels).map(([key, label]) => (
                                    <div key={key} className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-4 ${data.notification_preferences[key] ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                                        <div>
                                            <p className="font-black text-slate-950">{label}</p>
                                            <p className="mt-1 text-xs font-semibold text-slate-500">{data.notification_preferences[key] ? 'On and ready to reach you.' : 'Off until you turn it back on.'}</p>
                                        </div>
                                        <ToggleSwitch checked={Boolean(data.notification_preferences[key])} disabled={processing} onChange={() => requestNotificationToggle(key)} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </>
        );
    };

    const renderSecurity = () => (
        <>
            <PanelHeader
                eyebrow="Security"
                title="Password and verification"
                text="Password changes are isolated here so you can update security without touching your profile details."
                action={editing !== 'security' && <button type="button" onClick={() => setEditing('security')} className="rounded-xl bg-[#720101] px-5 py-3 text-sm font-black text-white">Change password</button>}
            />
            <div className="py-6">
                {editing === 'security' ? (
                    <div className="overflow-hidden rounded-2xl border border-[#ead8cc] bg-[#fffaf3] shadow-sm">
                        <div className="grid gap-0 lg:grid-cols-[0.92fr_1.28fr]">
                            <div className="relative overflow-hidden border-b border-[#ead8cc] bg-[#211915] p-6 text-white lg:border-b-0 lg:border-r lg:border-[#ead8cc]/20">
                                <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-[#f0aa0b]/20 blur-3xl" />
                                <div className="absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-[#720101]/45 blur-3xl" />
                                <div className="relative">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0aa0b] text-[#171412] shadow-lg shadow-black/20">
                                        <ShieldCheck className="h-7 w-7" />
                                    </div>
                                    <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-[#f0aa0b]">Secure password change</p>
                                    <h3 className="mt-2 text-2xl font-black">Confirm it is really you</h3>
                                    <p className="mt-3 text-sm font-semibold leading-6 text-white/70">A one-time code is sent directly to your account email before the new password can be saved.</p>
                                </div>
                                <div className="relative mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/45">Delivery address</p>
                                    <p className="mt-1 break-all text-sm font-black text-white">{user.email}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={sendPasswordCode}
                                    disabled={sendingPasswordCode}
                                    className="relative mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-[#720101] transition hover:bg-[#fff7e8] disabled:opacity-60"
                                >
                                    <MailCheck className="h-4 w-4" />
                                    {sendingPasswordCode ? 'Sending...' : passwordCodeSent ? 'Resend code' : 'Send code'}
                                </button>
                                {(passwordCodeMessage || passwordCodeError || passwordCodeSent) && (
                                    <div className={`relative mt-4 rounded-2xl border px-4 py-4 ${passwordCodeError ? 'border-red-300/30 bg-red-400/10' : passwordCodeExpired ? 'border-[#f0aa0b]/35 bg-[#f0aa0b]/10' : 'border-emerald-300/30 bg-emerald-400/10'}`}>
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${passwordCodeError ? 'bg-red-400/20 text-red-100' : passwordCodeExpired ? 'bg-[#f0aa0b]/20 text-[#f0aa0b]' : 'bg-emerald-400/20 text-emerald-100'}`}>
                                                {passwordCodeError ? <X className="h-4 w-4" /> : <Timer className="h-4 w-4" />}
                                            </div>
                                            <div>
                                                <p className={`text-sm font-black ${passwordCodeError ? 'text-red-100' : passwordCodeExpired ? 'text-[#ffe3a1]' : 'text-emerald-100'}`}>{passwordCodeError || passwordCodeMessage}</p>
                                                {passwordCodeSent && !passwordCodeExpired && (
                                                    <p className="mt-1 text-xs font-bold text-white/60">Expires in {passwordCodeCountdown}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="p-6">
                                <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#ead8cc] bg-white p-4 shadow-sm">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#fff1c2] text-[#9f6500]">
                                        <KeyRound className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9f6500]">Verification details</p>
                                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">Enter the active code, current password, and new password. Codes expire after 10 minutes.</p>
                                    </div>
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <label className="sm:col-span-2">
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Verification code</span>
                                        <div className="relative mt-2">
                                            <input inputMode="numeric" maxLength={6} value={data.password_verification_code} onChange={(e) => setData('password_verification_code', e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-28 text-center text-lg font-black tracking-[0.45em] text-slate-950 focus:border-[#720101] focus:outline-none focus:ring-4 focus:ring-[#720101]/10" />
                                            <span className={`absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${passwordCodeSent && !passwordCodeExpired ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                <Timer className="h-3.5 w-3.5" />
                                                {passwordCodeSent && !passwordCodeExpired ? passwordCodeCountdown : 'No code'}
                                            </span>
                                        </div>
                                        <FieldError message={errors.password_verification_code} />
                                    </label>
                                    <label>
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Current password</span>
                                        <input type={showPasswords ? 'text' : 'password'} value={data.current_password} onChange={(e) => setData('current_password', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold focus:border-[#720101] focus:outline-none focus:ring-4 focus:ring-[#720101]/10" />
                                        <FieldError message={errors.current_password} />
                                    </label>
                                    <PasswordStrengthField
                                        id="new_password"
                                        name="new_password"
                                        label="New password"
                                        value={data.new_password}
                                        username={data.username}
                                        email={data.email}
                                        visible={showPasswords}
                                        showToggle={false}
                                        placeholder="Create password"
                                        labelClassName="text-xs font-black uppercase tracking-widest text-slate-500"
                                        fieldClassName="auth-field auth-field-compact mt-2"
                                        error={errors.new_password}
                                        onChange={(value) => setData('new_password', value)}
                                    />
                                    <label className="sm:col-span-2">
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Confirm password</span>
                                        <input type={showPasswords ? 'text' : 'password'} value={data.new_password_confirmation} onChange={(e) => setData('new_password_confirmation', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold focus:border-[#720101] focus:outline-none focus:ring-4 focus:ring-[#720101]/10" />
                                        <PasswordMatchHint
                                            password={data.new_password}
                                            confirmation={data.new_password_confirmation}
                                            touched={Boolean(data.new_password_confirmation)}
                                        />
                                    </label>
                                </div>
                                <div className="mt-6 flex flex-col gap-3 border-t border-[#ead8cc] pt-5 sm:flex-row sm:items-center sm:justify-between">
                                    <button type="button" onClick={() => setShowPasswords((value) => !value)} className="rounded-xl border border-[#720101]/15 bg-white px-4 py-2.5 text-sm font-black text-[#720101] hover:bg-[#fff7e8]">
                                        {showPasswords ? 'Hide passwords' : 'Show passwords'}
                                    </button>
                                    <div className="flex justify-end gap-3">
                                        <button type="button" onClick={cancelEdit} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50">
                                            Cancel
                                        </button>
                                        <button type="button" onClick={submit} disabled={processing || !passwordCodeSent || passwordCodeExpired} className="rounded-xl bg-[#720101] px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-[#5a0101] disabled:cursor-not-allowed disabled:opacity-60">
                                            {processing ? 'Saving...' : passwordCodeExpired ? 'Code expired' : 'Save password'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-4 lg:grid-cols-3">
                        <DetailTile
                            eyebrow="Email verification"
                            title={verified ? 'Verified' : 'Needs verification'}
                            text={verified ? 'Your account email can receive recovery and booking notices.' : 'Verify your email to keep account recovery and notifications reliable.'}
                            tone={verified ? 'success' : 'warm'}
                        />
                        <DetailTile
                            eyebrow="Password rule"
                            title="Email code plus current password"
                            text="Password changes require a fresh email code, your current password, and confirmation."
                            tone="neutral"
                        />
                        <DetailTile
                            eyebrow="Security scope"
                            title="Isolated updates"
                            text="Changing your password here will not alter profile, booking, or contact details."
                            tone="warm"
                        />
                        {isClient && (
                            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 lg:col-span-3">
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-red-700">Account closure</p>
                                <h3 className="mt-2 text-xl font-black text-slate-950">Deactivate my account</h3>
                                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">This removes your access while preserving booking, payment, refund, chat, and audit records for business history.</p>
                                <div className="mt-4 grid gap-3 md:grid-cols-3">
                                    <input type="password" value={deleteForm.password} onChange={(e) => setDeleteForm((current) => ({ ...current, password: e.target.value }))} placeholder="Current password" className="rounded-xl border border-red-100 bg-white px-4 py-3 text-sm font-bold" />
                                    <input value={deleteForm.confirmation} onChange={(e) => setDeleteForm((current) => ({ ...current, confirmation: e.target.value }))} placeholder="Type DEACTIVATE" className="rounded-xl border border-red-100 bg-white px-4 py-3 text-sm font-bold" />
                                    <input value={deleteForm.reason} onChange={(e) => setDeleteForm((current) => ({ ...current, reason: e.target.value }))} placeholder="Reason, optional" className="rounded-xl border border-red-100 bg-white px-4 py-3 text-sm font-bold" />
                                </div>
                                {deleteError && <p className="mt-3 text-sm font-bold text-red-700">{deleteError}</p>}
                                <button type="button" onClick={deactivateAccount} disabled={deletingAccount || deleteForm.confirmation !== 'DEACTIVATE'} className="mt-4 rounded-xl bg-red-800 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
                                    {deletingAccount ? 'Deactivating...' : 'Deactivate account'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );

    const renderActivity = () => (
        <>
            <PanelHeader eyebrow="Account history" title="Recent profile activity" text="A short audit trail of profile, contact, and security updates." />
            <div className="py-6">
                {activity.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#ead8cc] bg-[#fffaf3] p-8 text-center">
                        <p className="font-black text-slate-950">No profile changes recorded yet.</p>
                        <p className="mt-2 text-sm font-semibold text-slate-500">Updates you make from this page will appear here.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-[#f1e2d8]">
                        {activity.map((item) => (
                            <div key={item.id} className="py-4">
                                <p className="font-black text-slate-950">Profile updated</p>
                                <p className="mt-1 text-sm font-semibold text-slate-500">
                                    {(item.metadata?.changed_fields || []).join(', ') || 'Account details'} / {new Date(item.created_at).toLocaleString()}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );

    const profileContent = (
                <main className={isClient ? 'mx-auto max-w-[1500px] px-4 pb-12 pt-24 sm:px-6 lg:px-8' : 'mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8'}>
                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#9f6500]">Eloquente account</p>
                            <h1 className="mt-2 font-display text-3xl font-bold text-slate-950 sm:text-4xl">Profile</h1>
                        </div>
                        <Link href={dashboardHref} className="w-fit rounded-xl border border-[#720101]/15 bg-white px-4 py-2.5 text-sm font-black text-[#720101] hover:bg-[#fff7e8]">
                            Back to dashboard
                        </Link>
                    </div>

                    {flash?.message && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800">{flash.message}</div>}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => loadAvatarFile(e.target.files?.[0])}
                        className="hidden"
                    />

                    <section className="staff-console-panel">
                        <div className="grid gap-4 p-4 lg:grid-cols-[1.05fr_1.25fr_0.85fr] lg:items-stretch">
                            <div className="flex min-w-0 items-center gap-4 rounded-xl border border-[#ead8cc] bg-white p-4">
                                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#720101] text-white">
                                    {avatarPreview ? <img src={avatarPreview} alt={`${displayName} profile`} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-3xl font-black">{initial}</div>}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#9f6500]">Account profile</p>
                                    <h2 className="mt-1 truncate text-2xl font-black leading-tight text-slate-950">{displayName}</h2>
                                    <p className="mt-1 truncate text-sm font-bold text-slate-500">@{user.username} / {user.role || 'Account'}</p>
                                </div>
                            </div>
                            <div className="rounded-xl border border-[#ead8cc] bg-white p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Profile readiness</p>
                                        <p className="mt-2 text-2xl font-black text-slate-950">{completion}%</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('overview')}
                                        className="staff-button-secondary min-h-0 px-3 py-1.5 text-xs"
                                    >
                                        View checklist
                                    </button>
                                </div>
                                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                                    <div className="h-full rounded-full bg-[#720101]" style={{ width: `${completion}%` }} />
                                </div>
                                <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                                    {missingReadiness.length === 0
                                        ? 'Everything required is ready for staff communications and booking updates.'
                                        : `Add ${missingReadiness.slice(0, 2).map((item) => item.label.toLowerCase()).join(' and ')}${missingReadiness.length > 2 ? `, plus ${missingReadiness.length - 2} more` : ''} to reach 100%.`}
                                </p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                                <div className="rounded-xl border border-[#ead8cc] bg-white px-4 py-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</p>
                                    <p className="mt-1 text-lg font-black text-slate-950">{verified ? 'Verified' : 'Needs review'}</p>
                                </div>
                                <div className="rounded-xl border border-[#ead8cc] bg-white px-4 py-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contact</p>
                                    <p className="mt-1 text-lg font-black text-slate-950">{contactLabels[user.preferred_contact_method || 'email']}</p>
                                </div>
                            </div>
                        </div>
                        {!verified && (
                            <div className="border-t border-[#ead8cc] bg-[#fff7d6] px-5 py-3">
                                <p className="text-sm font-bold text-[#9f6500]">Email verification is needed for account recovery and booking notices.</p>
                            </div>
                        )}
                    </section>

                    <nav className="mt-5 flex gap-5 overflow-x-auto border-b border-[#ead8cc]">
                        {tabs.map(([id, label]) => <TabButton key={id} active={activeTab === id} onClick={() => { setActiveTab(id); setEditing(null); }}>{label}</TabButton>)}
                    </nav>

                    <section className="staff-console-panel mt-6 px-5 sm:px-6">
                        {activeTab === 'overview' && renderOverview()}
                        {activeTab === 'personal' && renderPersonal()}
                        {activeTab === 'preferences' && renderPreferences()}
                        {activeTab === 'security' && renderSecurity()}
                        {activeTab === 'activity' && renderActivity()}
                    </section>

                    {photoModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171412]/75 px-4 py-6 backdrop-blur-sm">
                            <div className="max-h-[94vh] w-full max-w-[760px] overflow-y-auto rounded-[1.5rem] border border-[#ead8cc] bg-[#fffaf3] text-slate-950 shadow-2xl">
                                <div className="relative border-b border-[#ead8cc] bg-white px-6 py-5">
                                    <p className="text-xs font-black uppercase tracking-[0.22em] text-[#9f6500]">Eloquente account</p>
                                    <h3 className="mt-1 text-2xl font-black">Set profile picture</h3>
                                    <p className="mt-2 text-sm font-semibold text-slate-500">Frame your photo for bookings, messages, and staff follow-ups.</p>
                                    <button type="button" onClick={() => setPhotoModalOpen(false)} className="absolute right-5 top-5 rounded-full border border-[#ead8cc] bg-[#fffaf3] p-2 text-slate-500 hover:bg-white" aria-label="Close photo editor">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                                <div className="space-y-6 p-5 sm:p-6">
                                    <div
                                        role="application"
                                        tabIndex={0}
                                        onKeyDown={handlePhotoKeyDown}
                                        onPointerDown={(event) => {
                                            event.currentTarget.setPointerCapture(event.pointerId);
                                            setShowPhotoHint(false);
                                            setPhotoDragStart({ x: event.clientX, y: event.clientY });
                                        }}
                                        onPointerMove={(event) => {
                                            if (!photoDragStart) return;
                                            movePhoto(event.clientX - photoDragStart.x, event.clientY - photoDragStart.y);
                                            setPhotoDragStart({ x: event.clientX, y: event.clientY });
                                        }}
                                        onPointerUp={() => setPhotoDragStart(null)}
                                        onPointerCancel={() => setPhotoDragStart(null)}
                                        className="relative mx-auto h-[min(72vw,420px)] w-[min(72vw,420px)] cursor-grab overflow-hidden rounded-[1.25rem] border border-[#ead8cc] bg-[#2a211c] shadow-inner outline-none ring-offset-4 ring-offset-[#fffaf3] focus:ring-2 focus:ring-[#f0aa0b] active:cursor-grabbing"
                                    >
                                        <div className="absolute inset-0 opacity-60 blur-[1px]">
                                            {photoDraftUrl && (
                                                <img
                                                    src={photoDraftUrl}
                                                    alt=""
                                                    className="h-full w-full object-cover"
                                                    style={{
                                                        transform: `translate(${photoOffsetX}px, ${photoOffsetY}px) rotate(${photoRotation}deg) scale(${photoZoom})`,
                                                        transformOrigin: 'center',
                                                    }}
                                                />
                                            )}
                                        </div>
                                        <div className="absolute inset-0 bg-[#171412]/45" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="relative h-[78%] w-[78%] overflow-hidden rounded-full bg-[#720101] shadow-[0_0_0_999px_rgba(23,20,18,0.42)] ring-4 ring-[#f0aa0b]/70">
                                                {photoDraftUrl && (
                                                    <img
                                                        ref={cropImageRef}
                                                        src={photoDraftUrl}
                                                        alt="Profile photo preview"
                                                        className="h-full w-full object-cover"
                                                        style={{
                                                            transform: `translate(${photoOffsetX}px, ${photoOffsetY}px) rotate(${photoRotation}deg) scale(${photoZoom})`,
                                                            transformOrigin: 'center',
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        {showPhotoHint && (
                                            <div className="absolute left-1/2 top-[26%] flex max-w-[260px] -translate-x-1/2 items-center gap-2 rounded-xl bg-[#171412]/90 px-4 py-3 text-sm font-black text-white shadow-lg transition-opacity">
                                                <Grip className="h-4 w-4 shrink-0 text-[#f0aa0b]" />
                                                Drag or use arrow keys to reposition image
                                            </div>
                                        )}
                                    </div>
                                    <div className="mx-auto flex max-w-md items-center gap-3">
                                        <span className="text-2xl text-slate-400">-</span>
                                        <input type="range" min="1" max="2.6" step="0.05" value={photoZoom} onChange={(e) => setPhotoZoom(Number(e.target.value))} className="w-full accent-[#720101]" aria-label="Zoom profile picture" />
                                        <span className="text-2xl font-bold text-[#720101]">+</span>
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-3">
                                        <button type="button" onClick={resetPhotoEditor} className="inline-flex items-center gap-2 rounded-xl border border-[#ead8cc] bg-white px-4 py-2.5 text-sm font-black text-[#720101] hover:bg-[#fff7e8]">
                                            <Crop className="h-4 w-4" />
                                            Reset crop
                                        </button>
                                        <button type="button" onClick={() => setPhotoRotation((value) => (value + 90) % 360)} className="inline-flex items-center gap-2 rounded-xl border border-[#ead8cc] bg-white px-4 py-2.5 text-sm font-black text-[#720101] hover:bg-[#fff7e8]">
                                            <RotateCcw className="h-4 w-4" />
                                            Rotate
                                        </button>
                                        <button type="button" onClick={chooseAvatar} className="inline-flex items-center gap-2 rounded-xl border border-[#ead8cc] bg-white px-4 py-2.5 text-sm font-black text-[#720101] hover:bg-[#fff7e8]">
                                            <Upload className="h-4 w-4" />
                                            Change file
                                        </button>
                                    </div>
                                    <p className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl border border-[#ead8cc] bg-white px-4 py-3 text-center text-sm font-semibold text-slate-500">
                                        <Clock className="h-4 w-4 text-[#9f6500]" />
                                        Your profile picture is visible to staff handling your bookings.
                                    </p>
                                </div>
                                <div className="flex justify-end gap-3 border-t border-[#ead8cc] bg-white p-4">
                                    <button type="button" onClick={() => setPhotoModalOpen(false)} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50">
                                        Cancel
                                    </button>
                                    <div className="flex gap-3">
                                        <button type="button" onClick={saveEditedAvatar} disabled={processing} className="rounded-xl bg-[#720101] px-7 py-3 text-sm font-black text-white hover:bg-[#5a0101] disabled:opacity-60">
                                            {processing ? 'Saving...' : 'Save photo'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {pendingNotificationToggle && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
                            <div className="w-full max-w-md rounded-2xl border border-[#ead8cc] bg-white p-6 shadow-2xl">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff1c2] text-[#9f6500]">
                                        <Bell className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9f6500]">Important alert</p>
                                        <h3 className="mt-1 text-xl font-black text-slate-950">Turn off {activeNotificationLabels[pendingNotificationToggle]}?</h3>
                                        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                                            This alert helps you catch booking, payment, message, or announcement updates. You can turn it back on anytime.
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-6 flex justify-end gap-3">
                                    <button type="button" onClick={() => setPendingNotificationToggle(null)} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50">
                                        Keep on
                                    </button>
                                    <button type="button" onClick={confirmNotificationOff} disabled={processing} className="rounded-xl bg-[#720101] px-5 py-3 text-sm font-black text-white hover:bg-[#5a0101] disabled:opacity-60">
                                        Turn off
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {isDirty && editing && (
                        <div className="fixed bottom-5 left-1/2 z-30 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-[#ead8cc] bg-white/95 px-5 py-4 shadow-2xl backdrop-blur">
                            <p className="text-center text-sm font-black text-slate-700">You have unsaved profile changes.</p>
                        </div>
                    )}
                </main>
    );

    return (
        <DefaultLayout>
            <Head title="Profile | Eloquente Catering">
                <meta name="description" content="Manage your Eloquente Catering profile, contact details, preferences, password, and account activity." />
            </Head>
            {isClient ? (
                <div className="min-h-screen bg-[#f7f4ee] text-slate-950">
                    <ClientNavbar user={user} activePath="/profile" />
                    {profileContent}
                </div>
            ) : (
                <div className="min-h-screen bg-[#f7f4ee] text-slate-950">
                    {profileContent}
                </div>
            )}
        </DefaultLayout>
    );
};

ProfileEdit.layout = (page) => page;

export default ProfileEdit;
