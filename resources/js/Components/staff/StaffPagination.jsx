import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const StaffPagination = ({
    page = 1,
    perPage = 25,
    total = 0,
    onPageChange,
    onPerPageChange,
    perPageOptions = [10, 25, 50],
}) => {
    const [perPageMenuOpen, setPerPageMenuOpen] = useState(false);
    const perPageMenuRef = useRef(null);
    const pageCount = Math.max(1, Math.ceil(total / perPage));
    const start = total === 0 ? 0 : ((page - 1) * perPage) + 1;
    const end = Math.min(total, page * perPage);
    const pages = Array.from(
        { length: Math.min(5, pageCount) },
        (_, index) => Math.max(1, Math.min(pageCount - Math.min(4, pageCount - 1), page - 2)) + index
    ).filter((value, index, list) => value <= pageCount && list.indexOf(value) === index);

    useEffect(() => {
        if (!perPageMenuOpen) return undefined;

        const handlePointerDown = (event) => {
            if (!perPageMenuRef.current?.contains(event.target)) {
                setPerPageMenuOpen(false);
            }
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setPerPageMenuOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [perPageMenuOpen]);

    return (
        <div className="staff-pagination">
            <div className="text-xs font-bold text-slate-500">
                Showing <span className="text-slate-900">{start}-{end}</span> of <span className="text-slate-900">{total}</span>
            </div>
            <div className="flex items-center gap-2">
                {onPerPageChange && (
                    <div className="staff-page-size-menu" ref={perPageMenuRef}>
                        <button
                            type="button"
                            className="staff-page-size-button"
                            aria-haspopup="listbox"
                            aria-expanded={perPageMenuOpen}
                            onClick={() => setPerPageMenuOpen((open) => !open)}
                        >
                            <span>{perPage} / page</span>
                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        </button>
                        {perPageMenuOpen && (
                            <div className="staff-page-size-list" role="listbox" aria-label="Rows per page">
                                {perPageOptions.map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        role="option"
                                        aria-selected={option === perPage}
                                        className={`staff-page-size-option ${option === perPage ? 'is-active' : ''}`}
                                        onClick={() => {
                                            onPerPageChange(Number(option));
                                            setPerPageMenuOpen(false);
                                        }}
                                    >
                                        {option} / page
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => onPageChange(1)}
                    disabled={page <= 1}
                    className="staff-page-button"
                >
                    First
                </button>
                <button
                    type="button"
                    onClick={() => onPageChange(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="staff-page-button"
                >
                    Prev
                </button>
                <div className="staff-page-numbers">
                    {pages.map((pageNumber) => (
                        <button
                            key={pageNumber}
                            type="button"
                            onClick={() => onPageChange(pageNumber)}
                            className={`staff-page-number ${pageNumber === page ? 'is-active' : ''}`}
                        >
                            {pageNumber}
                        </button>
                    ))}
                </div>
                <span className="min-w-16 text-center text-xs font-black text-slate-600">{page} / {pageCount}</span>
                <button
                    type="button"
                    onClick={() => onPageChange(Math.min(pageCount, page + 1))}
                    disabled={page >= pageCount}
                    className="staff-page-button"
                >
                    Next
                </button>
                <button
                    type="button"
                    onClick={() => onPageChange(pageCount)}
                    disabled={page >= pageCount}
                    className="staff-page-button"
                >
                    Last
                </button>
            </div>
        </div>
    );
};

export default StaffPagination;
