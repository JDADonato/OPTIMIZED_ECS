import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';

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

export const BarChart = loadRechartsComponent('BarChart');
export const Bar = loadRechartsComponent('Bar');
export const XAxis = loadRechartsComponent('XAxis');
export const YAxis = loadRechartsComponent('YAxis');
export const CartesianGrid = loadRechartsComponent('CartesianGrid');
export const Tooltip = loadRechartsComponent('Tooltip');
export const Legend = loadRechartsComponent('Legend');
export const LineChart = loadRechartsComponent('LineChart');
export const Line = loadRechartsComponent('Line');

const hasRenderableSize = (node) => {
    if (!node) return false;
    const { width, height } = node.getBoundingClientRect();
    return width > 1 && height > 1;
};

const readRenderableSize = (node) => {
    if (!node) return { width: 0, height: 0 };
    const { width, height } = node.getBoundingClientRect();
    return {
        width: Math.max(0, Math.floor(width)),
        height: Math.max(0, Math.floor(height)),
    };
};

export const ResponsiveContainer = ({ children, className = '', style = {}, minHeight = 220, width = '100%', height = '100%' }) => {
    const frameRef = useRef(null);
    const [moduleReady, setModuleReady] = useState(false);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (moduleReady || typeof window === 'undefined') return undefined;

        const markReady = () => setModuleReady(true);
        if ('requestIdleCallback' in window) {
            const idleId = window.requestIdleCallback(markReady, { timeout: 2000 });
            return () => window.cancelIdleCallback(idleId);
        }

        const timer = window.setTimeout(markReady, 750);
        return () => window.clearTimeout(timer);
    }, [moduleReady]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const node = frameRef.current;
        if (!node) return undefined;

        const updateSize = () => {
            const nextSize = readRenderableSize(node);
            setSize((previous) => (
                previous.width === nextSize.width && previous.height === nextSize.height ? previous : nextSize
            ));
        };

        updateSize();

        if ('ResizeObserver' in window) {
            const observer = new window.ResizeObserver(updateSize);
            observer.observe(node);
            return () => observer.disconnect();
        }

        let animationFrame = window.requestAnimationFrame(function watchSize() {
            updateSize();
            animationFrame = window.requestAnimationFrame(watchSize);
        });

        return () => window.cancelAnimationFrame(animationFrame);
    }, []);

    const canRenderChart = moduleReady && hasRenderableSize(frameRef.current) && size.width > 1 && size.height > 1;
    const wrapperStyle = {
        width,
        height,
        minWidth: 0,
        minHeight,
        ...style,
    };
    const renderedChart = React.isValidElement(children)
        ? React.cloneElement(children, { width: size.width, height: size.height })
        : children;

    return (
        <div ref={frameRef} className={`h-full w-full min-w-0 ${className}`.trim()} style={wrapperStyle}>
            {canRenderChart ? (
                <Suspense fallback={chartFallback}>
                    {renderedChart}
                </Suspense>
            ) : chartFallback}
        </div>
    );
};
