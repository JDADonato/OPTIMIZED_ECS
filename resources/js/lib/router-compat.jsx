/**
 * react-router-dom compatibility shim for Inertia.js
 * 
 * This module re-exports Inertia equivalents under react-router-dom's API names.
 * Combined with a Vite alias, this allows ALL original components to work
 * without changing their import statements.
 */
import { Link as InertiaLink, router } from '@inertiajs/react';
import React from 'react';

// Link: wraps Inertia's Link to accept react-router-dom's `to` prop
export const Link = ({ to, children, className, onClick, ...rest }) => {
    return (
        <InertiaLink href={to || '#'} className={className} onClick={onClick} {...rest}>
            {children}
        </InertiaLink>
    );
};

// useNavigate: returns a function matching react-router-dom's navigate(path)
export const useNavigate = () => {
    return (path, options) => {
        if (path && typeof path === 'string') {
            router.visit(path, { preserveState: false });
        } else if (typeof path === 'number' && path < 0) {
            window.history.back();
        }
    };
};

// useLocation: returns current URL info
export const useLocation = () => {
    return {
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
    };
};

// useSearchParams: basic shim
export const useSearchParams = () => {
    const params = new URLSearchParams(window.location.search);
    return [params, () => {}];
};

// useParams: basic shim
export const useParams = () => {
    return {};
};

// Outlet: not needed with Inertia (pages are resolved by Inertia)
export const Outlet = () => null;

// BrowserRouter / Routes / Route: no-ops for compatibility
export const BrowserRouter = ({ children }) => <>{children}</>;
export const Routes = ({ children }) => <>{children}</>;
export const Route = () => null;
export const Navigate = ({ to }) => {
    React.useEffect(() => { router.visit(to); }, []);
    return null;
};
