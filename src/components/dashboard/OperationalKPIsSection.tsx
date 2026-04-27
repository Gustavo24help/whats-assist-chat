import { useState, useCallback } from 'react';
import { SectionHeader } from './SectionHeader';
import { KPICard } from './KPICard';
import { KPIFilters } from './KPIFilters';
import { KPIDrillDownDialog } from './KPIDrillDownDialog';
import {
  useOperationalKPIs,
  FALLBACK_OPERATIONAL_KPIS,
  type PeriodOption,
  type ComparisonMode,
} from '@/hooks/useOperationalKPIs';
import type { DrillDownKPI } from '@/hooks/useKPIDrillDown';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import {
  MessageCircle,
  FileText,
  CalendarCheck,
  Wrench,
  CheckCircle2,
  DollarSign,
  Flag,
  Banknote,
  Hammer,
  Package,
  ClipboardList,
  HandCoins,
  PiggyBank,
  Percent,
} from 'lucide-react';

interface OperationalKPIsSectionProps {
  period: PeriodOption;
  customDateRange?: { from: Date; to: Date };
  comparisonMode?: ComparisonMode;
  comparisonRange?: { from: Date; to: Date };
}

const COMPARISON_LABEL: Record<ComparisonMode, string> = {
  'previous-month': 'vs mesmo período do mês anterior',
  'avg-3-months': 'vs média dos 3 meses anteriores',
  'custom': 'vs período personalizado',
};

export const OperationalKPIsSection = ({
  period,
  customDateRange,
  comparisonMode = 'previous-month',
  comparisonRange,
}: OperationalKPIsSectionProps) => {
  const [filters, setFilters] = useState<{
    categoriaId?: number;
    prestadorCpf?: string;
    clienteTelefone?: string;
  }>({});

  const [drillDown, setDrillDown] = useState<{ kpi: DrillDownKPI; label: string } | null>(null);

  const { data, isLoading } = useOperationalKPIs({
    period,
    customRange: customDateRange,
    comparisonMode,
    comparisonRange,
    ...filters,
  });

  const kpis = data || FALLBACK_OPERATIONAL_KPIS;
  const compLabel = COMPARISON_LABEL[comparisonMode];

  const handleFiltersChange = useCallback(
    (newFilters: {
      categoriaId?: number;
      prestadorCpf?: string;
      clienteTelefone?: string;
    }) => {
      setFilters(newFilters);
    },
    [],
  );

  const formatCurrency = (value: number) =>
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const openDrill = (kpi: DrillDownKPI, label: string) => () =>
    setDrillDown({ kpi, label });

  if (isLoading) {
    return (
      <section>
        <SectionHeader
          title="Métricas Operacionais"
          subtitle="KPIs do negócio em tempo real"
        >
          <KPIFilters onFiltersChange={handleFiltersChange} />
        </SectionHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
          {[...Array(14)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-12" />
            </Card>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader
        title="Métricas Operacionais"
        subtitle="Clique em qualquer KPI para abrir a planilha detalhada"
      >
        <KPIFilters onFiltersChange={handleFiltersChange} />
      </SectionHeader>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
        <KPICard
          label="Conversas Iniciadas"
          value={String(kpis.conversasIniciadas)}
          variation={kpis.variations.conversasIniciadas}
          comparisonLabel={compLabel}
          icon={<MessageCircle className="h-5 w-5" />}
          iconColor="brand-green"
          size="sm"
          animationDelay={0}
          tooltip="Cada nova ficha de serviço criada conta como uma conversa iniciada (nova demanda comercial). Equivale a FS Criadas com a estrutura atual."
          onClick={openDrill('conversasIniciadas', 'Conversas Iniciadas')}
        />
        <KPICard
          label="FS Criadas"
          value={String(kpis.fsCriadas)}
          variation={kpis.variations.fsCriadas}
          comparisonLabel={compLabel}
          icon={<FileText className="h-5 w-5" />}
          iconColor="brand-green"
          size="sm"
          animationDelay={50}
          tooltip="Fichas de serviço criadas no período (data de criação)."
          onClick={openDrill('fsCriadas', 'FS Criadas')}
        />
        <KPICard
          label="Nº Serviços Orçados"
          value={String(kpis.totalOrcamentos)}
          subValue={`${kpis.mediaOrcamentosPorFS.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} por FS`}
          variation={kpis.variations.totalOrcamentos}
          comparisonLabel={compLabel}
          icon={<ClipboardList className="h-5 w-5" />}
          iconColor="yellow"
          size="sm"
          animationDelay={75}
          tooltip="Total de orçamentos enviados pelos prestadores no período (cada linha em 'orcamentos' conta). O subtítulo mostra a média de orçamentos por FS com orçamento."
          onClick={openDrill('totalOrcamentos', 'Nº Serviços Orçados')}
        />
        <KPICard
          label="Visita Agendada"
          value={String(kpis.visitaAgendada)}
          variation={kpis.variations.visitaAgendada}
          comparisonLabel={compLabel}
          icon={<CalendarCheck className="h-5 w-5" />}
          iconColor="yellow"
          size="sm"
          animationDelay={100}
          tooltip="Fichas cujo status mudou para 'Visita Técnica' no período (histórico de status). Para fichas antigas sem histórico, usa data de criação como aproximação."
          onClick={openDrill('visitaAgendada', 'Visita Agendada')}
        />
        <KPICard
          label="Serviço Agendado"
          value={String(kpis.servicoAgendado)}
          subValue={`${kpis.servicoAgendado} agendado + ${kpis.finalizadoPago} concluído`}
          variation={kpis.variations.servicoAgendado}
          comparisonLabel={compLabel}
          icon={<Wrench className="h-5 w-5" />}
          iconColor="yellow"
          size="sm"
          animationDelay={150}
          tooltip="Mede o ATO de agendar (status virou 'Agendado'), não a data futura de execução. Fichas antigas sem histórico usam data de criação como fallback."
          onClick={openDrill('servicoAgendado', 'Serviço Agendado')}
        />
        <KPICard
          label="Serviço Finalizado"
          value={String(kpis.servicoFinalizado)}
          variation={kpis.variations.servicoFinalizado}
          comparisonLabel={compLabel}
          icon={<Flag className="h-5 w-5" />}
          iconColor="coral"
          size="sm"
          animationDelay={200}
          tooltip="Fichas cujo status mudou para 'Finalizado' no período. Independe de pagamento."
          onClick={openDrill('servicoFinalizado', 'Serviço Finalizado')}
        />
        <KPICard
          label="Finalizado e Pago (Cliente)"
          value={String(kpis.finalizadoPago)}
          variation={kpis.variations.finalizadoPago}
          comparisonLabel={compLabel}
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconColor="coral"
          size="sm"
          animationDelay={250}
          tooltip="Fichas finalizadas no período E com pagamento_realizado = true. Ancorado na data de finalização (não na criação)."
          onClick={openDrill('finalizadoPago', 'Finalizado e Pago (Cliente)')}
        />
        <KPICard
          label="Pago ao Prestador"
          value={String(kpis.pagoAoPrestador)}
          variation={kpis.variations.pagoAoPrestador}
          comparisonLabel={compLabel}
          icon={<Banknote className="h-5 w-5" />}
          iconColor="brand-green"
          size="sm"
          animationDelay={300}
          tooltip="Pagamentos realizados ao prestador no período (transacoes_financeiras.data_pagamento_realizada)."
          onClick={openDrill('pagoAoPrestador', 'Pago ao Prestador')}
        />
        <KPICard
          label="Valor Total OS"
          value={formatCurrency(kpis.valorTotalOS)}
          variation={kpis.variations.valorTotalOS}
          comparisonLabel={compLabel}
          icon={<DollarSign className="h-5 w-5" />}
          iconColor="coral"
          size="sm"
          animationDelay={350}
          tooltip="Soma do valor_total das fichas finalizadas e pagas no período (ancorado na data de finalização)."
          onClick={openDrill('valorTotalOS', 'Valor Total OS')}
        />
        <KPICard
          label="Valor Mão de Obra"
          value={formatCurrency(kpis.valorMaoObra)}
          variation={kpis.variations.valorMaoObra}
          comparisonLabel={compLabel}
          icon={<Hammer className="h-5 w-5" />}
          iconColor="yellow"
          size="sm"
          animationDelay={400}
          tooltip="Soma de valor_final_mao_obra (ou valor_mao_obra como fallback) das fichas finalizadas e pagas no período."
          onClick={openDrill('valorMaoObra', 'Valor Mão de Obra')}
        />
        <KPICard
          label="Valor Peças"
          value={formatCurrency(kpis.valorPecas)}
          variation={kpis.variations.valorPecas}
          comparisonLabel={compLabel}
          icon={<Package className="h-5 w-5" />}
          iconColor="brand-green"
          size="sm"
          animationDelay={450}
          tooltip="Soma de valor_final_pecas (ou valor_pecas como fallback) das fichas finalizadas e pagas no período."
          onClick={openDrill('valorPecas', 'Valor Peças')}
        />
        <KPICard
          label="Pago a Prestadores"
          value={formatCurrency(kpis.valorPagoPrestadores)}
          variation={kpis.variations.valorPagoPrestadores}
          comparisonLabel={compLabel}
          icon={<HandCoins className="h-5 w-5" />}
          iconColor="coral"
          size="sm"
          animationDelay={500}
          tooltip="Total pago aos prestadores no período (soma de valor_a_pagar_prestador das transações com status 'pago' ao prestador). Inclui mão de obra e o valor de peças quando NÃO são pagas pela 24help."
          onClick={openDrill('valorPagoPrestadores', 'Pago a Prestadores')}
        />
        <KPICard
          label="Líquido 24help"
          value={formatCurrency(kpis.valorLiquido24help)}
          variation={kpis.variations.valorLiquido24help}
          comparisonLabel={compLabel}
          icon={<PiggyBank className="h-5 w-5" />}
          iconColor="brand-green"
          size="sm"
          animationDelay={550}
          tooltip="Receita líquida da 24help: valor recebido do cliente menos o valor pago ao prestador. Quando o material é pago pela 24help, esse custo já está embutido na composição do pagamento ao prestador (sai do líquido)."
          onClick={openDrill('valorLiquido24help', 'Líquido 24help')}
        />
        <KPICard
          label="Margem Bruta 24help"
          value={`${kpis.margemBruta24help.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
          variation={kpis.variations.margemBruta24help}
          comparisonLabel={compLabel}
          icon={<Percent className="h-5 w-5" />}
          iconColor="yellow"
          size="sm"
          animationDelay={600}
          tooltip="Margem bruta = Líquido 24help / Pago a Prestadores × 100. Indica quanto a 24help retém como margem em relação ao custo direto do serviço."
          onClick={openDrill('margemBruta24help', 'Margem Bruta 24help')}
        />
      </div>

      <KPIDrillDownDialog
        open={!!drillDown}
        onOpenChange={(o) => !o && setDrillDown(null)}
        kpi={drillDown?.kpi || null}
        kpiLabel={drillDown?.label || ''}
        period={period}
        customRange={customDateRange}
        categoriaId={filters.categoriaId}
        prestadorCpf={filters.prestadorCpf}
        clienteTelefone={filters.clienteTelefone}
      />
    </section>
  );
};
