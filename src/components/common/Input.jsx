/* eslint-disable react/prop-types */
import React from "react";

export function Input({ className, type, onChange, ...props }) {
  const baseClasses = "w-full text-sm rounded-lg border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-francia-500 focus:border-francia-500 transition-all";
  
  // FIX: The original logic converted password fields to uppercase when their type was changed to "text" (to show the password).
  // This new logic explicitly checks if the input is a password field by looking at the `autoComplete` prop,
  // which is set to "current-password" in your `PasswordInput` component.
  // This ensures that password fields are NEVER transformed to uppercase.
  const isPasswordInput = props.autoComplete === 'current-password';

  // Determine if the input's text should be transformed to uppercase.
  // We exclude password fields, emails, and dates.
  const isTransformable = !isPasswordInput && type !== 'email' && type !== 'password' && type !== 'date';
  const finalClassName = `${baseClasses} ${isTransformable ? 'uppercase' : ''} ${className || ""}`;

  const handleInputChange = (e) => {
    // If an onChange handler is passed as a prop, we process the value.
    if (onChange) {
      // For text-like inputs that are transformable, we convert the value to uppercase.
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