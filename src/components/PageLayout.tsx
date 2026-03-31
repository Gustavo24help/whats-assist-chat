import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOpenInNewTab } from "@/hooks/useOpenInNewTab";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageCircle,
  BarChart3,
  Settings,
  LogOut,
  Users,
  Wrench,
  ClipboardList,
  MessageSquare,
  DollarSign,
  Clock3,
  FileText,
  FileSpreadsheet,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Tv,
  Bell,
  MapPin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SIDEBAR_KEY = "home-sidebar-collapsed";

const sidebarItems = [
  { label: "Início", icon: Bell, route: "/" },
  { label: "Chat de Atendimento", icon: MessageCircle, route: "/chat" },
  { label: "Chat Prestadores", icon: Wrench, route: "/chat-prestadores" },
  { label: "Dashboard", icon: BarChart3, route: "/dashboard" },
  { label: "Dashboard TV", icon: Tv, route: "/dashboard-tv" },
  { label: "Gerenc. Prestadores", icon: Users, route: "/gerenciamento-prestadores" },
  { label: "Análise de Serviços", icon: ClipboardList, route: "/analise-servicos" },
  { label: "Financeiro", icon: DollarSign, route: "/financeiro" },
  { label: "Calendário", icon: CalendarDays, route: "/calendario" },
  { label: "Fichas de Serviço", icon: FileText, route: "/fichas" },
  { label: "Planilha", icon: FileSpreadsheet, route: "/planilha" },
  { label: "Registro de Ponto", icon: Clock3, route: "/registro-ponto" },
  { label: "Mensagens Internas", icon: MessageSquare, route: "/mensagens" },
  { label: "Tarefas", icon: ClipboardList, route: "/tarefas" },
  { label: "Bairros", icon: MapPin, route: "/bairros" },
  { label: "Prestadores", icon: Users, route: "/prestadores" },
  { label: "Manutenção", icon: Wrench, route: "/manutencao" },
  { label: "Configurações", icon: Settings, route: "/settings" },
];

interface PageLayoutProps {
  children: React.ReactNode;
  /** If true, content takes full height with no overflow wrapper */
  fullHeight?: boolean;
}

export function PageLayout({ children, fullHeight = false }: PageLayoutProps) {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { openRoute } = useOpenInNewTab();

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === "true"; } catch { return false; }
  });

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_KEY, String(next)); } catch {}
      return next;
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth");
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "h-screen sticky top-0 flex flex-col border-r border-gray-200 transition-all duration-200 bg-brand-coral shrink-0 z-40",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo + collapse */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-white/20 shrink-0">
          {!collapsed && (
            <button onClick={() => navigate("/")} className="text-lg font-bold tracking-tight text-white hover:opacity-80 transition-opacity">
              24help
            </button>
          )}
          <Button variant="ghost" size="icon" onClick={toggleCollapsed} className="h-8 w-8 shrink-0 text-white hover:bg-white/20">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Nav items */}
        <ScrollArea className="flex-1 py-2">
          <nav className="flex flex-col gap-0.5 px-2">
            {sidebarItems.map(item => (
              <button
                key={item.route}
                onClick={() => openRoute(item.route)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-white hover:bg-white/20 transition-colors group text-left",
                  collapsed && "justify-center px-0"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0 text-white" />
                {!collapsed && (
                  <>
                    <span className="truncate flex-1">{item.label}</span>
                    <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                  </>
                )}
              </button>
            ))}
          </nav>
        </ScrollArea>

        {/* Footer: user + logout */}
        <div className="border-t border-white/20 p-3 shrink-0">
          {!collapsed && (
            <p className="text-xs text-white/70 truncate mb-2">{userProfile?.fullName || "Usuário"}</p>
          )}
          <Button variant="ghost" size={collapsed ? "icon" : "sm"} onClick={handleLogout} className="w-full justify-start gap-2 text-white hover:bg-white/20">
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sair</span>}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className={cn(
        "flex-1 flex flex-col min-w-0",
        fullHeight ? "h-screen" : "min-h-screen"
      )}>
        {children}
      </main>
    </div>
  );
}
