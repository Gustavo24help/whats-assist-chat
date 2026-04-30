import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FilterDropdown } from "@/components/FilterDropdown";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PanelLeftClose, PanelLeftOpen, Search, AlertTriangle, MessageCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { NovaConversaDialog } from "@/components/NovaConversaDialog";
import { getStatusFichaHex } from "@/lib/statusFichaCores";

export interface StatusCounts {
  byStatus: Record<string, number>;
  unreadCount: number;
  totalCount: number;
  ativasCount: number;
  inativasCount: number;
}

interface Operador {
  id: string;
  nome: string;
}

interface ChatBetaFilterSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  counts: StatusCounts;
  conversaStatusFilter: "ativas" | "inativas" | "todas";
  onConversaStatusFilterChange: (v: "ativas" | "inativas" | "todas") => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  conversaFilter: "todas" | "aberta" | "fechada";
  onConversaFilterChange: (v: "todas" | "aberta" | "fechada") => void;
  botFilter: "todos" | "ativo" | "desativado";
  onBotFilterChange: (v: "todos" | "ativo" | "desativado") => void;
  fichaFilter: "todas" | "com_ficha" | "sem_ficha";
  onFichaFilterChange: (v: "todas" | "com_ficha" | "sem_ficha") => void;
  pagamentoFilter: "todos" | "pago" | "nao_pago" | "pendente_finalizado";
  onPagamentoFilterChange: (v: "todos" | "pago" | "nao_pago" | "pendente_finalizado") => void;
  allTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
  tagsWithColors: Map<string, string>;
  botDisabledCount: number;
  showBotDisabledOnly: boolean;
  onToggleBotDisabled: () => void;
  operadores: Operador[];
  selectedOperadorId: string | null;
  onSelectedOperadorChange: (id: string | null) => void;
  activeTab: "conversas" | "contatos";
  onActiveTabChange: (tab: "conversas" | "contatos") => void;
  onContactCreated?: (cliente: any) => void;
}

const STATUS_ORDER = [
  "Ficha Criada",
  "Orçamento Enviado",
  "Em Negociação",
  "Negociação",
  "Aprovado",
  "Agendado",
  "Em Andamento",
  "Finalizado",
  "Garantia",
  "Retorno",
  "Dúvida Prestador",
  "Perdido",
  "Não foi adiante",
  "Cancelado",
];

// Mapa centralizado em src/lib/statusFichaCores.ts.


export const ChatBetaFilterSidebar = ({
  isCollapsed,
  onToggleCollapse,
  counts,
  conversaStatusFilter,
  onConversaStatusFilterChange,
  statusFilter,
  onStatusFilterChange,
  conversaFilter,
  onConversaFilterChange,
  botFilter,
  onBotFilterChange,
  fichaFilter,
  onFichaFilterChange,
  pagamentoFilter,
  onPagamentoFilterChange,
  allTags,
  selectedTags,
  onToggleTag,
  onClearTags,
  tagsWithColors,
  botDisabledCount,
  showBotDisabledOnly,
  onToggleBotDisabled,
  operadores,
  selectedOperadorId,
  onSelectedOperadorChange,
  activeTab,
  onActiveTabChange,
  onContactCreated,
}: ChatBetaFilterSidebarProps) => {
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [tagSearchTerm, setTagSearchTerm] = useState("");

  const filteredTags = useMemo(() => {
    if (!tagSearchTerm) return allTags;
    return allTags.filter(tag => tag.toLowerCase().includes(tagSearchTerm.toLowerCase()));
  }, [allTags, tagSearchTerm]);

  const sortedStatuses = useMemo(() => {
    const statuses = Object.entries(counts.byStatus);
    return statuses.sort((a, b) => {
      const idxA = STATUS_ORDER.indexOf(a[0]);
      const idxB = STATUS_ORDER.indexOf(b[0]);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
  }, [counts.byStatus]);

  if (isCollapsed) {
    return (
      <div className="w-10 border-r border-border/60 bg-card flex flex-col items-center py-2 shrink-0">
        <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="h-7 w-7 mb-2">
          <PanelLeftOpen className="h-3.5 w-3.5" />
        </Button>
        <div className="text-[10px] font-bold text-muted-foreground writing-vertical">
          {counts.totalCount}
        </div>
      </div>
    );
  }

  return (
    <div className="w-[260px] border-r border-border/60 bg-card flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="h-10 border-b border-border/40 flex items-center justify-between px-2.5 shrink-0">
        <span className="text-xs font-semibold text-foreground">Filtros</span>
        <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="h-6 w-6">
          <PanelLeftClose className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2">

        {/* Navigation: Conversas / Contatos + Nova lado a lado */}
        <div className="space-y-1">
          <Button
            variant={activeTab === "conversas" ? "default" : "ghost"}
            size="sm"
            onClick={() => onActiveTabChange("conversas")}
            className="w-full justify-start gap-2 h-7 text-[11px]"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Conversas
            <Badge variant="secondary" className="ml-auto h-4 px-1 text-[9px]">
              {counts.totalCount}
            </Badge>
          </Button>
          <div className="flex gap-1">
            <Button
              variant={activeTab === "contatos" ? "default" : "ghost"}
              size="sm"
              onClick={() => onActiveTabChange("contatos")}
              className="flex-1 justify-start gap-1.5 h-7 text-[11px]"
            >
              <Users className="h-3.5 w-3.5" />
              Contatos
            </Button>
            <NovaConversaDialog onContactCreated={(cliente) => onContactCreated?.(cliente)} />
          </div>
        </div>

        <div className="h-px bg-border/60" />

        {/* Operador dropdown */}
        <div>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Operador</span>
          <Select
            value={selectedOperadorId || "todos"}
            onValueChange={(v) => onSelectedOperadorChange(v === "todos" ? null : v)}
          >
            <SelectTrigger className="h-7 text-[11px] mt-1">
              <SelectValue placeholder="Todos os operadores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos" className="text-xs">Todos os operadores</SelectItem>
              {operadores.map(op => (
                <SelectItem key={op.id} value={op.id} className="text-xs">
                  {op.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bot disabled indicator */}
        {botDisabledCount > 0 && (
          <Button
            variant={showBotDisabledOnly ? "default" : "outline"}
            size="sm"
            onClick={onToggleBotDisabled}
            className="w-full justify-start gap-1.5 h-7 text-[11px]"
          >
            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-yellow-500 shrink-0">
              <AlertTriangle className="h-2.5 w-2.5 text-white" />
            </div>
            {botDisabledCount} atendimento
          </Button>
        )}

        {/* Filtros avançados */}
        <FilterDropdown
          statusFilter={statusFilter}
          conversaFilter={conversaFilter}
          botFilter={botFilter}
          fichaFilter={fichaFilter}
          pagamentoFilter={pagamentoFilter}
          onStatusFilterChange={onStatusFilterChange}
          onConversaFilterChange={onConversaFilterChange}
          onBotFilterChange={onBotFilterChange}
          onFichaFilterChange={onFichaFilterChange}
          onPagamentoFilterChange={onPagamentoFilterChange}
        />

        {/* Status counts */}
        <div>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Por Status ({counts.totalCount})
          </span>
          <div className="mt-1.5 space-y-0.5">
            <button
              onClick={() => onStatusFilterChange("all")}
              className={cn(
                "w-full flex items-center justify-between px-2 py-1 rounded text-[11px] transition-colors",
                statusFilter === "all"
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted/50 text-foreground"
              )}
            >
              <span>Todos os status</span>
              <span className="text-[10px] text-muted-foreground">{counts.totalCount}</span>
            </button>

            {sortedStatuses.map(([status, count]) => (
              <button
                key={status}
                onClick={() => {
                  if (statusFilter === status) {
                    onStatusFilterChange("all");
                  } else {
                    onStatusFilterChange(status);
                    // Auto-switch to "todas" so the status filter doesn't hide results
                    if (conversaStatusFilter !== "todas") {
                      onConversaStatusFilterChange("todas");
                    }
                  }
                }}
                className={cn(
                  "w-full flex items-center justify-between px-2 py-1 rounded text-[11px] transition-colors",
                  statusFilter === status
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted/50 text-foreground"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getStatusFichaHex(status) }} />
                  <span className="truncate">{status}</span>
                </div>
                <span className="text-[10px] text-muted-foreground ml-1">{count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tags — sempre por último, ocupando o espaço restante na base */}
        {allTags.length > 0 && (
          <div className="mt-auto pt-2">
            <Popover open={tagsExpanded} onOpenChange={setTagsExpanded}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full h-7 justify-start text-[11px] gap-1.5">
                  <span>🏷️</span>
                  Tags
                  {selectedTags.length > 0 ? (
                    <Badge variant="default" className="ml-auto h-4 px-1 text-[9px]">
                      {selectedTags.length}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="ml-auto h-4 px-1 text-[9px]">
                      {allTags.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 bg-popover z-50" align="start">
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      placeholder="Buscar tags..."
                      value={tagSearchTerm}
                      onChange={(e) => setTagSearchTerm(e.target.value)}
                      className="pl-7 h-7 text-xs"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                    {filteredTags.map((tag) => {
                      const tagColor = tagsWithColors.get(tag) || '#6B7280';
                      return (
                        <Badge
                          key={tag}
                          variant={selectedTags.includes(tag) ? "default" : "outline"}
                          className="cursor-pointer text-xs h-6 transition-all hover:scale-105"
                          onClick={() => onToggleTag(tag)}
                          style={{
                            backgroundColor: selectedTags.includes(tag) ? tagColor : 'transparent',
                            borderColor: tagColor,
                            color: selectedTags.includes(tag) ? '#FFFFFF' : tagColor
                          }}
                        >
                          {tag}
                        </Badge>
                      );
                    })}
                  </div>
                  {selectedTags.length > 0 && (
                    <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={onClearTags}>
                      Limpar seleção
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>
    </div>
  );
};
