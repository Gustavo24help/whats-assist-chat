import { useDashboardLayout } from '@/contexts/DashboardLayoutContext';
import { ExecutiveDashboardSection } from './ExecutiveDashboardSection';
import { ServicesLineChart, TicketMedioChart } from './index';
import { ExportReportSection } from './ExportReportSection';
import { SectionHeader } from './SectionHeader';
import {
  type PeriodOption,
  type ComparisonMode,
} from '@/hooks/useOperationalKPIs';

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

  const sortedBlocks = [...blocks]
    .filter(block => block.enabled)
    .sort((a, b) => a.order - b.order);

  // O bloco executivo (funil + financeiro + volume) substitui visualmente
  // os antigos 'operational-kpis' e 'conversion-funnel'. Para evitar
  // duplicação, renderizamos uma única vez no primeiro dos dois que aparecer.
  let executiveRendered = false;

  const renderBlock = (blockId: string) => {
    switch (blockId) {
      case 'operational-kpis':
      case 'conversion-funnel': {
        if (executiveRendered) return null;
        executiveRendered = true;
        return (
          <ExecutiveDashboardSection
            key="executive-dashboard"
            period={period}
            customDateRange={customDateRange}
            comparisonMode={comparisonMode}
            comparisonRange={comparisonRange}
          />
        );
      }

      case 'google-ads':
        // Google Ads removido temporariamente do dashboard.
        return null;

      case 'charts':
        return (
          <section key={blockId}>
            <SectionHeader
              title="Evolução Mensal"
              subtitle="Análises e tendências"
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
              <ServicesLineChart />
              <TicketMedioChart />
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
