import React, { useEffect, useState } from 'react';

const DEFAULT_FALLBACK = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=600';

const SmartImage = ({
    src,
    alt = '',
    fallbackSrc = DEFAULT_FALLBACK,
    aspectRatio = '4 / 3',
    containerClassName = '',
    className = '',
    loading = 'lazy',
    decoding = 'async',
    onClick,
    sizes,
    style = {},
    ...props
}) => {
    const [currentSrc, setCurrentSrc] = useState(src || fallbackSrc);
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setCurrentSrc(src || fallbackSrc);
        setLoaded(false);
        setFailed(false);
    }, [src, fallbackSrc]);

    const handleError = () => {
        if (failed || currentSrc === fallbackSrc) {
            setLoaded(true);
            return;
        }

        setFailed(true);
        setCurrentSrc(fallbackSrc);
    };

    return (
        <span
            className={`smart-image ${loaded ? 'is-loaded' : 'is-loading'} ${failed ? 'is-fallback' : ''} ${containerClassName}`}
            style={{ aspectRatio, ...style }}
            onClick={onClick}
        >
            {!loaded && <span className="smart-image-skeleton" aria-hidden="true" />}
            <img
                src={currentSrc}
                alt={alt}
                loading={loading}
                decoding={decoding}
                sizes={sizes}
                className={`smart-image-img ${className}`}
                onLoad={() => setLoaded(true)}
                onError={handleError}
                {...props}
            />
        </span>
    );
};

export default SmartImage;
