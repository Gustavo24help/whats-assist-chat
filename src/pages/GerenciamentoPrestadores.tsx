import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { PrestadorManagement } from "@/components/PrestadorManagement";
import { Button } from "@/components/ui/button";

const GerenciamentoPrestadores = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gerenciamento de Prestadores</h1>
            <p className="text-sm text-muted-foreground">
              Centralize os prestadores e prepare integrações com informações adicionais.
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6">
        <PrestadorManagement />
      </main>
    </div>
  );
};

export default GerenciamentoPrestadores;
