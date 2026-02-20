import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import {
  MessageCircle,
  BarChart3,
  Settings,
  LogOut,
  ArrowRight,
  Users,
  Wrench,
  ClipboardList,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Home = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth");
  };

  const firstName = userProfile?.fullName?.split(" ")[0] || "Usuário";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex flex-col">
      <header className="h-16 border-b bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 shadow-sm">
        <Logo />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>
            <Settings className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Configurações</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Sair</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">Olá, {firstName}!</h1>
          <p className="text-lg text-muted-foreground">O que deseja fazer hoje?</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 max-w-6xl w-full">
          <button
            onClick={() => navigate("/chat")}
            className="group saas-card p-8 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-xl border-2 border-transparent hover:border-brand-green/30 animate-slide-up"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="icon-container brand-green mb-6">
              <MessageCircle className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2 group-hover:text-brand-green transition-colors">
              Chat de Atendimento
            </h2>
            <p className="text-muted-foreground mb-6">
              Gerencie conversas do WhatsApp, fichas de serviço e atendimento aos clientes.
            </p>
            <div className="flex items-center text-brand-green font-medium">
              Acessar
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          <button
            onClick={() => navigate("/dashboard")}
            className="group saas-card p-8 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-xl border-2 border-transparent hover:border-brand-yellow/30 animate-slide-up"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="icon-container brand-yellow mb-6">
              <BarChart3 className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2 group-hover:text-brand-yellow transition-colors">
              Dashboard de Resultados
            </h2>
            <p className="text-muted-foreground mb-6">
              Visualize métricas, KPIs e acompanhe o desempenho do seu negócio.
            </p>
            <div className="flex items-center text-brand-yellow font-medium">
              Acessar
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          <button
            onClick={() => navigate("/gerenciamento-prestadores")}
            className="group saas-card p-8 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-xl border-2 border-transparent hover:border-brand-green/30 animate-slide-up"
            style={{ animationDelay: "0.3s" }}
          >
            <div className="icon-container brand-green mb-6">
              <Users className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2 group-hover:text-brand-green transition-colors">
              Gerenciamento de Prestadores
            </h2>
            <p className="text-muted-foreground mb-6">
              Centralize o cadastro de prestadores e evolua com integrações de dados relevantes.
            </p>
            <div className="flex items-center text-brand-green font-medium">
              Acessar
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          <button
            onClick={() => navigate("/analise-servicos")}
            className="group saas-card p-8 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-xl border-2 border-transparent hover:border-brand-yellow/30 animate-slide-up"
            style={{ animationDelay: "0.4s" }}
          >
            <div className="icon-container brand-yellow mb-6">
              <ClipboardList className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2 group-hover:text-brand-yellow transition-colors">
              Análise de Serviços
            </h2>
            <p className="text-muted-foreground mb-6">
              Consulte o painel que hoje está no Geral do Chat para acompanhar serviços e indicadores.
            </p>
            <div className="flex items-center text-brand-yellow font-medium">
              Acessar
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          <button
            onClick={() => navigate("/manutencao")}
            className="group saas-card p-8 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-xl border-2 border-transparent hover:border-brand-green/30 animate-slide-up"
            style={{ animationDelay: "0.5s" }}
          >
            <div className="icon-container brand-green mb-6">
              <Wrench className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2 group-hover:text-brand-green transition-colors">
              Manutenção
            </h2>
            <p className="text-muted-foreground mb-6">
              Reúna Minha Conta, Gerenciar Usuários e Ferramentas em um único ambiente.
            </p>
            <div className="flex items-center text-brand-green font-medium">
              Acessar
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>
        </div>
      </main>

      <footer className="py-4 text-center text-sm text-muted-foreground border-t bg-background/50">
        24Help © {new Date().getFullYear()} — Sistema de Atendimento
      </footer>
    </div>
  );
};

export default Home;
