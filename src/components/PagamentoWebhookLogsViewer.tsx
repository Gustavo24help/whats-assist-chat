import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, RefreshCw, ExternalLink, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type LogRow = {
  id: string;
  created_at: string;
  direcao: string;
  origem: string;
  ficha_id: string | null;
  evento: string | null;
  status: string;
  pagamento_link: string | null;
  valor: number | null;
  auth_source: string | null;
  payload: any;
  resposta: any;
  duracao_ms: number | null;
  erro: string | null;
};

const ORIGENS = [
  { value: "all", label: "Todas as origens" },
  { value: "make_update_pagamento", label: "Make → update-pagamento" },
  { value: "asaas_webhook", label: "Webhook Asaas" },
  { value: "create_payment_link", label: "Criação de link" },
  { value: "reconcile_asaas", label: "Reconciliação Asaas" },
];

const STATUS_COLORS: Record<string, string> = {
  success: "bg-green-100 text-green-800 border-green-300",
  error: "bg-red-100 text-red-800 border-red-300",
  ignored: "bg-gray-100 text-gray-700 border-gray-300",
};

export const PagamentoWebhookLogsViewer = () => {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [origem, setOrigem] = useState("all");
  const [status, setStatus] = useState("all");
  const [fichaFilter, setFichaFilter] = useState("");
  const [dataInicio, setDataInicio] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [dataFim, setDataFim] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState<LogRow | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("pagamento_webhook_log" as any)
        .select("*")
        .gte("created_at", `${dataInicio}T00:00:00`)
        .lte("created_at", `${dataFim}T23:59:59`)
        .order("created_at", { ascending: false })
        .limit(500);

      if (origem !== "all") q = q.eq("origem", origem);
      if (status !== "all") q = q.eq("status", status);
      if (fichaFilter.trim()) q = q.ilike("ficha_id", `%${fichaFilter.trim()}%`);

      const { data, error } = await q;
      if (error) throw error;
      setLogs((data ?? []) as unknown as LogRow[]);
    } catch (err: any) {
      toast({ title: "Erro ao carregar logs", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = logs.length;
  const sucesso = useMemo(() => logs.filter((l) => l.status === "success").length, [logs]);
  const erros = useMemo(() => logs.filter((l) => l.status === "error").length, [logs]);

  const copyJson = (val: any) => {
    navigator.clipboard.writeText(JSON.stringify(val, null, 2));
    toast({ title: "Copiado!" });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Logs de Pagamento</span>
            <Button onClick={fetchLogs} size="sm" variant="outline" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Atualizar</span>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
            <div>
              <label className="text-xs text-muted-foreground">De</label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Até</label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Origem</label>
              <Select value={origem} onValueChange={setOrigem}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORIGENS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                  <SelectItem value="ignored">Ignorado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Ficha</label>
              <Input placeholder="ID da ficha" value={fichaFilter} onChange={(e) => setFichaFilter(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end mb-3">
            <Button onClick={fetchLogs} size="sm">Aplicar filtros</Button>
          </div>

          <div className="flex gap-3 mb-3 text-sm">
            <Badge variant="outline">Total: {total}</Badge>
            <Badge className={STATUS_COLORS.success}>Sucesso: {sucesso}</Badge>
            <Badge className={STATUS_COLORS.error}>Erros: {erros}</Badge>
          </div>

          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-2">Data/Hora</th>
                  <th className="p-2">Origem</th>
                  <th className="p-2">Ficha</th>
                  <th className="p-2">Evento</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Valor</th>
                  <th className="p-2">Link</th>
                  <th className="p-2">Duração</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum log encontrado no período.</td></tr>
                ) : logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-t hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelected(log)}
                  >
                    <td className="p-2 whitespace-nowrap">{format(new Date(log.created_at), "dd/MM/yy HH:mm:ss")}</td>
                    <td className="p-2"><Badge variant="outline">{log.origem}</Badge></td>
                    <td className="p-2 font-mono text-xs">{log.ficha_id ?? "—"}</td>
                    <td className="p-2">{log.evento ?? "—"}</td>
                    <td className="p-2"><Badge className={STATUS_COLORS[log.status] ?? ""}>{log.status}</Badge></td>
                    <td className="p-2">{log.valor != null ? `R$ ${Number(log.valor).toFixed(2)}` : "—"}</td>
                    <td className="p-2 max-w-[200px] truncate">
                      {log.pagamento_link ? (
                        <a
                          href={log.pagamento_link}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary inline-flex items-center gap-1"
                        >
                          {log.pagamento_link.slice(0, 30)}…
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : "—"}
                    </td>
                    <td className="p-2">{log.duracao_ms ? `${log.duracao_ms}ms` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {logs.length === 500 && (
            <p className="text-xs text-muted-foreground mt-2">
              Mostrando os 500 mais recentes. Use filtros mais estreitos para ver tudo.
            </p>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Detalhe do log</SheetTitle>
                <SheetDescription>
                  {format(new Date(selected.created_at), "dd/MM/yyyy HH:mm:ss")} · {selected.origem}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><strong>Direção:</strong> {selected.direcao}</div>
                  <div><strong>Status:</strong> <Badge className={STATUS_COLORS[selected.status] ?? ""}>{selected.status}</Badge></div>
                  <div><strong>Ficha:</strong> <span className="font-mono">{selected.ficha_id ?? "—"}</span></div>
                  <div><strong>Evento:</strong> {selected.evento ?? "—"}</div>
                  <div><strong>Valor:</strong> {selected.valor != null ? `R$ ${Number(selected.valor).toFixed(2)}` : "—"}</div>
                  <div><strong>Duração:</strong> {selected.duracao_ms ? `${selected.duracao_ms}ms` : "—"}</div>
                  <div><strong>Auth source:</strong> {selected.auth_source ?? "—"}</div>
                </div>
                {selected.pagamento_link && (
                  <div>
                    <strong>Link:</strong>{" "}
                    <a className="text-primary break-all" href={selected.pagamento_link} target="_blank" rel="noreferrer">{selected.pagamento_link}</a>
                  </div>
                )}
                {selected.erro && (
                  <div className="bg-red-50 border border-red-200 p-3 rounded">
                    <strong className="text-red-800">Erro:</strong>
                    <pre className="text-xs mt-1 whitespace-pre-wrap">{selected.erro}</pre>
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <strong>Payload recebido</strong>
                    <Button size="sm" variant="ghost" onClick={() => copyJson(selected.payload)}>
                      <Copy className="h-3 w-3 mr-1" /> Copiar
                    </Button>
                  </div>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto max-h-80">
                    {JSON.stringify(selected.payload, null, 2)}
                  </pre>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <strong>Resposta</strong>
                    <Button size="sm" variant="ghost" onClick={() => copyJson(selected.resposta)}>
                      <Copy className="h-3 w-3 mr-1" /> Copiar
                    </Button>
                  </div>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto max-h-80">
                    {JSON.stringify(selected.resposta, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};
