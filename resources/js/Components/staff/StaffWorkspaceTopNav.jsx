import React from 'react';
import { usePage } from '@inertiajs/react';
import { Menu, X } from 'lucide-react';
import NotificationBell from '../common/NotificationBell';
import UserDropdown from '../common/UserDropdown';

const StaffWorkspaceTopNav = ({
    logo,
    logoAlt = 'Eloquente',
    badge,
    title,
    description,
    workspaces = [],
    activeWorkspace,
    onWorkspaceChange,
    searchSlot = null,
    notificationVariant = 'light',
    menuOpen = false,
    onMenuToggle,
}) => {
    const { auth } = usePage().props;
    const user = auth?.user;
    const hasWorkspaceTabs = workspaces.length > 0;

    return (
        <header className={`staff-workspace-navbar ${hasWorkspaceTabs ? 'has-switcher' : 'has-context'} ${searchSlot ? 'has-search' : ''}`}>
            <button
                type="button"
                className="staff-workspace-navbar-menu"
                onClick={onMenuToggle}
                aria-label={menuOpen ? 'Close staff navigation' : 'Open staff navigation'}
                aria-expanded={menuOpen}
            >
                {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>

            <div className="staff-workspace-navbar-brand">
                {logo && <img src={logo} alt={logoAlt} />}
                {badge && <span>{badge}</span>}
            </div>

            {hasWorkspaceTabs && (
                <nav className="staff-workspace-switcher" aria-label="Staff workspaces">
                    {workspaces.map((workspace) => (
                        <button
                            key={workspace.id}
                            type="button"
                            className={activeWorkspace === workspace.id ? 'is-active' : ''}
                            onClick={() => onWorkspaceChange?.(workspace)}
                            title={workspace.description}
                            aria-current={activeWorkspace === workspace.id ? 'page' : undefined}
                        >
                            {workspace.label}
                        </button>
                    ))}
                </nav>
            )}

            {searchSlot ? (
                <div className="staff-workspace-navbar-spacer" aria-hidden="true" />
            ) : (
                <div className="staff-workspace-navbar-context">
                    <span>{badge || 'Workspace'}</span>
                    <strong>{title}</strong>
                    {description && <small>{description}</small>}
                </div>
            )}

            <div className="staff-workspace-navbar-utilities">
                {searchSlot && (
                    <div className="staff-workspace-navbar-utility-search">
                        {searchSlot}
                    </div>
                )}
                <div className="staff-workspace-navbar-utility-actions">
                    <NotificationBell variant={notificationVariant} placement="inline" />
                    {user && <UserDropdown user={user} />}
                </div>
            </div>
        </header>
    );
};

export default StaffWorkspaceTopNav;
