import React, { useEffect, useRef, useState } from 'react';
import {
    BarChart,
    Bar,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    LabelList,
    LineChart,
    Line,
    ReferenceLine,
} from 'recharts';

export {
    BarChart,
    Bar,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    LabelList,
    LineChart,
    Line,
    ReferenceLine,
};

class ChartErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidUpdate(previousProps) {
        if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
            this.setState({ hasError: false });
        }
    }

    componentDidCatch(error) {
        console.warn('Chart rendering failed. Showing a fallback panel instead.', error);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="admin-chart-empty h-full min-h-[220px]">
                    Chart could not render in this panel. Try switching tabs or refreshing the page.
                </div>
            );
        }

        return this.props.children;
    }
}

const measureElement = (element, fallbackHeight) => {
    if (!element || typeof element.getBoundingClientRect !== 'function') {
        return null;
    }

    const rect = element.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const measuredHeight = Math.floor(rect.height);
    const height = measuredHeight > 0 ? measuredHeight : fallbackHeight;

    if (width <= 1 || height <= 1) {
        return null;
    }

    return { width, height };
};

export const ResponsiveContainer = ({ children, className = '', style = {}, minHeight = 220, width = '100%', height = '100%' }) => {
    const wrapperRef = useRef(null);
    const frameRef = useRef(null);
    const [size, setSize] = useState(null);
    const wrapperStyle = {
        width,
        height,
        minWidth: 0,
        minHeight,
        ...style,
    };

    useEffect(() => {
        const element = wrapperRef.current;
        if (!element) return undefined;

        const updateSize = () => {
            if (frameRef.current) {
                window.cancelAnimationFrame(frameRef.current);
            }

            frameRef.current = window.requestAnimationFrame(() => {
                frameRef.current = null;
                const nextSize = measureElement(element, minHeight);
                setSize((previous) => {
                    if (!nextSize) {
                        return previous === null ? previous : null;
                    }

                    if (previous && previous.width === nextSize.width && previous.height === nextSize.height) {
                        return previous;
                    }

                    return nextSize;
                });
            });
        };

        updateSize();

        const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateSize) : null;
        resizeObserver?.observe(element);
        window.addEventListener('resize', updateSize);

        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener('resize', updateSize);
            if (frameRef.current) {
                window.cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }
        };
    }, [minHeight]);

    const measuredChart = size && React.isValidElement(children)
        ? React.cloneElement(children, { width: size.width, height: size.height })
        : null;

    return (
        <div ref={wrapperRef} className={`h-full w-full min-w-0 ${className}`.trim()} style={wrapperStyle}>
            {measuredChart ? (
                <ChartErrorBoundary resetKey={`${size.width}x${size.height}`}>
                    {measuredChart}
                </ChartErrorBoundary>
            ) : (
                <div aria-hidden="true" className="h-full w-full min-w-0" style={{ minHeight }} />
            )}
        </div>
    );
};
