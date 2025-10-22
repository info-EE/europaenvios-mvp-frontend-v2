import React, { useRef, useEffect, useState } from 'react';
import { Modal } from '/src/components/common/Modal.jsx';
import { Button } from '/src/components/common/Button.jsx';
import { useModal } from '/src/context/ModalContext.jsx';

/**
 * A modal for capturing photos from a webcam, optimized for performance and quality.
 * It requests a high resolution for the capture without lagging the preview.
 */
export function CameraModal({ open, onClose, onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [track, setTrack] = useState(null);
  const [capabilities, setCapabilities] = useState(null);
  const { showAlert } = useModal();

  useEffect(() => {
    async function setupCamera() {
      if (open) {
        try {
          // Request a higher resolution, ideally 4K, for better capture quality.
          // The browser will manage the preview performance.
          const constraints = {
            video: {
              width: { ideal: 3840 },
              height: { ideal: 2160 },
              frameRate: { ideal: 30 }
            },
          };
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
                videoRef.current.play();
                const videoTrack = stream.getVideoTracks()[0];
                setTrack(videoTrack);
                const trackCapabilities = videoTrack.getCapabilities();
                setCapabilities(trackCapabilities);
                if (trackCapabilities.zoom) {
                    setZoom(videoTrack.getSettings().zoom || 1);
                } else {
                    console.log("Zoom is not supported by this camera/browser.");
                }
            };
          }
        } catch (err) {
          console.error("Error accessing camera:", err);
          showAlert(
            "Error de cámara",
            "No se pudo acceder a la cámara. Asegúrate de que no esté en uso y que los permisos estén concedidos."
          );
          onClose();
        }
      } else if (streamRef.current) {
        // Stop stream when the modal closes
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setTrack(null);
        setCapabilities(null);
      }
    }
    setupCamera();

    // Cleanup function
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setTrack(null);
        setCapabilities(null);
      }
    };
  }, [open, onClose, showAlert]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || video.readyState < video.HAVE_METADATA) return;

    const canvas = document.createElement('canvas');
    
    // Capture at the full native resolution of the video stream
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Use high quality for JPEG to ensure text is legible
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    onCapture(dataUrl);
    onClose();
  };

  const handleZoomChange = (e) => {
     if (track && capabilities?.zoom) {
      try {
        const newZoom = parseFloat(e.target.value);
        track.applyConstraints({ advanced: [{ zoom: newZoom }] })
          .then(() => {
            setZoom(newZoom);
          })
          .catch(error => {
            console.error("Error applying zoom:", error);
          });
      } catch (error) {
        console.error("Error preparing to apply zoom:", error);
      }
    }
  };

  const canZoom = !!capabilities?.zoom;

  return (
    <Modal open={open} onClose={onClose} title="Tomar foto con PC" maxWidth="max-w-4xl">
      <div className="space-y-4">
        <div className="bg-black rounded-lg overflow-hidden aspect-video relative">
          <video ref={videoRef} playsInline className="w-full h-full object-contain" />
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          {canZoom && capabilities.zoom ? (
            <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
              <label htmlFor="zoom" className="text-sm font-medium text-slate-700 whitespace-nowrap">Zoom:</label>
              <input
                id="zoom"
                type="range"
                min={capabilities.zoom.min}
                max={capabilities.zoom.max}
                step={capabilities.zoom.step}
                value={zoom}
                onChange={handleZoomChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
               <span className="text-sm font-medium text-slate-700 w-10 text-right">{Math.round(zoom * 10) / 10}x</span>
            </div>
          ) : <div className="flex-1"></div> }

          <Button variant="primary" onClick={handleCapture} className="w-full sm:w-auto">
            Capturar Foto 📸
          </Button>
        </div>
      </div>
    </Modal>
  );
}