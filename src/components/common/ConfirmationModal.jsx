/* eslint-disable react/prop-types */
import React from "react";
import { Modal } from "./Modal.jsx";
import { Button } from "./Button.jsx";

/**
 * Un modal para pedir confirmación al usuario (Sí/No).
 * Reemplaza a window.confirm()
 */
export function ConfirmationModal({ open, onClose, onConfirm, title, children }) {
  if (!open) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-slate-600 mb-6">{children}</div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleConfirm} autoFocus>
          Confirmar
        </Button>
      </div>
    </Modal>
  );
}