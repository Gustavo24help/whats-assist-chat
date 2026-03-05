import { useState, useEffect, useCallback } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CalendarIcon, Save, Copy, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DailyGoal {
  id: string;
  date: string;
  meta_agendamento_quantidade: number;
  meta_agendamento_valor: number;
}

export const DailyGoalsManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [quantidade, setQuantidade] = useState("");
  const [valor, setValor] = useState("");
  const [saving, setSaving] = useState(false);
  const [monthGoals, setMonthGoals] = useState<DailyGoal[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(false);

  // Bulk copy state
  const [showBulkCopy, setShowBulkCopy] = useState(false);
  const [bulkDays, setBulkDays] = useState<Date[]>([]);
  const [copyingSaving, setCopyingSaving] = useState(false);

  const fetchMonthGoals = useCallback(async () => {
    setLoadingGoals(true);
    const monthStart = format(startOfMonth(selectedDate), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(selectedDate), "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("daily_goals")
      .select("*")
      .gte("date", monthStart)
      .lte("date", monthEnd)
      .order("date", { ascending: true });

    if (!error && data) {
      setMonthGoals(data);
    }
    setLoadingGoals(false);
  }, [selectedDate]);

  useEffect(() => {
    fetchMonthGoals();
  }, [fetchMonthGoals]);

  // Load selected date's goal
  useEffect(() => {
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const existing = monthGoals.find((g) => g.date === dateStr);
    if (existing) {
      setQuantidade(String(existing.meta_agendamento_quantidade));
      setValor(String(existing.meta_agendamento_valor));
    } else {
      setQuantidade("");
      setValor("");
    }
  }, [selectedDate, monthGoals]);

  const handleSave = async () => {
    if (!quantidade && !valor) {
      toast({ title: "Preencha ao menos um campo", variant: "destructive" });
      return;
    }
    setSaving(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    const { error } = await supabase
      .from("daily_goals")
      .upsert(
        {
          date: dateStr,
          meta_agendamento_quantidade: parseInt(quantidade) || 0,
          meta_agendamento_valor: parseFloat(valor) || 0,
        },
        { onConflict: "date" }
      );

    if (error) {
      toast({ title: "Erro ao salvar meta", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Meta salva!", description: `Meta do dia ${format(selectedDate, "dd/MM/yyyy")} salva.` });
      queryClient.invalidateQueries({ queryKey: ['tv-metas-independentes'] });
      fetchMonthGoals();
    }
    setSaving(false);
  };

  const handleBulkCopy = async () => {
    if (bulkDays.length === 0) {
      toast({ title: "Selecione ao menos um dia", variant: "destructive" });
      return;
    }
    if (!quantidade && !valor) {
      toast({ title: "Preencha os valores antes de copiar", variant: "destructive" });
      return;
    }

    setCopyingSaving(true);
    const records = bulkDays.map((d) => ({
      date: format(d, "yyyy-MM-dd"),
      meta_agendamento_quantidade: parseInt(quantidade) || 0,
      meta_agendamento_valor: parseFloat(valor) || 0,
    }));

    const { error } = await supabase
      .from("daily_goals")
      .upsert(records, { onConflict: "date" });

    if (error) {
      toast({ title: "Erro ao copiar metas", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Metas copiadas!", description: `${bulkDays.length} dias atualizados.` });
      queryClient.invalidateQueries({ queryKey: ['tv-metas-independentes'] });
      setShowBulkCopy(false);
      setBulkDays([]);
      fetchMonthGoals();
    }
    setCopyingSaving(false);
  };

  // Generate weekdays of current month for bulk selection
  const monthWeekdays = eachDayOfInterval({
    start: startOfMonth(selectedDate),
    end: endOfMonth(selectedDate),
  }).filter((d) => !isWeekend(d));

  const toggleBulkDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    setBulkDays((prev) => {
      const exists = prev.some((d) => format(d, "yyyy-MM-dd") === dayStr);
      if (exists) return prev.filter((d) => format(d, "yyyy-MM-dd") !== dayStr);
      return [...prev, day];
    });
  };

  const selectAllWeekdays = () => setBulkDays(monthWeekdays);
  const clearSelection = () => setBulkDays([]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Metas Diárias de Agendamento</CardTitle>
          <CardDescription>
            Defina a meta de quantidade de agendamentos e valor de OS para cada dia.
            Essas metas alimentam os KPIs do Dashboard TV.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date picker */}
          <div className="space-y-2">
            <Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[260px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "PPP", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="meta_qtd">Meta de Agendamentos (qtd)</Label>
              <Input
                id="meta_qtd"
                type="number"
                min="0"
                placeholder="Ex: 5"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta_valor">Meta de Valor de OS (R$)</Label>
              <Input
                id="meta_valor"
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex: 5000"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar Meta
            </Button>
            <Button variant="outline" onClick={() => setShowBulkCopy(!showBulkCopy)}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar para vários dias
            </Button>
          </div>

          {/* Bulk copy */}
          {showBulkCopy && (
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Copiar metas para múltiplos dias</CardTitle>
                <CardDescription>
                  Os valores acima serão aplicados a todos os dias selecionados.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllWeekdays}>
                    Selecionar dias úteis do mês
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    Limpar
                  </Button>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 max-h-48 overflow-y-auto">
                  {monthWeekdays.map((day) => {
                    const dayStr = format(day, "yyyy-MM-dd");
                    const isSelected = bulkDays.some((d) => format(d, "yyyy-MM-dd") === dayStr);
                    return (
                      <label
                        key={dayStr}
                        className={cn(
                          "flex items-center gap-1 p-1.5 rounded text-xs cursor-pointer border",
                          isSelected ? "bg-primary/10 border-primary" : "border-transparent hover:bg-muted"
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleBulkDay(day)}
                        />
                        {format(day, "dd/MM")}
                      </label>
                    );
                  })}
                </div>
                <Button onClick={handleBulkCopy} disabled={copyingSaving || bulkDays.length === 0}>
                  {copyingSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  Aplicar em {bulkDays.length} dia(s)
                </Button>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Monthly listing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Metas cadastradas — {format(selectedDate, "MMMM yyyy", { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingGoals ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : monthGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada neste mês.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Meta Qtd</TableHead>
                    <TableHead className="text-right">Meta Valor (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthGoals.map((goal) => {
                    const [y, m, d] = goal.date.split("-").map(Number);
                    const goalDate = new Date(y, m - 1, d);
                    return (
                      <TableRow
                        key={goal.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedDate(goalDate)}
                      >
                        <TableCell>{format(goalDate, "dd/MM/yyyy (EEE)", { locale: ptBR })}</TableCell>
                        <TableCell className="text-right">{goal.meta_agendamento_quantidade}</TableCell>
                        <TableCell className="text-right">
                          {Number(goal.meta_agendamento_valor).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
