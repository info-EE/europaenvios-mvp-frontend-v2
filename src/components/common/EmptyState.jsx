/* eslint-disable react/prop-types */
import React from "react";

export function EmptyState({ icon, title, message }) {
  return (
    <div className="text-center py-10 px-4 border-2 border-dashed border-slate-200 rounded-lg">
      <div className="mx-auto w-12 h-12 text-slate-400">{icon}</div>
      <h3 className="mt-2 text-lg font-medium text-slate-800">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{message}</p>
    </div>
  );
}