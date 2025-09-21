/* eslint-disable react/prop-types */
import React from "react";
import { Button } from "./Button";

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] overflow-auto flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <Button onClick={onClose}>Cerrar</Button>
        </div>
        <div className="p-4 sm:p-6 flex-grow">{children}</div>
      </div>
    </div>
  );
}