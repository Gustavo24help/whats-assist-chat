import React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { VisualModeProvider } from "@/contexts/VisualModeContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { AvisoPopupOverlay } from "@/components/AvisoPopupOverlay";
import { TarefaPopupOverlay } from "@/components/TarefaPopupOverlay";
import { InternalMessagePopupOverlay } from "@/components/InternalMessagePopupOverlay";
import { AtribuicaoOperadorPopup } from "@/components/AtribuicaoOperadorPopup";
import { TarefaOpPopupOverlay } from "@/components/TarefaOpPopupOverlay";
import { InactivityWarningModal } from "@/components/InactivityWarningModal";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { ExitReminderPopup } from "@/components/ExitReminderPopup";
import { useExitReminder } from "@/hooks/useExitReminder";
import { PontoEndModal } from "@/components/PontoEndModal";
import { usePontoClock } from "@/hooks/usePontoClock";
import { redistributeChats } from "@/hooks/useLogoutRedistribution";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Home from "./pages/Home";
import { FichaWhatsAppDemo } from "./components/FichaWhatsApp";
import Chat from "./pages/Chat";
import ChatBeta from "./pages/ChatBeta";
import MobileChat from "./pages/MobileChat";
import { useIsMobile } from "@/hooks/use-mobile";
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
import TarefasOperacionais from "./pages/TarefasOperacionais";
import AdminPrestadorPortal from "./pages/AdminPrestadorPortal";
import VisibilitySettings from "./pages/VisibilitySettings";
import SystemLogs from "./pages/SystemLogs";
import SystemLogsFicha from "./pages/SystemLogsFicha";
import LogsPagamento from "./pages/LogsPagamento";
import Orcamentos from "./pages/Orcamentos";
import ContasReceber from "./pages/ContasReceber";
import ContasPagar from "./pages/ContasPagar";
import PagamentosOrfaos from "./pages/PagamentosOrfaos";


const queryClient = new QueryClient();

// Rotas públicas onde NÃO deve rodar hooks de inatividade/ponto/exit reminder.
// Acessadas por prestadores/clientes sem login (via WhatsApp).
const isPublicRoute = (pathname: string): boolean => {
  const p = decodeURIComponent(pathname || "").toLowerCase();
  return (
    p.startsWith("/orcamento") ||
    p.startsWith("/or%c3%a7amento") ||
    p.startsWith("/orçamento") ||
    p.startsWith("/prestador") ||
    p.startsWith("/auth") ||
    p.startsWith("/ficha-whatsapp-demo")
  );
};

const InactivityHooks = () => {
  const { showWarning, minutesLeft, dismissWarning } = useInactivityLogout();
  const { showReminder, exitTime, dismiss: dismissReminder } = useExitReminder();
  const { showEndModal, dismissEndModal } = usePontoClock();
  const navigate = useNavigate();

  const handleExitLogout = async () => {
    dismissReminder();
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      try { await redistributeChats(user.id); } catch {}
    }
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <>
      <InactivityWarningModal open={showWarning} minutesLeft={minutesLeft} onDismiss={dismissWarning} />
      <ExitReminderPopup open={showReminder} exitTime={exitTime} onDismiss={dismissReminder} onLogout={handleExitLogout} />
      <PontoEndModal open={showEndModal} onContinue={dismissEndModal} />
    </>
  );
};

const InactivityWrapper = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const skip = isPublicRoute(location.pathname);

  return (
    <>
      {!skip && <InactivityHooks />}
      {children}
    </>
  );
};

// Roteador transparente: em <768px renderiza a versão mobile do chat,
// em telas maiores renderiza a versão desktop original.
const ChatRouter = ({ desktop }: { desktop: React.ReactElement }) => {
  const isMobile = useIsMobile();
  return isMobile ? <MobileChat /> : desktop;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <VisualModeProvider>
        <BrowserRouter>
          <AuthProvider>
            <NotificationProvider>
              <InactivityWrapper>
              <AvisoPopupOverlay />
              <TarefaPopupOverlay />
              <InternalMessagePopupOverlay />
              <AtribuicaoOperadorPopup />
              <TarefaOpPopupOverlay />
              <Routes>
              <Route path="/auth" element={<Auth />} />
              {/* Rotas públicas de orçamento — TODAS as variantes devem abrir sem login */}
              <Route path="/orcamento" element={<OrcamentoPublico />} />
              <Route path="/orcamento/" element={<OrcamentoPublico />} />
              <Route path="/orcamento/:fichaId" element={<OrcamentoPublico />} />
              <Route path="/orcamento/:fichaId/*" element={<OrcamentoPublico />} />
              <Route path="/orcamento/*" element={<OrcamentoPublico />} />
              {/* Variante com acento (caso copiado/colado de algum lugar) */}
              <Route path="/or%C3%A7amento" element={<OrcamentoPublico />} />
              <Route path="/or%C3%A7amento/:fichaId" element={<OrcamentoPublico />} />
              <Route path="/ficha-whatsapp-demo" element={<FichaWhatsAppDemo />} />
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
                    <ChatRouter desktop={<Chat />} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chat-beta"
                element={
                  <ProtectedRoute>
                    <ChatRouter desktop={<ChatBeta />} />
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
              <Route
                path="/settings/visibility"
                element={
                  <ProtectedRoute>
                    <VisibilitySettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/system-logs"
                element={
                  <ProtectedRoute>
                    <SystemLogs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/system-logs/:fichaId"
                element={
                  <ProtectedRoute>
                    <SystemLogsFicha />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/logs-pagamento"
                element={
                  <ProtectedRoute>
                    <LogsPagamento />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin-prestador"
                element={
                  <ProtectedRoute>
                    <AdminPrestadorPortal />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orcamentos"
                element={
                  <ProtectedRoute>
                    <Orcamentos />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/contas-receber"
                element={
                  <ProtectedRoute>
                    <ContasReceber />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/contas-pagar"
                element={
                  <ProtectedRoute>
                    <ContasPagar />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/financeiro/pagamentos-orfaos"
                element={
                  <ProtectedRoute>
                    <PagamentosOrfaos />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tarefas-operacionais"
                element={
                  <ProtectedRoute>
                    <TarefasOperacionais />
                  </ProtectedRoute>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
                          </Routes>
              </InactivityWrapper>
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </VisualModeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
