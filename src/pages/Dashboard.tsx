import { useState } from "react";
import { 
  Header, 
  VisualModeSelector,
  DashboardBlockCustomizer,
} from "@/components/dashboard";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayoutProvider } from "@/contexts/DashboardLayoutContext";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { PageLayout } from "@/components/PageLayout";

type PeriodOption = 'today' | '7days' | '30days' | 'month' | 'custom';

const Dashboard = () => {
  const { userProfile } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('30days');
  const [customDateRange, setCustomDateRange] = useState<{ from: Date; to: Date } | undefined>();

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  const handlePeriodChange = (period: PeriodOption, dateRange?: { from: Date; to: Date }) => {
    setSelectedPeriod(period);
    if (dateRange) {
      setCustomDateRange(dateRange);
    }
  };

  const handleSearch = (query: string) => {
    console.log('Search:', query);
  };

  return (
    <DashboardLayoutProvider>
      <PageLayout>
        <div className="flex-1 flex flex-col min-h-screen">
          <Header
            title="Visão Executiva"
            subtitle="Acompanhe os principais indicadores do seu negócio"
            onRefresh={handleRefresh}
            onSearch={handleSearch}
            onPeriodChange={handlePeriodChange}
            isRefreshing={isRefreshing}
            notificationCount={0}
            className="pr-4"
          >
            <DashboardBlockCustomizer />
            <VisualModeSelector />
          </Header>

          <DashboardContent 
            period={selectedPeriod}
            customDateRange={customDateRange}
          />

          <footer className="py-4 px-6 border-t bg-background/50 text-center">
            <p className="text-sm text-muted-foreground">
              24Help © {new Date().getFullYear()} — Dashboard Executivo
            </p>
          </footer>
        </div>
      </PageLayout>
    </DashboardLayoutProvider>
  );
};

export default Dashboard;
