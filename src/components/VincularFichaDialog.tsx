import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { vincularFichas } from "@/hooks/useFichaGrupo";
import { useAuth } from "@/contexts/AuthContext";

interface VincularFichaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fichaAtualId: string;
  onSuccess: () => void;
}

interface FichaResult {
  id: string;
  nome_ficha: string | null;
  nome_cliente: string | null;
  telefone_cliente: string;
  status: string | null;
  prestador_id: string | null;
  valor_total: number | null;
}

const STATUS_EXCLUIDOS = ["Finalizado", "Perdido", "Não foi adiante"];

export const VincularFichaDialog = ({ open, onOpenChange, fichaAtualId, onSuccess }: VincularFichaDialogProps) => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<FichaResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<FichaResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSearch = async () => {
    const termRaw = search.trim();
    if (!termRaw) return;
    setLoading(true);

    const term = `%${termRaw}%`;
    const select = "id, nome_ficha, nome_cliente, telefone_cliente, status, prestador_id, valor_total";

    // Run separate queries in parallel — `.or()` breaks with special chars (@ , -) in IDs.
    const base = () =>
      supabase.from("fichas_de_servico").select(select).neq("id", fichaAtualId).limit(50);

    const [r1, r2, r3, r4] = await Promise.all([
      base().ilike("id", term),
      base().ilike("nome_ficha", term),
      base().ilike("nome_cliente", term),
      base().ilike("telefone_cliente", term),
    ]);

    const firstError = [r1, r2, r3, r4].find((r) => r.error)?.error;
    if (firstError) {
      console.error("[VincularFichaDialog] erro busca:", firstError);
      toast.error("Erro ao buscar fichas: " + firstError.message);
      setResults([]);
      setLoading(false);
      return;
    }

    // Merge + dedupe by id
    const map = new Map<string, FichaResult>();
    [...(r1.data || []), ...(r2.data || []), ...(r3.data || []), ...(r4.data || [])].forEach((f: any) => {
      if (!map.has(f.id)) map.set(f.id, f);
    });

    const merged = Array.from(map.values()).filter((f) => !STATUS_EXCLUIDOS.includes(f.status || ""));
    if (merged.length === 0) {
      console.log("[VincularFichaDialog] nenhum resultado para:", termRaw);
    }
    setResults(merged);
    setLoading(false);
  };

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);

    const result = await vincularFichas(fichaAtualId, selected.id, user?.id);

    if (result.success) {
      toast.success("Fichas vinculadas com sucesso!");
      onSuccess();
      onOpenChange(false);
      setSearch("");
      setResults([]);
      setSelected(null);
    } else {
      toast.error(result.error || "Erro ao vincular fichas.");
    }

    setSaving(false);
    setConfirmOpen(false);
  };

  const formatMoeda = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Vincular a ficha existente
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Buscar por ID, nome, telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={loading} size="icon" variant="outline">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            <ScrollArea className="h-[300px] pr-3">
              {results.length === 0 && !loading && search && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma ficha encontrada</p>
              )}
              <div className="space-y-2">
                {results.map((f) => (
                  <div
                    key={f.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selected?.id === f.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                    onClick={() => setSelected(f)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-medium truncate">{f.id}</span>
                      <Badge variant="outline" className="text-xs">{f.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <p>{f.nome_cliente || f.telefone_cliente}</p>
                      {f.valor_total ? <p>{formatMoeda(f.valor_total)}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {selected && (
              <Button className="w-full" onClick={() => setConfirmOpen(true)}>
                <Link2 className="mr-2 h-4 w-4" />
                Vincular a "{selected.id}"
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar vinculação de fichas</AlertDialogTitle>
            <AlertDialogDescription>
              A ficha atual (<strong>{fichaAtualId}</strong>) será vinculada à ficha principal (
              <strong>{selected?.id}</strong>). Status, valores e pagamento serão gerenciados pela ficha principal. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
