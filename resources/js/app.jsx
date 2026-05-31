import './bootstrap';
import '../css/app.css';
import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import AppErrorBoundary from './Components/common/AppErrorBoundary';
import DefaultLayout from './Layouts/DefaultLayout';

const pages = import.meta.glob('./Pages/**/*.jsx');

createInertiaApp({
    title: (title) => title ? `${title} - Eloquente Catering` : 'Eloquente Catering System',
    resolve: async (name) => {
        const page = await pages[`./Pages/${name}.jsx`]();
        // Assign DefaultLayout (which includes FlashToast) to every page
        // unless the page already defines its own layout
        page.default.layout = page.default.layout || ((p) => <DefaultLayout>{p}</DefaultLayout>);
        return page;
    },
    setup({ el, App, props }) {
        createRoot(el).render(
            <AppErrorBoundary auth={props.initialPage?.props?.auth}>
                <App {...props} />
            </AppErrorBoundary>
        );
    },
});
