export const PASSWORD_POLICY_VERSION = 2;
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_REQUIRED_CHARACTER_TYPES = 3;

const normalizeIdentityPart = (value = '') => String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');

const identityNeedles = ({ username = '', email = '' } = {}) => {
    const emailLocal = String(email).includes('@') ? String(email).split('@')[0] : email;
    return [username, emailLocal]
        .map(normalizeIdentityPart)
        .filter((value) => value.length >= 3);
};

export const passwordCharacterTypes = (password = '') => ({
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
});

export const evaluatePassword = (password = '', context = {}) => {
    const types = passwordCharacterTypes(password);
    const typeCount = Object.values(types).filter(Boolean).length;
    const lowerPassword = String(password).toLowerCase();
    const containsIdentity = identityNeedles(context).some((needle) => lowerPassword.includes(needle));

    const checks = [
        {
            key: 'length',
            label: `At least ${PASSWORD_MIN_LENGTH} characters`,
            met: String(password).length >= PASSWORD_MIN_LENGTH,
        },
        {
            key: 'mix',
            label: `At least ${PASSWORD_REQUIRED_CHARACTER_TYPES} of 4: lowercase, uppercase, number, symbol`,
            met: typeCount >= PASSWORD_REQUIRED_CHARACTER_TYPES,
        },
        {
            key: 'identity',
            label: 'Does not include your username or email name',
            met: !containsIdentity,
        },
    ];

    return {
        valid: checks.every((check) => check.met),
        checks,
        unmet: checks.filter((check) => !check.met),
        typeCount,
        types,
    };
};

export const passwordIsValid = (password = '', context = {}) => evaluatePassword(password, context).valid;
