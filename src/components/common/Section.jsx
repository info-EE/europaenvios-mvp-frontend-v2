/* eslint-disable react/prop-types */
import React from "react";

export function Section({ title, right, children }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-xl font-bold text-slate-800 flex-shrink-0">{title}</h2>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
          {right}
        </div>
      </div>
      {children}
    </div>
  );
}