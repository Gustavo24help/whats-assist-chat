import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Copy, Globe } from "lucide-react";
import { toast } from "sonner";

interface Props {
  fichaId: string | null;
}

const copy = async (text: string) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copiado!", { duration: 1200, id: "copy-site" });
  } catch {
    toast.error("Erro ao copiar");
  }
};

const Bloco = ({
  label,
  value,
  multiline,
}: {
  label: string;
  value?: string | null;
  multiline?: boolean;
}) => {
  if (!value) return null;
  return (
    <div className="bg-muted/30 rounded-lg p-2.5">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
          {label}
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 -mr-1 -mt-1"
          onClick={() => copy(value)}
          title="Copiar"
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
      <p
        className={
          multiline
            ? "text-xs whitespace-pre-wrap leading-snug"
            : "text-xs leading-snug"
        }
      >
        {value}
      </p>
    </div>
  );
};

export const SiteDadosTab = ({ fichaId }: Props) => {
  const [dados, setDados] = useState<any | null>(null);
  const [ficha, setFicha] = useState<any | null>(null);
  const [cliente, setCliente] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fichaId) {
      setDados(null);
      setFicha(null);
      setCliente(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: pq } = await supabase
        .from("pre_qualificacao_bot")
        .select("dados")
        .eq("ficha_id", fichaId)
        .maybeSingle();
      const { data: f } = await supabase
        .from("fichas_de_servico")
        .select("horario_agendamento, hora_inicio_agendamento, hora_fim_agendamento, agendamento_provisorio, endereco, telefone_cliente")
        .eq("id", fichaId)
        .maybeSingle();

      let c: any = null;
      if (f?.telefone_cliente) {
        const { data: cli } = await supabase
          .from("clientes")
          .select("bairro, nome")
          .eq("telefone", f.telefone_cliente)
          .maybeSingle();
        c = cli;
      }
      if (!cancelled) {
        setDados((pq?.dados as any) ?? null);
        setFicha(f ?? null);
        setCliente(c);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fichaId]);


  if (loading) {
    return <p className="text-xs text-muted-foreground p-2">Carregando…</p>;
  }
  if (!dados) {
    return (
      <p className="text-xs text-muted-foreground p-2">
        Sem dados do site para esta ficha.
      </p>
    );
  }

  const perguntas = (dados.perguntas || {}) as Record<string, any>;
  const obs = perguntas.__obs;
  const perguntasEntries = Object.entries(perguntas).filter(
    ([k]) => k !== "__obs"
  );

  const escopo = (dados.escopo_cliente || {}) as Record<string, any>;
  const politicaTexto: string = String(escopo.politica || "").trim();
  const politicaPartes = politicaTexto
    ? politicaTexto.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)
    : [];
  const alerta1 = politicaPartes[0] || "";
  const alerta2 = politicaPartes[1] || "";

  const copiarTudoAvisos = () => {
    const partes = [
      escopo.inclui ? `O que inclui:\n${escopo.inclui}` : "",
      escopo.nao_inclui
        ? `O que NÃO inclui (sujeito a novo orçamento):\n${escopo.nao_inclui}`
        : "",
      alerta1,
      alerta2,
      escopo.termo ? `Aceite:\n${escopo.termo}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    copy(partes);
  };

  const copiarParaPrestador = () => {
    const orc = (dados.orcamento || {}) as Record<string, any>;
    const cli = (dados.cliente || {}) as Record<string, any>;
    const catSub = [orc.categoria, orc.subcategoria].filter(Boolean).join(" › ");
    const bairro = cliente?.bairro || cli.bairro || "";
    const enderecoLinha = [bairro, ficha?.endereco].filter(Boolean).join(" — ");
    const perguntasLinhas = perguntasEntries
      .map(([p, r]) => {
        const rs = Array.isArray(r) ? r.join(", ") : String(r ?? "");
        return `• ${p}: ${rs}`;
      })
      .join("\n");

    const agParts: string[] = [];
    if (ficha?.horario_agendamento) agParts.push(String(ficha.horario_agendamento));
    if (ficha?.hora_inicio_agendamento || ficha?.hora_fim_agendamento) {
      agParts.push(
        `${ficha.hora_inicio_agendamento ?? ""}${
          ficha.hora_fim_agendamento ? " - " + ficha.hora_fim_agendamento : ""
        }`.trim()
      );
    }
    let agendamento = agParts.filter(Boolean).join(" ");
    if (ficha?.agendamento_provisorio) agendamento += " (provisório)";

    const linhas = [
      orc.servico ? `*Serviço:* ${orc.servico}${catSub ? `  (${catSub})` : ""}` : "",
      orc.problema ? `*Problema:* ${orc.problema}` : "",
      enderecoLinha ? `*Bairro:* ${enderecoLinha}` : "",
      perguntasLinhas ? `*Perguntas:*\n${perguntasLinhas}` : "",
      obs ? `*Detalhes:* ${obs}` : "",
      agendamento ? `*Agendamento:* ${agendamento}` : "",
      escopo.estimativa ? `*Valor sugerido:* ${escopo.estimativa}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    copy(linhas);
  };

  return (
    <div className="space-y-4">
      <Button
        variant="default"
        size="sm"
        className="w-full h-8 text-xs"
        onClick={copiarParaPrestador}
      >
        <Copy className="h-3 w-3 mr-1" />
        📋 Copiar para o prestador
      </Button>


      {/* DADOS DO SERVIÇO */}
      <section className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wide">
            Dados do Serviço
          </h3>
        </div>

        <Bloco label="Nome" value={dados.cliente?.nome} />
        <Bloco label="Categoria" value={dados.orcamento?.categoria} />
        <Bloco label="Subcategoria" value={dados.orcamento?.subcategoria} />
        <Bloco label="Serviço" value={dados.orcamento?.servico} />
        <Bloco
          label="Valor estimado no site"
          value={dados.orcamento?.estimativa}
        />
        <Bloco label="Problema" value={dados.orcamento?.problema} multiline />
        <Bloco
          label="Resumo/Solução"
          value={dados.orcamento?.solucao}
          multiline
        />

        {perguntasEntries.length > 0 && (
          <div className="bg-muted/30 rounded-lg p-2.5 space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
              Perguntas & Respostas
            </p>
            {perguntasEntries.map(([pergunta, resposta]) => {
              const respStr = Array.isArray(resposta)
                ? resposta.join(", ")
                : String(resposta ?? "");
              const linha = `${pergunta} → ${respStr}`;
              return (
                <div
                  key={pergunta}
                  className="flex items-start justify-between gap-2 border-t border-border/40 pt-2 first:border-t-0 first:pt-0"
                >
                  <div className="text-xs min-w-0 leading-snug">
                    <span className="font-medium">{pergunta}</span>
                    <span className="text-muted-foreground"> → </span>
                    <span>{respStr}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => copy(linha)}
                    title="Copiar"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <Bloco label="Detalhes adicionais" value={obs} multiline />
      </section>

      {/* AVISOS AO CLIENTE */}
      {(escopo.inclui ||
        escopo.nao_inclui ||
        escopo.pode_ter_adicional ||
        alerta1 ||
        alerta2 ||
        escopo.termo) && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide">
              Avisos ao Cliente
            </h3>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={copiarTudoAvisos}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copiar tudo
            </Button>
          </div>

          <Bloco label="O que inclui" value={escopo.inclui} multiline />
          <Bloco
            label="O que NÃO inclui (sujeito a novo orçamento)"
            value={escopo.nao_inclui}
            multiline
          />
          <Bloco
            label="Pode ter adicional"
            value={escopo.pode_ter_adicional}
            multiline
          />
          <Bloco label="Alerta 1" value={alerta1} multiline />
          <Bloco label="Alerta 2" value={alerta2} multiline />
          <Bloco label="Aceite (termo)" value={escopo.termo} multiline />
        </section>
      )}
    </div>
  );
};
