import React, { useState, useRef, useEffect } from 'react';
// Corrected import paths to relative
import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';
// Removed Heroicons import - Install '@heroicons/react' and uncomment if needed
// import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

/**
 * A modal for viewing a single image at a time with pan and zoom capabilities,
 * allowing navigation between multiple images.
 */
export function ImageViewerModal({ open, onClose, images, initialImageIndex = 0 }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(initialImageIndex);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const imageContainerRef = useRef(null); // Ref for the individual image container

  // Reset state for the current image when index changes or modal opens
  const resetImageState = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  // Reset all states when modal opens
  useEffect(() => {
    if (open) {
      // Ensure initialImageIndex is valid
      const validIndex = Math.max(0, Math.min(initialImageIndex, images?.length ? images.length - 1 : 0));
      setCurrentImageIndex(validIndex);
      resetImageState();
    }
  }, [open, initialImageIndex, images]); // Added images to dependency array

  // Reset state when current image changes
  useEffect(() => {
    resetImageState();
  }, [currentImageIndex]);


  if (!open || !images || images.length === 0) return null;

  const handleClose = () => {
    onClose();
  };

  // Ensure currentImageIndex is always within bounds
  const safeIndex = Math.max(0, Math.min(currentImageIndex, images.length - 1));
  const currentImage = images[safeIndex];

  const goToNextImage = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
  };

  const goToPreviousImage = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (!imageContainerRef.current) return;

    const scaleAmount = -e.deltaY * 0.005; // Reduced sensitivity
    const newZoom = Math.min(Math.max(0.5, zoom + scaleAmount * zoom), 5); // Clamp zoom level, make zoom relative

    const rect = imageContainerRef.current.getBoundingClientRect();
    // Calculate mouse position relative to the container center
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;

    // Calculate the new position based on where the mouse is pointing
    const newX = position.x - (mouseX / zoom) * (newZoom - zoom);
    const newY = position.y - (mouseY / zoom) * (newZoom - zoom);


    setZoom(newZoom);
    setPosition({ x: newX, y: newY });
  };

  const onMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setStartPos({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    if (imageContainerRef.current) {
      imageContainerRef.current.style.cursor = 'grabbing';
    }
  };

  const onMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - startPos.x,
      y: e.clientY - startPos.y
    });
  };

  const onMouseUpOrLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      if (imageContainerRef.current) {
        imageContainerRef.current.style.cursor = 'grab';
      }
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Visor de Fotos" maxWidth="max-w-6xl">
      {/* Container for image and controls */}
      <div className="relative w-full h-[75vh] flex items-center justify-center bg-slate-100 rounded-lg select-none group"> {/* Added group */}
        {/* Navigation Arrows - visibility on hover */}
        {images.length > 1 && (
          <>
            <Button
              aria-label="Previous image" // Added aria-label
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white bg-opacity-50 hover:bg-opacity-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-bold text-lg" // Added opacity styles & text style
              onClick={goToPreviousImage}
            >
              {/* Replaced icon with text */}
              &lt;
              {/* <ChevronLeftIcon className="h-6 w-6 text-slate-800" /> */}
            </Button>
            <Button
              aria-label="Next image" // Added aria-label
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white bg-opacity-50 hover:bg-opacity-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-bold text-lg" // Added opacity styles & text style
              onClick={goToNextImage}
            >
              {/* Replaced icon with text */}
              &gt;
              {/* <ChevronRightIcon className="h-6 w-6 text-slate-800" /> */}
            </Button>
          </>
        )}

        {/* Image Display Area */}
        <div
          ref={imageContainerRef}
          className="relative w-full h-full overflow-hidden cursor-grab" // Takes full height/width of parent
          onWheel={handleWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUpOrLeave}
          onMouseLeave={onMouseUpOrLeave}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          {/* Apply transform to the image directly */}
          <img
            src={currentImage}
            alt={`Foto ${safeIndex + 1}`} // Use safeIndex
            className="absolute top-0 left-0 w-full h-full object-contain" // Use absolute positioning and object-contain
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out', // Slightly faster transition
              willChange: 'transform', // Performance hint
            }}
            draggable="false"
          />
        </div>

        {/* Image Counter */}
        {images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black bg-opacity-50 text-white text-xs px-3 py-1 rounded-full pointer-events-none"> {/* Added pointer-events-none */}
            {safeIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Controls for Zoom and Reset */}
      <div className="flex justify-center items-center gap-4 mt-4">
        <Button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}>-</Button>
        <span className="text-sm font-semibold w-16 text-center">{Math.round(zoom * 100)}%</span>
        <Button onClick={() => setZoom(z => Math.min(5, z + 0.2))}>+</Button>
        <Button onClick={resetImageState}>Reset</Button>
      </div>
      <p className="text-center text-xs text-slate-500 mt-2">
        Usa la rueda del ratón para hacer zoom, arrastra para mover y las flechas para navegar entre fotos.
      </p>
    </Modal>
  );
}