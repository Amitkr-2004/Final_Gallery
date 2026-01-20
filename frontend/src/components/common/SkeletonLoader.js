import React from 'react';
import './SkeletonLoader.css';

const SkeletonLoader = ({ variant = 'card', width, height, count = 1, className = '' }) => {
  const skeletons = Array.from({ length: count }, (_, i) => i);

  const getSkeletonClass = () => {
    const baseClass = 'skeleton';
    const variantClass = `skeleton-${variant}`;
    return `${baseClass} ${variantClass} ${className}`;
  };

  const getStyle = () => {
    const style = {};
    if (width) style.width = typeof width === 'number' ? `${width}px` : width;
    if (height) style.height = typeof height === 'number' ? `${height}px` : height;
    return style;
  };

  if (count === 1) {
    return <div className={getSkeletonClass()} style={getStyle()} />;
  }

  return (
    <>
      {skeletons.map((_, index) => (
        <div key={index} className={getSkeletonClass()} style={getStyle()} />
      ))}
    </>
  );
};

export default React.memo(SkeletonLoader);
