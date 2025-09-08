import React from "react";
import { createRoot } from "react-dom/client";

// Import explícito y tolerante (default o named)
import AppDefault, { App as AppNamed } from "./App.jsx";
const RootApp = AppDefault ?? AppNamed;

if (!RootApp) {
  // Si volviera a fallar, verás este error en consola en vez de quedar pantalla blanca.
  throw new Error(
    'No se encontró el componente App. Asegúrate de tener `export default App` al final de src/App.jsx (o `export const App = ...`).'
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);
