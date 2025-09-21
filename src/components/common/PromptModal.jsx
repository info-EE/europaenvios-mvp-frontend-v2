/* eslint-disable react/prop-types */
import React, { useState, useEffect } from "react";
import { Modal } from "./Modal.jsx";
import { Button } from "./Button.jsx";
import { Input } from "./Input.jsx";
import { Field } from "./Field.jsx";

/**
 * Un modal para solicitar texto al usuario.
 * Reemplaza a window.prompt()
 */
export function PromptModal({ open, onClose, onConfirm, title, message, inputLabel, initialValue = "" }) {
  const [value, setValue] = useState(initialValue);

  // Reinicia el valor del input cuando el modal se abre
  useEffect(() => {
    if (open) {
      setValue(initialValue);
    }
  }, [open, initialValue]);

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm(value);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        {message && <p className="text-slate-600">{message}</p>}
        <Field label={inputLabel || ""}>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            autoFocus
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleConfirm}>
          Aceptar
        </Button>
      </div>
    </Modal>
  );
}