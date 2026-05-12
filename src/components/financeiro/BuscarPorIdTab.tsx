import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Eye } from "lucide-react";
import { IdBadge } from "@/components/ui/IdBadge";

export interface BuscaIdItem {
  id: string;
  data: string | Date | null;
  beneficiario: string;
  valor: number;
  status: string;
  statusColor?: string;
  origem?: string;
  raw?: any;
  idKind?: "receber" | "pagar" | "transacao" | "pagar_manual" | "ficha" | "generic";
}

interface Props {
  items: BuscaIdItem[];
  loading?: boolean;
  onView?: (item: BuscaIdItem) => void;
  beneficiarioLabel?: string;
}

const formatMoeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const formatData = (d: string | Date | null) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR");
};

export function BuscarPorIdTab({ items, loading, onView, beneficiarioLabel = "Beneficiário" }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter(item =>
      item.id.toLowerCase().includes(q) ||
      item.beneficiario.toLowerCase().includes(q) ||
      (item.origem || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por ID, beneficiário ou origem..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-11 text-base"
          autoFocus
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">ID</TableHead>
                <TableHead className="w-[110px]">Data</TableHead>
                <TableHead>{beneficiarioLabel}</TableHead>
                <TableHead className="w-[120px]">Valor</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                {onView && <TableHead className="w-[60px] text-center">Ver</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {query ? "Nenhum resultado para a busca" : "Nenhum registro"}
                </TableCell></TableRow>
              ) : (
                filtered.slice(0, 200).map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/50">
                    <TableCell><IdBadge id={item.id} kind={item.idKind || "generic"} /></TableCell>
                    <TableCell className="text-xs">{formatData(item.data)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{item.beneficiario}</span>
                        {item.origem && <span className="text-[10px] text-muted-foreground">{item.origem}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-sm">{formatMoeda(item.valor)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={item.statusColor || ""}>{item.status}</Badge>
                    </TableCell>
                    {onView && (
                      <TableCell className="text-center">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onView(item)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {filtered.length > 200 && (
            <div className="p-2 text-center text-xs text-muted-foreground border-t">
              Mostrando 200 de {filtered.length} resultados — refine a busca para ver mais
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
