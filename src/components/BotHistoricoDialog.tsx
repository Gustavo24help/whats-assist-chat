import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History, Bot, User, Clock, Power, PowerOff, Globe, Monitor, Hash } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";

interface BotHistorico {
  id: string;
  telefone_cliente: string;
  acao: 'ligado' | 'desligado';
  origem: 'manual' | 'automatico' | 'sistema';
  executado_por_id: string | null;
  ficha_id: string | null;
  observacao: string | null;
  created_at: string;
  user_agent?: string | null;
  ip_address?: string | null;
  request_id?: string | null;
  profile?: {
    full_name: string | null;
  } | null;
}

interface BotHistoricoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  telefoneCliente: string;
  nomeCliente: string;
}

export function BotHistoricoDialog({
  open,
  onOpenChange,
  telefoneCliente,
  nomeCliente,
}: BotHistoricoDialogProps) {
  const [historico, setHistorico] = useState<BotHistorico[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && telefoneCliente) {
      fetchHistorico();
    }
  }, [open, telefoneCliente]);

  const fetchHistorico = async () => {
    setLoading(true);
    try {
      // Buscar histórico com join no profile
      const { data, error } = await supabase
        .from('bot_historico')
        .select(`
          *,
          profile:profiles(full_name)
        `)
        .eq('telefone_cliente', telefoneCliente)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setHistorico((data as unknown as BotHistorico[]) || []);
    } catch (error) {
      console.error('Erro ao buscar histórico do bot:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOrigemLabel = (origem: string) => {
    switch (origem) {
      case 'manual':
        return { label: 'Manual', variant: 'default' as const };
      case 'automatico':
        return { label: 'Automático', variant: 'secondary' as const };
      case 'sistema':
        return { label: 'Sistema', variant: 'outline' as const };
      default:
        return { label: origem, variant: 'outline' as const };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico do Bot - {nomeCliente}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : historico.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bot className="h-12 w-12 mb-2 opacity-50" />
              <p>Nenhum histórico encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historico.map((item) => {
                const origemInfo = getOrigemLabel(item.origem);
                const isLigado = item.acao === 'ligado';

                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border ${
                      isLigado
                        ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900'
                        : 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {isLigado ? (
                          <Power className="h-4 w-4 text-green-600" />
                        ) : (
                          <PowerOff className="h-4 w-4 text-red-600" />
                        )}
                        <span className={`font-medium ${isLigado ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                          Bot {isLigado ? 'Ligado' : 'Desligado'}
                        </span>
                        <Badge variant={origemInfo.variant} className="text-xs">
                          {origemInfo.label}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>

                      {item.profile?.full_name && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.profile.full_name}
                        </div>
                      )}

                      {item.observacao && (
                        <p className="text-xs mt-1 opacity-75">{item.observacao}</p>
                      )}

                      {item.ficha_id && (
                        <p className="text-xs mt-1 opacity-75">Ficha: {item.ficha_id}</p>
                      )}

                      {/* Auditoria avançada */}
                      {(item.user_agent || item.ip_address || item.request_id) && (
                        <TooltipProvider>
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-current/10">
                            {item.ip_address && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 text-xs opacity-60 cursor-help">
                                    <Globe className="h-3 w-3" />
                                    <span>{item.ip_address.split(',')[0]}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>IP de origem: {item.ip_address}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            
                            {item.user_agent && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 text-xs opacity-60 cursor-help">
                                    <Monitor className="h-3 w-3" />
                                    <span>Dispositivo</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs break-all">{item.user_agent}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            
                            {item.request_id && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 text-xs opacity-60 cursor-help">
                                    <Hash className="h-3 w-3" />
                                    <span>{item.request_id.substring(0, 8)}...</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Request ID: {item.request_id}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
