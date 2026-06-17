import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PrestadorOpt {
  cpf: string;
  nome: string;
  telefone: string | null;
  categoria: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fichaId: string;
  categoriaNome: string | null;
  prestadorPreSelecionadoCpf?: string | null;
  onEnviado?: () => void;
}

export function EnviarConviteDialog({
  open,
  onOpenChange,
  fichaId,
  categoriaNome,
  prestadorPreSelecionadoCpf,
  onEnviado,
}: Props) {
  const [prestadores, setPrestadores] = useState<PrestadorOpt[]>([]);
  const [convidadosCpfs, setConvidadosCpfs] = useState<Set<string>>(new Set());
  const [selecionado, setSelecionado] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: ps } = await supabase
        .from("prestadores")
        .select("cpf, nome, telefone, categoria, ativo")
        .eq("ativo", true)
        .order("nome", { ascending: true });
      const lista = (ps ?? [])
        .filter((p) => !categoriaNome || (p.categoria || "").toLowerCase() === categoriaNome.toLowerCase())
        .map((p) => ({ cpf: p.cpf, nome: p.nome, telefone: p.telefone, categoria: p.categoria }));
      setPrestadores(lista);

      const { data: convites } = await supabase
        .from("convites_prestador")
        .select("prestador_cpf")
        .eq("ficha_id", fichaId);
      setConvidadosCpfs(new Set((convites ?? []).map((c: any) => c.prestador_cpf)));

      if (prestadorPreSelecionadoCpf && lista.some((p) => p.cpf === prestadorPreSelecionadoCpf)) {
        setSelecionado(prestadorPreSelecionadoCpf);
      }
    })();
  }, [open, fichaId, categoriaNome, prestadorPreSelecionadoCpf]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return prestadores.filter((p) => !q || p.nome.toLowerCase().includes(q));
  }, [prestadores, busca]);

  const handleEnviar = async () => {
    if (!selecionado) {
      toast.error("Selecione um prestador");
      return;
    }
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("enviar-convite-prestador", {
        body: { ficha_id: fichaId, prestador_cpf: selecionado },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Convite enviado! Aguardando resposta (10 min).");
      onEnviado?.();
      onOpenChange(false);
      setSelecionado("");
    } catch (e: any) {
      toast.error(`Falha ao enviar: ${e?.message || e}`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar convite ao prestador</DialogTitle>
          <DialogDescription>
            Resumo do serviço + opções SIM/NÃO. Validade de 10 minutos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Categoria da ficha</Label>
            <div className="text-sm font-medium">{categoriaNome || "—"}</div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Prestador</Label>
            <Input
              placeholder="Buscar prestador..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-8 text-sm"
            />
            <Select value={selecionado} onValueChange={setSelecionado}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="max-h-[280px] z-[150]">
                {filtrados.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                    Nenhum prestador da categoria
                  </div>
                ) : (
                  filtrados.map((p) => (
                    <SelectItem key={p.cpf} value={p.cpf}>
                      <span className="flex items-center gap-2">
                        {p.nome}
                        {convidadosCpfs.has(p.cpf) && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0">
                            já convidado
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
            O prestador recebe no WhatsApp: <strong>valor, bairro, descrição, o que inclui/não inclui, data/hora</strong> e dois links (ACEITAR / RECUSAR).
            Faltando 3 min ele recebe um lembrete automático. Expirando, o convite é marcado e você pode sugerir o próximo da fila.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={handleEnviar} disabled={enviando || !selecionado}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
