import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Info, RefreshCw, Users, TrendingUp, DollarSign, Clock, Moon } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer,
  Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import {
  useRecurrenceSummary, useRecurrenceCohorts, useRecurrenceProviderFirst,
  useRecurrenceProviderDormant, useRecurrenceReactivation, Segment,
} from "@/hooks/useRecurrenceDashboard";

const fmtBRL = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number | null | undefined) => (v == null ? "—" : `${Number(v).toFixed(1)}%`);
const fmtNum = (v: number | null | undefined) => (v == null ? "—" : new Intl.NumberFormat("pt-BR").format(v));

// Lista de meses disponíveis: de out/2025 até o mês atual
const buildMeses = () => {
  const out: { value: string; label: string }[] = [];
  const start = new Date(2025, 9, 1); // out/2025
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), 1);
  const cursor = new Date(end);
  while (cursor >= start) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const value = `${y}-${String(m + 1).padStart(2, "0")}`;
    const label = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    out.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return [{ value: "all", label: "Todo o histórico" }, ...out];
};
const MESES = buildMeses();

const KPI = ({ titulo, valor, hint, icon: Icon }: { titulo: string; valor: string; hint?: string; icon?: any }) => (
  <Card className="border-border/60">
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{titulo}</p>
            {hint && (
              <TooltipProvider><Tooltip><TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/60" />
              </TooltipTrigger><TooltipContent className="max-w-xs"><p className="text-xs">{hint}</p></TooltipContent></Tooltip></TooltipProvider>
            )}
          </div>
          <p className="text-2xl font-semibold tabular-nums">{valor}</p>
        </div>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground/50 mt-1" />}
      </div>
    </CardContent>
  </Card>
);

const TAG_LABEL: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
  recorrente_alerta_90d: { label: "Alerta 90d", variant: "secondary" },
  recorrente_dormindo_180d: { label: "Dormindo 180d", variant: "outline" },
  recorrente_perdido_365d: { label: "Perdido 365d", variant: "destructive" },
  promotor_sem_recompra: { label: "Promotor sem recompra", variant: "default" },
  alto_valor_sem_recompra: { label: "Alto valor sem recompra", variant: "default" },
};

const DashboardRecorrencia = () => {
  const [periodo, setPeriodo] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [segment, setSegment] = useState<Segment>("all");
  const [filtroPrestador, setFiltroPrestador] = useState("");
  const [filtroTag, setFiltroTag] = useState<string>("all");

  const { start, end } = useMemo(() => {
    if (periodo === "all") {
      return { start: new Date(2020, 0, 1), end: new Date() };
    }
    const [y, m] = periodo.split("-").map(Number);
    const s = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const e = new Date(y, m, 0, 23, 59, 59, 999); // último dia do mês
    return { start: s, end: e };
  }, [periodo]);

  const summary = useRecurrenceSummary(start, end, segment);
  const cohorts = useRecurrenceCohorts(segment);
  const providerFirst = useRecurrenceProviderFirst(segment);
  const providerDormant = useRecurrenceProviderDormant(segment);
  const reactivation = useRecurrenceReactivation(segment, 500);

  const refetchAll = () => {
    summary.refetch(); cohorts.refetch(); providerFirst.refetch();
    providerDormant.refetch(); reactivation.refetch();
  };

  const data = summary.data;
  const buckets = data?.tempo_recorrencia ?? {};
  const bucketLabels: Record<string, string> = {
    d_0_7: "Até 7 dias", d_8_30: "8 a 30 dias", d_31_60: "31 a 60 dias",
    d_61_90: "61 a 90 dias", d_91_180: "91 a 180 dias", d_181_365: "181 a 365 dias",
    d_365_plus: "Mais de 365 dias", nao_voltou: "Ainda não voltou",
  };
  const bucketChart = Object.entries(bucketLabels).map(([k, l]) => ({
    label: l, qtd: buckets[k] ?? 0,
  }));

  const providersFilt = (rows: any[] | undefined) =>
    !rows ? [] : !filtroPrestador.trim() ? rows :
      rows.filter(r => (r.provider_name ?? "").toLowerCase().includes(filtroPrestador.trim().toLowerCase()));

  const tagsFilt = !reactivation.data ? [] :
    filtroTag === "all" ? reactivation.data : reactivation.data.filter(r => r.tag === filtroTag);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Recorrência, LTV e Cohorts</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Recompra, LTV/CAC, cohorts trimestrais e influência dos prestadores no retorno dos clientes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{PERIODOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={segment} onValueChange={(v) => setSegment(v as Segment)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="B2C">B2C</SelectItem>
                <SelectItem value="B2B">B2B</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={refetchAll} title="Atualizar">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Cards executivos */}
        {summary.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 15 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <KPI titulo="Clientes totais" valor={fmtNum(data.clientes_total)} icon={Users}
              hint="Clientes únicos (após dedupe por CNPJ/CPF/telefone) com ao menos 1 serviço válido (finalizado ou em garantia) no histórico." />
            <KPI titulo="Clientes recorrentes" valor={fmtNum(data.clientes_recorrentes)}
              hint="Clientes com 2+ serviços válidos em qualquer momento do histórico." />
            <KPI titulo="Recorrência geral" valor={fmtPct(data.recorrencia_geral_pct)}
              hint="Clientes recorrentes ÷ clientes totais." />
            <KPI titulo="Clientes no período" valor={fmtNum(data.clientes_periodo)}
              hint="Clientes únicos atendidos no período selecionado." />
            <KPI titulo="Recorrentes no período" valor={fmtNum(data.recorrentes_periodo)}
              hint="Dos clientes do período, quantos já tinham serviço anterior ao início do período (qualquer momento da história)." />
            <KPI titulo="Recorrência do período" valor={fmtPct(data.recorrencia_periodo_pct)}
              hint="Recorrentes do período ÷ clientes do período." />
            <KPI titulo="Receita do período" valor={fmtBRL(data.receita_total)} icon={DollarSign} />
            <KPI titulo="Receita recorrente" valor={fmtBRL(data.receita_recorrente)}
              hint="Soma dos serviços do período feitos por clientes que têm 2+ serviços no histórico." />
            <KPI titulo="% receita recorrente" valor={fmtPct(data.pct_receita_recorrente)} />
            <KPI titulo="CAC economizado" valor={fmtBRL(data.cac_economizado)}
              hint={`R$ ${data.cac_fixo} × clientes recorrentes do período. CAC fixo: R$ ${data.cac_fixo}.`} />
            <KPI titulo="LTV médio bruto" valor={fmtBRL(data.ltv_avg)} icon={TrendingUp}
              hint="Soma do valor de todos os serviços válidos do cliente, em média." />
            <KPI titulo="LTV líquido de CAC" valor={fmtBRL(data.ltv_liq)}
              hint="LTV médio bruto - R$ 80 (CAC fixo por cliente novo)." />
            <KPI titulo="LTV / CAC" valor={data.ltv_cac?.toFixed(2) ?? "—"}
              hint="LTV médio bruto ÷ R$ 80." />
            <KPI titulo="Dias até recorrência" valor={`${data.dias_avg ?? 0} / ${data.dias_med ?? 0}`} icon={Clock}
              hint="Média / mediana de dias entre o 1º e o 2º serviço válido do cliente." />
            <KPI titulo="Recorrentes dormindo" valor={fmtNum(data.recorrentes_dormindo)} icon={Moon}
              hint="Clientes com 2+ serviços sem novo serviço há mais de 180 dias." />
          </div>
        ) : null}

        <Tabs defaultValue="serie">
          <TabsList>
            <TabsTrigger value="serie">Série mensal</TabsTrigger>
            <TabsTrigger value="cohorts">Cohorts trimestrais</TabsTrigger>
            <TabsTrigger value="tempo">Tempo até recorrência</TabsTrigger>
            <TabsTrigger value="prestadores">Prestadores</TabsTrigger>
            <TabsTrigger value="reativacao">Tags de reativação</TabsTrigger>
            <TabsTrigger value="nps">NPS</TabsTrigger>
          </TabsList>

          <TabsContent value="serie" className="mt-4">
            <Card><CardHeader><CardTitle className="text-base">Recorrência mensal</CardTitle></CardHeader>
              <CardContent>
                {summary.isLoading ? <Skeleton className="h-80" /> : (
                  <ResponsiveContainer width="100%" height={360}>
                    <ComposedChart data={data?.serie_mensal ?? []}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="mes" fontSize={11} />
                      <YAxis yAxisId="left" fontSize={11} />
                      <YAxis yAxisId="right" orientation="right" fontSize={11} unit="%" />
                      <RTooltip formatter={(v: any, name: string) => name.includes("%") ? `${v}%` : name.includes("Receita") ? fmtBRL(v) : v} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="clientes_unicos" name="Clientes únicos" fill="hsl(var(--primary))" />
                      <Bar yAxisId="left" dataKey="recorrentes" name="Recorrentes" fill="hsl(var(--chart-2, 220 70% 50%))" />
                      <Line yAxisId="right" dataKey="pct_recorrencia" name="% recorrência" stroke="hsl(var(--destructive))" strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card className="mt-3"><CardHeader><CardTitle className="text-base">Receita recorrente mensal</CardTitle></CardHeader>
              <CardContent>
                {summary.isLoading ? <Skeleton className="h-60" /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data?.serie_mensal ?? []}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="mes" fontSize={11} />
                      <YAxis fontSize={11} tickFormatter={(v) => fmtBRL(v)} />
                      <RTooltip formatter={(v: any) => fmtBRL(v)} />
                      <Legend />
                      <Bar dataKey="receita_total" name="Receita total" fill="hsl(var(--muted-foreground))" />
                      <Bar dataKey="receita_recorrente" name="Receita recorrente" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cohorts" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cohorts trimestrais por primeiro serviço válido</CardTitle>
                <p className="text-xs text-muted-foreground">Janelas que ainda não fecharam aparecem como "—" (nunca zero).</p>
              </CardHeader>
              <CardContent>
                {cohorts.isLoading ? <Skeleton className="h-64" /> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cohort</TableHead>
                          <TableHead className="text-right">Novos</TableHead>
                          <TableHead className="text-right">30d</TableHead>
                          <TableHead className="text-right">60d</TableHead>
                          <TableHead className="text-right">90d</TableHead>
                          <TableHead className="text-right">180d</TableHead>
                          <TableHead className="text-right">365d</TableHead>
                          <TableHead className="text-right">Algum</TableHead>
                          <TableHead className="text-right">Dias méd</TableHead>
                          <TableHead className="text-right">Dias med</TableHead>
                          <TableHead className="text-right">LTV méd</TableHead>
                          <TableHead className="text-right">Rec. recorrente</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(cohorts.data ?? []).map((c) => (
                          <TableRow key={c.cohort_start}>
                            <TableCell className="font-medium">{c.cohort_label}</TableCell>
                            <TableCell className="text-right tabular-nums">{c.clientes}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtPct(c.voltou_30)}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtPct(c.voltou_60)}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtPct(c.voltou_90)}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtPct(c.voltou_180)}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtPct(c.voltou_365)}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">{fmtPct(c.voltou_any)}</TableCell>
                            <TableCell className="text-right tabular-nums">{c.tempo_avg ?? "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{c.tempo_med ?? "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtBRL(c.ltv_avg)}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtBRL(c.receita_recorrente)}</TableCell>
                          </TableRow>
                        ))}
                        {!cohorts.data?.length && (
                          <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-6">Sem cohorts.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tempo" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Distribuição do tempo do 1º para o 2º serviço</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={bucketChart}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis fontSize={11} />
                    <RTooltip />
                    <Bar dataKey="qtd" name="Clientes" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prestadores" className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <Input placeholder="Filtrar prestador..." value={filtroPrestador}
                onChange={(e) => setFiltroPrestador(e.target.value)} className="max-w-xs" />
              <p className="text-xs text-muted-foreground">
                Atenção: os números abaixo são <strong>indícios</strong>, não causalidade. Diferenças podem refletir tipo de serviço, região, ticket, urgência ou perfil do cliente.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Prestadores que mais retêm (primeiro serviço)</CardTitle>
                <p className="text-xs text-muted-foreground">Agrupado pelo prestador do <strong>primeiro</strong> serviço válido. Min. 3 clientes iniciados.</p>
              </CardHeader>
              <CardContent>
                {providerFirst.isLoading ? <Skeleton className="h-48" /> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Prestador</TableHead>
                        <TableHead className="text-right">Iniciados</TableHead>
                        <TableHead className="text-right">Voltaram</TableHead>
                        <TableHead className="text-right">Taxa retorno</TableHead>
                        <TableHead className="text-right">LTV méd</TableHead>
                        <TableHead className="text-right">Rec. recorrente</TableHead>
                        <TableHead className="text-right">NPS méd</TableHead>
                        <TableHead className="text-right">Ticket 1º</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {providersFilt(providerFirst.data).map((p) => (
                          <TableRow key={p.provider_id}>
                            <TableCell className="font-medium">{p.provider_name}</TableCell>
                            <TableCell className="text-right tabular-nums">{p.clientes_iniciados}</TableCell>
                            <TableCell className="text-right tabular-nums">{p.clientes_voltaram}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">{fmtPct(p.taxa_retorno_pct)}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtBRL(p.ltv_avg)}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtBRL(p.receita_recorrente)}</TableCell>
                            <TableCell className="text-right tabular-nums">{p.nps_avg ?? "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtBRL(p.ticket_primeiro_avg)}</TableCell>
                          </TableRow>
                        ))}
                        {!providerFirst.data?.length && (
                          <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sem dados.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Prestador do último serviço antes do sumiço</CardTitle>
                <p className="text-xs text-muted-foreground">Clientes recorrentes (2+ serviços) que estão sem novo serviço há mais de 180 dias. Min. 2 clientes por prestador.</p>
              </CardHeader>
              <CardContent>
                {providerDormant.isLoading ? <Skeleton className="h-40" /> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Prestador</TableHead>
                        <TableHead className="text-right">Clientes que sumiram</TableHead>
                        <TableHead className="text-right">NPS méd último</TableHead>
                        <TableHead className="text-right">Ticket méd último</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {providersFilt(providerDormant.data).map((p) => (
                          <TableRow key={p.provider_id}>
                            <TableCell className="font-medium">{p.provider_name}</TableCell>
                            <TableCell className="text-right tabular-nums">{p.clientes_que_sumiram}</TableCell>
                            <TableCell className="text-right tabular-nums">{p.nps_avg_ultimo ?? "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtBRL(p.ticket_avg_ultimo)}</TableCell>
                          </TableRow>
                        ))}
                        {!providerDormant.data?.length && (
                          <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem dados — ninguém sumiu ainda.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reativacao" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-base">Tags de reativação</CardTitle>
                  <Select value={filtroTag} onValueChange={setFiltroTag}>
                    <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as tags</SelectItem>
                      {Object.entries(TAG_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {reactivation.isLoading ? <Skeleton className="h-64" /> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Segmento</TableHead>
                        <TableHead>Tag</TableHead>
                        <TableHead>Último serviço</TableHead>
                        <TableHead>Último prestador</TableHead>
                        <TableHead className="text-right">Dias</TableHead>
                        <TableHead className="text-right">LTV</TableHead>
                        <TableHead className="text-right">NPS</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {tagsFilt.slice(0, 200).map((r) => {
                          const t = TAG_LABEL[r.tag];
                          return (
                            <TableRow key={r.canonical_id + r.tag}>
                              <TableCell>
                                <div className="font-medium">{r.cliente_nome}</div>
                                <div className="text-xs text-muted-foreground">{r.cliente_telefone}</div>
                              </TableCell>
                              <TableCell><Badge variant="outline">{r.segmento}</Badge></TableCell>
                              <TableCell><Badge variant={t?.variant ?? "secondary"}>{t?.label ?? r.tag}</Badge></TableCell>
                              <TableCell className="text-xs">{new Date(r.ultimo_servico).toLocaleDateString("pt-BR")}</TableCell>
                              <TableCell className="text-xs">{r.ultimo_prestador ?? "—"}</TableCell>
                              <TableCell className="text-right tabular-nums">{r.dias_sem_servico}</TableCell>
                              <TableCell className="text-right tabular-nums">{fmtBRL(r.ltv)}</TableCell>
                              <TableCell className="text-right tabular-nums">{r.nps_ultimo ?? "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                        {!tagsFilt.length && (
                          <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nenhum cliente nesta tag.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {tagsFilt.length > 200 && (
                  <p className="text-xs text-muted-foreground mt-2">Exibindo os 200 primeiros de {tagsFilt.length}.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="nps" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">NPS × Recorrência</CardTitle></CardHeader>
              <CardContent className="py-10">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    O cruzamento detalhado de NPS por grupo de recorrência ainda não está disponível nesta versão do dashboard.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    O NPS individual (último atendimento) já aparece nas tabelas de Prestadores e Tags de reativação acima.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DashboardRecorrencia;
