import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Financeiro = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex flex-col">
      <header className="h-16 border-b bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Logo />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Financeiro</h1>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-muted-foreground text-center mt-12">
            Módulo financeiro em construção. Use o PopupConfirmacaoFinanceira a partir da ficha de serviço.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Financeiro;
