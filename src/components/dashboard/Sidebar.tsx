import React from 'react';
import { cn } from '@/lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Monitor,
  Megaphone,
  TrendingUp,
  Headphones,
  FileBarChart,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  MapPin,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import logoGreen from '@/assets/logo-green.png';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  badge?: number;
}

const mainNavItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Dashboard TV', icon: Monitor, path: '/dashboard-tv' },
  { label: 'Chat', icon: MessageCircle, path: '/chat' },
  { label: 'Prestadores', icon: Users, path: '/prestadores' },
  { label: 'Bairros', icon: MapPin, path: '/bairros' },
  // Estas rotas ainda não existem como páginas separadas; manter como acesso ao dashboard principal
  { label: 'Marketing', icon: Megaphone, path: '/dashboard' },
  { label: 'Vendas', icon: TrendingUp, path: '/dashboard' },
  { label: 'Atendimento', icon: Headphones, path: '/dashboard' },
  { label: 'Relatórios', icon: FileBarChart, path: '/dashboard' },
];

const footerNavItems: NavItem[] = [
  { label: 'Configurações', icon: Settings, path: '/settings' },
  { label: 'Ajuda', icon: HelpCircle, path: '/settings' },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  className?: string;
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
}

export const Sidebar = ({
  collapsed = false,
  onToggle,
  className,
  user = { name: 'Usuário', email: 'usuario@24help.com.br' },
}: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const NavButton = ({ item }: { item: NavItem }) => (
    <Button
      variant="ghost"
      className={cn(
        'w-full justify-start gap-3 h-11 px-3 transition-all duration-200',
        isActive(item.path)
          ? 'bg-brand-green/10 text-brand-green hover:bg-brand-green/15'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
        collapsed && 'justify-center px-0'
      )}
      onClick={() => navigate(item.path)}
    >
      <item.icon className={cn('h-5 w-5 shrink-0', isActive(item.path) && 'text-brand-green')} />
      {!collapsed && (
        <span className="font-medium truncate">{item.label}</span>
      )}
      {!collapsed && item.badge && (
        <span className="ml-auto bg-brand-red text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {item.badge}
        </span>
      )}
    </Button>
  );

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 bottom-0 z-50 flex flex-col bg-background border-r shadow-sm transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center h-16 border-b px-4',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        <Button
          variant="ghost"
          className={cn('h-auto p-0 hover:bg-transparent', collapsed && 'rounded-full')}
          onClick={() => navigate('/')}
          aria-label="Voltar para a página inicial"
        >
          {!collapsed && (
            <img src={logoGreen} alt="24Help" className="h-8 w-auto" />
          )}
          {collapsed && (
            <div className="h-8 w-8 rounded-full bg-brand-green flex items-center justify-center">
              <span className="text-white font-bold text-sm">24</span>
            </div>
          )}
        </Button>
        {onToggle && (
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8 shrink-0', collapsed && 'absolute -right-3 top-6 bg-background border shadow-sm')}
            onClick={onToggle}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {mainNavItems.map((item) => (
          <NavButton key={`${item.label}-${item.path}`} item={item} />
        ))}
      </nav>

      {/* Footer Navigation */}
      <div className="border-t py-4 px-2 space-y-1">
        {footerNavItems.map((item) => (
          <NavButton key={`${item.label}-${item.path}`} item={item} />
        ))}
      </div>

      {/* User Profile */}
      <div className={cn(
        'border-t p-4 flex items-center gap-3',
        collapsed && 'justify-center p-2'
      )}>
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={user.avatar} />
          <AvatarFallback className="bg-brand-green text-white text-sm font-medium">
            {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        )}
      </div>
    </aside>
  );
};
