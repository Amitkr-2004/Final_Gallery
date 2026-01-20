import React, { useState, useEffect } from 'react';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import { ImageOff } from 'lucide-react';
import './LazyImage.css';

const LazyImage = ({ src, alt, className = '', blurDataURL, onClick }) => {
  const [imageSrc, setImageSrc] = useState(blurDataURL || null);
  const [imageError, setImageError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const { targetRef, hasIntersected } = useIntersectionObserver({
    threshold: 0.01,
    rootMargin: '100px',
  });

  useEffect(() => {
    if (!hasIntersected || !src) return;

    const img = new Image();

    img.onload = () => {
      setImageSrc(src);
      setIsLoaded(true);
      setImageError(false);
    };

    img.onerror = () => {
      setImageError(true);
      setIsLoaded(true);
    };

    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [hasIntersected, src]);

  if (imageError) {
    return (
      <div className={`lazy-image-error ${className}`} ref={targetRef}>
        <ImageOff size={32} />
        <span>Failed to load image</span>
      </div>
    );
  }

  return (
    <div
      ref={targetRef}
      className={`lazy-image-container ${className}`}
      onClick={onClick}
    >
      <img
        src={imageSrc || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E'}
        alt={alt}
        className={`lazy-image ${isLoaded ? 'loaded' : 'loading'} ${blurDataURL && !isLoaded ? 'blurred' : ''}`}
        loading="lazy"
      />
      {!isLoaded && !imageError && (
        <div className="lazy-image-placeholder" />
      )}
    </div>
  );
};

export default React.memo(LazyImage);
