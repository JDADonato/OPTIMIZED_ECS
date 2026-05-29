import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.jsx'],
            refresh: true,
        }),
        react(),
    ],
    resolve: {
        alias: {
            // Map react-router-dom to our Inertia-compatible shim
            // so ALL original components work without changing imports
            'react-router-dom': path.resolve(__dirname, 'resources/js/lib/router-compat.jsx'),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    const normalizedId = id.replace(/\\/g, '/');

                    if (!normalizedId.includes('node_modules')) {
                        return undefined;
                    }

                    if (
                        normalizedId.includes('/react/') ||
                        normalizedId.includes('/react-dom/') ||
                        normalizedId.includes('/scheduler/') ||
                        normalizedId.includes('/@inertiajs/')
                    ) {
                        return 'vendor-framework';
                    }

                    if (normalizedId.includes('/recharts/')) {
                        return 'vendor-charts';
                    }

                    if (normalizedId.includes('/d3-') || normalizedId.includes('/victory-vendor/')) {
                        return 'vendor-dataviz';
                    }

                    if (normalizedId.includes('/@headlessui/') || normalizedId.includes('/lucide-react/')) {
                        return 'vendor-ui';
                    }

                    if (normalizedId.includes('/axios/')) {
                        return 'vendor-http';
                    }

                    if (normalizedId.includes('/laravel-echo/') || normalizedId.includes('/pusher-js/')) {
                        return 'vendor-realtime';
                    }

                    return undefined;
                },
            }
        }
    }
});
