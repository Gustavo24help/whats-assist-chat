import React, { useState, memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { MoreVertical, Tag, Archive, ArchiveRestore, Trash2, Circle, CircleDot, Check, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DeleteContactDialog } from "./DeleteContactDialog";

interface ConversationCardProps {
  telefone: string;
  nome: string;
  tags: string[];
  tagsColors?: Map<string, string>;
  fichaId?: string | null;
  fichaStatus?: string | null;
  statusConversa: "aberta" | "fechada";
  ultimaInteracao: string;
  isSelected: boolean;
  unreadCount?: number;
  onClick: () => void;
  onOpenTagManager: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  isArchived: boolean;
  marcadoNaoLido?: boolean;
  onToggleUnread: () => void;
  botHabilitado?: boolean;
  botDesativadoNotificacaoVista?: boolean;
  botDesligadoManualmente?: boolean;
  orcamentosCount?: number;
  atendenteNome?: string | null;
  temServicoParaFinalizar?: boolean;
  pagamentoLink?: string | null;
  pagamentoRealizado?: boolean;
  semOrcamento?: boolean;
  statusAlertColor?: string | null;
  tempoNoStatusMinutos?: number;
}

const getStatusColor = (status: string) => {
  const statusMap: Record<string, string> = {
    "Não foi adiante": "bg-gray-500",
    "Ficha Criada": "bg-blue-500",
    "Contato Inicial": "bg-cyan-500",
    "Dúvida Prestador": "bg-yellow-500",
    "Orçamento Enviado": "bg-amber-500",
    "Negociação": "bg-orange-500",
    "Visita Técnica": "bg-purple-500",
    "Orçamento Aprovado / Agendamento": "bg-teal-500",
    "Orçamento Não Aprovado": "bg-red-500",
    "Agendado": "bg-indigo-500",
    "Em andamento": "bg-green-500",
    "Finalizado": "bg-emerald-600",
    "Garantia": "bg-lime-500",
    "Perdido": "bg-rose-500"
  };
  return statusMap[status] || "bg-gray-400";
};

// ✅ Memoized para evitar re-renders desnecessários
export const ConversationCard = memo(({
  telefone,
  nome,
  tags,
  tagsColors,
  fichaId,
  fichaStatus,
  statusConversa,
  ultimaInteracao,
  isSelected,
  unreadCount = 0,
  onClick,
  onOpenTagManager,
  onArchive,
  onUnarchive,
  onDelete,
  isArchived,
  marcadoNaoLido = false,
  onToggleUnread,
  botHabilitado = true,
  botDesativadoNotificacaoVista = true,
  botDesligadoManualmente = false,
  orcamentosCount = 0,
  atendenteNome,
  temServicoParaFinalizar = false,
  pagamentoLink,
  pagamentoRealizado = false,
  semOrcamento = false,
  statusAlertColor = null,
  tempoNoStatusMinutos
}: ConversationCardProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDelete = () => {
    setDeleteDialogOpen(false);
    onDelete();
  };

  const alertBackgroundStyle = statusAlertColor
    ? {
        background: `${statusAlertColor}18`,
        borderLeftColor: statusAlertColor,
      }
    : undefined;

  return (
    <>
    <div
      className={cn(
        "p-2.5 md:p-3 border-b cursor-pointer transition-colors relative hover:bg-muted/40 overflow-hidden",
        isSelected ? "bg-primary/10 border-l-4 border-l-primary" : "",
        (unreadCount > 0 || marcadoNaoLido) && !isSelected && !statusAlertColor && "bg-blue-100 dark:bg-blue-950/40 border-l-4 border-l-blue-600 dark:border-l-blue-400",
        statusAlertColor && !isSelected && "border-l-4"
      )}
      style={alertBackgroundStyle}
      onClick={onClick}
    >
      {/* Linha 1: Tag e Menu */}
      <div className="flex items-start justify-between mb-1.5 gap-2 overflow-hidden">
        <div className="flex gap-1 flex-wrap flex-1 min-h-[18px] min-w-0 overflow-hidden">
          {tags.map((tag, idx) => {
            const tagColor = tagsColors?.get(tag) || '#6B7280';
            return (
              <Badge 
                key={idx} 
                variant="secondary" 
                className="text-xs px-1.5 py-0 h-4 border"
                style={{
                  backgroundColor: tagColor,
                  borderColor: tagColor,
                  color: '#FFFFFF'
                }}
              >
                {tag}
              </Badge>
            );
          })}
        </div>
        
        <div className="flex items-center gap-1">
          <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 -mt-1">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!isArchived && (
              <>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleUnread(); }}>
                  {marcadoNaoLido ? (
                    <>
                      <Circle className="mr-2 h-4 w-4" />
                      Marcar como Lida
                    </>
                  ) : (
                    <>
                      <CircleDot className="mr-2 h-4 w-4" />
                      Marcar como Não Lida
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpenTagManager(); }}>
                  <Tag className="mr-2 h-4 w-4" />
                  Gerenciar Tags
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(); }}>
                  <Archive className="mr-2 h-4 w-4" />
                  Arquivar Contato
                </DropdownMenuItem>
              </>
            )}
            {isArchived && (
              <>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUnarchive(); }}>
                  <ArchiveRestore className="mr-2 h-4 w-4" />
                  Restaurar Contato
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); setDeleteDialogOpen(true); }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Deletar Permanentemente
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>

      {/* Operador (acima do nome do cliente) */}
      {atendenteNome && (
        <p className="text-[10px] italic text-muted-foreground truncate mb-0.5">
          Operador: {atendenteNome}
        </p>
      )}

      {/* Nome e Telefone */}
      <div className="flex items-center justify-between mb-1 gap-2 w-full overflow-hidden">
        <h3 className="font-semibold text-sm truncate w-0 flex-1">{nome}</h3>
        <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">{telefone}</span>
      </div>

      {/* Ficha Ativa e Status */}
      {fichaId && (
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-medium text-primary">📋 {fichaId}</span>
          {fichaStatus && (
            <div className="flex items-center gap-1">
              <div className={cn("w-2 h-2 rounded-full shrink-0", getStatusColor(fichaStatus))} />
              <span className="text-xs text-muted-foreground truncate">{fichaStatus}</span>
            </div>
          )}
          {pagamentoLink && fichaStatus === "Finalizado" && (
            pagamentoRealizado ? (
              <Check className="h-4 w-4 text-green-600 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500 shrink-0" />
            )
          )}
          {orcamentosCount > 0 && (
            <Badge variant="secondary" className="text-xs h-5 px-1.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-700">
              💰 {orcamentosCount}
            </Badge>
          )}
        </div>
      )}

      {/* Horário e Badge de Não Lidas */}
      <div className="flex items-center justify-between mt-1.5 gap-2 overflow-hidden">
        <span className="text-xs text-muted-foreground truncate">
          {formatDistanceToNow(new Date(ultimaInteracao), { addSuffix: true, locale: ptBR })}
        </span>
        
        <div className="flex items-center gap-1.5">
          {semOrcamento && (
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
              💰 Sem orçamento
            </span>
          )}
          {statusAlertColor && (
            <span className="text-[10px] font-semibold text-orange-700 dark:text-orange-300 shrink-0">
              ⏰ Status atrasado{typeof tempoNoStatusMinutos === "number" ? ` (${Math.floor(tempoNoStatusMinutos)}min)` : ""}
            </span>
          )}
          {temServicoParaFinalizar && (
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500 shrink-0">
              <span className="text-white text-xs font-bold">!</span>
            </div>
          )}
          {!botHabilitado && !botDesativadoNotificacaoVista && !botDesligadoManualmente && (
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500 shrink-0">
              <span className="text-white text-xs font-bold">!</span>
            </div>
          )}
          {(marcadoNaoLido || unreadCount > 0) && (
            <div className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-blue-600 shrink-0">
              <span className="text-white text-xs font-bold">{unreadCount > 0 ? unreadCount : '•'}</span>
            </div>
          )}
        </div>
      </div>

      <DeleteContactDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        contactName={nome}
      />
    </div>
    </>
  );
});
