import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface AcompanhamentoTabProps {
  fichaId: string | null;
}

const COMPARECIMENTO_PRESTADOR_OPTIONS = [
  "Foi",
  "Atrasou",
  "Atrasou e avisou",
  "Não foi",
  "Não foi e avisou",
];

export const AcompanhamentoTab = ({ fichaId }: AcompanhamentoTabProps) => {
  const [comparecimentoPrestador, setComparecimentoPrestador] = useState<string | null>(null);
  const [notas, setNotas] = useState<string>("");
  const [novaObservacao, setNovaObservacao] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!fichaId) return;

    const fetchAcompanhamento = async () => {
      const { data, error } = await supabase
        .from("fichas_de_servico")
        .select("comparecimento_prestador, notas")
        .eq("id", fichaId)
        .single();

      if (error) {
        console.error("Erro ao carregar acompanhamento:", error);
        return;
      }

      setComparecimentoPrestador(data?.comparecimento_prestador ?? null);
      setNotas(data?.notas ?? "");
    };

    fetchAcompanhamento();
  }, [fichaId]);

  const adicionarObservacao = async () => {
    if (!fichaId || !novaObservacao.trim()) return;

    setIsSaving(true);

    const agora = format(new Date(), "dd/MM/yyyy HH:mm");
    const entrada = `[${agora}] ${novaObservacao.trim()}`;
    const notasAtualizadas = notas ? `${notas}\n${entrada}` : entrada;

    const { error } = await supabase
      .from("fichas_de_servico")
      .update({ notas: notasAtualizadas })
      .eq("id", fichaId);

    if (error) {
      console.error("Erro ao salvar observação:", error);
      toast.error("Não foi possível salvar a observação.");
      setIsSaving(false);
      return;
    }

    setNotas(notasAtualizadas);
    setNovaObservacao("");
    toast.success("Observação adicionada!");
    setIsSaving(false);
  };

  const salvarAcompanhamento = async () => {
    if (!fichaId) return;

    setIsSaving(true);

    let { error } = await supabase
      .from("fichas_de_servico")
      .update({ comparecimento_prestador: comparecimentoPrestador?.trim() || null })
      .eq("id", fichaId);

    const colunaIndisponivel =
      error?.code === "PGRST204" &&
      error?.message?.includes("comparecimento_prestador");

    if (colunaIndisponivel) {
      toast.warning("Banco sem a coluna de comparecimento. Aplique a migration para habilitar este campo.");
      error = null;
    }

    if (error) {
      console.error("Erro ao salvar acompanhamento:", error);
      toast.error("Não foi possível salvar o acompanhamento.");
      setIsSaving(false);
      return;
    }

    toast.success("Acompanhamento salvo com sucesso!");
    setIsSaving(false);
  };

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Acompanhamento</h3>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="acompanhamento_comparecimento">Comparecimento do prestador</Label>
        <Select
          value={comparecimentoPrestador || "nao_informado"}
          onValueChange={(value) => setComparecimentoPrestador(value === "nao_informado" ? null : value)}
        >
          <SelectTrigger id="acompanhamento_comparecimento" className="h-9 text-sm">
            <SelectValue placeholder="Selecione o comparecimento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nao_informado">Não informado</SelectItem>
            {COMPARECIMENTO_PRESTADOR_OPTIONS.map((opcao) => (
              <SelectItem key={opcao} value={opcao}>
                {opcao}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={salvarAcompanhamento} disabled={isSaving} className="w-full" size="sm">
        {isSaving ? "Salvando..." : "Salvar comparecimento"}
      </Button>

      <div className="border-t pt-3 space-y-2">
        <Label>Adicionar observação</Label>
        <Textarea
          value={novaObservacao}
          onChange={(e) => setNovaObservacao(e.target.value)}
          placeholder="Digite uma observação..."
          rows={2}
          className="text-sm"
        />
        <Button
          onClick={adicionarObservacao}
          disabled={isSaving || !novaObservacao.trim()}
          variant="outline"
          className="w-full"
          size="sm"
        >
          Adicionar observação
        </Button>
      </div>

      {notas && (
        <div className="border-t pt-3 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Histórico de observações</Label>
          <div className="bg-muted/50 rounded-md p-2 max-h-48 overflow-y-auto">
            <pre className="text-xs whitespace-pre-wrap font-sans text-foreground">{notas}</pre>
          </div>
        </div>
      )}
    </Card>
  );
};
