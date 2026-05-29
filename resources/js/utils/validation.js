export const firstErrorMessage = (errors = {}, fallback = 'Please review the highlighted fields and try again.') => {
    const first = Object.values(errors || {}).flat().filter(Boolean)[0];
    return first || fallback;
};

export const validationPayload = async (response, fallback = 'Request failed. Please try again.') => {
    const payload = await response.json().catch(() => ({}));
    return {
        payload,
        errors: payload.errors || {},
        message: firstErrorMessage(payload.errors || {}, payload.message || payload.error || fallback),
    };
};

export const focusFirstInvalidField = (errors = {}, root = document) => {
    const firstField = Object.keys(errors || {}).find(Boolean);
    if (!firstField || !root?.querySelector) return;

    const selector = `[name="${CSS.escape(firstField)}"], [data-field="${CSS.escape(firstField)}"]`;
    const target = root.querySelector(selector);

    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.setTimeout(() => target.focus?.({ preventScroll: true }), 220);
    }
};
