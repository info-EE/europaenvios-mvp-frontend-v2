/* eslint-disable react/prop-types */
import React from "react";
import { Button } from "./Button";

export function Modal({ open, onClose, title, children, maxWidth = "max-w-lg" }) {
  if (!open) return null;

  // Detener la propagación para evitar que el clic dentro del modal lo cierre
  const handleModalContentClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose} // Cierra el modal si se hace clic en el fondo
    >
      <div 
        className={`bg-white rounded-2xl shadow-xl w-full ${maxWidth} max-h-[92vh] overflow-auto flex flex-col`}
        onClick={handleModalContentClick}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <Button 
            onClick={onClose} 
            className="!p-1.5 h-auto text-slate-500 hover:bg-slate-200"
            aria-label="Cerrar modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
        <div className="p-4 sm:p-6 flex-grow">{children}</div>
      </div>
    </div>
  );
}