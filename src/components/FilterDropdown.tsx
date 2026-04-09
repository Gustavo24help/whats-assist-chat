import { useState } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface FilterDropdownProps {
  statusFilter: string;
  conversaFilter: "todas" | "aberta" | "fechada";
  botFilter: "todos" | "ativo" | "desativado";
  fichaFilter: "todas" | "com_ficha" | "sem_ficha";
  pagamentoFilter: "todos" | "pago" | "nao_pago" | "pendente_finalizado";
  onStatusFilterChange: (value: string) => void;
  onConversaFilterChange: (value: "todas" | "aberta" | "fechada") => void;
  onBotFilterChange: (value: "todos" | "ativo" | "desativado") => void;
  onFichaFilterChange: (value: "todas" | "com_ficha" | "sem_ficha") => void;
  onPagamentoFilterChange: (value: "todos" | "pago" | "nao_pago" | "pendente_finalizado") => void;
}

export const FilterDropdown = ({
  statusFilter,
  conversaFilter,
  botFilter,
  fichaFilter,
  pagamentoFilter,
  onStatusFilterChange,
  onConversaFilterChange,
  onBotFilterChange,
  onFichaFilterChange,
  onPagamentoFilterChange,
}: FilterDropdownProps) => {
  const [open, setOpen] = useState(false);

  // Calcular quantos filtros estão ativos (não no estado padrão)
  const getActiveFiltersCount = () => {
    let count = 0;
    if (statusFilter !== "all") count++;
    if (conversaFilter !== "todas") count++;
    if (botFilter !== "todos") count++;
    if (fichaFilter !== "todas") count++;
    if (pagamentoFilter !== "todos") count++;
    return count;
  };

  const activeCount = getActiveFiltersCount();

  const handleReset = () => {
    onStatusFilterChange("all");
    onConversaFilterChange("todas");
    onBotFilterChange("todos");
    onFichaFilterChange("todas");
    onPagamentoFilterChange("todos");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="flex-1 h-8 justify-start text-xs gap-1.5">
          <Filter className="h-3.5 w-3.5" />
          Filtros
          {activeCount > 0 && (
            <Badge variant="default" className="ml-auto h-4 px-1 text-[10px]">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full max-w-[95vw] sm:max-w-[600px] p-0 bg-popover backdrop-blur-sm z-50 flex flex-col max-h-[70vh]" align="start">
        <div className="p-3 sm:p-4 border-b shrink-0">
          <h3 className="font-semibold text-sm">Filtros</h3>
        </div>
        
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="max-h-[calc(70vh-140px)]">
            <div className="p-3">
              {/* Grid responsivo - 1 coluna em mobile, 2 em desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 lg:gap-x-8 gap-y-3">
              
              {/* Coluna 1 */}
              <div className="space-y-3">
                {/* Status da Conversa */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-xs">Status da Conversa</h4>
                  <RadioGroup value={conversaFilter} onValueChange={onConversaFilterChange}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="todas" id="conversa-todas" />
                      <Label htmlFor="conversa-todas" className="text-sm cursor-pointer">Todas</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="aberta" id="conversa-aberta" />
                      <Label htmlFor="conversa-aberta" className="text-sm cursor-pointer">Abertas (24h)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="fechada" id="conversa-fechada" />
                      <Label htmlFor="conversa-fechada" className="text-sm cursor-pointer">Fechadas</Label>
                    </div>
                  </RadioGroup>
                </div>


                {/* Status do Bot */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-xs">Status do Bot</h4>
                  <RadioGroup value={botFilter} onValueChange={onBotFilterChange}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="todos" id="bot-todos" />
                      <Label htmlFor="bot-todos" className="text-sm cursor-pointer">Todos</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="ativo" id="bot-ativo" />
                      <Label htmlFor="bot-ativo" className="text-sm cursor-pointer">Bot Ativo</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="desativado" id="bot-desativado" />
                      <Label htmlFor="bot-desativado" className="text-sm cursor-pointer">Bot Desativado</Label>
                    </div>
                  </RadioGroup>
                </div>

              </div>

              {/* Coluna 2 */}
              <div className="space-y-3">
                {/* Ficha Vinculada */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-xs">Ficha Vinculada</h4>
                  <RadioGroup value={fichaFilter} onValueChange={onFichaFilterChange}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="todas" id="ficha-todas" />
                      <Label htmlFor="ficha-todas" className="text-sm cursor-pointer">Todas</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="com_ficha" id="ficha-com" />
                      <Label htmlFor="ficha-com" className="text-sm cursor-pointer">Com ficha</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sem_ficha" id="ficha-sem" />
                      <Label htmlFor="ficha-sem" className="text-sm cursor-pointer">Sem ficha</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Status da Ficha */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-xs">Status da Ficha</h4>
                  <RadioGroup value={statusFilter} onValueChange={onStatusFilterChange}>
                    {[
                      { value: "all", label: "Todos" },
                      { value: "Ficha Criada", label: "Ficha Criada" },
                      { value: "Contato Inicial", label: "Contato Inicial" },
                      { value: "Dúvida Prestador", label: "Dúvida Prestador" },
                      { value: "Orçamento Enviado", label: "Orçamento Enviado" },
                      { value: "Negociação", label: "Negociação" },
                      { value: "Visita Técnica", label: "Visita Técnica" },
                      { value: "Orçamento Aprovado / Agendamento", label: "Orç. Aprovado / Agendamento" },
                      { value: "Orçamento Não Aprovado", label: "Orçamento Não Aprovado" },
                      { value: "Agendado", label: "Agendado" },
                      { value: "Em andamento", label: "Em Andamento" },
                      { value: "Retorno", label: "Retorno" },
                      { value: "Finalizado", label: "Finalizado" },
                      { value: "Garantia", label: "Garantia" },
                      { value: "Perdido", label: "Perdido" },
                      { value: "Não foi adiante", label: "Não foi adiante" },
                    ].map((s) => (
                      <div key={s.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={s.value} id={`status-${s.value}`} />
                        <Label htmlFor={`status-${s.value}`} className="text-sm cursor-pointer">{s.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Status de Pagamento */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-xs">Pagamento</h4>
                  <RadioGroup value={pagamentoFilter} onValueChange={onPagamentoFilterChange}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="todos" id="pagamento-todos" />
                      <Label htmlFor="pagamento-todos" className="text-sm cursor-pointer">Todos</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pago" id="pagamento-pago" />
                      <Label htmlFor="pagamento-pago" className="text-sm cursor-pointer">Pago</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="nao_pago" id="pagamento-nao-pago" />
                      <Label htmlFor="pagamento-nao-pago" className="text-sm cursor-pointer">Não Pago</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pendente_finalizado" id="pagamento-pendente" />
                      <Label htmlFor="pagamento-pendente" className="text-sm cursor-pointer">Pendente (Finalizado)</Label>
                    </div>
                  </RadioGroup>
                </div>

              </div>

              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-2 sm:p-3 border-t bg-muted/50 flex justify-between items-center shrink-0 gap-2">
          <span className="text-xs text-muted-foreground flex-1">
            {activeCount} filtro(s) ativo(s)
          </span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleReset}
            disabled={activeCount === 0}
            className="hover:bg-accent shrink-0"
          >
            Redefinir
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
