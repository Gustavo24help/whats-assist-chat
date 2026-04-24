import { useDashboardLayout } from '@/contexts/DashboardLayoutContext';
import { OperationalKPIsSection } from './OperationalKPIsSection';
import { ConversionRatesSection } from './ConversionRatesSection';
import { GoogleAdsSection } from './GoogleAdsSection';
import { ConversionFunnel, ServicesLineChart, AdsPerformanceChart, TicketMedioChart, ROIChart } from './index';
import type { FunnelStepData } from './ConversionFunnel';
import { ExportReportSection } from './ExportReportSection';
import { SectionHeader } from './SectionHeader';
import {
  useOperationalKPIs,
  FALLBACK_OPERATIONAL_KPIS,
  type PeriodOption,
  type ComparisonMode,
} from '@/hooks/useOperationalKPIs';
import { useGoogleAdsMetrics, FALLBACK_METRICS } from '@/hooks/useGoogleAdsMetrics';

interface DashboardContentProps {
  period: PeriodOption;
  customDateRange?: { from: Date; to: Date };
  comparisonMode?: ComparisonMode;
  comparisonRange?: { from: Date; to: Date };
}

export const DashboardContent = ({
  period,
  customDateRange,
  comparisonMode = 'previous-month',
  comparisonRange,
}: DashboardContentProps) => {
  const { blocks } = useDashboardLayout();

  // Buscar KPIs operacionais para usar nas taxas de conversão
  const { data: kpis } = useOperationalKPIs({
    period,
    customRange: customDateRange,
    comparisonMode,
    comparisonRange,
  });

  const kpiData = kpis || FALLBACK_OPERATIONAL_KPIS;

  const sortedBlocks = [...blocks]
    .filter(block => block.enabled)
    .sort((a, b) => a.order - b.order);

  const renderBlock = (blockId: string) => {
    switch (blockId) {
      case 'operational-kpis':
        return (
          <OperationalKPIsSection 
            key={blockId}
            period={period} 
            customDateRange={customDateRange}
            comparisonMode={comparisonMode}
            comparisonRange={comparisonRange}
          />
        );

      case 'conversion-funnel':
        return (
          <div key={blockId} className="space-y-6">
            <ConversionRatesSection
              fsCriadas={kpiData.fsCriadas}
              servicosAgendados={kpiData.servicoAgendado}
              servicosFinalizados={kpiData.servicoFinalizado}
              finalizadosPagos={kpiData.finalizadoPago}
            />
            <ConversionFunnel />
          </div>
        );

      case 'google-ads':
        return (
          <GoogleAdsSection 
            key={blockId}
            period={period}
            customDateRange={customDateRange}
          />
        );

      case 'charts':
        return (
          <section key={blockId}>
            <SectionHeader 
              title="Evolução Mensal" 
              subtitle="Análises e tendências"
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
              <ServicesLineChart />
              <AdsPerformanceChart />
              <TicketMedioChart />
              <ROIChart />
            </div>
          </section>
        );

      case 'export':
        return (
          <section key={blockId}>
            <SectionHeader 
              title="Relatórios" 
              subtitle="Exporte dados personalizados para análise"
            />
            <div className="mt-4">
              <ExportReportSection />
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <main className="flex-1 p-6 space-y-8 overflow-auto">
      {sortedBlocks.map(block => renderBlock(block.id))}
    </main>
  );
};
