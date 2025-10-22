import React, { useRef, useEffect, useState } from 'react';
import { Modal } from '/src/components/common/Modal.jsx';
import { Button } from '/src/components/common/Button.jsx';
import { useModal } from '/src/context/ModalContext.jsx';

/**
 * A modal for capturing high-resolution photos from a webcam.
 * It requests the highest possible resolution and provides zoom controls if supported.
 */
export function CameraModal({ open, onClose, onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [track, setTrack] = useState(null);
  const { showAlert } = useModal();

  useEffect(() => {
    async function setupCamera() {
      if (open) {
        try {
          // Request high resolution, ideal for 4K webcams
          const constraints = {
            video: {
              width: { ideal: 3840 },
              height: { ideal: 2160 },
            },
          };
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
          const videoTrack = stream.getVideoTracks()[0];
          setTrack(videoTrack);

          // Check for zoom capabilities
          if (videoTrack.getCapabilities().zoom) {
            setZoom(videoTrack.getSettings().zoom || 1);
          }
        } catch (err) {
          console.error("Error accessing camera:", err);
          showAlert("Error de cámara", "No se pudo acceder a la cámara en alta resolución. Asegúrate de que no esté en uso y que los permisos estén concedidos.");
          onClose();
        }
      } else if (streamRef.current) {
        // Stop stream when modal is closed
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
    setupCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [open, onClose, showAlert]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    // Capture at the stream's full resolution
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Use a higher quality setting for the JPEG output
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    onCapture(dataUrl);
    onClose();
  };
  
  // Handle camera zoom controls
  const handleZoomChange = (e) => {
    if (track && track.getCapabilities().zoom) {
      try {
        const newZoom = parseFloat(e.target.value);
        track.applyConstraints({ advanced: [{ zoom: newZoom }] });
        setZoom(newZoom);
      } catch (error) {
        console.error("Error applying zoom:", error);
      }
    }
  };

  const capabilities = track?.getCapabilities();
  const canZoom = !!capabilities?.zoom;

  return (
    <Modal open={open} onClose={onClose} title="Tomar foto con PC" maxWidth="max-w-4xl">
      <div className="space-y-4">
        <div className="bg-black rounded-lg overflow-hidden">
          <video ref={videoRef} playsInline className="w-full h-auto" />
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          {canZoom && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label htmlFor="zoom" className="text-sm font-medium text-slate-700">Zoom:</label>
              <input
                id="zoom"
                type="range"
                min={capabilities.zoom.min}
                max={capabilities.zoom.max}
                step={capabilities.zoom.step}
                value={zoom}
                onChange={handleZoomChange}
                className="w-full"
              />
            </div>
          )}
          <Button variant="primary" onClick={handleCapture} className="w-full sm:w-auto">
            Capturar Foto
          </Button>
        </div>
      </div>
    </Modal>
  );
}