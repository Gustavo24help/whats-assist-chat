import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0.24.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY')!
})

// Fuso horário Brasil = UTC-3
const BRT_OFFSET = -3

function toBRT(date: Date): Date {
  return new Date(date.getTime() + BRT_OFFSET * 60 * 60 * 1000)
}

function hoje(): string {
  return toBRT(new Date()).toISOString().split('T')[0]
}

function diffMinutos(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 60000
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const dataAlvo = body.data || hoje()

    console.log(`Processando análise para: ${dataAlvo}`)

    const inicioUTC = new Date(`${dataAlvo}T${String(9 - BRT_OFFSET).padStart(2, '0')}:00:00Z`)
    const fimUTC    = new Date(`${dataAlvo}T${String(18 - BRT_OFFSET).padStart(2, '0')}:30:00Z`)

    const { data: mensagens, error: errMsgs } = await supabase
      .from('mensagens')
      .select('id, cliente_id, texto, tipo, tipo_remetente, operador_nome, data_hora, ficha_id')
      .in('tipo_remetente', ['atendente', 'cliente'])
      .gte('data_hora', inicioUTC.toISOString())
      .lte('data_hora', fimUTC.toISOString())
      .order('data_hora', { ascending: true })

    if (errMsgs) throw errMsgs
    if (!mensagens?.length) {
      return new Response(JSON.stringify({ ok: true, msg: 'Sem mensagens no período' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const porCliente: Record<string, typeof mensagens> = {}
    for (const m of mensagens) {
      const tel = m.cliente_id || 'desconhecido'
      if (!porCliente[tel]) porCliente[tel] = []
      porCliente[tel].push(m)
    }

    console.log(`Clientes encontrados: ${Object.keys(porCliente).length}`)

    const resultados: Array<{ telefone: string; fase: string; lacunas: number; tokens: number }> = []

    for (const [telefone, msgs] of Object.entries(porCliente)) {
      try {
        const fichaId = [...msgs].reverse().find(m => m.ficha_id)?.ficha_id || null

        let fase = 'sem_ficha'
        if (fichaId) {
          const { data: historico } = await supabase
            .from('ficha_status_historico')
            .select('status_novo, data_inicio')
            .eq('ficha_id', fichaId)
            .lte('data_inicio', fimUTC.toISOString())
            .order('data_inicio', { ascending: false })
            .limit(1)

          if (historico?.length) {
            const statusAtual = historico[0].status_novo
            fase = ['Agendado', 'Em execução', 'Concluído'].includes(statusAtual)
              ? 'pos_agendamento'
              : 'pre_agendamento'
          } else {
            fase = 'pre_agendamento'
          }
        }

        const contagemOperadores: Record<string, number> = {}
        for (const m of msgs) {
          if (m.operador_nome) {
            contagemOperadores[m.operador_nome] = (contagemOperadores[m.operador_nome] || 0) + 1
          }
        }
        const operadorPrincipal = Object.entries(contagemOperadores)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || null

        const msgsCliente   = msgs.filter(m => m.tipo_remetente === 'cliente')
        const msgsAtendente = msgs.filter(m => m.tipo_remetente === 'atendente')

        let tempoPrimeiraResposta: number | null = null
        const primeiraMsgCliente = msgsCliente[0]
        const primeiraResposta = msgsAtendente.find(
          m => new Date(m.data_hora) > new Date(primeiraMsgCliente?.data_hora || 0)
        )
        if (primeiraMsgCliente && primeiraResposta) {
          tempoPrimeiraResposta = diffMinutos(primeiraMsgCliente.data_hora, primeiraResposta.data_hora)
        }

        const temposResposta: number[] = []
        for (const mc of msgsCliente) {
          const resposta = msgsAtendente.find(
            ma => new Date(ma.data_hora) > new Date(mc.data_hora)
          )
          if (resposta) {
            const diff = diffMinutos(mc.data_hora, resposta.data_hora)
            if (diff < 120) temposResposta.push(diff)
          }
        }
        const tempoRespostaMedio = temposResposta.length
          ? temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length
          : null

        let tempoEmFase: number | null = null
        if (fichaId) {
          const { data: entradaFase } = await supabase
            .from('ficha_status_historico')
            .select('data_inicio')
            .eq('ficha_id', fichaId)
            .order('data_inicio', { ascending: true })
            .limit(1)
          if (entradaFase?.length) {
            tempoEmFase = diffMinutos(entradaFase[0].data_inicio, fimUTC.toISOString()) / 60
          }
        }

        const ultimaMsg = msgs[msgs.length - 1]
        const lacunaSemResposta = ultimaMsg?.tipo_remetente === 'cliente'

        let lacunaSemJanela = false
        if (fichaId && fase === 'pos_agendamento') {
          const { data: ficha } = await supabase
            .from('fichas_de_servico')
            .select('hora_inicio_agendamento, hora_fim_agendamento')
            .eq('id', fichaId)
            .single()
          lacunaSemJanela = !ficha?.hora_inicio_agendamento || !ficha?.hora_fim_agendamento
        }

        let lacunaOrcamentoPendente = false
        if (fichaId && fase === 'pre_agendamento') {
          const { data: orcamentos } = await supabase
            .from('orcamentos')
            .select('id')
            .eq('ficha_nome', fichaId)
            .limit(1)
          lacunaOrcamentoPendente = !orcamentos?.length
        }

        const lacunaProblemaServico = fase === 'pos_agendamento' && lacunaSemResposta

        const lacunaSemFollowup = fase === 'pre_agendamento'
          && msgsCliente.length === 0
          && msgsAtendente.length > 0

        const lacunaDetalhes: Array<{ tipo: string; descricao: string; timestamp: string | null }> = []
        if (lacunaSemResposta) lacunaDetalhes.push({
          tipo: 'sem_resposta',
          descricao: `Última mensagem do cliente às ${toBRT(new Date(ultimaMsg.data_hora)).toISOString().substring(11, 16)} BRT sem resposta`,
          timestamp: ultimaMsg.data_hora
        })
        if (lacunaSemJanela) lacunaDetalhes.push({
          tipo: 'sem_janela_horario',
          descricao: 'Serviço agendado sem janela de horário definida',
          timestamp: null
        })
        if (lacunaOrcamentoPendente) lacunaDetalhes.push({
          tipo: 'orcamento_pendente',
          descricao: 'Ficha aberta sem orçamento registrado',
          timestamp: null
        })
        if (lacunaProblemaServico) lacunaDetalhes.push({
          tipo: 'problema_servico',
          descricao: 'Cliente enviou mensagem pós-agendamento sem resposta',
          timestamp: ultimaMsg.data_hora
        })
        if (lacunaSemFollowup) lacunaDetalhes.push({
          tipo: 'sem_followup',
          descricao: 'Atendente enviou mensagens mas cliente não respondeu — follow-up necessário',
          timestamp: null
        })

        let iaResumo: string | null = null
        let iaTom: string | null = null
        let iaQualidade: number | null = null
        let iaInsatisfacao = false
        let iaMomento: string | null = null
        let iaSugestao: string | null = null
        let tokensUsados = 0

        if (msgs.length >= 3) {
          const conversa = msgs.map(m => {
            const hora = toBRT(new Date(m.data_hora)).toISOString().substring(11, 16)
            const quem = m.tipo_remetente === 'cliente' ? 'CLIENTE' : `ATENDENTE(${m.operador_nome || '?'})`
            return `[${hora}] ${quem}: ${m.texto || '[mídia]'}`
          }).join('\n')

          const prompt = `Analise esta conversa de atendimento de uma empresa de serviços residenciais (elétrica, hidráulica, etc.) via WhatsApp.

CONVERSA:
${conversa}

Responda APENAS com JSON válido, sem markdown:
{
  "resumo": "2 frases descrevendo o que aconteceu",
  "tom": "formal|informal|tenso|empatico|neutro",
  "qualidade_ortografica": 1-10,
  "insatisfacao_detectada": true|false,
  "momento_critico": "descrição se houve situação delicada, ou null",
  "sugestao": "o que o atendente poderia ter feito diferente, ou null se atendimento foi bom"
}`

          try {
            const response = await anthropic.messages.create({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 400,
              messages: [{ role: 'user', content: prompt }]
            })

            tokensUsados = response.usage.input_tokens + response.usage.output_tokens

            const block = response.content[0] as { type: string; text?: string }
            if (block.type === 'text' && block.text) {
              const ia = JSON.parse(block.text)
              iaResumo      = ia.resumo ?? null
              iaTom         = ia.tom ?? null
              iaQualidade   = ia.qualidade_ortografica ?? null
              iaInsatisfacao = !!ia.insatisfacao_detectada
              iaMomento     = ia.momento_critico ?? null
              iaSugestao    = ia.sugestao ?? null
            }
          } catch (eIA) {
            console.error('Erro IA para', telefone, eIA)
          }
        }

        const registro = {
          data_analise: dataAlvo,
          cliente_telefone: telefone,
          ficha_id: fichaId,
          fase,
          operador_principal: operadorPrincipal,
          total_msgs_cliente: msgsCliente.length,
          total_msgs_atendente: msgsAtendente.length,
          tempo_primeira_resposta_min: tempoPrimeiraResposta ? Math.round(tempoPrimeiraResposta) : null,
          tempo_resposta_medio_min: tempoRespostaMedio ? Math.round(tempoRespostaMedio) : null,
          tempo_em_fase_horas: tempoEmFase ? Math.round(tempoEmFase * 10) / 10 : null,
          lacuna_sem_resposta: lacunaSemResposta,
          lacuna_sem_janela_horario: lacunaSemJanela,
          lacuna_orcamento_pendente: lacunaOrcamentoPendente,
          lacuna_problema_servico: lacunaProblemaServico,
          lacuna_sem_followup: lacunaSemFollowup,
          lacuna_detalhes: lacunaDetalhes,
          ia_resumo: iaResumo,
          ia_tom: iaTom,
          ia_qualidade_ortografica: iaQualidade,
          ia_insatisfacao_detectada: iaInsatisfacao,
          ia_momento_critico: iaMomento,
          ia_sugestao: iaSugestao,
          processado_em: new Date().toISOString(),
          tokens_usados: tokensUsados
        }

        const { error: errInsert } = await supabase
          .from('analise_operacional_diaria')
          .upsert(registro, { onConflict: 'data_analise,cliente_telefone' })

        if (errInsert) console.error('Erro ao salvar', telefone, errInsert)
        else resultados.push({ telefone, fase, lacunas: lacunaDetalhes.length, tokens: tokensUsados })

      } catch (errCliente) {
        console.error('Erro processando cliente', telefone, errCliente)
      }
    }

    const totalTokens = resultados.reduce((s, r) => s + r.tokens, 0)
    console.log(`Concluído: ${resultados.length} clientes, ${totalTokens} tokens`)

    return new Response(JSON.stringify({
      ok: true,
      data: dataAlvo,
      clientes_processados: resultados.length,
      total_tokens: totalTokens,
      lacunas_encontradas: resultados.filter(r => r.lacunas > 0).length,
      detalhes: resultados
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Erro geral:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ ok: false, erro: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
