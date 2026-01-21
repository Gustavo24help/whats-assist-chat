import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar, Header, KPICard, SectionHeader } from "@/components/dashboard";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Users, 
  MessageCircle, 
  FileText, 
  DollarSign, 
  TrendingUp, 
  Clock,
  CheckCircle,
  AlertTriangle
} from "lucide-react";

type PeriodOption = 'today' | '7days' | '30days' | 'month' | 'custom';

const Dashboard = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('30days');

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Simulate refresh
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  const handlePeriodChange = (period: PeriodOption, dateRange?: { from: Date; to: Date }) => {
    setSelectedPeriod(period);
    console.log('Period changed:', period, dateRange);
  };

  const handleSearch = (query: string) => {
    console.log('Search:', query);
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
      <div className="flex-1 flex flex-col min-h-screen ml-[72px] lg:ml-60">
        {/* Header */}
        <Header
          title="Visão Executiva"
          subtitle="Acompanhe os principais indicadores do seu negócio"
          onRefresh={handleRefresh}
          onSearch={handleSearch}
          onPeriodChange={handlePeriodChange}
          isRefreshing={isRefreshing}
          notificationCount={3}
        />

        {/* Content */}
        <main className="flex-1 p-6 space-y-8 overflow-auto">
          {/* KPIs Section */}
          <section>
            <SectionHeader 
              title="Indicadores Principais" 
              subtitle="Métricas em tempo real"
            />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <KPICard
                label="Total de Clientes"
                value="1.248"
                variation={12.5}
                icon={<Users className="h-5 w-5" />}
                iconColor="brand-green"
                animationDelay={0}
              />
              <KPICard
                label="Conversas Ativas"
                value="47"
                variation={-3.2}
                icon={<MessageCircle className="h-5 w-5" />}
                iconColor="yellow"
                animationDelay={100}
              />
              <KPICard
                label="Fichas Abertas"
                value="156"
                variation={8.7}
                icon={<FileText className="h-5 w-5" />}
                iconColor="coral"
                animationDelay={200}
              />
              <KPICard
                label="Faturamento"
                value="R$ 45.820"
                variation={15.3}
                icon={<DollarSign className="h-5 w-5" />}
                iconColor="brand-green"
                animationDelay={300}
              />
            </div>
          </section>

          {/* Performance Section */}
          <section>
            <SectionHeader 
              title="Performance de Atendimento" 
              subtitle="Eficiência da equipe"
            />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <KPICard
                label="Taxa de Conversão"
                value="68%"
                variation={5.2}
                icon={<TrendingUp className="h-5 w-5" />}
                iconColor="brand-green"
                size="sm"
                animationDelay={400}
              />
              <KPICard
                label="Tempo Médio Resposta"
                value="4min"
                variation={-12.0}
                comparisonLabel="vs semana anterior"
                icon={<Clock className="h-5 w-5" />}
                iconColor="yellow"
                size="sm"
                animationDelay={500}
              />
              <KPICard
                label="Serviços Finalizados"
                value="89"
                variation={22.1}
                icon={<CheckCircle className="h-5 w-5" />}
                iconColor="brand-green"
                size="sm"
                animationDelay={600}
              />
              <KPICard
                label="Pendências"
                value="12"
                variation={-8.5}
                icon={<AlertTriangle className="h-5 w-5" />}
                iconColor="coral"
                size="sm"
                animationDelay={700}
              />
            </div>
          </section>

          {/* Placeholder for Charts */}
          <section>
            <SectionHeader 
              title="Gráficos e Análises" 
              subtitle="Visualizações detalhadas"
            />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
              <div className="saas-card p-6 h-80 flex items-center justify-center">
                <p className="text-muted-foreground">Gráfico de Vendas (em breve)</p>
              </div>
              <div className="saas-card p-6 h-80 flex items-center justify-center">
                <p className="text-muted-foreground">Funil de Conversão (em breve)</p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
