import { SectionHeader } from './SectionHeader';
import { KPICard } from './KPICard';
import { useGoogleAdsMetrics, FALLBACK_METRICS } from '@/hooks/useGoogleAdsMetrics';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { 
  Eye, 
  MousePointerClick, 
  Target, 
  Percent, 
  Receipt, 
  ArrowRightLeft 
} from 'lucide-react';

type PeriodOption = 'today' | '7days' | '30days' | 'month' | 'custom';

interface GoogleAdsSectionProps {
  period: PeriodOption;
  customDateRange?: { from: Date; to: Date };
}

export const GoogleAdsSection = ({ period, customDateRange }: GoogleAdsSectionProps) => {
  const { data: metrics, isLoading } = useGoogleAdsMetrics(period, customDateRange);
  const data = metrics || FALLBACK_METRICS;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString('pt-BR');
  };

  const formatCurrency = (num: number) => {
    return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  if (isLoading) {
    return (
      <section>
        <SectionHeader 
          title="Marketing · Google Ads" 
          subtitle="Performance das campanhas"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-4">
          {[...Array(6)].map((_, i) => (
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
        title="Marketing · Google Ads" 
        subtitle="Performance das campanhas"
      />
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-4">
        <KPICard
          label="Impressões"
          value={formatNumber(data.impressoes)}
          variation={data.variations.impressoes}
          icon={<Eye className="h-5 w-5" />}
          iconColor="brand-green"
          size="sm"
          animationDelay={0}
        />
        <KPICard
          label="Cliques"
          value={formatNumber(data.cliques)}
          variation={data.variations.cliques}
          icon={<MousePointerClick className="h-5 w-5" />}
          iconColor="brand-green"
          size="sm"
          animationDelay={50}
        />
        <KPICard
          label="Conversões"
          value={formatNumber(data.conversoes)}
          variation={data.variations.conversoes}
          icon={<Target className="h-5 w-5" />}
          iconColor="yellow"
          size="sm"
          animationDelay={100}
        />
        <KPICard
          label="CTR"
          value={`${data.ctr}%`}
          variation={data.variations.ctr}
          icon={<Percent className="h-5 w-5" />}
          iconColor="yellow"
          size="sm"
          animationDelay={150}
        />
        <KPICard
          label="Custo Ads"
          value={formatCurrency(data.custo)}
          variation={data.variations.custo}
          comparisonLabel="vs período anterior"
          icon={<Receipt className="h-5 w-5" />}
          iconColor="coral"
          size="sm"
          animationDelay={200}
        />
        <KPICard
          label="Cliques/Conv."
          value={String(data.clicksPerConversion)}
          variation={data.variations.clicksPerConversion}
          icon={<ArrowRightLeft className="h-5 w-5" />}
          iconColor="coral"
          size="sm"
          animationDelay={250}
        />
      </div>
    </section>
  );
};
