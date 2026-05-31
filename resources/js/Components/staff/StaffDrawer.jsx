import React from 'react';

const StaffDrawer = ({ isOpen, title, eyebrow, children, footer, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[130] flex justify-end bg-slate-950/35 backdrop-blur-sm">
            <button type="button" className="flex-1 cursor-default" aria-label="Close drawer" onClick={onClose} />
            <aside className="staff-drawer">
                <header className="staff-drawer-header">
                    <div>
                        {eyebrow && <p className="marketing-kicker">{eyebrow}</p>}
                        <h2 className="mt-1 text-xl font-black text-slate-950">{title}</h2>
                    </div>
                    <button type="button" onClick={onClose} className="staff-icon-button" aria-label="Close drawer">
                        X
                    </button>
                </header>
                <div className="staff-drawer-body custom-scrollbar">{children}</div>
                {footer && <footer className="staff-drawer-footer">{footer}</footer>}
            </aside>
        </div>
    );
};

export default StaffDrawer;
