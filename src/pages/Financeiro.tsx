import { Logo } from "@/components/Logo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Wrench } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FinanceiroKPIs } from "@/components/financeiro/FinanceiroKPIs";
import { PagamentoClientesTabV2 } from "@/components/financeiro/PagamentoClientesTabV2";
import { PagamentoPrestadoresTabV2 } from "@/components/financeiro/PagamentoPrestadoresTabV2";
import { PageLayout } from "@/components/PageLayout";

const Financeiro = () => {
  const hoje = new Date();

  return (
    <PageLayout>
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-foreground">Financeiro</h1>
            <p className="text-xs text-muted-foreground">
              {format(hoje, "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>
          <Logo />
        </div>
      </header>

      <div className="px-4 py-4 md:px-6">
        <FinanceiroKPIs />
      </div>

      <main className="flex-1 px-4 md:px-6 pb-6">
        <Tabs defaultValue="prestadores" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto mb-4">
            <TabsTrigger value="clientes" className="gap-1.5">
              <Users className="h-4 w-4" /> Pagamento Clientes
            </TabsTrigger>
            <TabsTrigger value="prestadores" className="gap-1.5">
              <Wrench className="h-4 w-4" /> Pagamento Prestadores
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clientes">
            <PagamentoClientesTabV2 />
          </TabsContent>

          <TabsContent value="prestadores">
            <PagamentoPrestadoresTabV2 />
          </TabsContent>
        </Tabs>
      </main>
    </PageLayout>
  );
};

export default Financeiro;
