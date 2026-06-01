import React, { useId } from 'react';
import { Search, X } from 'lucide-react';

const StaffNavbarSearch = ({
    value,
    onChange,
    onClear,
    inputRef = null,
    placeholder = 'Search workspace...',
    results = [],
    isOpen = false,
    onOpenChange,
    onSelect,
    onKeyDown,
    loading = false,
    loadingText = 'Searching...',
    emptyText = 'No matching results found.',
    label = 'Search workspace',
    className = '',
    iconClassName = 'staff-navbar-search-icon',
    clearClassName = 'staff-navbar-search-clear',
    resultsClassName = 'staff-navbar-search-results custom-scrollbar',
    resultClassName = 'staff-navbar-search-result',
    emptyClassName = 'staff-navbar-search-empty',
    trailingControl = null,
    panelSlot = null,
}) => {
    const inputId = useId();
    const inputValue = String(value ?? '');
    const trimmedValue = inputValue.trim();
    const shouldShowPanel = isOpen && (loading || results.length > 0 || trimmedValue.length > 0);
    const rootClassName = [
        'staff-navbar-search',
        trailingControl ? 'has-trailing' : '',
        className,
    ].filter(Boolean).join(' ');

    const handleKeyDown = (event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            onOpenChange?.(false);
            return;
        }

        if (event.key === 'Enter' && !loading && results.length > 0) {
            event.preventDefault();
            onSelect?.(results[0]);
        }
    };

    return (
        <div
            className={rootClassName}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    onOpenChange?.(false);
                }
            }}
        >
            <label className="sr-only" htmlFor={inputId}>{label}</label>
            <Search className={iconClassName} aria-hidden="true" />
            <input
                ref={inputRef}
                id={inputId}
                value={inputValue}
                onChange={(event) => {
                    onChange?.(event.target.value);
                    onOpenChange?.(true);
                }}
                onFocus={() => onOpenChange?.(true)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                autoComplete="off"
                spellCheck="false"
            />
            {inputValue && (
                <button
                    type="button"
                    className={clearClassName}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                        onClear?.();
                        onOpenChange?.(true);
                    }}
                    aria-label="Clear search"
                >
                    <X aria-hidden="true" />
                </button>
            )}
            {trailingControl}
            {panelSlot}
            {shouldShowPanel && (
                <div className={resultsClassName} role="listbox" aria-label={`${label} results`}>
                    {loading ? (
                        <div className={emptyClassName}>{loadingText}</div>
                    ) : results.length > 0 ? (
                        results.map((result) => (
                            <button
                                key={result.id}
                                type="button"
                                className={`${resultClassName} ${result.isActive ? 'is-active' : ''}`.trim()}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => onSelect?.(result)}
                                role="option"
                                aria-selected={result.isActive ? 'true' : 'false'}
                            >
                                <span>
                                    <strong>{result.label}</strong>
                                    {result.path && <small>{result.path}</small>}
                                </span>
                                {result.description && <em>{result.description}</em>}
                            </button>
                        ))
                    ) : (
                        <div className={emptyClassName}>{emptyText}</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default StaffNavbarSearch;
