import React from 'react';
import { QRCodeCanvas } from "qrcode.react";
import { Modal } from './Modal';

export function QrCodeModal({ open, onClose, sessionId }) {
  // Verificación para asegurar que el sessionId existe antes de crear la URL
  if (!sessionId) {
    // Esto previene que se genere un QR con "undefined"
    // Normalmente no se debería ver, ya que el modal no se abre sin un ID,
    // pero es una buena medida de seguridad.
    return (
      <Modal open={open} onClose={onClose} title="Error">
        <p>No se pudo generar un ID de sesión válido. Por favor, cierra esta ventana e inténtelo de nuevo.</p>
      </Modal>
    );
  }
  
  // Construcción correcta de la URL
  const uploadUrl = `${window.location.origin}/upload/${sessionId}`;

  return (
    <Modal open={open} onClose={onClose} title="Escanear para subir foto">
      <div className="text-center">
        <p className="mb-4 text-slate-600">
          Escanea este código con la cámara de tu móvil para subir la foto del paquete directamente.
        </p>
        <div className="p-4 bg-white inline-block rounded-lg shadow-inner">
          <QRCodeCanvas value={uploadUrl} size={256} />
        </div>
        <p className="mt-2 text-xs text-slate-500 break-all">{uploadUrl}</p>
      </div>
    </Modal>
  );
}