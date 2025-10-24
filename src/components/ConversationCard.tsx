import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Tag, Archive } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ConversationCardProps {
  telefone: string;
  nome: string;
  tags: string[];
  fichaId?: string | null;
  fichaStatus?: string | null;
  statusConversa: "aberta" | "fechada";
  ultimaInteracao: string;
  isSelected: boolean;
  unreadCount?: number;
  onClick: () => void;
  onOpenTagManager: () => void;
  onArchive: () => void;
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

export const ConversationCard = ({
  telefone,
  nome,
  tags,
  fichaId,
  fichaStatus,
  statusConversa,
  ultimaInteracao,
  isSelected,
  unreadCount = 0,
  onClick,
  onOpenTagManager,
  onArchive
}: ConversationCardProps) => {
  return (
    <div
      className={cn(
        "p-3 border-b cursor-pointer transition-colors relative",
        isSelected ? "bg-primary/10 border-l-4 border-l-primary" : "hover:bg-muted/50"
      )}
      onClick={onClick}
    >
      {/* Linha 1: Tag e Menu */}
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex gap-1 flex-wrap flex-1 min-h-[20px]">
          {tags.map((tag, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs px-1.5 py-0 h-5">
              {tag}
            </Badge>
          ))}
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpenTagManager(); }}>
              <Tag className="mr-2 h-4 w-4" />
              Gerenciar Tags
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(); }}>
              <Archive className="mr-2 h-4 w-4" />
              Arquivar Contato
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Linha 2: Nome e Telefone */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-sm truncate flex-1">{nome}</h3>
        <span className="text-xs text-muted-foreground ml-2 shrink-0">{telefone}</span>
      </div>

      {/* Linha 3: Ficha Ativa e Status */}
      {fichaId && (
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-primary">📋 Ficha Ativa: {fichaId}</span>
          {fichaStatus && (
            <div className="flex items-center gap-1">
              <div className={cn("w-2 h-2 rounded-full", getStatusColor(fichaStatus))} />
              <span className="text-xs text-muted-foreground">{fichaStatus}</span>
            </div>
          )}
        </div>
      )}

      {/* Linha 4: Horário e Badge de Não Lidas */}
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(ultimaInteracao), { addSuffix: true, locale: ptBR })}
        </span>
        
        {unreadCount > 0 && (
          <Badge variant="destructive" className="h-5 px-1.5 text-xs">
            {unreadCount}
          </Badge>
        )}
      </div>
    </div>
  );
};
