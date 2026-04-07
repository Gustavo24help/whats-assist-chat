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
  ChevronDown,
  Tv,
  Bell,
  MapPin,
  ExternalLink,
  Smartphone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { redistributeChats } from "@/hooks/useLogoutRedistribution";

const SIDEBAR_KEY = "home-sidebar-collapsed";
const SIDEBAR_GROUPS_KEY = "home-sidebar-groups";

interface SidebarItem {
  label: string;
  icon: any;
  route?: string;
  externalUrl?: string;
}

interface SidebarGroup {
  label: string;
  icon: any;
  items: SidebarItem[];
}

type SidebarEntry = SidebarItem | SidebarGroup;

function isGroup(entry: SidebarEntry): entry is SidebarGroup {
  return "items" in entry;
}

const sidebarEntries: SidebarEntry[] = [
  { label: "Início", icon: Bell, route: "/" },
  { label: "Chat de Atendimento", icon: MessageCircle, route: "/chat" },
  { label: "Chat Prestadores", icon: Wrench, route: "/chat-prestadores" },
  {
    label: "Relatórios",
    icon: BarChart3,
    items: [
      { label: "Dashboard", icon: BarChart3, route: "/dashboard" },
      { label: "Dashboard TV", icon: Tv, route: "/dashboard-tv" },
      { label: "Análise de Serviços", icon: ClipboardList, route: "/analise-servicos" },
    ],
  },
  {
    label: "Serviços",
    icon: FileText,
    items: [
      { label: "Fichas de Serviço", icon: FileText, route: "/fichas" },
      { label: "Orçamentos", icon: ClipboardList, route: "/orcamentos" },
      { label: "Calendário", icon: CalendarDays, route: "/calendario" },
    ],
  },
  {
    label: "Prestadores",
    icon: Users,
    items: [
      { label: "Prestadores", icon: Users, route: "/prestadores" },
      { label: "App Prestadores", icon: Smartphone, route: "/admin-prestador" },
      { label: "Gerenc. Prestadores", icon: Wrench, route: "/gerenciamento-prestadores" },
    ],
  },
  {
    label: "Financeiro",
    icon: DollarSign,
    items: [
      { label: "Financeiro", icon: DollarSign, route: "/financeiro" },
      { label: "Contas a Receber", icon: DollarSign, route: "/contas-receber" },
      { label: "Planilha", icon: FileSpreadsheet, route: "/planilha" },
    ],
  },
  {
    label: "Pessoas",
    icon: Clock3,
    items: [
      { label: "Registro de Ponto", icon: Clock3, route: "/registro-ponto" },
      { label: "Mensagens Internas", icon: MessageSquare, route: "/mensagens" },
    ],
  },
  { label: "Tarefas", icon: ClipboardList, route: "/tarefas" },
  { label: "Tarefas Operacionais", icon: ClipboardList, route: "/tarefas-operacionais" },
  { label: "Bairros", icon: MapPin, route: "/bairros" },
  {
    label: "Configurações",
    icon: Settings,
    items: [
      { label: "Configurações", icon: Settings, route: "/settings" },
      { label: "Manutenção", icon: Wrench, route: "/manutencao" },
    ],
  },
];

interface PageLayoutProps {
  children: React.ReactNode;
  fullHeight?: boolean;
}

export function PageLayout({ children, fullHeight = false }: PageLayoutProps) {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { openRoute } = useOpenInNewTab();

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === "true"; } catch { return false; }
  });

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_GROUPS_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_KEY, String(next)); } catch {}
      return next;
    });
  };

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => {
      const next = { ...prev, [label]: !prev[label] };
      try { localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handleLogout = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser?.id) {
      try {
        await redistributeChats(currentUser.id);
      } catch (err) {
        console.error("Erro ao redistribuir chats:", err);
      }
    }
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth");
  };

  const handleItemClick = (item: SidebarItem) => {
    if (item.externalUrl) {
      window.open(item.externalUrl, "_blank");
    } else if (item.route) {
      openRoute(item.route);
    }
  };

  const renderItem = (item: SidebarItem, indent = false) => (
    <button
      key={item.route || item.externalUrl || item.label}
      onClick={() => handleItemClick(item)}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white hover:bg-white/20 transition-colors group text-left w-full",
        collapsed && "justify-center px-0",
        indent && !collapsed && "pl-8"
      )}
    >
      <item.icon className="h-4 w-4 shrink-0 text-white" />
      {!collapsed && (
        <>
          <span className="truncate flex-1">{item.label}</span>
          {item.externalUrl && <ExternalLink className="h-3 w-3 opacity-40 shrink-0" />}
          {!item.externalUrl && <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />}
        </>
      )}
    </button>
  );

  const renderGroup = (group: SidebarGroup) => {
    const isOpen = !!openGroups[group.label];

    if (collapsed) {
      // In collapsed mode, show only the group icon — clicking expands sidebar
      return (
        <button
          key={group.label}
          onClick={() => { toggleCollapsed(); toggleGroup(group.label); }}
          title={group.label}
          className="flex items-center justify-center rounded-md py-2 text-sm text-white hover:bg-white/20 transition-colors w-full"
        >
          <group.icon className="h-4 w-4 shrink-0 text-white" />
        </button>
      );
    }

    return (
      <div key={group.label}>
        <button
          onClick={() => toggleGroup(group.label)}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white hover:bg-white/20 transition-colors w-full text-left"
        >
          <group.icon className="h-4 w-4 shrink-0 text-white" />
          <span className="truncate flex-1 font-medium">{group.label}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 text-white/60 transition-transform shrink-0", isOpen && "rotate-180")} />
        </button>
        {isOpen && (
          <div className="flex flex-col gap-0.5 mt-0.5">
            {group.items.map(item => renderItem(item, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside
        className={cn(
          "h-screen sticky top-0 flex flex-col border-r border-gray-200 transition-all duration-200 bg-brand-coral shrink-0 z-40",
          collapsed ? "w-16" : "w-60"
        )}
      >
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

        <ScrollArea className="flex-1 py-2">
          <nav className="flex flex-col gap-0.5 px-2">
            {sidebarEntries.map(entry =>
              isGroup(entry) ? renderGroup(entry) : renderItem(entry)
            )}
          </nav>
        </ScrollArea>

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

      <main className={cn(
        "flex-1 flex flex-col min-w-0",
        fullHeight ? "h-screen" : "min-h-screen"
      )}>
        {children}
      </main>
    </div>
  );
}
