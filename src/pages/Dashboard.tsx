import { useState } from "react";
import { 
  Sidebar, 
  Header, 
  KPICard, 
  SectionHeader, 
  VisualModeSelector,
  ConversionFunnel,
  ServicesLineChart,
  AdsPerformanceChart,
  TicketMedioChart,
  ROIChart
} from "@/components/dashboard";
import { useAuth } from "@/contexts/AuthContext";
import { useGoogleAdsMetrics, FALLBACK_METRICS } from "@/hooks/useGoogleAdsMetrics";
import { 
  DollarSign, 
  FileText, 
  Wrench,
  CreditCard,
  Eye,
  MousePointerClick,
  Target,
  Percent,
  Receipt,
  ArrowRightLeft,
  MessageCircle,
  Clock,
  Users,
  CheckCircle,
  TrendingUp,
  AlertTriangle,
  ShoppingCart
} from "lucide-react";

type PeriodOption = 'today' | '7days' | '30days' | 'month' | 'custom';

const Dashboard = () => {
  const { userProfile } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('30days');
  const [customDateRange, setCustomDateRange] = useState<{ from: Date; to: Date } | undefined>();

  // Google Ads metrics
  const { data: adsMetrics, isLoading: isLoadingAds, refetch: refetchAds } = useGoogleAdsMetrics(selectedPeriod, customDateRange);
  const metrics = adsMetrics || FALLBACK_METRICS;

  const handleRefresh = () => {
    setIsRefreshing(true);
    refetchAds();
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  const handlePeriodChange = (period: PeriodOption, dateRange?: { from: Date; to: Date }) => {
    setSelectedPeriod(period);
    if (dateRange) {
      setCustomDateRange(dateRange);
    }
    console.log('Period changed:', period, dateRange);
  };

  const handleSearch = (query: string) => {
    console.log('Search:', query);
  };

  // Formatar valores para exibição
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
    return num.toLocaleString('pt-BR');
  };

  const formatCurrency = (num: number) => {
    return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <Sidebar 
        user={{
          name: userProfile?.fullName || 'Usuário',
          email: userProfile?.email || 'usuario@24help.com.br'
        }}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen ml-[72px] lg:ml-64">
        {/* Header with VisualModeSelector */}
        <Header
          title="Visão Executiva"
          subtitle="Acompanhe os principais indicadores do seu negócio"
          onRefresh={handleRefresh}
          onSearch={handleSearch}
          onPeriodChange={handlePeriodChange}
          isRefreshing={isRefreshing}
          notificationCount={3}
          className="pr-4"
        >
          <VisualModeSelector />
        </Header>

        {/* Content */}
        <main className="flex-1 p-6 space-y-8 overflow-auto">
          {/* Resumo do Dia */}
          <section>
            <SectionHeader 
              title="Resumo do Dia" 
              subtitle="Principais métricas consolidadas"
            />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <KPICard
                label="Lucro Líquido"
                value="R$ 41.340"
                variation={18.5}
                icon={<DollarSign className="h-5 w-5" />}
                iconColor="brand-green"
                animationDelay={0}
              />
              <KPICard
                label="Valor OS Geradas"
                value="R$ 52.180"
                variation={12.3}
                icon={<FileText className="h-5 w-5" />}
                iconColor="yellow"
                animationDelay={100}
              />
              <KPICard
                label="Serviços Fechados"
                value="127"
                variation={13.4}
                icon={<Wrench className="h-5 w-5" />}
                iconColor="coral"
                animationDelay={200}
              />
              <KPICard
                label="Custo Ads"
                value="R$ 4.480"
                variation={-5.2}
                comparisonLabel="vs semana anterior"
                icon={<CreditCard className="h-5 w-5" />}
                iconColor="red"
                animationDelay={300}
              />
            </div>
          </section>

          {/* Marketing · Google Ads */}
          <section>
            <SectionHeader 
              title="Marketing · Google Ads" 
              subtitle="Performance das campanhas"
            />
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-4">
              <KPICard
                label="Impressões"
                value={formatNumber(metrics.impressoes)}
                variation={metrics.variations.impressoes}
                icon={<Eye className="h-5 w-5" />}
                iconColor="brand-green"
                size="sm"
                animationDelay={400}
              />
              <KPICard
                label="Cliques"
                value={formatNumber(metrics.cliques)}
                variation={metrics.variations.cliques}
                icon={<MousePointerClick className="h-5 w-5" />}
                iconColor="brand-green"
                size="sm"
                animationDelay={450}
              />
              <KPICard
                label="Conversões"
                value={formatNumber(metrics.conversoes)}
                variation={metrics.variations.conversoes}
                icon={<Target className="h-5 w-5" />}
                iconColor="yellow"
                size="sm"
                animationDelay={500}
              />
              <KPICard
                label="CTR"
                value={`${metrics.ctr}%`}
                variation={metrics.variations.ctr}
                icon={<Percent className="h-5 w-5" />}
                iconColor="yellow"
                size="sm"
                animationDelay={550}
              />
              <KPICard
                label="Custo Ads"
                value={formatCurrency(metrics.custo)}
                variation={metrics.variations.custo}
                comparisonLabel="vs período anterior"
                icon={<Receipt className="h-5 w-5" />}
                iconColor="coral"
                size="sm"
                animationDelay={600}
              />
              <KPICard
                label="Cliques/Conv."
                value={String(metrics.clicksPerConversion)}
                variation={metrics.variations.clicksPerConversion}
                icon={<ArrowRightLeft className="h-5 w-5" />}
                iconColor="coral"
                size="sm"
                animationDelay={650}
              />
            </div>
          </section>

          {/* Atendimento · WhatsApp */}
          <section>
            <SectionHeader 
              title="Atendimento · WhatsApp" 
              subtitle="Métricas de conversação"
            />
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <KPICard
                label="Conversas Ativas"
                value="47"
                variation={-3.2}
                icon={<MessageCircle className="h-5 w-5" />}
                iconColor="brand-green"
                animationDelay={700}
              />
              <KPICard
                label="Tempo Médio Resposta"
                value="4min"
                variation={-12.0}
                comparisonLabel="menor é melhor"
                icon={<Clock className="h-5 w-5" />}
                iconColor="yellow"
                animationDelay={750}
              />
              <KPICard
                label="Clientes Únicos"
                value="892"
                variation={18.0}
                icon={<Users className="h-5 w-5" />}
                iconColor="coral"
                animationDelay={800}
              />
            </div>
          </section>

          {/* Vendas · Operação */}
          <section>
            <SectionHeader 
              title="Vendas · Operação" 
              subtitle="Funil de vendas e conversão"
            />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <KPICard
                label="Taxa de Conversão"
                value="68%"
                variation={5.2}
                icon={<TrendingUp className="h-5 w-5" />}
                iconColor="brand-green"
                animationDelay={850}
              />
              <KPICard
                label="Fichas Abertas"
                value="423"
                variation={6.3}
                icon={<FileText className="h-5 w-5" />}
                iconColor="yellow"
                animationDelay={900}
              />
              <KPICard
                label="Serviços Finalizados"
                value="127"
                variation={13.4}
                icon={<CheckCircle className="h-5 w-5" />}
                iconColor="brand-green"
                animationDelay={950}
              />
              <KPICard
                label="Pendências"
                value="12"
                variation={-8.5}
                icon={<AlertTriangle className="h-5 w-5" />}
                iconColor="coral"
                animationDelay={1000}
              />
            </div>
          </section>

          {/* Funil de Conversão */}
          <section>
            <SectionHeader 
              title="Funil de Conversão" 
              subtitle="Jornada do cliente até o fechamento"
            />
            <div className="mt-4">
              <ConversionFunnel />
            </div>
          </section>

          {/* Evolução Mensal - Charts Grid */}
          <section>
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
        </main>

        {/* Footer */}
        <footer className="py-4 px-6 border-t bg-background/50 text-center">
          <p className="text-sm text-muted-foreground">
            24Help © {new Date().getFullYear()} — Dashboard Executivo
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Dashboard;
