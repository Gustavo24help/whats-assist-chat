import { SectionHeader } from './SectionHeader';
import { KPICard } from './KPICard';
import { TrendingUp, Target, CheckCircle2 } from 'lucide-react';

interface ConversionRatesSectionProps {
  fsCriadas: number;
  servicosAgendados: number;
  finalizadosPagos: number;
}

export const ConversionRatesSection = ({
  fsCriadas,
  servicosAgendados,
  finalizadosPagos,
}: ConversionRatesSectionProps) => {
  // Calcula as taxas de conversão
  const taxaAgendamento = fsCriadas > 0 
    ? Number(((servicosAgendados / fsCriadas) * 100).toFixed(1)) 
    : 0;
  
  const taxaFinalizacao = fsCriadas > 0 
    ? Number(((finalizadosPagos / fsCriadas) * 100).toFixed(1)) 
    : 0;

  const taxaAgendadoParaPago = servicosAgendados > 0
    ? Number(((finalizadosPagos / servicosAgendados) * 100).toFixed(1))
    : 0;

  return (
    <section>
      <SectionHeader 
        title="Taxas de Conversão" 
        subtitle="Eficiência do funil de vendas"
      />
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        <KPICard
          label="Agendados / FS Criadas"
          value={`${taxaAgendamento}%`}
          subValue={`${servicosAgendados} de ${fsCriadas}`}
          icon={<Target className="h-5 w-5" />}
          iconColor="yellow"
          animationDelay={0}
        />
        <KPICard
          label="Pagos / FS Criadas"
          value={`${taxaFinalizacao}%`}
          subValue={`${finalizadosPagos} de ${fsCriadas}`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconColor="brand-green"
          animationDelay={50}
        />
        <KPICard
          label="Pagos / Agendados"
          value={`${taxaAgendadoParaPago}%`}
          subValue={`${finalizadosPagos} de ${servicosAgendados}`}
          icon={<TrendingUp className="h-5 w-5" />}
          iconColor="coral"
          animationDelay={100}
        />
      </div>
    </section>
  );
};
