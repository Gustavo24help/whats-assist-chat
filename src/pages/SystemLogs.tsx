import { PageLayout } from "@/components/PageLayout";
import { SystemLogsViewer } from "@/components/SystemLogsViewer";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";

const SystemLogs = () => {
  const { user, userProfile, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const aguardandoPerfil = loading || (!!user && !userProfile);

  useEffect(() => {
    if (!aguardandoPerfil && !isAdmin) {
      navigate("/settings", { replace: true });
    }
  }, [aguardandoPerfil, isAdmin, navigate]);

  return (
    <PageLayout>
      <header className="border-b border-border bg-card px-6 py-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Logs do Sistema</h1>
          <p className="text-sm text-muted-foreground">
            Auditoria de erros, falhas de rede e ações de usuários.
          </p>
        </div>
      </header>

      <main className="container mx-auto p-6">
        {aguardandoPerfil ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Carregando...</p>
            </CardContent>
          </Card>
        ) : isAdmin ? (
          <SystemLogsViewer />
        ) : null}
      </main>
    </PageLayout>
  );
};

export default SystemLogs;
