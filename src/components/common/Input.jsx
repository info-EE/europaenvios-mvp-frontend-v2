/* eslint-disable react/prop-types */
import React from "react";

export function Input({ className, ...props }) {
  const baseClasses = "w-full text-sm rounded-lg border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-francia-500 focus:border-francia-500 transition-all";

  return (
    <input {...props} className={`${baseClasses} ${className || ""}`} />
  );
}