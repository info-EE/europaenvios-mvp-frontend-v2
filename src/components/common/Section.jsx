/* eslint-disable react/prop-types */
import React from "react";

export function Section({ title, right, children }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-xl font-bold text-slate-800">{title}</h2>
        <div className="flex items-center gap-2">{right}</div>
      </div>
      {children}
    </div>
  );
}