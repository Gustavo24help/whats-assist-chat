import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock3, LogIn, LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RegistroPonto {
  id: string;
  user_id: string;
  entrada_em: string;
  saida_em: string | null;
  created_at: string;
}

const PAGE_SIZE = 10;

const RegistroPontoPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [registros, setRegistros] = useState<RegistroPonto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const loadRegistros = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("registro_ponto")
      .select("*")
      .eq("user_id", user.id)
      .order("entrada_em", { ascending: false });

    if (error) {
      toast.error("Não foi possível carregar os registros de ponto.");
      setLoading(false);
      return;
    }

    setRegistros(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadRegistros();
  }, [loadRegistros]);

  const registroAberto = useMemo(() => registros.find((registro) => !registro.saida_em) ?? null, [registros]);
  const totalPages = Math.max(1, Math.ceil(registros.length / PAGE_SIZE));

  const registrosPaginados = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return registros.slice(start, start + PAGE_SIZE);
  }, [page, registros]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const registrarEntrada = async () => {
    if (!user || registroAberto) return;

    setSaving(true);
    const { error } = await supabase.from("registro_ponto").insert({ user_id: user.id });
    setSaving(false);

    if (error) {
      toast.error("Erro ao registrar entrada.");
      return;
    }

    toast.success("Entrada registrada com sucesso!");
    await loadRegistros();
  };

  const registrarSaida = async () => {
    if (!registroAberto) return;

    setSaving(true);
    const { error } = await supabase
      .from("registro_ponto")
      .update({ saida_em: new Date().toISOString() })
      .eq("id", registroAberto.id);
    setSaving(false);

    if (error) {
      toast.error("Erro ao registrar saída.");
      return;
    }

    toast.success("Saída registrada com sucesso!");
    await loadRegistros();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex flex-col">
      <header className="h-16 border-b bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 shadow-sm">
        <Logo />
        <Button variant="outline" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Home
        </Button>
      </header>

      <main className="flex-1 container max-w-4xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-brand-green" />
              Registro de ponto
            </CardTitle>
            <CardDescription>
              Controle individual de entrada e saída. Este histórico é visível apenas para o usuário logado.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="flex gap-2 flex-wrap">
              <Button onClick={registrarEntrada} disabled={!!registroAberto || saving}>
                <LogIn className="h-4 w-4 mr-2" />
                Registrar entrada
              </Button>
              <Button variant="outline" onClick={registrarSaida} disabled={!registroAberto || saving}>
                <LogOut className="h-4 w-4 mr-2" />
                Registrar saída
              </Button>
              {registroAberto ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600">Em expediente</Badge>
              ) : (
                <Badge variant="secondary">Fora do expediente</Badge>
              )}
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando registros...</p>
            ) : registros.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum registro de ponto encontrado.</p>
            ) : (
              <div className="space-y-3">
                {registrosPaginados.map((registro) => (
                  <div key={registro.id} className="rounded-lg border p-4">
                    <p className="text-sm">
                      <span className="font-medium">Entrada:</span> {new Date(registro.entrada_em).toLocaleString("pt-BR")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Saída:</span>{" "}
                      {registro.saida_em ? new Date(registro.saida_em).toLocaleString("pt-BR") : "Ainda em aberto"}
                    </p>
                  </div>
                ))}

                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    Página {page} de {totalPages} • {registros.length} registro(s)
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= totalPages}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default RegistroPontoPage;
