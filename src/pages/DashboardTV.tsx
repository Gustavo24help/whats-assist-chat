import { HeaderBar } from '@/components/dashboard/tv/HeaderBar';
import { HeroKPIs } from '@/components/dashboard/tv/HeroKPIs';
import { SalesFunnel } from '@/components/dashboard/tv/SalesFunnel';
import { MetricsGrid } from '@/components/dashboard/tv/MetricsGrid';
import { LiveTicker } from '@/components/dashboard/tv/LiveTicker';

const DashboardTV = () => (
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
    <HeaderBar />
    <div className="flex-1 overflow-auto">
      <HeroKPIs />
      <SalesFunnel />
      <MetricsGrid />
    </div>
    <LiveTicker />
  </div>
);

export default DashboardTV;
