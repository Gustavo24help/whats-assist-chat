import { useState, useCallback } from 'react';
import { SectionHeader } from './SectionHeader';
import { KPICard } from './KPICard';
import { KPIFilters } from './KPIFilters';
import {
  useOperationalKPIs,
  FALLBACK_OPERATIONAL_KPIS,
  type PeriodOption,
  type ComparisonMode,
} from '@/hooks/useOperationalKPIs';
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
        subtitle="KPIs do negócio em tempo real"
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
        />
      </div>
    </section>
  );
};
