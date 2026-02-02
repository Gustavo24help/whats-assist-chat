import { useState, useCallback } from 'react';
import { SectionHeader } from './SectionHeader';
import { KPICard } from './KPICard';
import { KPIFilters } from './KPIFilters';
import { useOperationalKPIs, FALLBACK_OPERATIONAL_KPIS, type PeriodOption } from '@/hooks/useOperationalKPIs';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { 
  MessageCircle, 
  FileText, 
  CalendarCheck, 
  Wrench, 
  CheckCircle2, 
  DollarSign 
} from 'lucide-react';

interface OperationalKPIsSectionProps {
  period: PeriodOption;
  customDateRange?: { from: Date; to: Date };
}

export const OperationalKPIsSection = ({ 
  period, 
  customDateRange 
}: OperationalKPIsSectionProps) => {
  const [filters, setFilters] = useState<{
    categoriaId?: number;
    prestadorCpf?: string;
    clienteTelefone?: string;
  }>({});

  const { data, isLoading } = useOperationalKPIs({
    period,
    customRange: customDateRange,
    ...filters,
  });

  const kpis = data || FALLBACK_OPERATIONAL_KPIS;

  const handleFiltersChange = useCallback((newFilters: {
    categoriaId?: number;
    prestadorCpf?: string;
    clienteTelefone?: string;
  }) => {
    setFilters(newFilters);
  }, []);

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  if (isLoading) {
    return (
      <section>
        <SectionHeader 
          title="Métricas Operacionais" 
          subtitle="KPIs do negócio em tempo real"
        >
          <KPIFilters onFiltersChange={handleFiltersChange} />
        </SectionHeader>
        
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
        title="Métricas Operacionais" 
        subtitle="KPIs do negócio em tempo real"
      >
        <KPIFilters onFiltersChange={handleFiltersChange} />
      </SectionHeader>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-4">
        <KPICard
          label="Conversas Iniciadas"
          value={String(kpis.conversasIniciadas)}
          variation={kpis.variations.conversasIniciadas}
          icon={<MessageCircle className="h-5 w-5" />}
          iconColor="brand-green"
          size="sm"
          animationDelay={0}
        />
        <KPICard
          label="FS Criadas"
          value={String(kpis.fsCriadas)}
          variation={kpis.variations.fsCriadas}
          icon={<FileText className="h-5 w-5" />}
          iconColor="brand-green"
          size="sm"
          animationDelay={50}
        />
        <KPICard
          label="Visita Agendada"
          value={String(kpis.visitaAgendada)}
          variation={kpis.variations.visitaAgendada}
          icon={<CalendarCheck className="h-5 w-5" />}
          iconColor="yellow"
          size="sm"
          animationDelay={100}
        />
        <KPICard
          label="Serviço Agendado"
          value={String(kpis.servicoAgendado)}
          variation={kpis.variations.servicoAgendado}
          icon={<Wrench className="h-5 w-5" />}
          iconColor="yellow"
          size="sm"
          animationDelay={150}
        />
        <KPICard
          label="Finalizado e Pago"
          value={String(kpis.finalizadoPago)}
          variation={kpis.variations.finalizadoPago}
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconColor="coral"
          size="sm"
          animationDelay={200}
        />
        <KPICard
          label="Valor Total OS"
          value={formatCurrency(kpis.valorTotalOS)}
          variation={kpis.variations.valorTotalOS}
          icon={<DollarSign className="h-5 w-5" />}
          iconColor="coral"
          size="sm"
          animationDelay={250}
        />
      </div>
    </section>
  );
};
