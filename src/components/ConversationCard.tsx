import React, { useState, memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { MoreVertical, Tag, Archive, ArchiveRestore, Trash2, Circle, CircleDot, Check, XCircle, Sparkles, Bookmark } from "lucide-react";
import { formatDistanceToNow, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DeleteContactDialog } from "./DeleteContactDialog";
import { getStatusFichaHex } from "@/lib/statusFichaCores";

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
  hasNewOrcamento?: boolean;
  hasSuggestion?: boolean;
  bookmarked?: boolean;
  onToggleBookmark?: () => void;
  ultimaMsgPor?: string | null;
  fichaCreatedAt?: string | null;
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

// Cor (HEX) usada para sublinhar o nome do status no card.
// Importa da paleta única para manter consistência entre chats.
const getStatusUnderlineHex = (status: string): string => getStatusFichaHex(status);

// Formata telefone para exibição: remove "whatsapp:" e "+55"
// Ex.: whatsapp:+5511987654321 -> (11) 98765-4321
const formatTelefoneDisplay = (tel: string): string => {
  if (!tel) return "";
  let n = tel.replace(/^whatsapp:/i, "").replace(/\D/g, "");
  if (n.startsWith("55") && n.length >= 12) n = n.slice(2);
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return n || tel;
};

// Cor da borda do card baseada no status da ficha (sutil, com transparência)
const getCardBorderClass = (fichaId?: string | null, fichaStatus?: string | null): string => {
  if (!fichaId) return "border-yellow-500/40";
  if (fichaStatus === "Ficha Criada") return "border-red-500/40";
  if (fichaStatus === "Finalizado" || fichaStatus === "Perdido" || fichaStatus === "Garantia") return "border-green-500/40";
  return "border-blue-500/40";
};

// Formata tempo desde criação: "MMmin" se <60, senão "Xh" ou "Xd"
const formatTempoDesde = (iso: string): string => {
  const mins = differenceInMinutes(new Date(), new Date(iso));
  if (mins < 0) return "0min";
  if (mins < 60) return `${mins}min`;
  const horas = Math.floor(mins / 60);
  if (horas < 24) return `${horas}h`;
  const dias = Math.floor(horas / 24);
  return `${dias}d`;
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
  tempoNoStatusMinutos,
  hasNewOrcamento = false,
  hasSuggestion = false,
  bookmarked = false,
  onToggleBookmark,
  ultimaMsgPor,
  fichaCreatedAt,
}: ConversationCardProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDelete = () => {
    setDeleteDialogOpen(false);
    onDelete();
  };

  const alertBackgroundStyle = hasNewOrcamento
    ? {
        background: 'rgba(239, 68, 68, 0.12)',
        borderLeftColor: '#ef4444',
      }
    : statusAlertColor
    ? {
        background: `${statusAlertColor}18`,
        borderLeftColor: statusAlertColor,
      }
    : undefined;

  return (
    <>
    <div
      className={cn(
        "h-full p-2 md:p-2.5 border-b cursor-pointer transition-colors relative hover:bg-muted/40 overflow-hidden",
        isSelected && "bg-primary/10 ring-2 ring-primary",
        (unreadCount > 0 || marcadoNaoLido) && !isSelected && !statusAlertColor && !hasNewOrcamento && "bg-blue-100 dark:bg-blue-950/40",
        hasSuggestion && !isSelected && !hasNewOrcamento && !statusAlertColor && "animate-pulse bg-primary/5"
      )}
      style={alertBackgroundStyle}
      onClick={onClick}
    >
      {/* Overlay de Novo Orçamento */}
      {hasNewOrcamento && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <span className="text-lg font-bold text-red-600 dark:text-red-400 animate-pulse drop-shadow-sm">
            🆕 Chegou novo orçamento!
          </span>
        </div>
      )}

      {/* Linha 0: Nome + Tags + Menu */}
      <div className="grid grid-cols-[minmax(0,1fr)_4rem] items-start gap-1 overflow-visible">
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
          <h3 className="font-semibold text-sm truncate min-w-0 leading-tight">{nome}</h3>
          <div className="flex gap-1 min-w-0 overflow-hidden">
            {tags.map((tag, idx) => {
              const tagColor = tagsColors?.get(tag) || '#6B7280';
              return (
                <Badge
                  key={idx}
                  variant="secondary"
                  className="text-[10px] px-1 py-0 h-4 border shrink-0"
                  style={{ backgroundColor: tagColor, borderColor: tagColor, color: '#FFFFFF' }}
                >
                  {tag}
                </Badge>
              );
            })}
          </div>
        </div>
        <div className="flex h-7 items-center justify-end gap-1 overflow-visible">
          {onToggleBookmark && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 shrink-0 bg-transparent p-0 text-foreground opacity-100 hover:bg-accent hover:text-accent-foreground",
                bookmarked && "text-primary"
              )}
              aria-label={bookmarked ? "Remover marca página" : "Marcar página"}
              title={bookmarked ? "Remover marca página" : "Marcar página"}
              onClick={(e) => { e.stopPropagation(); onToggleBookmark(); }}
            >
              <Bookmark className={cn("h-5 w-5 stroke-[2.5]", bookmarked && "fill-current")} />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 bg-transparent p-0 text-foreground opacity-100 hover:bg-accent hover:text-accent-foreground" aria-label="Mais opções">
                <MoreVertical className="h-5 w-5 stroke-[2.5]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isArchived && (
                <>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleUnread(); }}>
                    {marcadoNaoLido ? (<><Circle className="mr-2 h-4 w-4" />Marcar como Lida</>) : (<><CircleDot className="mr-2 h-4 w-4" />Marcar como Não Lida</>)}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpenTagManager(); }}>
                    <Tag className="mr-2 h-4 w-4" />Gerenciar Tags
                  </DropdownMenuItem>
                  {onToggleBookmark && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleBookmark(); }}>
                      <Bookmark className={cn("mr-2 h-4 w-4", bookmarked && "fill-current")} />
                      {bookmarked ? "Remover marca página" : "Marcar página"}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(); }}>
                    <Archive className="mr-2 h-4 w-4" />Arquivar Contato
                  </DropdownMenuItem>
                </>
              )}
              {isArchived && (
                <>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUnarchive(); }}>
                    <ArchiveRestore className="mr-2 h-4 w-4" />Restaurar Contato
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDeleteDialogOpen(true); }} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />Deletar Permanentemente
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        </div>

      {/* LINHA 1: FS (telefone removido a pedido dos operadores) */}
      <div className="flex items-center gap-2 w-full overflow-hidden whitespace-nowrap leading-tight">
        {fichaId && (
          <span className="text-xs font-medium text-primary shrink-0 truncate">📋 {fichaId}</span>
        )}
        {pagamentoLink && fichaStatus === "Finalizado" && (
          pagamentoRealizado
            ? <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
            : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
        )}
        {orcamentosCount > 0 && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-700">
            🧾 {orcamentosCount}
          </Badge>
        )}
      </div>

      {/* LINHA 2: Status · ⏳ tempo no status · 🔥 Sem orçamento */}
      <div className="flex items-center gap-2 text-xs overflow-hidden whitespace-nowrap leading-tight">
        {fichaStatus && (
          <span className="flex items-center gap-1.5 min-w-0 truncate">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: getStatusUnderlineHex(fichaStatus) }}
              aria-hidden
            />
            <span
              className="truncate min-w-0 font-medium text-foreground/80"
              style={{
                textDecorationLine: "underline",
                textDecorationColor: getStatusUnderlineHex(fichaStatus),
                textDecorationThickness: "2px",
                textUnderlineOffset: "3px",
              }}
            >
              {fichaStatus}
            </span>
          </span>
        )}
        {/* Tempo no status atual removido a pedido dos operadores */}
        {semOrcamento && (
          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
            🔥 Sem orçamento
          </span>
        )}
      </div>

      {/* LINHA 3: Operador · ⏰ tempo desde criação · UM · alertas */}
      <div className="flex items-center justify-between gap-2 overflow-hidden leading-tight">
        <span className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5 min-w-0">
          {atendenteNome && (
            <span className="shrink-0 truncate max-w-[100px]" title={`Operador responsável: ${atendenteNome}`}>
              👤 {atendenteNome}
            </span>
          )}
          {fichaCreatedAt && (
            <span className="shrink-0" title="Tempo desde a criação da ficha">
              ⏰ {formatTempoDesde(fichaCreatedAt)}
            </span>
          )}
          <span className="shrink-0 truncate" title={`Última interação: ${formatDistanceToNow(new Date(ultimaInteracao), { addSuffix: true, locale: ptBR })}`}>
            {formatDistanceToNow(new Date(ultimaInteracao), { addSuffix: true, locale: ptBR })}
          </span>
          {ultimaMsgPor && (
            <span className="text-[10px] text-muted-foreground/70 italic shrink-0" title={`Última mensagem por ${ultimaMsgPor}`}>
              · UM: {ultimaMsgPor === "Cliente" ? "C" : "24"}
            </span>
          )}
        </span>

        <div className="flex items-center gap-1.5">
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
          {hasSuggestion && (
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
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
