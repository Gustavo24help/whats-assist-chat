import { SectionHeader } from './SectionHeader';
import { KPICard } from './KPICard';
import { TrendingUp, Target, CheckCircle2, Flag } from 'lucide-react';

interface ConversionRatesSectionProps {
  fsCriadas: number;
  servicosAgendados: number;
  servicosFinalizados: number;
  finalizadosPagos: number;
}

export const ConversionRatesSection = ({
  fsCriadas,
  servicosAgendados,
  servicosFinalizados,
  finalizadosPagos,
}: ConversionRatesSectionProps) => {
  const taxaAgendamento =
    fsCriadas > 0 ? Number(((servicosAgendados / fsCriadas) * 100).toFixed(1)) : 0;

  const taxaPagosSobreFsCriadas =
    fsCriadas > 0 ? Number(((finalizadosPagos / fsCriadas) * 100).toFixed(1)) : 0;

  const taxaFinalizadosSobreAgendados =
    servicosAgendados > 0
      ? Number(((servicosFinalizados / servicosAgendados) * 100).toFixed(1))
      : 0;

  const taxaFinalizadosSobreFsCriadas =
    fsCriadas > 0 ? Number(((servicosFinalizados / fsCriadas) * 100).toFixed(1)) : 0;

  return (
    <section>
      <SectionHeader
        title="Taxas de Conversão"
        subtitle="Eficiência do funil de vendas"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        <KPICard
          label="Agendados / FS Criadas"
          value={`${taxaAgendamento}%`}
          subValue={`${servicosAgendados} de ${fsCriadas}`}
          icon={<Target className="h-5 w-5" />}
          iconColor="yellow"
          tooltip="Fichas que viraram 'Agendado' (histórico) sobre fichas criadas no período."
          animationDelay={0}
        />
        <KPICard
          label="Pagos / FS Criadas"
          value={`${taxaPagosSobreFsCriadas}%`}
          subValue={`${finalizadosPagos} de ${fsCriadas}`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconColor="brand-green"
          tooltip="Fichas finalizadas + pagas pelo cliente sobre fichas criadas no período."
          animationDelay={50}
        />
        <KPICard
          label="Finalizados / Agendados"
          value={`${taxaFinalizadosSobreAgendados}%`}
          subValue={`${servicosFinalizados} de ${servicosAgendados}`}
          icon={<TrendingUp className="h-5 w-5" />}
          iconColor="coral"
          tooltip="Fichas finalizadas sobre fichas agendadas no período."
          animationDelay={100}
        />
        <KPICard
          label="Finalizados / FS Criadas"
          value={`${taxaFinalizadosSobreFsCriadas}%`}
          subValue={`${servicosFinalizados} de ${fsCriadas}`}
          icon={<Flag className="h-5 w-5" />}
          iconColor="brand-green"
          tooltip="Fichas finalizadas sobre fichas criadas no período."
          animationDelay={150}
        />
      </div>
    </section>
  );
};
