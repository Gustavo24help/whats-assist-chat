import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

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
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!fichaId) return;

    const fetchAcompanhamento = async () => {
      const { data, error } = await supabase
        .from("fichas_de_servico")
        .select("comparecimento_prestador")
        .eq("id", fichaId)
        .single();

      if (error) {
        console.error("Erro ao carregar acompanhamento:", error);
        return;
      }

      setComparecimentoPrestador(data?.comparecimento_prestador ?? null);
    };

    fetchAcompanhamento();
  }, [fichaId]);

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

      <Button onClick={salvarAcompanhamento} disabled={isSaving} className="w-full">
        {isSaving ? "Salvando..." : "Salvar acompanhamento"}
      </Button>
    </Card>
  );
};
