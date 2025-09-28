/* eslint-disable react/prop-types */
import React from "react";
// --- CORRECCIÓN FINAL: Se importa el componente con su nombre real: QRCodeCanvas ---
import { QRCodeCanvas } from "qrcode.react";
import { Modal } from "./Modal";

export function QrCodeModal({ open, onClose, url }) {
  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Escanear para subir foto">
      <div className="text-center p-4">
        <p className="text-slate-600 mb-4">
          Escanea este código QR con la cámara de tu móvil para abrir la página de subida de fotos.
        </p>
        <div className="bg-white p-4 inline-block rounded-lg border">
            {/* --- CORRECCIÓN FINAL: Se usa el componente QRCodeCanvas --- */}
            <QRCodeCanvas value={url} size={256} />
        </div>
        <p className="text-slate-500 text-xs mt-4">
          La foto aparecerá aquí automáticamente después de subirla.
        </p>
      </div>
    </Modal>
  );
}