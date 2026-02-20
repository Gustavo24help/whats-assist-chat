import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { FichasOverview } from "@/components/FichasOverview";
import { Button } from "@/components/ui/button";

const AnaliseServicos = () => {
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card px-6 py-4 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Análise de Serviços</h1>
            <p className="text-sm text-muted-foreground">Acompanhe indicadores e desempenho das fichas de atendimento.</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <FichasOverview />
      </main>
    </div>
  );
};

export default AnaliseServicos;
