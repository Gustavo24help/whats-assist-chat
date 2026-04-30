import React from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import App from "./App.tsx";
import "./index.css";
import { initSystemLogger, logSystemEvent } from "@/lib/systemLogger";

// Inicializa logger de sistema (captura console.error/warn, fetch falhas, erros não tratados)
initSystemLogger();

// Handler global para erros assíncronos não tratados
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  event.preventDefault();
});

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Toaster 
      position="top-right" 
      closeButton 
      expand={true}
      visibleToasts={6}
      richColors 
      style={{ zIndex: 999999 }}
      toastOptions={{
        duration: 6000,
        className: 'shadow-lg rounded-xl'
      }}
    />
  </>
);
