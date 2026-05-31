const WARNING_THRESHOLD = 3;

const BLOCKED_TERMS = [
    'fuck',
    'fucking',
    'motherfucker',
    'shit',
    'bullshit',
    'bitch',
    'asshole',
    'bastard',
    'cunt',
    'dickhead',
    'whore',
    'slut',
    'faggot',
    'fag',
    'nigger',
    'nigga',
    'chink',
    'gook',
    'spic',
    'kike',
    'retard',
    'tranny',
];

export const CHAT_MODERATION_BLOCK_MESSAGE = 'Message blocked because it contains inappropriate or abusive language. Please rewrite it respectfully.';
export const CHAT_MODERATION_REPEAT_WARNING = 'Repeated blocked messages may lead to staff review or account action.';

const substitutionMap = {
    0: 'o',
    1: 'i',
    3: 'e',
    4: 'a',
    '@': 'a',
    $: 's',
    5: 's',
    7: 't',
    '!': 'i',
};

const normalizeModerationText = (text = '') => String(text)
    .toLowerCase()
    .replace(/[0134@$57!]/g, (char) => substitutionMap[char] || char)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const isTrustedStructuredPayload = (message = '') => {
    try {
        const parsed = JSON.parse(message);
        return parsed?.type === 'booking_details';
    } catch (error) {
        return false;
    }
};

export const getChatModerationIssue = (message = '') => {
    const text = String(message || '').trim();
    if (!text || isTrustedStructuredPayload(text)) return null;

    const normalized = normalizeModerationText(text);
    const tokens = normalized ? normalized.split(' ') : [];

    const matched = BLOCKED_TERMS.some((term) => {
        const normalizedTerm = normalizeModerationText(term);
        if (!normalizedTerm) return false;

        const exactTokenMatch = !normalizedTerm.includes(' ') && tokens.includes(normalizedTerm);
        const separatedLetters = !normalizedTerm.includes(' ')
            && normalizedTerm.length >= 4
            && normalized.includes(normalizedTerm.split('').join(' '));

        return exactTokenMatch || separatedLetters;
    });

    return matched ? { category: 'restricted_language' } : null;
};

export const getChatModerationFeedback = (attempts = 1, serverPayload = null) => ({
    message: serverPayload?.error || CHAT_MODERATION_BLOCK_MESSAGE,
    warning: serverPayload?.moderation?.warning || (Number(attempts) >= WARNING_THRESHOLD ? CHAT_MODERATION_REPEAT_WARNING : ''),
    attempts: Number(serverPayload?.moderation?.attempts || attempts || 1),
});
