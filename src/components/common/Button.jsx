// src/components/common/Button.jsx (versión sugerida)

/* eslint-disable react/prop-types */
import React from "react";

const styleVariants = {
  primary: 'px-4 py-2 rounded-lg bg-francia-600 hover:bg-francia-700 text-white font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md',
  secondary: 'px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors duration-200 flex items-center justify-center gap-2',
  icon: 'p-2 rounded-lg hover:bg-slate-100 transition-colors duration-200 text-slate-600',
  iconDanger: 'p-2 rounded-lg hover:bg-red-50 transition-colors duration-200 text-red-600',
};

export function Button({ children, variant = 'secondary', className, ...props }) {
  const buttonClasses = styleVariants[variant] || styleVariants.secondary;
  const disabledClasses = props.disabled ? "opacity-50 cursor-not-allowed" : "";

  return (
    <button className={`${buttonClasses} ${className || ''} ${disabledClasses}`} {...props}>
      {children}
    </button>
  );
}