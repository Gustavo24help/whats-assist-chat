import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CoachingSuggestion {
  perfil: string;
  conversaoMeta: number;
  proximoPassoLabel: string;
  sugestaoMensagem: string;
  prioridade: "maxima" | "normal";
}

export function useClienteSignalsBeta(clienteTelefone: string) {
  const [coaching, setCoaching] = useState<CoachingSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const lastMsgIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!clienteTelefone) return;

    const fetchSignals = async () => {
      setLoading(true);

      // 1. Buscar últimas 30 mensagens em ordem cronológica
      const { data: msgs } = await supabase
        .from("mensagens")
        .select("id, texto, remetente, data_hora")
        .eq("cliente_id", clienteTelefone)
        .order("data_hora", { ascending: false })
        .limit(30);

      if (!msgs?.length) {
        setCoaching(null);
        setLoading(false);
        return;
      }

      // Evitar rechamar se a última mensagem não mudou
      const ultimaMsgId = msgs[0].id;
      if (ultimaMsgId === lastMsgIdRef.current) {
        setLoading(false);
        return;
      }
      lastMsgIdRef.current = ultimaMsgId;

      // 2. Buscar ficha ativa
      const { data: ficha } = await supabase
        .from("fichas_de_servico")
        .select("id, status, descricao, valor_total, prestador_id, horario_agendamento")
        .eq("telefone_cliente", clienteTelefone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 3. Suprimir sugestão se conversa já encerrada
      const statusFinais = ["Agendado", "Em andamento", "Finalizado", "Garantia", "Perdido", "Não foi adiante"];
      if (ficha && statusFinais.includes(ficha.status)) {
        setCoaching(null);
        setLoading(false);
        return;
      }

      // 4. Total de orçamentos coletados
      let totalOrcamentos = 0;
      if (ficha?.id) {
        const { count } = await supabase
          .from("orcamentos")
          .select("*", { count: "exact", head: true })
          .eq("ficha_id", ficha.id);
        totalOrcamentos = count || 0;
      }

      // 5. Quem mandou a última mensagem e há quanto tempo
      const ultimaMsg = msgs[0];
      const quemFalou = ultimaMsg.remetente === "cliente" ? "cliente" : "operador";
      const minutosDesdeUltimaMsg = Math.floor((Date.now() - new Date(ultimaMsg.data_hora).getTime()) / 60000);

      // 6. Histórico em ordem cronológica para a IA
      const historico = msgs
        .slice(0, 20)
        .reverse()
        .map((m) => ({
          role: m.remetente === "cliente" ? "user" : "assistant",
          content: m.texto || "",
        }))
        .filter((m) => m.content.trim().length > 0);

      // 7. Contexto estruturado — a IA lê tudo e decide
      const contexto = `⚡ MODO TEMPO REAL

ESTADO ATUAL DA CONVERSA:
- Quem enviou a última mensagem: ${quemFalou}
- Última mensagem enviada: "${ultimaMsg.texto}"
- Minutos desde essa mensagem: ${minutosDesdeUltimaMsg}

ESTADO DA FICHA:
- Status: ${ficha?.status || "Sem ficha"}
- Serviço: ${ficha?.descricao || "Não identificado"}
- Orçamentos de prestadores coletados: ${totalOrcamentos}
- Prestador atribuído: ${ficha?.prestador_id ? "Sim" : "Não"}
- Valor total: ${ficha?.valor_total ? `R$${ficha.valor_total}` : "Não definido"}
- Agendamento: ${ficha?.horario_agendamento || "Não agendado"}

INSTRUÇÃO:
Leia o histórico completo acima e a última mensagem enviada. Com base nisso:
- Se o cliente foi o último a falar: sugira a melhor resposta para avançar ao fechamento
- Se o operador foi o último a falar: sugira um follow-up coerente com o que foi enviado, que incentive o cliente a responder

Retorne APENAS o texto da mensagem sugerida. Sem explicação, sem aspas, sem prefixo.`;

      const messagesPayload = [...historico, { role: "user", content: contexto }];

      // 8. Chamar edge function
      const { data, error } = await supabase.functions.invoke("vendas-assistant", {
        body: { messages: messagesPayload },
      });

      if (error || !data?.content?.[0]?.text) {
        setCoaching(null);
        setLoading(false);
        return;
      }

      const sugestaoTexto = data.content[0].text.trim();

      // 9. Perfil e prioridade para o badge (local, sem chamar IA)
      const textoCliente = msgs
        .filter((m) => m.remetente === "cliente")
        .map((m) => m.texto || "")
        .join(" ")
        .toLowerCase();

      const urgente = ["urgente", "hoje", "agora", "já", "sem luz", "sem água", "vazamento", "queimado"].some((p) =>
        textoCliente.includes(p),
      );
      const perguntas = msgs.filter((m) => m.remetente === "cliente" && (m.texto || "").includes("?")).length;

      let perfil = "Normal";
      let meta = 0.28;
      let proximo = "Qualificar";

      if (urgente) {
        perfil = "Urgente";
        meta = 0.44;
        proximo = "Cotar agora";
      } else if (perguntas >= 6) {
        perfil = "Decidido";
        meta = 0.7;
        proximo = "Fechar";
      } else if (perguntas >= 3) {
        perfil = "Explorador";
        meta = 0.47;
        proximo = "Coletar orçamentos";
      } else if (totalOrcamentos > 0) {
        perfil = "Pós-orçamento";
        meta = 0.41;
        proximo = "Confirmar agendamento";
      }

      setCoaching({
        perfil,
        conversaoMeta: meta,
        proximoPassoLabel: proximo,
        sugestaoMensagem: sugestaoTexto,
        prioridade: urgente ? "maxima" : "normal",
      });

      setLoading(false);
    };

    fetchSignals();
  }, [clienteTelefone]);

  return { coaching, loading };
}
