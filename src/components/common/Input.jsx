/* eslint-disable react/prop-types */
import React from "react";

export function Input({ className, type, onChange, ...props }) {
  const baseClasses = "w-full text-sm rounded-lg border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-francia-500 focus:border-francia-500 transition-all";
  
  // Determine if the input's text should be transformed to uppercase.
  // We exclude certain types like email, password, or date.
  const isTransformable = type !== 'email' && type !== 'password' && type !== 'date';
  const finalClassName = `${baseClasses} ${isTransformable ? 'uppercase' : ''} ${className || ""}`;

  const handleInputChange = (e) => {
    // If an onChange handler is passed as a prop, we process the value.
    if (onChange) {
      // For text-like inputs, we convert the value to uppercase.
      if (isTransformable) {
        e.target.value = e.target.value.toUpperCase();
      }
      // We then call the original onChange handler with the (potentially modified) event.
      onChange(e);
    }
  };

  return (
    <input {...props} type={type} onChange={handleInputChange} className={finalClassName} />
  );
}