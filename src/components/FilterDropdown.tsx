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
  unreadFilter: "todas" | "lidas" | "nao_lidas";
  botFilter: "todos" | "ativo" | "desativado";
  fichaFilter: "todas" | "com_ficha" | "sem_ficha";
  onStatusFilterChange: (value: string) => void;
  onConversaFilterChange: (value: "todas" | "aberta" | "fechada") => void;
  onUnreadFilterChange: (value: "todas" | "lidas" | "nao_lidas") => void;
  onBotFilterChange: (value: "todos" | "ativo" | "desativado") => void;
  onFichaFilterChange: (value: "todas" | "com_ficha" | "sem_ficha") => void;
}

export const FilterDropdown = ({
  statusFilter,
  conversaFilter,
  unreadFilter,
  botFilter,
  fichaFilter,
  onStatusFilterChange,
  onConversaFilterChange,
  onUnreadFilterChange,
  onBotFilterChange,
  onFichaFilterChange,
}: FilterDropdownProps) => {
  const [open, setOpen] = useState(false);

  // Calcular quantos filtros estão ativos (não no estado padrão)
  const getActiveFiltersCount = () => {
    let count = 0;
    if (statusFilter !== "all") count++;
    if (conversaFilter !== "todas") count++;
    if (unreadFilter !== "todas") count++;
    if (botFilter !== "todos") count++;
    if (fichaFilter !== "todas") count++;
    return count;
  };

  const activeCount = getActiveFiltersCount();

  const handleReset = () => {
    onStatusFilterChange("all");
    onConversaFilterChange("todas");
    onUnreadFilterChange("todas");
    onBotFilterChange("todos");
    onFichaFilterChange("todas");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full h-9 justify-start text-sm">
          <Filter className="h-4 w-4 mr-2" />
          Filtros
          {activeCount > 0 && (
            <Badge variant="default" className="ml-auto h-5 px-1.5 text-xs">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[600px] p-0 bg-popover backdrop-blur-sm z-50 flex flex-col max-h-[600px]" align="start">
        <div className="p-4 border-b shrink-0">
          <h3 className="font-semibold text-sm">Filtros</h3>
        </div>
        
        <ScrollArea className="flex-1 max-h-[400px]">
          <div className="p-4">
            {/* Grid 2 colunas para melhor organização */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              
              {/* Coluna 1 */}
              <div className="space-y-6">
                {/* Status da Conversa */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Status da Conversa</h4>
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

                <Separator className="my-2" />

                {/* Mensagens */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Mensagens</h4>
                  <RadioGroup value={unreadFilter} onValueChange={onUnreadFilterChange}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="todas" id="msg-todas" />
                      <Label htmlFor="msg-todas" className="text-sm cursor-pointer">Todas</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="nao_lidas" id="msg-nao-lidas" />
                      <Label htmlFor="msg-nao-lidas" className="text-sm cursor-pointer">Não lidas</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="lidas" id="msg-lidas" />
                      <Label htmlFor="msg-lidas" className="text-sm cursor-pointer">Lidas</Label>
                    </div>
                  </RadioGroup>
                </div>

                <Separator className="my-2" />

                {/* Status do Bot */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Status do Bot</h4>
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
              <div className="space-y-6">
                {/* Ficha Vinculada */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Ficha Vinculada</h4>
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

                <Separator className="my-2" />

                {/* Status da Ficha */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Status da Ficha</h4>
                  <RadioGroup value={statusFilter} onValueChange={onStatusFilterChange}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="status-all" />
                      <Label htmlFor="status-all" className="text-sm cursor-pointer">Todos</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Ficha Criada" id="status-criada" />
                      <Label htmlFor="status-criada" className="text-sm cursor-pointer">Ficha Criada</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Contato Inicial" id="status-contato" />
                      <Label htmlFor="status-contato" className="text-sm cursor-pointer">Contato Inicial</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Orçamento Enviado" id="status-orcamento" />
                      <Label htmlFor="status-orcamento" className="text-sm cursor-pointer">Orçamento Enviado</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Agendado" id="status-agendado" />
                      <Label htmlFor="status-agendado" className="text-sm cursor-pointer">Agendado</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Em andamento" id="status-andamento" />
                      <Label htmlFor="status-andamento" className="text-sm cursor-pointer">Em Andamento</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Finalizado" id="status-finalizado" />
                      <Label htmlFor="status-finalizado" className="text-sm cursor-pointer">Finalizado</Label>
                    </div>
                  </RadioGroup>
                </div>

              </div>

            </div>
          </div>
        </ScrollArea>

        <div className="p-3 border-t bg-muted/50 flex justify-between items-center shrink-0">
          <span className="text-xs text-muted-foreground">
            {activeCount} filtro(s) ativo(s)
          </span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleReset}
            disabled={activeCount === 0}
            className="hover:bg-accent"
          >
            Redefinir
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
