import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ModalProvider } from "./context/ModalContext.jsx";
import { PhotoUploadPage } from "./components/pages/PhotoUploadPage.jsx";

const root = createRoot(document.getElementById("root"));

const path = window.location.pathname;
const isUploadPage = path.startsWith('/upload/');

// Si la URL es para la página de subida, renderiza solo ese componente.
if (isUploadPage) {
  const sessionId = path.split('/')[2];
  root.render(
    <React.StrictMode>
      <PhotoUploadPage sessionId={sessionId} />
    </React.StrictMode>
  );
} else {
  // De lo contrario, carga la aplicación principal completa.
  root.render(
    <React.StrictMode>
      <ModalProvider>
        <App />
      </ModalProvider>
    </React.StrictMode>
  );
}