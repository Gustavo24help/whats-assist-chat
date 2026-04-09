import { Logo } from "@/components/Logo";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PagamentoPrestadoresTabV2 } from "@/components/financeiro/PagamentoPrestadoresTabV2";
import { PageLayout } from "@/components/PageLayout";

const ContasPagar = () => {
  const hoje = new Date();

  return (
    <PageLayout>
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-foreground">Contas a Pagar</h1>
            <p className="text-xs text-muted-foreground">
              {format(hoje, "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>
          <Logo />
        </div>
      </header>

      <main className="flex-1 px-4 md:px-6 py-4 pb-6">
        <PagamentoPrestadoresTabV2 />
      </main>
    </PageLayout>
  );
};

export default ContasPagar;
