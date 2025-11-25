import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OrcamentoNotificacao {
  id: string;
  ficha_id: string;
  ficha_nome: string | null;
  telefone_cliente: string;
  cliente_nome: string;
  valor_total: number | null;
  data_criacao: string;
}

interface OrcamentoNotificationProps {
  onSelectFicha: (fichaId: string, telefoneCliente: string) => void;
}

// Som de notificação suave de sino
const BUDGET_NOTIFICATION_SOUND = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export function OrcamentoNotification({ onSelectFicha }: OrcamentoNotificationProps) {
  const [notifications, setNotifications] = useState<OrcamentoNotificacao[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Criar elemento de áudio
    audioRef.current = new Audio(BUDGET_NOTIFICATION_SOUND);
  }, []);

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => console.error("Erro ao tocar som:", err));
    }
  };

  useEffect(() => {
    // Escutar novos orçamentos em tempo real
    const channel = supabase
      .channel('orcamentos-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orcamentos'
        },
        async (payload) => {
          const novoOrcamento = payload.new as any;
          
          // Buscar informações da ficha e cliente
          const { data: ficha } = await supabase
            .from('fichas_de_servico')
            .select('id, nome_ficha, telefone_cliente')
            .eq('id', novoOrcamento.ficha_nome)
            .single();

          if (ficha) {
            const { data: cliente } = await supabase
              .from('clientes')
              .select('nome')
              .eq('telefone', ficha.telefone_cliente)
              .single();

            const notificacao: OrcamentoNotificacao = {
              id: novoOrcamento.id,
              ficha_id: novoOrcamento.ficha_nome,
              ficha_nome: ficha.nome_ficha,
              telefone_cliente: ficha.telefone_cliente,
              cliente_nome: cliente?.nome || 'Cliente',
              valor_total: novoOrcamento.valor_total,
              data_criacao: novoOrcamento.data_criacao
            };

            setNotifications(prev => [notificacao, ...prev]);
            playNotificationSound();
            
            toast.success(
              `Novo orçamento recebido!`,
              {
                description: `${notificacao.ficha_id} - ${notificacao.cliente_nome}`,
                duration: 5000,
              }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleNotificationClick = (notificacao: OrcamentoNotificacao) => {
    onSelectFicha(notificacao.ficha_id, notificacao.telefone_cliente);
    // Remove da lista ao clicar
    setNotifications(prev => prev.filter(n => n.id !== notificacao.id));
    setIsOpen(false);
  };

  const handleClearAll = () => {
    setNotifications([]);
    setIsOpen(false);
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatTimeAgo = (date: string) => {
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: ptBR
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "relative",
            notifications.length > 0 && "animate-notification-glow"
          )}
        >
          <Bell className={cn(
            "h-4 w-4",
            notifications.length > 0 && "animate-notification-ring"
          )} />
          {notifications.length > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-semibold animate-pulse">
              {notifications.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b bg-muted/50">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Novos Orçamentos
          </h3>
        </div>
        
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Nenhum orçamento novo
          </div>
        ) : (
          <>
            <div className="max-h-96 overflow-y-auto">
              {notifications.map((notificacao) => (
                <button
                  key={notificacao.id}
                  onClick={() => handleNotificationClick(notificacao)}
                  className="w-full p-3 border-b hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="flex items-start gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5 shrink-0 animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {notificacao.ficha_id}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {notificacao.cliente_nome}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-semibold text-primary">
                          {formatCurrency(notificacao.valor_total)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(notificacao.data_criacao)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="p-2 border-t bg-muted/30">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="w-full text-xs"
              >
                Marcar todas como vistas
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
