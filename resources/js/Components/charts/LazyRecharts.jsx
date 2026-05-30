import React, { lazy, Suspense, useEffect, useState } from 'react';

const loadRechartsComponent = (name) => lazy(() => (
    import('recharts').then((module) => ({ default: module[name] }))
));

const chartFallback = (
    <div className="staff-skeleton staff-skeleton-panel flex h-full min-h-[220px] items-center justify-center rounded-xl border border-slate-100 bg-slate-50" aria-label="Loading chart">
        <div className="staff-skeleton-panel-lines w-full max-w-sm">
            <span />
            <span />
            <span />
        </div>
    </div>
);

const LazyResponsiveContainer = loadRechartsComponent('ResponsiveContainer');

export const BarChart = loadRechartsComponent('BarChart');
export const Bar = loadRechartsComponent('Bar');
export const XAxis = loadRechartsComponent('XAxis');
export const YAxis = loadRechartsComponent('YAxis');
export const CartesianGrid = loadRechartsComponent('CartesianGrid');
export const Tooltip = loadRechartsComponent('Tooltip');
export const Legend = loadRechartsComponent('Legend');
export const LineChart = loadRechartsComponent('LineChart');
export const Line = loadRechartsComponent('Line');

export const ResponsiveContainer = (props) => {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (ready) return undefined;

        const markReady = () => setReady(true);
        if ('requestIdleCallback' in window) {
            const idleId = window.requestIdleCallback(markReady, { timeout: 2000 });
            return () => window.cancelIdleCallback(idleId);
        }

        const timer = window.setTimeout(markReady, 750);
        return () => window.clearTimeout(timer);
    }, [ready]);

    if (!ready) return chartFallback;

    return (
        <Suspense fallback={chartFallback}>
            <LazyResponsiveContainer {...props} />
        </Suspense>
    );
};
