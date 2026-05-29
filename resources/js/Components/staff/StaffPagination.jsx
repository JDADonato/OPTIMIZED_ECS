import React from 'react';

const StaffPagination = ({
    page = 1,
    perPage = 25,
    total = 0,
    onPageChange,
    onPerPageChange,
    perPageOptions = [10, 25, 50],
}) => {
    const pageCount = Math.max(1, Math.ceil(total / perPage));
    const start = total === 0 ? 0 : ((page - 1) * perPage) + 1;
    const end = Math.min(total, page * perPage);
    const pages = Array.from(
        { length: Math.min(5, pageCount) },
        (_, index) => Math.max(1, Math.min(pageCount - Math.min(4, pageCount - 1), page - 2)) + index
    ).filter((value, index, list) => value <= pageCount && list.indexOf(value) === index);

    return (
        <div className="staff-pagination">
            <div className="text-xs font-bold text-slate-500">
                Showing <span className="text-slate-900">{start}-{end}</span> of <span className="text-slate-900">{total}</span>
            </div>
            <div className="flex items-center gap-2">
                {onPerPageChange && (
                    <select
                        value={perPage}
                        onChange={(event) => onPerPageChange(Number(event.target.value))}
                        className="staff-control w-auto py-1.5 text-xs"
                    >
                        {perPageOptions.map((option) => (
                            <option key={option} value={option}>{option} / page</option>
                        ))}
                    </select>
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
