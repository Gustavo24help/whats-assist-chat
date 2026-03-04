import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { History, Clock } from 'lucide-react';

const STATUS_EXCLUIDOS = ['Finalizado', 'Perdido', 'Não foi adiante'];

function formatDuration(minutes: number): string {
  if (minutes < 1) return '<1min';
  const d = Math.floor(minutes / (60 * 24));
  const h = Math.floor((minutes % (60 * 24)) / 60);
  const m = Math.round(minutes % 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function buildMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    options.push({
      value: format(d, 'yyyy-MM'),
      label: format(d, 'MMMM yyyy', { locale: ptBR }),
    });
  }
  return options;
}

interface StatusAvg {
  status: string;
  media: number;
  min: number;
  max: number;
  quantidade: number;
}

function calcAverages(records: { status_novo: string; data_inicio: string; data_fim: string | null }[]): StatusAvg[] {
  const map = new Map<string, number[]>();
  const now = new Date();

  for (const r of records) {
    if (STATUS_EXCLUIDOS.includes(r.status_novo)) continue;
    const start = new Date(r.data_inicio);
    const end = r.data_fim ? new Date(r.data_fim) : now;
    const mins = Math.max(0, (end.getTime() - start.getTime()) / 60000);
    if (!map.has(r.status_novo)) map.set(r.status_novo, []);
    map.get(r.status_novo)!.push(mins);
  }

  const result: StatusAvg[] = [];
  for (const [status, durations] of map) {
    const sum = durations.reduce((a, b) => a + b, 0);
    result.push({
      status,
      media: sum / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      quantidade: durations.length,
    });
  }

  return result.sort((a, b) => b.media - a.media);
}

export function RelatorioTempoStatus() {
  const monthOptions = useMemo(buildMonthOptions, []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [year, month] = selectedMonth.split('-').map(Number);
  const from = startOfMonth(new Date(year, month - 1)).toISOString();
  const to = endOfMonth(new Date(year, month - 1)).toISOString();

  const { data: records, isLoading } = useQuery({
    queryKey: ['tempo-status-report', selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ficha_status_historico')
        .select('status_novo, data_inicio, data_fim')
        .gte('data_inicio', from)
        .lte('data_inicio', to)
        .order('data_inicio', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allRecords, isLoading: histLoading } = useQuery({
    queryKey: ['tempo-status-historico-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ficha_status_historico')
        .select('status_novo, data_inicio, data_fim')
        .order('data_inicio', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: historyOpen,
  });

  const averages = useMemo(() => records ? calcAverages(records) : [], [records]);

  const historyByMonth = useMemo(() => {
    if (!allRecords) return [];
    const monthMap = new Map<string, typeof allRecords>();
    for (const r of allRecords) {
      const key = r.data_inicio.substring(0, 7);
      if (!monthMap.has(key)) monthMap.set(key, []);
      monthMap.get(key)!.push(r);
    }
    const result: { month: string; label: string; averages: StatusAvg[] }[] = [];
    const sortedKeys = [...monthMap.keys()].sort().reverse();
    for (const key of sortedKeys) {
      const [y, m] = key.split('-').map(Number);
      result.push({
        month: key,
        label: format(new Date(y, m - 1), 'MMM yyyy', { locale: ptBR }),
        averages: calcAverages(monthMap.get(key)!),
      });
    }
    return result;
  }, [allRecords]);

  const allStatuses = useMemo(() => {
    const set = new Set<string>();
    historyByMonth.forEach(m => m.averages.forEach(a => set.add(a.status)));
    return [...set].sort();
  }, [historyByMonth]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Tempo Médio por Status
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
              <History className="h-4 w-4 mr-1" />
              Histórico
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : averages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro encontrado para este mês.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Média</TableHead>
                <TableHead className="text-right">Mín</TableHead>
                <TableHead className="text-right">Máx</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {averages.map(a => (
                <TableRow key={a.status}>
                  <TableCell className="font-medium">{a.status}</TableCell>
                  <TableCell className="text-right font-mono">{formatDuration(a.media)}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{formatDuration(a.min)}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{formatDuration(a.max)}</TableCell>
                  <TableCell className="text-right">{a.quantidade}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Histórico — Tempo Médio por Status (todos os meses)</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            {histLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : historyByMonth.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado disponível.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10">Mês</TableHead>
                      {allStatuses.map(s => (
                        <TableHead key={s} className="text-right whitespace-nowrap">{s}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyByMonth.map(m => (
                      <TableRow key={m.month}>
                        <TableCell className="font-medium sticky left-0 bg-background z-10 whitespace-nowrap capitalize">
                          {m.label}
                        </TableCell>
                        {allStatuses.map(s => {
                          const avg = m.averages.find(a => a.status === s);
                          return (
                            <TableCell key={s} className="text-right font-mono text-sm">
                              {avg ? formatDuration(avg.media) : '—'}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
