import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, DollarSign, Tag, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ResumoFichaTabProps {
  fichaId: string | null;
}

interface FichaResumo {
  id: string;
  nome_ficha: string | null;
  status: string | null;
  categoria_id: number | null;
  valor_total: number | null;
  descricao: string | null;
  preferencia_horario_cliente: string | null;
  horario_agendamento: string | null;
}

const STATUS_OPTIONS = [
  "Ficha Criada",
  "Dúvida Prestador",
  "Orçamento Enviado",
  "Orçamento Aprovado / Agendamento",
  "Agendado",
  "Em andamento",
  "Visita Técnica",
  "Retorno",
  "Aguardando Pagamento",
  "Finalizado",
  "Garantia",
  "Perdido",
  "Não foi adiante",
];

const formatMoeda = (v: number | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const statusVariant = (status: string | null): "default" | "secondary" | "destructive" | "outline" => {
  if (!status) return "outline";
  if (status === "Finalizado") return "default";
  if (["Perdido", "Não foi adiante"].includes(status)) return "destructive";
  if (["Agendado", "Orçamento Aprovado / Agendamento"].includes(status)) return "secondary";
  return "outline";
};

export const ResumoFichaTab = ({ fichaId }: ResumoFichaTabProps) => {
  const [ficha, setFicha] = useState<FichaResumo | null>(null);
  const [categoriaNome, setCategoriaNome] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => {
    if (!fichaId) {
      setFicha(null);
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("fichas_de_servico")
        .select("id, nome_ficha, status, categoria_id, valor_total, descricao, preferencia_horario_cliente, horario_agendamento")
        .eq("id", fichaId)
        .maybeSingle();
      if (data) {
        setFicha(data as FichaResumo);
        if (data.categoria_id) {
          const { data: cat } = await supabase
            .from("categorias")
            .select("nome")
            .eq("id", data.categoria_id)
            .maybeSingle();
          setCategoriaNome(cat?.nome || null);
        } else setCategoriaNome(null);
      } else {
        setFicha(null);
      }
      setLoading(false);
    };
    load();
  }, [fichaId]);

  const handleStatusChange = async (novoStatus: string) => {
    if (!ficha || !fichaId) return;
    if (novoStatus === ficha.status) return;
    setSavingStatus(true);
    const { error } = await supabase
      .from("fichas_de_servico")
      .update({ status: novoStatus as any })
      .eq("id", fichaId);
    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      setFicha({ ...ficha, status: novoStatus });
      toast.success("Status atualizado");
    }
    setSavingStatus(false);
  };

  if (!fichaId) {
    return (
      <div className="text-center py-8">
        <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Selecione uma ficha para ver o resumo.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ficha) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Ficha não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Cabeçalho */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
        <p className="text-[10px] text-muted-foreground mb-0.5">Ficha</p>
        <p className="text-sm font-bold text-foreground">{ficha.nome_ficha || ficha.id}</p>
        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{ficha.id}</p>
      </div>

      {/* Status editável */}
      <div className="bg-muted/30 rounded-lg p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] text-muted-foreground">Status atual</p>
          <Badge variant={statusVariant(ficha.status)} className="text-[9px] px-1.5 py-0">
            {ficha.status || "—"}
          </Badge>
        </div>
        <Select value={ficha.status || ""} onValueChange={handleStatusChange} disabled={savingStatus}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Alterar status..." />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Categoria + Valor */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="bg-muted/30 rounded-lg p-2.5">
          <div className="flex items-center gap-1 mb-1">
            <Tag className="h-3 w-3 text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground">Categoria</p>
          </div>
          <p className="text-xs font-medium truncate">{categoriaNome || "—"}</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-2.5">
          <div className="flex items-center gap-1 mb-1">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground">Valor</p>
          </div>
          <p className="text-xs font-bold text-primary">{formatMoeda(ficha.valor_total)}</p>
        </div>
      </div>

      {/* Resumo do serviço */}
      <div className="bg-muted/30 rounded-lg p-2.5">
        <p className="text-[10px] text-muted-foreground mb-1">Resumo do serviço</p>
        <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
          {ficha.descricao || <span className="italic text-muted-foreground">Sem descrição.</span>}
        </p>
      </div>

      {/* Preferência de horário */}
      <div className="bg-muted/30 rounded-lg p-2.5">
        <div className="flex items-center gap-1 mb-1">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground">Preferência de horário do cliente</p>
        </div>
        <p className="text-xs text-foreground/90">
          {ficha.preferencia_horario_cliente || <span className="italic text-muted-foreground">Não informado.</span>}
        </p>
      </div>

      {/* Agendamento (se houver) */}
      {ficha.horario_agendamento && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5">
          <p className="text-[10px] text-muted-foreground mb-1">Agendado para</p>
          <p className="text-xs font-semibold text-primary">
            {new Date(ficha.horario_agendamento).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      )}
    </div>
  );
};
