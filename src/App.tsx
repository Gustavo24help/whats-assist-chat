import React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { VisualModeProvider } from "@/contexts/VisualModeContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { AvisoPopupOverlay } from "@/components/AvisoPopupOverlay";
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
import PrestadoresReport from "./pages/PrestadoresReport";
import DashboardTV from "./pages/DashboardTV";
import GerenciamentoPrestadores from "./pages/GerenciamentoPrestadores";
import PrestadorDetalhes from "./pages/PrestadorDetalhes";
import AnaliseServicos from "./pages/AnaliseServicos";
import Manutencao from "./pages/Manutencao";
import Avisos from "./pages/Avisos";
import MensagensInternas from "./pages/MensagensInternas";
import Financeiro from "./pages/Financeiro";
import UserDetails from "./pages/UserDetails";
import Fichas from "./pages/Fichas";
import FichaDetalhes from "./pages/FichaDetalhes";
import RegistroPontoPage from "./pages/RegistroPonto";
import Planilha from "./pages/Planilha";
import PlanilhaControleFinanceiro from "./pages/PlanilhaControleFinanceiro";
import PlanilhaControlePagamentos from "./pages/PlanilhaControlePagamentos";
import Calendario from "./pages/Calendario";
import ChatPrestadores from "./pages/ChatPrestadores";
import Tarefas from "./pages/Tarefas";
import VisibilitySettings from "./pages/VisibilitySettings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <VisualModeProvider>
        <BrowserRouter>
          <AuthProvider>
            <NotificationProvider>
              <AvisoPopupOverlay />
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
                path="/settings/users/:userId"
                element={
                  <ProtectedRoute>
                    <UserDetails />
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
                path="/analise-servicos"
                element={
                  <ProtectedRoute>
                    <AnaliseServicos />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/gerenciamento-prestadores"
                element={
                  <ProtectedRoute>
                    <GerenciamentoPrestadores />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/gerenciamento-prestadores/:cpf"
                element={
                  <ProtectedRoute>
                    <PrestadorDetalhes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manutencao"
                element={
                  <ProtectedRoute>
                    <Manutencao />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/avisos"
                element={
                  <ProtectedRoute>
                    <Avisos />
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
              <Route
                path="/prestadores"
                element={
                  <ProtectedRoute>
                    <PrestadoresReport />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard-tv"
                element={
                  <ProtectedRoute>
                    <DashboardTV />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/mensagens"
                element={
                  <ProtectedRoute>
                    <MensagensInternas />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/planilha"
                element={
                  <ProtectedRoute>
                    <Planilha />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/planilha/controle-financeiro"
                element={
                  <ProtectedRoute>
                    <PlanilhaControleFinanceiro />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/planilha/controle-pagamentos"
                element={
                  <ProtectedRoute>
                    <PlanilhaControlePagamentos />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/financeiro"
                element={
                  <ProtectedRoute>
                    <Financeiro />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/registro-ponto"
                element={
                  <ProtectedRoute>
                    <RegistroPontoPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/fichas"
                element={
                  <ProtectedRoute>
                    <Fichas />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ficha/:fichaId"
                element={
                  <ProtectedRoute>
                    <FichaDetalhes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calendario"
                element={
                  <ProtectedRoute>
                    <Calendario />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chat-prestadores"
                element={
                  <ProtectedRoute>
                    <ChatPrestadores />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tarefas"
                element={
                  <ProtectedRoute>
                    <Tarefas />
                  </ProtectedRoute>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
                          </Routes>
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </VisualModeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
