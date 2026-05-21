import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BRT_OFFSET = -3;


function toBRT(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(d.getHours() + BRT_OFFSET);
  return d;
}

function formatHHMM(date: Date): string {
  return date.toTimeString().slice(0, 5);
}

serve(async (req) => {
  // TESTE TEMPORÁRIO - remover depois
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        tem_key: !!ANTHROPIC_API_KEY,
        key_prefix: ANTHROPIC_API_KEY?.slice(0, 10) || "VAZIA",
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  const { data: reqData } = await req.json().catch(() => ({ data: null }));
  const targetDate = reqData?.data || new Date().toISOString().slice(0, 10);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Busca mensagens do dia (9h-18h30 BRT = 12h-21h30 UTC)
  const startUTC = `${targetDate}T12:00:00Z`;
  const endUTC = `${targetDate}T21:30:00Z`;

  const { data: mensagens, error } = await supabase
    .from("mensagens")
    .select("cliente_id, ficha_id, tipo_remetente, operador_nome, data_hora, texto")
    .gte("data_hora", startUTC)
    .lte("data_hora", endUTC)
    .order("data_hora", { ascending: true });

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  // Agrupa por cliente_id (mantém prefixo whatsapp:)
  const grupos = new Map<string, typeof mensagens>();
  for (const m of mensagens ?? []) {
    // 🔧 FIX 1: não remover prefixo whatsapp: para evitar mismatch
    const tel = m.cliente_id || "desconhecido";
    if (!grupos.has(tel)) grupos.set(tel, []);
    grupos.get(tel)!.push(m);
  }

  let totalTokens = 0;
  let totalLacunas = 0;
  const detalhes: any[] = [];

  for (const [tel, msgs] of grupos.entries()) {
    const msgsCliente = msgs.filter((m) => m.tipo_remetente === "cliente");
    const msgsAtendente = msgs.filter((m) => m.tipo_remetente === "atendente");

    // 🔧 FIX 2: usar reverse().find() em vez de findLast (compatibilidade Deno)
    const fichaId = [...msgs].reverse().find((m) => m.ficha_id)?.ficha_id || null;

    // Busca status da ficha para determinar fase
    let fase = "sem_ficha";
    let horaInicioAgendamento: string | null = null;
    if (fichaId) {
      const { data: ficha } = await supabase
        .from("fichas_de_servico")
        .select("hora_inicio_agendamento, hora_fim_agendamento, status")
        .eq("id", fichaId)
        .single();

      if (ficha) {
        horaInicioAgendamento = ficha.hora_inicio_agendamento;
        fase = ficha.hora_inicio_agendamento ? "pos_agendamento" : "pre_agendamento";
      } else {
        fase = "pre_agendamento";
      }
    }

    // Cálculo de tempos de resposta
    let temposPrimeira: number[] = [];
    let temposResposta: number[] = [];
    let ultimaMsgCliente: Date | null = null;

    for (const msg of msgs) {
      const t = new Date(msg.data_hora);
      if (msg.tipo_remetente === "cliente") {
        ultimaMsgCliente = t;
      } else if (msg.tipo_remetente === "atendente" && ultimaMsgCliente) {
        const diff = (t.getTime() - ultimaMsgCliente.getTime()) / 60000;
        temposResposta.push(diff);
        ultimaMsgCliente = null;
      }
    }

    const tempoMedio =
      temposResposta.length > 0 ? Math.round(temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length) : null;

    const tempoPrimeira = temposResposta.length > 0 ? Math.round(temposResposta[0]) : null;

    // Cálculo de lacunas
    const ultimaMsgGeral = msgs[msgs.length - 1];
    const ultimoRemetente = ultimaMsgGeral?.tipo_remetente;
    const horaUltima = new Date(ultimaMsgGeral?.data_hora || endUTC);
    const minutosDesdeUltima = (new Date(endUTC).getTime() - horaUltima.getTime()) / 60000;

    const lacunaSemResposta = ultimoRemetente === "cliente" && minutosDesdeUltima > 30;
    const lacunaSemJanela = fase === "pre_agendamento" && !horaInicioAgendamento && msgsAtendente.length > 0;
    const lacunaOrcamento = fase === "pre_agendamento" && msgsCliente.length >= 3 && msgsAtendente.length === 0;
    const lacunaSemFollowup = fase === "pos_agendamento" && minutosDesdeUltima > 120 && ultimoRemetente !== "atendente";
    const lacunaTempoAlto = tempoMedio !== null && tempoMedio > 20;

    const lacunasCount = [
      lacunaSemResposta,
      lacunaSemJanela,
      lacunaOrcamento,
      lacunaSemFollowup,
      lacunaTempoAlto,
    ].filter(Boolean).length;

    totalLacunas += lacunasCount;

    // Operador principal
    const operadorFreq = new Map<string, number>();
    for (const m of msgsAtendente) {
      if (m.operador_nome) {
        operadorFreq.set(m.operador_nome, (operadorFreq.get(m.operador_nome) || 0) + 1);
      }
    }
    const operadorPrincipal = [...operadorFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Tempo em fase (horas desde início do dia até agora)
    const inicioFase = new Date(startUTC);
    const fimFase = new Date(endUTC);
    const tempoEmFaseHoras = Math.round(((fimFase.getTime() - inicioFase.getTime()) / 3600000) * 10) / 10;

    // 🔧 FIX 3: condição corrigida — roda IA se há pelo menos 1 msg de cada lado
    let iaResumo = null,
      iaTom = null,
      iaQualidade = null,
      iaInsatisfacao = false;
    let iaMomento = null,
      iaSugestao = null,
      tokensUsados = 0;

    if (msgsCliente.length >= 1 && msgsAtendente.length >= 1 && ANTHROPIC_API_KEY) {
      const conversa = msgs
        .slice(-20) // últimas 20 mensagens para economizar tokens
        .map((m) => `[${m.tipo_remetente}]: ${m.texto}`)
        .join("\n");

      const prompt = `Analise esta conversa de atendimento WhatsApp de uma empresa de serviços em Curitiba (24help).

CONVERSA:
${conversa}

Responda APENAS com JSON válido neste formato exato:
{
  "resumo": "resumo em 1-2 frases do que foi tratado",
  "tom": "positivo|neutro|negativo",
  "qualidade_ortografica": "boa|regular|ruim",
  "insatisfacao_detectada": true|false,
  "momento_critico": "descreva se houve momento crítico ou null",
  "sugestao": "1 sugestão de melhoria para o atendente ou null"
}`;

      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 300,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        const aiData = await res.json();
        tokensUsados = (aiData.usage?.input_tokens || 0) + (aiData.usage?.output_tokens || 0);
        totalTokens += tokensUsados;

        const text = aiData.content?.[0]?.text || "{}";
        const parsed = JSON.parse(text);

        iaResumo = parsed.resumo;
        iaTom = parsed.tom;
        iaQualidade = parsed.qualidade_ortografica;
        iaInsatisfacao = parsed.insatisfacao_detectada === true;
        iaMomento = parsed.momento_critico;
        iaSugestao = parsed.sugestao;
      } catch (e) {
        console.error("Erro AI:", e);
      }
    }

    // Upsert no banco
    await supabase.from("analise_operacional_diaria").upsert(
      {
        data_analise: targetDate,
        cliente_telefone: tel,
        ficha_id: fichaId,
        fase,
        operador_principal: operadorPrincipal,
        total_msgs_cliente: msgsCliente.length,
        total_msgs_atendente: msgsAtendente.length,
        tempo_primeira_resposta_min: tempoPrimeira,
        tempo_resposta_medio_min: tempoMedio,
        tempo_em_fase_horas: tempoEmFaseHoras,
        lacuna_sem_resposta: lacunaSemResposta,
        lacuna_sem_janela: lacunaSemJanela,
        lacuna_orcamento_pendente: lacunaOrcamento,
        lacuna_sem_followup: lacunaSemFollowup,
        lacuna_tempo_alto: lacunaTempoAlto,
        lacuna_detalhes: {
          sem_resposta: lacunaSemResposta,
          sem_janela: lacunaSemJanela,
          orcamento_pendente: lacunaOrcamento,
          sem_followup: lacunaSemFollowup,
          tempo_alto: lacunaTempoAlto,
        },
        ia_resumo: iaResumo,
        ia_tom: iaTom,
        ia_qualidade_ortografica: iaQualidade,
        ia_insatisfacao_detectada: iaInsatisfacao,
        ia_momento_critico: iaMomento,
        ia_sugestao: iaSugestao,
        tokens_usados: tokensUsados,
      },
      {
        onConflict: "data_analise,cliente_telefone",
      },
    );

    detalhes.push({ telefone: tel, fase, lacunas: lacunasCount, tokens: tokensUsados });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      data: targetDate,
      clientes_processados: grupos.size,
      total_tokens: totalTokens,
      lacunas_encontradas: totalLacunas,
      detalhes,
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
});
