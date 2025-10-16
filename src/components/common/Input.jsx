/* eslint-disable react/prop-types */
import React from "react";

export function Input({ className, type, onChange, numericFormat, ...props }) {
  const baseClasses = "w-full text-sm rounded-lg border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-francia-500 focus:border-francia-500 transition-all";
  
  const isPasswordInput = props.autoComplete === 'current-password';

  const isTransformable = !isPasswordInput && type !== 'email' && type !== 'password' && type !== 'date';
  const finalClassName = `${baseClasses} ${isTransformable ? 'uppercase' : ''} ${className || ""}`;

  const handleInputChange = (e) => {
    if (onChange) {
      let { value } = e.target;

      // Si se especifica el formato numérico, reemplaza puntos por comas.
      if (numericFormat === 'comma') {
        value = value.replace(/\./g, ',');
      }

      if (isTransformable) {
        value = value.toUpperCase();
      }
      
      e.target.value = value;
      onChange(e);
    }
  };

  return (
    <input {...props} type={type} onChange={handleInputChange} className={finalClassName} />
  );
}