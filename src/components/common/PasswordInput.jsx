/* eslint-disable react/prop-types */
import React, { useState } from "react";
import { Input } from "./Input";

export function PasswordInput(props) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        {...props}
        type={show ? "text" : "password"}
        autoComplete="current-password"
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-600 font-semibold"
        onClick={() => setShow((s) => !s)}
      >
        {show ? "Ocultar" : "Ver"}
      </button>
    </div>
  );
}