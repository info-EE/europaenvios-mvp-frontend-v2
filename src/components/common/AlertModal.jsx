/* eslint-disable react/prop-types */
import React from "react";
import { Modal } from "./Modal.jsx";
import { Button } from "./Button.jsx";

/**
 * Un modal para mostrar mensajes de alerta simples.
 * Reemplaza a window.alert()
 */
export function AlertModal({ open, onClose, title, children }) {
  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-slate-600 mb-6">{children}</div>
      <div className="flex justify-end">
        <Button variant="primary" onClick={onClose} autoFocus>
          Aceptar
        </Button>
      </div>
    </Modal>
  );
}