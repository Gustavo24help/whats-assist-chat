import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, RefreshCw, ShieldCheck, Wrench, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type MissingRow = {
  sid: string;
  date_sent: string;
  direction: string;
  rota: string;
  numero_twilio: string;
  cliente: string;
  body_preview: string;
  num_media?: string | number;
  status_twilio?: string;
  error_code?: string | number | null;
  error_message?: string | null;
};

type Result = {
  success: boolean;
  run_id?: string | null;
  totals?: {
    twilio: number;
    lovable: number;
    missing: number;
    recovered: number;
    recovery_errors: number;
    loss_rate_pct: number;
  };
  missing?: MissingRow[];
  duration_ms?: number;
  error?: string;
};

type RunHistory = {
  id: string;
  created_at: string;
  triggered_by: string;
  scope: string;
  customer_phone: string | null;
  total_twilio: number;
  total_lovable: number;
  total_missing: number;
  total_recovered: number;
  total_recovery_errors: number;
  loss_rate_pct: number;
};

export const TwilioReconcilePanel = () => {
  const { toast } = useToast();
  const [hours, setHours] = useState<string>("24");
  const [scope, setScope] = useState<"all" | "cliente" | "prestador">("all");
  const [phone, setPhone] = useState("");
  const [loadingMode, setLoadingMode] = useState<null | "verify" | "diagnose" | "recover">(null);
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<RunHistory[]>([]);

  const loadHistory = async () => {
    const { data } = await supabase
      .from("twilio_reconciliation_runs" as any)
      .select(
        "id, created_at, triggered_by, scope, customer_phone, total_twilio, total_lovable, total_missing, total_recovered, total_recovery_errors, loss_rate_pct",
      )
      .order("created_at", { ascending: false })
      .limit(15);
    setHistory((data as any) || []);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const run = async (mode: "verify" | "diagnose" | "recover") => {
    setLoadingMode(mode);
    try {
      const { data, error } = await supabase.functions.invoke("twilio-reconcile", {
        body: {
          mode,
          hours: Number(hours) || 24,
          scope,
          customer_phone: phone.trim() || undefined,
          limit_recover: 200,
        },
      });
      if (error) throw error;
      setResult(data as Result);
      if (mode === "verify") {
        toast({
          title: (data as any).success ? "Conexão Twilio OK" : "Falha na Twilio",
          description: (data as any).success
            ? `Conta: ${(data as any).friendly_name || (data as any).account_sid}`
            : `Erro ${(data as any).status}`,
          variant: (data as any).success ? "default" : "destructive",
        });
      } else if (mode === "diagnose") {
        toast({
          title: "Diagnóstico concluído",
          description: `Twilio: ${(data as Result).totals?.twilio} · Lovable: ${(data as Result).totals?.lovable} · Faltando: ${(data as Result).totals?.missing}`,
        });
      } else {
        toast({
          title: "Recuperação concluída",
          description: `Recuperadas: ${(data as Result).totals?.recovered} · Erros: ${(data as Result).totals?.recovery_errors}`,
        });
      }
      loadHistory();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || String(e), variant: "destructive" });
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reconciliação Twilio ↔ Lovable</CardTitle>
        <CardDescription>
          Compara o que a Twilio enviou/recebeu com o que está salvo no sistema. Identifica
          mensagens faltantes e permite recuperar com segurança (nunca duplica nem altera
          mensagens existentes).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Período (horas)</Label>
            <Select value={hours} onValueChange={setHours}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1h</SelectItem>
                <SelectItem value="6">6h</SelectItem>
                <SelectItem value="24">24h</SelectItem>
                <SelectItem value="72">3 dias</SelectItem>
                <SelectItem value="168">7 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Rota</Label>
            <Select value={scope} onValueChange={(v: any) => setScope(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="prestador">Prestador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Telefone (opcional, ex: +5541999999999)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55..." />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => run("verify")} disabled={!!loadingMode}>
            {loadingMode === "verify" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
            Testar conexão Twilio
          </Button>
          <Button size="sm" onClick={() => run("diagnose")} disabled={!!loadingMode}>
            {loadingMode === "diagnose" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Activity className="h-4 w-4 mr-2" />}
            Diagnosticar
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={() => run("recover")}
            disabled={!!loadingMode || !result || (result.totals?.missing ?? 0) === 0}
          >
            {loadingMode === "recover" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wrench className="h-4 w-4 mr-2" />}
            Recuperar faltantes
          </Button>
        </div>

        {result?.totals && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Twilio" value={result.totals.twilio} />
            <Stat label="Lovable" value={result.totals.lovable} />
            <Stat label="Faltando" value={result.totals.missing} highlight={result.totals.missing > 0} />
            <Stat label="Recuperadas" value={result.totals.recovered} />
            <Stat label="Perda %" value={`${result.totals.loss_rate_pct}%`} highlight={result.totals.loss_rate_pct > 0} />
          </div>
        )}

        {result?.missing && result.missing.length > 0 && (
          <div className="border rounded-md overflow-auto max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Rota</TableHead>
                  <TableHead>Direção</TableHead>
                  <TableHead>Número Twilio</TableHead>
                  <TableHead>Cliente/Prestador</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.missing.map((m) => (
                  <TableRow key={m.sid}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {m.date_sent ? new Date(m.date_sent).toLocaleString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell><Badge variant="outline">{m.rota}</Badge></TableCell>
                    <TableCell className="text-xs">{m.direction}</TableCell>
                    <TableCell className="text-xs font-mono">{m.numero_twilio}</TableCell>
                    <TableCell className="text-xs font-mono">{m.cliente}</TableCell>
                    <TableCell className="text-xs max-w-xs truncate">{m.body_preview || `(${m.num_media || 0} mídia)`}</TableCell>
                    <TableCell className="text-xs">
                      {m.status_twilio}
                      {m.error_code ? <span className="text-destructive"> · {m.error_code}</span> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Histórico de execuções</h4>
            <Button variant="ghost" size="sm" onClick={loadHistory}>
              <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
            </Button>
          </div>
          <div className="border rounded-md overflow-auto max-h-72">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead>Rota</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Twilio</TableHead>
                  <TableHead>Lovable</TableHead>
                  <TableHead>Faltando</TableHead>
                  <TableHead>Recuperadas</TableHead>
                  <TableHead>Perda %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-xs">{r.triggered_by}</TableCell>
                    <TableCell className="text-xs">{r.scope}</TableCell>
                    <TableCell className="text-xs font-mono">{r.customer_phone || "—"}</TableCell>
                    <TableCell className="text-xs">{r.total_twilio}</TableCell>
                    <TableCell className="text-xs">{r.total_lovable}</TableCell>
                    <TableCell className="text-xs">{r.total_missing}</TableCell>
                    <TableCell className="text-xs">{r.total_recovered}</TableCell>
                    <TableCell className="text-xs">{r.loss_rate_pct}%</TableCell>
                  </TableRow>
                ))}
                {history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-xs text-muted-foreground py-4">
                      Nenhuma execução ainda
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const Stat = ({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) => (
  <div className={`border rounded-md p-3 ${highlight ? "border-destructive/40 bg-destructive/5" : ""}`}>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-xl font-semibold">{value}</p>
  </div>
);
