import { usePage, router } from '@inertiajs/react';
import { clearSensitiveAuthState } from '../utils/smartResource';

export const useAuth = () => {
    const { auth } = usePage().props;
    const user = auth?.user || null;

    const login = async (username, password, remember = false) => {
        return new Promise((resolve, reject) => {
            router.post('/login', { username, password, remember }, {
                onSuccess: () => resolve({ success: true }),
                onError: (errors) => {
                    const msg = errors.username || errors.password || 'The username or password is incorrect.';
                    resolve({ success: false, message: msg });
                },
                onFinish: () => {},
                // Prevent Inertia from preserving scroll on login redirect
                preserveScroll: false,
            });
        });
    };

    const logout = () => {
        clearSensitiveAuthState();
        router.post('/logout');
    };

    const loading = false;

    return { user, login, logout, loading };
};

// Default export for compatibility with `import { AuthProvider } from ...`
export const AuthProvider = ({ children }) => children;
