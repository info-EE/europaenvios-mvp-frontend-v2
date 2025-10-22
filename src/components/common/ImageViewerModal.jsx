import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '/src/components/common/Modal.jsx';
import { Button } from '/src/components/common/Button.jsx';

/**
 * A modal for viewing images with pan and zoom capabilities.
 */
export function ImageViewerModal({ open, onClose, images }) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const imageRef = useRef(null);

  const resetState = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };
  
  useEffect(() => {
    if (open) {
      resetState();
    }
  }, [open]);

  if (!open || !images || images.length === 0) return null;
  
  const handleClose = () => {
    onClose();
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const newZoom = zoom - e.deltaY * 0.01;
    setZoom(Math.min(Math.max(0.5, newZoom), 5)); // Clamp zoom level
  };

  const onMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setStartPos({ 
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
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
    setIsDragging(false);
  };

  return (
    <Modal open={open} onClose={handleClose} title="Visor de Fotos" maxWidth="max-w-6xl">
        <div 
          className="relative w-full h-[80vh] bg-slate-100 overflow-hidden cursor-grab rounded-lg"
          onWheel={handleWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUpOrLeave}
          onMouseLeave={onMouseUpOrLeave}
        >
          {images.map((url, index) => (
            <img
              key={index}
              ref={imageRef}
              src={url}
              alt={`Foto ${index + 1}`}
              className="absolute transition-transform duration-100 ease-out"
              style={{
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                cursor: isDragging ? 'grabbing' : 'grab',
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain'
              }}
              draggable="false"
            />
          ))}
        </div>
        <div className="flex justify-center items-center gap-4 mt-4">
            <Button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}>-</Button>
            <span className="text-sm font-semibold w-16 text-center">{Math.round(zoom * 100)}%</span>
            <Button onClick={() => setZoom(z => Math.min(5, z + 0.2))}>+</Button>
            <Button onClick={resetState}>Reset</Button>
        </div>
        <p className="text-center text-xs text-slate-500 mt-2">Usa la rueda del ratón para hacer zoom y arrastra para mover la imagen.</p>
    </Modal>
  );
}