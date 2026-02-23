import React from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import App from "./App.tsx";
import "./index.css";

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
      expand={false} 
      richColors 
      toastOptions={{
        duration: 4000,
        className: 'shadow-lg rounded-xl'
      }}
    />
  </>
);
