/* eslint-disable react/prop-types */
import React from "react";

export function Field({ label, required, children }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </div>
      {children}
    </label>
  );
}