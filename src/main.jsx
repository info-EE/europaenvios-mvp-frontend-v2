import React from "react";
import { createRoot } from "react-dom/client";

// Import defensivo: toma default o named export
import * as AppModule from "./App";
const RootApp = AppModule?.default ?? AppModule?.App;

if (!RootApp) {
  // Esto evita la pantalla en blanco silente y te deja un error claro en consola.
  throw new Error(
    'No se encontró el componente App. Asegúrate de que "src/App.jsx" exporte `export default App` (o `export const App = ...`).'
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);
