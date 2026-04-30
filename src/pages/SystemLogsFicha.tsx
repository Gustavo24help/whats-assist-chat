import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, RefreshCw, Search, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LogRow {
  id: string;
  created_at: string;
  nivel: string;
  categoria: string;
  mensagem: string;
  detalhes: any;
  url: string | null;
  user_email: string | null;
  user_name: string | null;
  ficha_id: string | null;
  cliente_telefone: string | null;
}

interface FichaInfo {
  id: string;
  nome_cliente: string | null;
  telefone_cliente: string | null;
  status: string | null;
  valor_total: number | null;
  pagamento_link: string | null;
  pagamento_realizado: boolean | null;
}

const nivelColor: Record<string, string> = {
  error: "destructive",
  warn: "secondary",
  info: "default",
  debug: "outline",
};

const SystemLogsFicha = () => {
  const { fichaId } = useParams<{ fichaId: string }>();
  const navigate = useNavigate();
  const { user, userProfile, isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [ficha, setFicha] = useState<FichaInfo | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<LogRow | null>(null);
  const aguardandoPerfil = loading || (!!user && !userProfile);

  useEffect(() => {
    if (!aguardandoPerfil && !isAdmin) {
      navigate("/settings", { replace: true });
    }
  }, [aguardandoPerfil, isAdmin, navigate]);

  const load = async () => {
    if (!fichaId) return;
    setLoadingLogs(true);
    try {
      // 1) Info da ficha
      const { data: fdata } = await supabase
        .from("fichas_de_servico")
        .select("id, nome_cliente, telefone_cliente, status, valor_total, pagamento_link, pagamento_realizado")
        .eq("id", fichaId)
        .maybeSingle();
      setFicha(fdata as any);

      const telefone = (fdata as any)?.telefone_cliente as string | undefined;

      // 2) Logs por ficha_id OU pelo telefone do cliente (correlação ampla)
      // @ts-ignore - colunas novas (ficha_id, cliente_telefone) ainda não nos types regenerados
      let query = supabase
        .from("system_logs")
        .select("id, created_at, nivel, categoria, mensagem, detalhes, url, user_email, user_name, ficha_id, cliente_telefone")
        .order("created_at", { ascending: false })
        .limit(500);

      if (telefone) {
        // OR ficha_id = X OR cliente_telefone = telefone
        query = query.or(`ficha_id.eq.${fichaId},cliente_telefone.eq.${telefone}`);
      } else {
        query = query.eq("ficha_id", fichaId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // 3) Também trazer mudanças de status da ficha (sintetiza a partir de ficha_status_historico)
      const { data: statusHist } = await supabase
        .from("ficha_status_historico")
        .select("id, status_anterior, status_novo, data_inicio")
        .eq("ficha_id", fichaId)
        .order("data_inicio", { ascending: false })
        .limit(50);

      const statusLogs: LogRow[] = (statusHist || []).map((s: any) => ({
        id: `status-${s.id}`,
        created_at: s.data_inicio,
        nivel: "info",
        categoria: "status_change",
        mensagem: `Status: ${s.status_anterior ?? "—"} → ${s.status_novo}`,
        detalhes: s,
        url: null,
        user_email: null,
        user_name: null,
        ficha_id: fichaId!,
        cliente_telefone: telefone ?? null,
      }));

      const merged = [...((data as any) || []), ...statusLogs].sort(
        (a: LogRow, b: LogRow) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setLogs(merged);
    } catch (e: any) {
      toast({ title: "Erro ao carregar logs", description: e.message || String(e), variant: "destructive" });
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (!aguardandoPerfil && isAdmin && fichaId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aguardandoPerfil, isAdmin, fichaId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const s = search.toLowerCase();
    return logs.filter(
      (l) =>
        l.mensagem.toLowerCase().includes(s) ||
        l.categoria.toLowerCase().includes(s) ||
        (l.user_email || "").toLowerCase().includes(s) ||
        JSON.stringify(l.detalhes || {}).toLowerCase().includes(s)
    );
  }, [logs, search]);

  return (
    <PageLayout>
      <header className="border-b border-border bg-card px-6 py-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            Logs da ficha <span className="font-mono text-primary">{fichaId}</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Histórico de automações backend, mudanças de status e ações de operadores correlacionadas.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loadingLogs}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loadingLogs ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </header>

      <main className="container mx-auto p-6 space-y-4">
        {aguardandoPerfil ? (
          <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Carregando...</p></CardContent></Card>
        ) : !isAdmin ? null : (
          <>
            {ficha && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Resumo da ficha</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Cliente</p>
                    <p className="font-medium">{ficha.nome_cliente || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Telefone</p>
                    <p className="font-mono text-xs">{ficha.telefone_cliente || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant="outline">{ficha.status || "—"}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Valor / Pagamento</p>
                    <p className="font-medium">
                      {ficha.valor_total ? `R$ ${Number(ficha.valor_total).toFixed(2)}` : "—"}{" "}
                      {ficha.pagamento_realizado ? <Badge variant="default" className="ml-1">Pago</Badge> : null}
                    </p>
                    {ficha.pagamento_link && (
                      <a
                        href={ficha.pagamento_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                      >
                        Link Asaas <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    Eventos ({filtered.length})
                  </CardTitle>
                  <div className="relative w-72">
                    <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar mensagem, categoria, usuário..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingLogs ? (
                  <p className="text-sm text-muted-foreground p-4">Carregando eventos...</p>
                ) : filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">Nenhum evento encontrado para esta ficha.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[160px]">Quando</TableHead>
                        <TableHead className="w-[80px]">Nível</TableHead>
                        <TableHead className="w-[140px]">Categoria</TableHead>
                        <TableHead>Mensagem</TableHead>
                        <TableHead className="w-[160px]">Usuário</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((log) => (
                        <TableRow
                          key={log.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelected(log)}
                        >
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={(nivelColor[log.nivel] as any) || "outline"}>{log.nivel}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{log.categoria}</TableCell>
                          <TableCell className="text-sm max-w-[500px] truncate">{log.mensagem}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {log.user_name || log.user_email || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalhes do evento</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Quando: </span>{format(new Date(selected.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</div>
                <div><span className="text-muted-foreground">Nível: </span><Badge variant={(nivelColor[selected.nivel] as any) || "outline"}>{selected.nivel}</Badge></div>
                <div><span className="text-muted-foreground">Categoria: </span>{selected.categoria}</div>
                <div><span className="text-muted-foreground">Usuário: </span>{selected.user_name || selected.user_email || "—"}</div>
              </div>
              <div>
                <p className="text-muted-foreground">Mensagem</p>
                <p className="font-medium whitespace-pre-wrap">{selected.mensagem}</p>
              </div>
              {selected.url && (
                <div>
                  <p className="text-muted-foreground">URL</p>
                  <p className="font-mono text-xs break-all">{selected.url}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground mb-1">Detalhes</p>
                <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-96">
                  {JSON.stringify(selected.detalhes, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default SystemLogsFicha;
