import React, { useEffect, useRef } from 'react';

const RevealOnScroll = ({ children, className = '', delay = '', as: Component = 'div', ...props }) => {
    const ref = useRef(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;

        if (typeof IntersectionObserver === 'undefined') {
            el.classList.add('vis');
            return undefined;
        }

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                el.classList.add('vis');
                observer.unobserve(el);
            }
        }, { threshold: 0.1 });

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <Component ref={ref} className={`rv ${delay} ${className}`.trim()} {...props}>
            {children}
        </Component>
    );
};

export default RevealOnScroll;
