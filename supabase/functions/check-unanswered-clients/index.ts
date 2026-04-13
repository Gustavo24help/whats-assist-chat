import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_PHONE = 'whatsapp:+554198751600';
const GEMINI_SYSTEM_PROMPT = `Você é um analisador de mensagens de atendimento ao cliente.

TAREFA: Analise a última mensagem do cliente e determine se o operador PRECISA responder.

Responda APENAS com um JSON:
{
  "precisa_responder": true/false,
  "tipo_mensagem": "pergunta" | "afirmacao_dependente" | "aguardando_resposta" | "nenhuma",
  "confianca": 0.0-1.0,
  "motivo": "explicação breve",
  "sugestao_resposta": "breve sugestão do que responder"
}

REGRAS PARA "precisa_responder": true:
1. PERGUNTAS DIRETAS (com "?") → SIM (0.95)
2. PERGUNTAS SEM INTERROGAÇÃO → SIM (0.85)
3. AFIRMAÇÕES QUE PEDEM RESPOSTA ("Tá bom", "Certo, esperando") → SIM (0.90)
4. MENSAGENS DE ESPERA ("Aguardando...", "Fico no aguardo") → SIM (0.95)
5. URGÊNCIA/IMPACIÊNCIA ("Cadê?", "Já faz 3 dias") → SIM (0.90)
6. SOLICITAÇÕES DIRETAS ("Me manda", "Preciso do") → SIM (0.95)
7. CONTEXTUALIZAÇÃO ("Moro em Curitiba, preciso de...") → SIM (0.75)

REGRAS PARA "precisa_responder": false:
8. CONFIRMAÇÕES NEUTRAS ("Ok", "Certo", "👍") → NÃO (0.99)
9. AGRADECIMENTOS → TALVEZ (0.60)
10. ENCERRAMENTO ("Valeu!", "Resolvido") → NÃO (0.95)`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[CHECK-UNANSWERED] Iniciando verificação...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')!;
    let twilioFromNumber = Deno.env.get('TWILIO_PHONE_NUMBER') || 'whatsapp:+554138911555';
    if (!twilioFromNumber.startsWith('whatsapp:')) twilioFromNumber = 'whatsapp:' + twilioFromNumber;

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY não configurado');

    // 1. Buscar conversas onde a última mensagem é do CLIENTE e tem mais de 30min
    const trintaMinAtras = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    // Get clients with bot disabled (active conversations)
    const { data: clientesAtivos } = await supabase
      .from('clientes')
      .select('telefone, nome, ficha_ativa_id')
      .eq('bot_habilitado', false)
      .eq('arquivado', false);

    if (!clientesAtivos || clientesAtivos.length === 0) {
      console.log('[CHECK-UNANSWERED] Nenhum cliente ativo com bot desligado');
      return new Response(JSON.stringify({ checked: 0, notified: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const telefones = clientesAtivos.map(c => c.telefone);

    // 2. For each client, get last 5 messages to check if client is waiting
    const clientesParaNotificar: Array<{
      nome: string;
      telefone: string;
      ficha_id: string | null;
      ultima_msg: string;
      hora_msg: string;
      analise: any;
    }> = [];

    for (const cliente of clientesAtivos) {
      const { data: msgs } = await supabase
        .from('mensagens')
        .select('texto, remetente, data_hora')
        .eq('cliente_id', cliente.telefone)
        .order('data_hora', { ascending: false })
        .limit(5);

      if (!msgs || msgs.length === 0) continue;

      const ultimaMsg = msgs[0];

      // Skip if last message is from operator (already responded)
      if (ultimaMsg.remetente !== 'cliente') continue;

      // Skip if message is less than 30min old
      if (new Date(ultimaMsg.data_hora) > new Date(trintaMinAtras)) continue;

      // Skip messages older than 24h (probably already handled)
      const vinteQuatroHAtras = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (new Date(ultimaMsg.data_hora) < vinteQuatroHAtras) continue;

      // 3. Use Gemini to analyze the message
      const lastOperatorMsg = msgs.find(m => m.remetente === 'operador');

      const userPrompt = JSON.stringify({
        mensagem_cliente: ultimaMsg.texto || '(mensagem sem texto)',
        timestamp_mensagem: ultimaMsg.data_hora,
        ultima_resposta_operador: lastOperatorMsg ? {
          texto: lastOperatorMsg.texto,
          timestamp: lastOperatorMsg.data_hora
        } : null,
        historico_resumido: msgs.slice(0, 5).map(m => `${m.remetente}: ${m.texto || '(mídia)'}`).join(' | ')
      });

      try {
        const aiResponse = await fetch('https://ai-gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${lovableApiKey}`,
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
            messages: [
              { role: 'system', content: GEMINI_SYSTEM_PROMPT },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.1,
            max_tokens: 300,
          })
        });

        if (!aiResponse.ok) {
          console.error(`[CHECK-UNANSWERED] AI error for ${cliente.telefone}: ${aiResponse.status}`);
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || '';

        // Parse JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error(`[CHECK-UNANSWERED] Failed to parse AI response for ${cliente.telefone}`);
          continue;
        }

        const analise = JSON.parse(jsonMatch[0]);

        if (analise.precisa_responder === true && analise.confianca >= 0.7) {
          clientesParaNotificar.push({
            nome: cliente.nome,
            telefone: cliente.telefone,
            ficha_id: cliente.ficha_ativa_id,
            ultima_msg: (ultimaMsg.texto || '(mídia)').substring(0, 100),
            hora_msg: ultimaMsg.data_hora,
            analise
          });
        }
      } catch (aiErr) {
        console.error(`[CHECK-UNANSWERED] AI error for ${cliente.telefone}:`, aiErr);
      }
    }

    console.log(`[CHECK-UNANSWERED] ${clientesParaNotificar.length} clientes precisam de resposta`);

    // 4. Send WhatsApp notification to admin
    if (clientesParaNotificar.length > 0) {
      const projectId = Deno.env.get('SUPABASE_URL')?.match(/\/\/([^.]+)/)?.[1] || '';
      const baseUrl = `https://id-preview--247f47e9-107f-4a1e-896c-9ffdc2650cad.lovable.app`;

      let mensagem = `⚠️ *${clientesParaNotificar.length} cliente(s) aguardando resposta*\n\n`;

      for (const c of clientesParaNotificar.slice(0, 10)) {
        const hora = new Date(c.hora_msg).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
        const link = `${baseUrl}/chat-beta?telefone=${encodeURIComponent(c.telefone)}`;

        mensagem += `👤 *${c.nome}*\n`;
        mensagem += `📱 ${c.telefone}\n`;
        if (c.ficha_id) mensagem += `📄 Ficha: ${c.ficha_id}\n`;
        mensagem += `💬 "${c.ultima_msg}"\n`;
        mensagem += `⏰ ${hora}\n`;
        mensagem += `🔗 ${link}\n`;
        mensagem += `---\n`;
      }

      if (clientesParaNotificar.length > 10) {
        mensagem += `\n_...e mais ${clientesParaNotificar.length - 10} cliente(s)_`;
      }

      // Send via Twilio
      const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
      const twilioResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: ADMIN_PHONE,
            From: twilioFromNumber,
            Body: mensagem,
          }),
        }
      );

      if (twilioResponse.ok) {
        console.log(`[CHECK-UNANSWERED] ✅ Notificação enviada para admin`);
      } else {
        const err = await twilioResponse.text();
        console.error(`[CHECK-UNANSWERED] ❌ Erro ao enviar notificação:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        checked: clientesAtivos.length,
        notified: clientesParaNotificar.length,
        details: clientesParaNotificar.map(c => ({
          nome: c.nome,
          telefone: c.telefone,
          tipo: c.analise.tipo_mensagem,
          confianca: c.analise.confianca
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CHECK-UNANSWERED] ❌ Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
