import { FichasOverview } from "@/components/FichasOverview";
import { RelatorioTempoStatus } from "@/components/RelatorioTempoStatus";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLayout } from "@/components/PageLayout";

const AnaliseServicos = () => {
  return (
    <PageLayout fullHeight>
      <header className="border-b border-border bg-card px-6 py-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Análise de Serviços</h1>
          <p className="text-sm text-muted-foreground">Acompanhe indicadores e desempenho das fichas de atendimento.</p>
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-4">
        <Tabs defaultValue="fichas" className="h-full flex flex-col">
          <TabsList>
            <TabsTrigger value="fichas">Fichas</TabsTrigger>
            <TabsTrigger value="tempo-status">Tempo por Status</TabsTrigger>
          </TabsList>
          <TabsContent value="fichas" className="flex-1 overflow-hidden mt-0">
            <FichasOverview />
          </TabsContent>
          <TabsContent value="tempo-status" className="flex-1 overflow-auto mt-0">
            <RelatorioTempoStatus />
          </TabsContent>
        </Tabs>
      </main>
    </PageLayout>
  );
};

export default AnaliseServicos;
