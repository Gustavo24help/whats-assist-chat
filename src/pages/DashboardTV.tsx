import { useState } from 'react';
import { HeaderBar } from '@/components/dashboard/tv/HeaderBar';
import { HeroKPIs } from '@/components/dashboard/tv/HeroKPIs';
import { SalesFunnel } from '@/components/dashboard/tv/SalesFunnel';
import { ConversionRates } from '@/components/dashboard/tv/ConversionRates';
import { MetricsGrid } from '@/components/dashboard/tv/MetricsGrid';
import { LiveTicker } from '@/components/dashboard/tv/LiveTicker';
import { MetasModal } from '@/components/dashboard/tv/MetasModal';

const DashboardTV = () => {
  const [metasOpen, setMetasOpen] = useState(false);
  const [filtros, setFiltros] = useState({
    periodo: 'hoje',
    comparacao: 'ontem',
    apenasUteis: false,
    prestadorId: 'todos',
    categoriaId: 'todas',
  });

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <style>{`
        @keyframes pulse-danger {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
        }
      `}</style>
      <HeaderBar
        filtros={filtros}
        onFiltrosChange={setFiltros}
        onOpenMetas={() => setMetasOpen(true)}
      />
      <div className="flex-1 overflow-auto">
        <HeroKPIs />
        <SalesFunnel />
        <ConversionRates />
        <MetricsGrid />
      </div>
      <LiveTicker />
      <MetasModal open={metasOpen} onClose={() => setMetasOpen(false)} />
    </div>
  );
};

export default DashboardTV;
