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

interface StatusRecord {
  status_novo: string;
  data_inicio: string;
  data_fim: string | null;
  ficha_id?: string;
}

interface StatusAvg {
  status: string;
  media: number;
  min: number;
  max: number;
  quantidade: number;
}

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

/**
 * Synthesize "Ficha Criada" records from fichas_de_servico.
 * The trigger only fires on UPDATE, so the initial status is never recorded.
 * For each ficha, we create a synthetic record:
 *   data_inicio = ficha.created_at
 *   data_fim = first status change (MIN data_inicio from historico) or null if still in "Ficha Criada"
 */
function synthesizeFichaCriada(
  fichas: { id: string; created_at: string; status: string }[],
  firstChangeMap: Map<string, string>,
): StatusRecord[] {
  return fichas.map(f => ({
    status_novo: 'Ficha Criada',
    data_inicio: f.created_at,
    data_fim: firstChangeMap.get(f.id) || null,
    ficha_id: f.id,
  }));
}

function calcAverages(records: StatusRecord[]): StatusAvg[] {
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

/**
 * Merge synthetic "Ficha Criada" records with real historico records,
 * removing duplicate "Ficha Criada" entries from the real data
 * (those come from fichas that were reverted back to "Ficha Criada").
 */
function mergeRecords(
  realRecords: StatusRecord[],
  syntheticRecords: StatusRecord[],
): StatusRecord[] {
  // Get ficha_ids that have synthetic records
  const syntheticFichaIds = new Set(syntheticRecords.map(r => r.ficha_id));

  // Filter out real "Ficha Criada" records for fichas that already have synthetic ones
  const filteredReal = realRecords.filter(r => {
    if (r.status_novo === 'Ficha Criada' && r.ficha_id && syntheticFichaIds.has(r.ficha_id)) {
      return false; // Remove duplicate
    }
    return true;
  });

  return [...syntheticRecords, ...filteredReal];
}

export function RelatorioTempoStatus() {
  const monthOptions = useMemo(buildMonthOptions, []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [year, month] = selectedMonth.split('-').map(Number);
  const from = startOfMonth(new Date(year, month - 1)).toISOString();
  const to = endOfMonth(new Date(year, month - 1)).toISOString();

  // 1. Fetch historico records for the selected month
  const { data: records, isLoading: loadingRecords } = useQuery({
    queryKey: ['tempo-status-report', selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ficha_status_historico')
        .select('status_novo, data_inicio, data_fim, ficha_id')
        .gte('data_inicio', from)
        .lte('data_inicio', to)
        .order('data_inicio', { ascending: true });
      if (error) throw error;
      return (data || []) as StatusRecord[];
    },
  });

  // 2. Fetch fichas created in the selected month (for synthetic "Ficha Criada")
  const { data: fichasDoMes, isLoading: loadingFichas } = useQuery({
    queryKey: ['fichas-do-mes', selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fichas_de_servico')
        .select('id, created_at, status')
        .gte('created_at', from)
        .lte('created_at', to);
      if (error) throw error;
      return (data || []) as { id: string; created_at: string; status: string }[];
    },
  });

  // 3. Fetch first status change per ficha (to know when "Ficha Criada" ended)
  const fichaIds = useMemo(() => fichasDoMes?.map(f => f.id) || [], [fichasDoMes]);

  const { data: firstChanges, isLoading: loadingFirstChanges } = useQuery({
    queryKey: ['first-status-change', fichaIds],
    queryFn: async () => {
      if (fichaIds.length === 0) return [];
      // Fetch all historico for these fichas, ordered, to find first change
      const { data, error } = await supabase
        .from('ficha_status_historico')
        .select('ficha_id, data_inicio')
        .in('ficha_id', fichaIds)
        .order('data_inicio', { ascending: true });
      if (error) throw error;
      return (data || []) as { ficha_id: string; data_inicio: string }[];
    },
    enabled: fichaIds.length > 0,
  });

  const isLoading = loadingRecords || loadingFichas || loadingFirstChanges;

  // Build first-change map (ficha_id -> earliest data_inicio)
  const firstChangeMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!firstChanges) return map;
    for (const fc of firstChanges) {
      if (!map.has(fc.ficha_id)) {
        map.set(fc.ficha_id, fc.data_inicio); // already ordered asc
      }
    }
    return map;
  }, [firstChanges]);

  // Compute merged averages
  const averages = useMemo(() => {
    if (!records || !fichasDoMes) return [];
    const synthetic = synthesizeFichaCriada(fichasDoMes, firstChangeMap);
    const merged = mergeRecords(records, synthetic);
    return calcAverages(merged);
  }, [records, fichasDoMes, firstChangeMap]);

  // ========== HISTORY MODAL ==========

  // All fichas ever (for history)
  const { data: allFichas, isLoading: loadingAllFichas } = useQuery({
    queryKey: ['all-fichas-for-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fichas_de_servico')
        .select('id, created_at, status')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as { id: string; created_at: string; status: string }[];
    },
    enabled: historyOpen,
  });

  const { data: allRecords, isLoading: histLoading } = useQuery({
    queryKey: ['tempo-status-historico-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ficha_status_historico')
        .select('status_novo, data_inicio, data_fim, ficha_id')
        .order('data_inicio', { ascending: true });
      if (error) throw error;
      return (data || []) as StatusRecord[];
    },
    enabled: historyOpen,
  });

  // All first changes for history
  const allFichaIds = useMemo(() => allFichas?.map(f => f.id) || [], [allFichas]);

  const { data: allFirstChanges, isLoading: loadingAllFirstChanges } = useQuery({
    queryKey: ['all-first-status-changes', allFichaIds.length],
    queryFn: async () => {
      if (allFichaIds.length === 0) return [];
      // Batch in chunks of 500 to avoid query limits
      const results: { ficha_id: string; data_inicio: string }[] = [];
      for (let i = 0; i < allFichaIds.length; i += 500) {
        const chunk = allFichaIds.slice(i, i + 500);
        const { data, error } = await supabase
          .from('ficha_status_historico')
          .select('ficha_id, data_inicio')
          .in('ficha_id', chunk)
          .order('data_inicio', { ascending: true });
        if (error) throw error;
        if (data) results.push(...data);
      }
      return results;
    },
    enabled: historyOpen && allFichaIds.length > 0,
  });

  const allFirstChangeMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!allFirstChanges) return map;
    for (const fc of allFirstChanges) {
      if (!map.has(fc.ficha_id)) {
        map.set(fc.ficha_id, fc.data_inicio);
      }
    }
    return map;
  }, [allFirstChanges]);

  const historyByMonth = useMemo(() => {
    if (!allRecords || !allFichas) return [];

    // Group fichas by month
    const fichasByMonth = new Map<string, typeof allFichas>();
    for (const f of allFichas) {
      const key = f.created_at.substring(0, 7);
      if (!fichasByMonth.has(key)) fichasByMonth.set(key, []);
      fichasByMonth.get(key)!.push(f);
    }

    // Group real records by month
    const recordsByMonth = new Map<string, StatusRecord[]>();
    for (const r of allRecords) {
      const key = r.data_inicio.substring(0, 7);
      if (!recordsByMonth.has(key)) recordsByMonth.set(key, []);
      recordsByMonth.get(key)!.push(r);
    }

    // All months from both sources
    const allMonthKeys = new Set([...fichasByMonth.keys(), ...recordsByMonth.keys()]);
    const sortedKeys = [...allMonthKeys].sort().reverse();

    const result: { month: string; label: string; averages: StatusAvg[] }[] = [];
    for (const key of sortedKeys) {
      const [y, m] = key.split('-').map(Number);
      const monthFichas = fichasByMonth.get(key) || [];
      const monthRecords = recordsByMonth.get(key) || [];
      const synthetic = synthesizeFichaCriada(monthFichas, allFirstChangeMap);
      const merged = mergeRecords(monthRecords, synthetic);

      result.push({
        month: key,
        label: format(new Date(y, m - 1), 'MMM yyyy', { locale: ptBR }),
        averages: calcAverages(merged),
      });
    }
    return result;
  }, [allRecords, allFichas, allFirstChangeMap]);

  const allStatuses = useMemo(() => {
    const set = new Set<string>();
    historyByMonth.forEach(m => m.averages.forEach(a => set.add(a.status)));
    return [...set].sort();
  }, [historyByMonth]);

  const histLoadingAll = histLoading || loadingAllFichas || loadingAllFirstChanges;

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
            {histLoadingAll ? (
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
