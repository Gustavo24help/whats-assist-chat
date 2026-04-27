import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Download, Search, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useKPIDrillDown, type DrillDownKPI } from '@/hooks/useKPIDrillDown';
import type { PeriodOption } from '@/hooks/useOperationalKPIs';
import { Link } from 'react-router-dom';

interface KPIDrillDownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kpi: DrillDownKPI | null;
  kpiLabel: string;
  period: PeriodOption;
  customRange?: { from: Date; to: Date };
  categoriaId?: number;
  prestadorCpf?: string;
  clienteTelefone?: string;
}

const formatMoeda = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const formatDate = (d: string | null) => {
  if (!d) return '-';
  try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return '-'; }
};

const PERIOD_LABEL: Record<PeriodOption, string> = {
  today: 'Hoje',
  '7days': 'Últimos 7 dias',
  '30days': 'Últimos 30 dias',
  month: 'Este mês',
  custom: 'Período personalizado',
};

const COLUMNS = [
  { key: 'data_evento', label: 'Data evento', cls: 'whitespace-nowrap' },
  { key: 'ficha_id', label: 'Ficha', cls: 'font-mono whitespace-nowrap' },
  { key: 'cliente', label: 'Cliente', cls: 'whitespace-nowrap max-w-[180px] truncate' },
  { key: 'prestador', label: 'Prestador', cls: 'whitespace-nowrap max-w-[160px] truncate' },
  { key: 'categoria', label: 'Categoria', cls: 'whitespace-nowrap' },
  { key: 'status', label: 'Status', cls: 'whitespace-nowrap' },
  { key: 'mao_obra', label: 'Mão de obra', cls: 'text-right whitespace-nowrap' },
  { key: 'pecas', label: 'Peças', cls: 'text-right whitespace-nowrap' },
  { key: 'pago_prestador', label: 'Pago a prestador', cls: 'text-right whitespace-nowrap' },
  { key: 'total_os', label: 'Total OS', cls: 'text-right whitespace-nowrap font-semibold' },
  { key: 'liquido_24h', label: 'Líquido 24help', cls: 'text-right whitespace-nowrap' },
  { key: 'margem', label: 'Margem bruta', cls: 'text-right whitespace-nowrap' },
  { key: 'pgto_prest', label: 'Pgto prestador', cls: 'whitespace-nowrap' },
  { key: 'pgto_cli', label: 'Pgto cliente', cls: 'whitespace-nowrap' },
] as const;

export const KPIDrillDownDialog = ({
  open,
  onOpenChange,
  kpi,
  kpiLabel,
  period,
  customRange,
  categoriaId,
  prestadorCpf,
  clienteTelefone,
}: KPIDrillDownDialogProps) => {
  const [search, setSearch] = useState('');

  const { data: rows = [], isLoading } = useKPIDrillDown({
    kpi: kpi as DrillDownKPI,
    period,
    customRange,
    categoriaId,
    prestadorCpf,
    clienteTelefone,
    enabled: open && !!kpi,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.ficha_id.toLowerCase().includes(s) ||
        r.cliente_nome.toLowerCase().includes(s) ||
        r.prestador_nome.toLowerCase().includes(s) ||
        (r.categoria || '').toLowerCase().includes(s),
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.maoObra += r.valor_mao_obra;
        acc.pecas += r.valor_pecas;
        acc.pagoPrestador += r.valor_pago_prestador;
        acc.totalOS += r.valor_total_os;
        acc.liquido += r.valor_liquido_24help;
        return acc;
      },
      { maoObra: 0, pecas: 0, pagoPrestador: 0, totalOS: 0, liquido: 0 },
    );
  }, [filtered]);

  const margemTotal =
    totals.pagoPrestador > 0 ? (totals.liquido / totals.pagoPrestador) * 100 : 0;

  const exportCsv = () => {
    const header = COLUMNS.map((c) => c.label).join(',');
    const lines = filtered.map((r) =>
      [
        formatDate(r.data_evento),
        r.ficha_id,
        r.cliente_nome,
        r.prestador_nome,
        r.categoria || '',
        r.status_atual || '',
        r.valor_mao_obra.toFixed(2),
        r.valor_pecas.toFixed(2),
        r.valor_pago_prestador.toFixed(2),
        r.valor_total_os.toFixed(2),
        r.valor_liquido_24help.toFixed(2),
        r.margem_bruta_pct.toFixed(1) + '%',
        r.status_pagamento_prestador === 'pago' ? 'Pago' : 'Pendente',
        r.pagamento_cliente_realizado ? 'Sim' : 'Não',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${kpi}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const periodText =
    period === 'custom' && customRange
      ? `${format(customRange.from, 'dd/MM/yyyy')} – ${format(customRange.to, 'dd/MM/yyyy')}`
      : PERIOD_LABEL[period];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] xl:max-w-[1400px] h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <DialogTitle className="text-xl">{kpiLabel}</DialogTitle>
              <DialogDescription>
                {filtered.length} serviço{filtered.length === 1 ? '' : 's'} • {periodText}
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
          </div>

          {/* Totais agregados */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            <div className="min-w-[110px] rounded-md border bg-muted/30 px-3 py-1.5 shrink-0">
              <div className="text-[10px] text-muted-foreground uppercase">Mão obra</div>
              <div className="text-sm font-semibold">{formatMoeda(totals.maoObra)}</div>
            </div>
            <div className="min-w-[110px] rounded-md border bg-muted/30 px-3 py-1.5 shrink-0">
              <div className="text-[10px] text-muted-foreground uppercase">Peças</div>
              <div className="text-sm font-semibold">{formatMoeda(totals.pecas)}</div>
            </div>
            <div className="min-w-[140px] rounded-md border bg-muted/30 px-3 py-1.5 shrink-0">
              <div className="text-[10px] text-muted-foreground uppercase">Pago prestador</div>
              <div className="text-sm font-semibold">{formatMoeda(totals.pagoPrestador)}</div>
            </div>
            <div className="min-w-[120px] rounded-md border bg-muted/30 px-3 py-1.5 shrink-0">
              <div className="text-[10px] text-muted-foreground uppercase">Total OS</div>
              <div className="text-sm font-bold">{formatMoeda(totals.totalOS)}</div>
            </div>
            <div className="min-w-[140px] rounded-md border bg-muted/30 px-3 py-1.5 shrink-0">
              <div className="text-[10px] text-muted-foreground uppercase">Líquido 24help</div>
              <div className="text-sm font-semibold text-green-700 dark:text-green-400">
                {formatMoeda(totals.liquido)}
              </div>
            </div>
            <div className="min-w-[120px] rounded-md border bg-muted/30 px-3 py-1.5 shrink-0">
              <div className="text-[10px] text-muted-foreground uppercase">Margem bruta</div>
              <div className="text-sm font-semibold">{margemTotal.toFixed(1)}%</div>
            </div>
          </div>

          <div className="relative mt-2 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar ficha, cliente, prestador, categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 pb-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              Nenhum serviço encontrado para este KPI no período.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto mt-2">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="bg-muted/60">
                    {COLUMNS.map((c) => (
                      <th
                        key={c.key}
                        className={cn(
                          'p-2 font-medium text-left border-b border-r last:border-r-0',
                          c.cls,
                        )}
                      >
                        {c.label}
                      </th>
                    ))}
                    <th className="p-2 border-b w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={`${r.ficha_id}-${i}`} className="hover:bg-muted/30">
                      <td className="p-2 border-r border-t whitespace-nowrap">
                        {formatDate(r.data_evento)}
                      </td>
                      <td className="p-2 border-r border-t font-mono whitespace-nowrap">
                        {r.ficha_id}
                      </td>
                      <td className="p-2 border-r border-t max-w-[180px] truncate" title={r.cliente_nome}>
                        {r.cliente_nome}
                      </td>
                      <td className="p-2 border-r border-t max-w-[160px] truncate" title={r.prestador_nome}>
                        {r.prestador_nome}
                      </td>
                      <td className="p-2 border-r border-t whitespace-nowrap">
                        {r.categoria || '-'}
                      </td>
                      <td className="p-2 border-r border-t whitespace-nowrap">
                        <Badge variant="outline" className="text-[10px] py-0 h-4">
                          {r.status_atual || '-'}
                        </Badge>
                      </td>
                      <td className="p-2 border-r border-t text-right whitespace-nowrap">
                        {formatMoeda(r.valor_mao_obra)}
                      </td>
                      <td className="p-2 border-r border-t text-right whitespace-nowrap">
                        {formatMoeda(r.valor_pecas)}
                        {r.material_pago_24help && (
                          <span className="ml-1 text-[9px] text-muted-foreground">(24h)</span>
                        )}
                      </td>
                      <td className="p-2 border-r border-t text-right whitespace-nowrap">
                        {formatMoeda(r.valor_pago_prestador)}
                      </td>
                      <td className="p-2 border-r border-t text-right whitespace-nowrap font-semibold">
                        {formatMoeda(r.valor_total_os)}
                      </td>
                      <td className="p-2 border-r border-t text-right whitespace-nowrap text-green-700 dark:text-green-400">
                        {formatMoeda(r.valor_liquido_24help)}
                      </td>
                      <td className="p-2 border-r border-t text-right whitespace-nowrap">
                        {r.margem_bruta_pct.toFixed(1)}%
                      </td>
                      <td className="p-2 border-r border-t whitespace-nowrap">
                        {r.status_pagamento_prestador === 'pago' ? (
                          <span className="text-green-700 dark:text-green-400 font-medium">Pago</span>
                        ) : (
                          <span className="text-orange-600 dark:text-orange-400">Pendente</span>
                        )}
                      </td>
                      <td className="p-2 border-r border-t whitespace-nowrap">
                        {r.pagamento_cliente_realizado ? (
                          <span className="text-green-700 dark:text-green-400 font-medium">Sim</span>
                        ) : (
                          <span className="text-muted-foreground">Não</span>
                        )}
                      </td>
                      <td className="p-2 border-t text-center">
                        <Link
                          to={`/fichas/${r.ficha_id}`}
                          target="_blank"
                          className="inline-flex items-center text-muted-foreground hover:text-foreground"
                          title="Abrir ficha"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
