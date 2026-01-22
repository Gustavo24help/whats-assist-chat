import React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { VisualModeProvider } from "@/contexts/VisualModeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import FichasGeral from "./pages/FichasGeral";
import BairrosReport from "./pages/BairrosReport";
import OrcamentoPublico from "./pages/OrcamentoPublico";
import PrestadorPortal from "./pages/PrestadorPortal";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <VisualModeProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/orcamento" element={<OrcamentoPublico />} />
              <Route path="/prestador" element={<PrestadorPortal />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chat"
                element={
                  <ProtectedRoute>
                    <Chat />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/geral"
                element={
                  <ProtectedRoute>
                    <FichasGeral />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bairros"
                element={
                  <ProtectedRoute>
                    <BairrosReport />
                  </ProtectedRoute>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </VisualModeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
