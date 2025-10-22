import React, { useRef, useEffect, useState } from 'react';
import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';
import { useModal } from '../../context/ModalContext.jsx';

// Constantes para optimizar la captura
const MAX_CAPTURE_WIDTH = 1920;
const MAX_CAPTURE_HEIGHT = 1080;

/**
 * Un modal para capturar fotos desde una cámara web, optimizado para el rendimiento.
 * Solicita una resolución razonable y proporciona controles de zoom si son soportados.
 */
export function CameraModal({ open, onClose, onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [track, setTrack] = useState(null);
  const [capabilities, setCapabilities] = useState(null); // Almacenar capacidades
  const { showAlert } = useModal();

  useEffect(() => {
    async function setupCamera() {
      if (open) {
        try {
          // Solicitar resolución Full HD idealmente para mejor rendimiento de preview
          const constraints = {
            video: {
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              // Podrías añadir frameRate si la lentitud persiste:
              // frameRate: { ideal: 15 }
            },
          };
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // Esperar a que los metadatos del video estén cargados
            videoRef.current.onloadedmetadata = () => {
                videoRef.current.play();
                const videoTrack = stream.getVideoTracks()[0];
                setTrack(videoTrack);
                const trackCapabilities = videoTrack.getCapabilities();
                setCapabilities(trackCapabilities); // Guardar capacidades
                // Inicializar zoom si es soportado
                if (trackCapabilities.zoom) {
                    setZoom(videoTrack.getSettings().zoom || 1);
                } else {
                    console.log("El zoom no es soportado por esta cámara/navegador.");
                }
            };
          }

        } catch (err) {
          console.error("Error al acceder a la cámara:", err);
          let message = "No se pudo acceder a la cámara.";
          if (err.name === "OverconstrainedError") {
              message = "La resolución solicitada (1920x1080) no es soportada por la cámara. Intentando con la predeterminada.";
              // Intenta de nuevo con constraints más flexibles
              try {
                  const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
                  streamRef.current = fallbackStream;
                   if (videoRef.current) {
                        videoRef.current.srcObject = fallbackStream;
                         videoRef.current.onloadedmetadata = () => {
                            videoRef.current.play();
                            const videoTrack = fallbackStream.getVideoTracks()[0];
                            setTrack(videoTrack);
                             const trackCapabilities = videoTrack.getCapabilities();
                            setCapabilities(trackCapabilities);
                            if (trackCapabilities.zoom) {
                                setZoom(videoTrack.getSettings().zoom || 1);
                            }
                        };
                   }
              } catch (fallbackErr) {
                   console.error("Error al acceder a la cámara con constraints de respaldo:", fallbackErr);
                   showAlert("Error de cámara", "No se pudo acceder a la cámara incluso con la configuración predeterminada.");
                   onClose();
              }
          } else {
              showAlert("Error de cámara", `${message} Asegúrate de que no esté en uso y que los permisos estén concedidos.`);
              onClose();
          }
        }
      } else if (streamRef.current) {
        // Detener stream cuando el modal se cierra
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setTrack(null); // Limpiar track
        setCapabilities(null); // Limpiar capabilities
      }
    }
    setupCamera();

    // Función de limpieza
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setTrack(null);
        setCapabilities(null);
      }
    };
  }, [open, onClose, showAlert]); // Dependencias del useEffect

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || video.readyState < video.HAVE_METADATA) return; // Asegurarse que el video está listo

    const canvas = document.createElement('canvas');
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // Calcular dimensiones manteniendo aspect ratio, sin superar el máximo
    let captureWidth = videoWidth;
    let captureHeight = videoHeight;
    if (captureWidth > MAX_CAPTURE_WIDTH || captureHeight > MAX_CAPTURE_HEIGHT) {
        const ratio = Math.min(MAX_CAPTURE_WIDTH / captureWidth, MAX_CAPTURE_HEIGHT / captureHeight);
        captureWidth = Math.round(captureWidth * ratio);
        captureHeight = Math.round(captureHeight * ratio);
    }

    canvas.width = captureWidth;
    canvas.height = captureHeight;

    const ctx = canvas.getContext('2d');
    // Dibuja el video (posiblemente de alta resolución) en el canvas (con resolución optimizada)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Usar calidad alta para JPEG
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    onCapture(dataUrl);
    onClose(); // Cierra el modal después de capturar
  };

  // Manejar cambio en el slider de zoom
  const handleZoomChange = (e) => {
     if (track && capabilities?.zoom) {
      try {
        const newZoom = parseFloat(e.target.value);
        // Usar applyConstraints para aplicar el zoom
        track.applyConstraints({ advanced: [{ zoom: newZoom }] })
          .then(() => {
            setZoom(newZoom); // Actualizar estado local si tiene éxito
          })
          .catch(error => {
            console.error("Error al aplicar zoom:", error);
            // Opcional: mostrar alerta al usuario si falla
            // showAlert("Error de Zoom", "No se pudo aplicar el nivel de zoom.");
          });
      } catch (error) {
        // Captura errores síncronos, aunque applyConstraints es asíncrono
        console.error("Error al preparar para aplicar zoom:", error);
      }
    }
  };

  const canZoom = !!capabilities?.zoom; // Verifica si hay capacidades y si zoom existe en ellas

  return (
    <Modal open={open} onClose={onClose} title="Tomar foto con PC" maxWidth="max-w-4xl">
      <div className="space-y-4">
        <div className="bg-black rounded-lg overflow-hidden aspect-video relative"> {/* aspect-video para mantener proporción */}
          <video ref={videoRef} playsInline className="w-full h-full object-contain" /> {/* object-contain para evitar distorsión */}
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          {canZoom && capabilities.zoom ? ( // Comprobación más robusta
            <div className="flex items-center gap-2 w-full sm:w-auto flex-1"> {/* flex-1 para que ocupe espacio */}
              <label htmlFor="zoom" className="text-sm font-medium text-slate-700 whitespace-nowrap">Zoom:</label>
              <input
                id="zoom"
                type="range"
                min={capabilities.zoom.min}
                max={capabilities.zoom.max}
                step={capabilities.zoom.step}
                value={zoom}
                onChange={handleZoomChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700" // Estilos básicos para el range
              />
               <span className="text-sm font-medium text-slate-700 w-10 text-right">{Math.round(zoom * 10) / 10}x</span> {/* Mostrar valor actual */}
            </div>
          ) : <div className="flex-1"></div> } {/* Espaciador si no hay zoom */}

          <Button variant="primary" onClick={handleCapture} className="w-full sm:w-auto">
            Capturar Foto 📸
          </Button>
        </div>
      </div>
    </Modal>
  );
}