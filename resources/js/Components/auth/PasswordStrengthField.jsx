import React, { useMemo, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { evaluatePassword } from '../../utils/passwordPolicy';

export const PasswordMatchHint = ({ password, confirmation, touched = false }) => {
    if (!touched && !confirmation) return null;
    if (!confirmation) {
        return <p className="mt-1 text-xs font-bold text-slate-500">Repeat the password to confirm it.</p>;
    }

    const matches = password === confirmation;
    return (
        <p className={`mt-1 text-xs font-black ${matches ? 'text-emerald-700' : 'text-red-700'}`}>
            {matches ? 'Passwords match.' : 'Passwords do not match.'}
        </p>
    );
};

const PasswordStrengthField = ({
    id,
    name,
    label = 'Password',
    value,
    onChange,
    username,
    email,
    error,
    required = false,
    placeholder = 'Password',
    autoComplete = 'new-password',
    compact = true,
    labelClassName = 'auth-label',
    fieldClassName = '',
    inputClassName = 'auth-input',
    helperClassName = '',
    showToggle = true,
    visible,
}) => {
    const [localVisible, setLocalVisible] = useState(false);
    const isVisible = visible ?? localVisible;
    const evaluation = useMemo(() => evaluatePassword(value, { username, email }), [value, username, email]);
    const hasValue = String(value || '').length > 0;
    const shouldShowFeedback = hasValue || Boolean(error);
    const fieldStateClass = hasValue
        ? evaluation.valid
            ? 'auth-field-valid'
            : 'auth-field-warning'
        : '';
    const resolvedFieldClassName = fieldClassName || `auth-field ${compact ? 'auth-field-compact' : ''}`;

    return (
        <div>
            {label && <label htmlFor={id} className={labelClassName}>{label}</label>}
            <div className={`${resolvedFieldClassName} ${fieldStateClass}`.trim()}>
                <LockKeyhole className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} shrink-0 text-slate-400`} />
                <input
                    id={id}
                    name={name}
                    type={isVisible ? 'text' : 'password'}
                    required={required}
                    autoComplete={autoComplete}
                    className={`${inputClassName} ${showToggle ? 'pr-11' : ''}`.trim()}
                    placeholder={placeholder}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                />
                {showToggle && (
                    <button
                        type="button"
                        onClick={() => setLocalVisible((current) => !current)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label={isVisible ? 'Hide password' : 'Show password'}
                    >
                        {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                )}
            </div>
            {error && <p className="mt-2 text-xs font-bold text-red-700">{Array.isArray(error) ? error[0] : error}</p>}
            {shouldShowFeedback && (
                <div className={`password-rule-panel ${evaluation.valid ? 'is-valid' : 'is-warning'} ${helperClassName}`.trim()}>
                    {evaluation.valid ? (
                        <p className="flex items-center gap-2 text-xs font-black text-emerald-700">
                            <CheckCircle2 className="h-4 w-4" />
                            Password looks good.
                        </p>
                    ) : (
                        <>
                            <p className="text-xs font-black uppercase tracking-widest text-amber-800">Still needed</p>
                            <ul className="mt-2 space-y-1">
                                {evaluation.unmet.map((check) => (
                                    <li key={check.key} className="flex gap-2 text-xs font-semibold leading-5 text-slate-600">
                                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                                        {check.label}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default PasswordStrengthField;
