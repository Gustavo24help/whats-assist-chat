import { PrestadorManagement } from "@/components/PrestadorManagement";
import { PageLayout } from "@/components/PageLayout";

const GerenciamentoPrestadores = () => {
  return (
    <PageLayout>
      <header className="border-b border-border bg-card px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gerenciamento de Prestadores</h1>
          <p className="text-sm text-muted-foreground">
            Centralize os prestadores e prepare integrações com informações adicionais.
          </p>
        </div>
      </header>

      <main className="container mx-auto p-6">
        <PrestadorManagement />
      </main>
    </PageLayout>
  );
};

export default GerenciamentoPrestadores;
