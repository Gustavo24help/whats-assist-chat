import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCw, Download, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { logSystemEvent } from "@/lib/systemLogger";

interface LogRow {
  id: string;
  created_at: string;
  nivel: string;
  categoria: string;
  mensagem: string;
  detalhes: any;
  url: string | null;
  user_agent: string | null;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
}

const NIVEIS = ["todos", "info", "warn", "error", "debug"];
const CATEGORIAS = ["todas", "console", "network", "user_action", "auth", "system", "unhandled"];

export const SystemLogsViewer = () => {
  const { isAdminTI } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [nivel, setNivel] = useState("todos");
  const [categoria, setCategoria] = useState("todas");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(200);
  const [selected, setSelected] = useState<LogRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // @ts-ignore - tabela ainda não tipada nos types
      let q = supabase
        .from("system_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (nivel !== "todos") q = q.eq("nivel", nivel);
      if (categoria !== "todas") q = q.eq("categoria", categoria);

      const { data, error } = await q;
      if (error) throw error;
      setLogs((data as any) || []);
    } catch (e: any) {
      toast({
        title: "Erro ao carregar logs",
        description: e.message || String(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nivel, categoria, limit]);

  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const s = search.toLowerCase();
    return logs.filter(
      (l) =>
        l.mensagem?.toLowerCase().includes(s) ||
        l.user_name?.toLowerCase().includes(s) ||
        l.user_email?.toLowerCase().includes(s) ||
        l.url?.toLowerCase().includes(s) ||
        JSON.stringify(l.detalhes || {}).toLowerCase().includes(s),
    );
  }, [logs, search]);

  const exportCsv = () => {
    const header = [
      "created_at",
      "nivel",
      "categoria",
      "user_name",
      "user_email",
      "mensagem",
      "url",
      "detalhes",
    ];
    const rows = filtered.map((l) => [
      l.created_at,
      l.nivel,
      l.categoria,
      l.user_name ?? "",
      l.user_email ?? "",
      (l.mensagem ?? "").replace(/"/g, '""'),
      l.url ?? "",
      JSON.stringify(l.detalhes ?? {}).replace(/"/g, '""'),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system-logs-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const purgeOld = async () => {
    if (!confirm("Apagar logs com mais de 30 dias? Esta ação é irreversível.")) return;
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      // @ts-ignore
      const { error } = await supabase.from("system_logs").delete().lt("created_at", cutoff);
      if (error) throw error;
      logSystemEvent({
        nivel: "warn",
        categoria: "user_action",
        mensagem: "Logs antigos (>30 dias) foram apagados",
      });
      toast({ title: "Logs antigos apagados" });
      load();
    } catch (e: any) {
      toast({ title: "Erro ao apagar", description: e.message, variant: "destructive" });
    }
  };

  const nivelBadge = (n: string) => {
    const variant: any =
      n === "error" ? "destructive" : n === "warn" ? "secondary" : "outline";
    return <Badge variant={variant}>{n}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logs do Sistema</CardTitle>
        <CardDescription>
          Registro de erros de console, falhas de rede, ações de usuários e eventos do sistema.
          Visível apenas para administradores.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Buscar</label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Mensagem, usuário, URL…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Nível</label>
            <Select value={nivel} onValueChange={setNivel}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {NIVEIS.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Categoria</label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Mostrar</label>
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[100, 200, 500, 1000].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          {isAdminTI && (
            <Button variant="outline" size="sm" onClick={purgeOld}>
              <Trash2 className="h-4 w-4 mr-2" />
              Apagar &gt; 30 dias
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          {filtered.length} registro(s) exibido(s)
        </div>

        <div className="border rounded-md max-h-[600px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[160px]">Data</TableHead>
                <TableHead className="w-[80px]">Nível</TableHead>
                <TableHead className="w-[110px]">Categoria</TableHead>
                <TableHead className="w-[160px]">Usuário</TableHead>
                <TableHead>Mensagem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum log encontrado.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((l) => (
                <TableRow
                  key={l.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelected(l)}
                >
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>{nivelBadge(l.nivel)}</TableCell>
                  <TableCell className="text-xs">{l.categoria}</TableCell>
                  <TableCell className="text-xs truncate max-w-[160px]">
                    {l.user_name || l.user_email || "—"}
                  </TableCell>
                  <TableCell className="text-xs truncate max-w-[600px]">
                    {l.mensagem}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhes do log</DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><b>Data:</b> {new Date(selected.created_at).toLocaleString("pt-BR")}</div>
                  <div><b>Nível:</b> {selected.nivel}</div>
                  <div><b>Categoria:</b> {selected.categoria}</div>
                  <div><b>Usuário:</b> {selected.user_name || "—"}</div>
                  <div className="col-span-2"><b>Email:</b> {selected.user_email || "—"}</div>
                  <div className="col-span-2 break-all"><b>URL:</b> {selected.url || "—"}</div>
                  <div className="col-span-2 break-all text-xs text-muted-foreground">
                    <b>UA:</b> {selected.user_agent || "—"}
                  </div>
                </div>
                <div>
                  <b>Mensagem:</b>
                  <pre className="bg-muted p-2 rounded text-xs whitespace-pre-wrap mt-1">
                    {selected.mensagem}
                  </pre>
                </div>
                {selected.detalhes && (
                  <div>
                    <b>Detalhes:</b>
                    <pre className="bg-muted p-2 rounded text-xs whitespace-pre-wrap mt-1 max-h-[300px] overflow-auto">
                      {JSON.stringify(selected.detalhes, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
