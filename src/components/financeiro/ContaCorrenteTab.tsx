import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search } from "lucide-react";
import { format, parseISO, subMonths } from "date-fns";

const formatMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

export const ContaCorrenteTab = () => {
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [selectedPrestador, setSelectedPrestador] = useState("");
  const [movimentacoes, setMovimentacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState(() => format(subMonths(new Date(), 3), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(() => format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    supabase.from("prestadores").select("cpf, nome").order("nome").then(({ data }) => {
      setPrestadores(data || []);
    });
  }, []);

  const fetchExtrato = async () => {
    if (!selectedPrestador) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("conta_corrente_prestador")
        .select("*")
        .eq("prestador_id", selectedPrestador)
        .gte("data_movimentacao", `${dataInicio}T00:00:00`)
        .lte("data_movimentacao", `${dataFim}T23:59:59`)
        .order("data_movimentacao", { ascending: false })
        .limit(200);

      if (error) throw error;
      setMovimentacoes(data || []);
    } catch (e) {
      console.error("Erro ao carregar extrato:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPrestador) fetchExtrato();
  }, [selectedPrestador]);

  const saldoAtual = movimentacoes.length > 0 ? movimentacoes[0].saldo_atual : 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Prestador *</label>
            <Select value={selectedPrestador} onValueChange={setSelectedPrestador}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {prestadores.map((p) => (
                  <SelectItem key={p.cpf} value={p.cpf}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Data Início</label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Data Fim</label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <Button onClick={fetchExtrato} disabled={!selectedPrestador}>
            <Search className="h-4 w-4 mr-1" /> Buscar
          </Button>
        </div>
      </Card>

      {/* Balance */}
      {selectedPrestador && !loading && (
        <Card className={`p-4 ${saldoAtual >= 0 ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"}`}>
          <div className="text-xs text-muted-foreground">Saldo Atual</div>
          <div className={`text-2xl font-bold ${saldoAtual >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
            {formatMoeda(saldoAtual)}
          </div>
        </Card>
      )}

      {/* Statement Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !selectedPrestador ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Selecione um prestador para visualizar o extrato
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimentacoes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma movimentação encontrada
                  </TableCell>
                </TableRow>
              ) : (
                movimentacoes.map((m) => {
                  const isCredito = m.tipo === "credito";
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(parseISO(m.data_movimentacao), "dd/MM/yy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge className={isCredito
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        }>
                          {isCredito ? "Crédito" : "Débito"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[250px] truncate">{m.descricao || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.origem}</TableCell>
                      <TableCell className={`text-right font-medium ${isCredito ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                        {isCredito ? "+" : "-"}{formatMoeda(Math.abs(m.valor))}
                      </TableCell>
                      <TableCell className="text-right text-sm">{formatMoeda(m.saldo_atual)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};
