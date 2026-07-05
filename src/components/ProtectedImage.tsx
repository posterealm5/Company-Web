import React from 'react';

interface ProtectedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  wrapperClassName?: string;
  overlayClassName?: string;
}

export const ProtectedImage: React.FC<ProtectedImageProps> = ({
  wrapperClassName = '',
  overlayClassName = '',
  className = '',
  style,
  src,
  alt,
  width,
  height,
  ...props
}) => {
  const handleDragStart = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
  };

  // Determine if positioning classes are already specified in the className
  const isPositioned = 
    className.includes('absolute') || 
    className.includes('fixed') || 
    className.includes('sticky') || 
    className.includes('relative');

  // Check if width and height classes are specified to prevent layout collapse
  const hasHeightClass = className.split(/\s+/).some(c => c.startsWith('h-') && c !== 'h-auto' && !c.startsWith('hover:'));
  const hasWidthClass = className.split(/\s+/).some(c => c.startsWith('w-') && c !== 'w-auto' && !c.startsWith('hover:'));

  const imgWidthClass = hasWidthClass ? 'w-full' : '';
  const imgHeightClass = hasHeightClass ? 'h-full' : 'h-auto';

  // Extract object-fit and object-position classes so they are applied to the child <img> tag
  const classes = className.split(/\s+/);
  const fitAndPositionClasses = classes.filter(c => 
    c.startsWith('object-') || 
    c.startsWith('md:object-') || 
    c.startsWith('lg:object-') || 
    c.startsWith('xl:object-') || 
    c.startsWith('2xl:object-')
  ).join(' ');

  // The wrapper div inherits all sizing, positioning, border-radius, transition, and transform styles
  // We use inline-block by default to match the display behavior of a standard <img> element
  const wrapperClass = `inline-block ${isPositioned ? '' : 'relative'} overflow-hidden protected-area ${className} ${wrapperClassName}`;

  // The inner image fills the wrapper based on the width/height classes, and applies object-fit/position
  const imgClass = `${imgWidthClass} ${imgHeightClass} select-none pointer-events-none protected-area ${fitAndPositionClasses}`;

  return (
    <div 
      className={wrapperClass}
      style={style}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
    >
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        draggable={false}
        onDragStart={handleDragStart}
        className={imgClass}
        referrerPolicy="no-referrer"
        {...props}
      />
      {/* Transparent overlay layer to prevent direct interaction with the raw image element */}
      <div 
        className={`image-overlay ${overlayClassName}`}
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
      />
    </div>
  );
};
