import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageLayout } from "@/components/PageLayout";
import { PagamentoWebhookLogsViewer } from "@/components/PagamentoWebhookLogsViewer";
import { useAuth } from "@/contexts/AuthContext";

const LogsPagamento = () => {
  const navigate = useNavigate();
  const { user, userProfile, isAdmin, loading } = useAuth();
  const aguardandoPerfil = loading || (!!user && !userProfile);

  useEffect(() => {
    if (!aguardandoPerfil && !isAdmin) {
      navigate("/manutencao", { replace: true });
    }
  }, [aguardandoPerfil, isAdmin, navigate]);

  return (
    <PageLayout>
      <header className="border-b border-border bg-card px-6 py-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/manutencao")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Logs de Pagamento</h1>
          <p className="text-sm text-muted-foreground">
            Histórico de webhooks: links recebidos do Make, confirmações do Asaas e criações de link.
          </p>
        </div>
      </header>
      <main className="container mx-auto p-6">
        {aguardandoPerfil ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando...</CardContent></Card>
        ) : isAdmin ? <PagamentoWebhookLogsViewer /> : null}
      </main>
    </PageLayout>
  );
};

export default LogsPagamento;
