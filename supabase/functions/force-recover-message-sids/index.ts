import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('🔧 [FORCE-RECOVER] Iniciando recuperação FORÇADA de MessageSids...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID') || 'AC13e7e780450a855f503451bca7114c07';
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    let twilioWhatsappNumber = Deno.env.get('TWILIO_PHONE_NUMBER') || 'whatsapp:+554138911555';

    if (!twilioWhatsappNumber.startsWith('whatsapp:')) {
      twilioWhatsappNumber = 'whatsapp:' + twilioWhatsappNumber;
    }

    if (!twilioAuthToken) {
      throw new Error('TWILIO_AUTH_TOKEN não configurado');
    }

    const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    // Buscar TODAS mensagens sem MessageSid (últimas 48h)
    const { data: mensagensSemSid, error: fetchError } = await supabase
      .from('mensagens')
      .select('id, cliente_id, texto, tipo, data_hora, arquivo_url')
      .is('message_sid', null)
      .eq('remetente', 'cliente')
      .gte('data_hora', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order('data_hora', { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    console.log(`[FORCE-RECOVER] 📋 Encontradas ${mensagensSemSid?.length || 0} mensagens sem MessageSid`);

    if (!mensagensSemSid || mensagensSemSid.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhuma mensagem sem MessageSid encontrada!',
          recuperadas: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let recuperadas = 0;
    let naoEncontradas = 0;
    let erros = 0;
    const detalhes: any[] = [];

    for (const msg of mensagensSemSid) {
      try {
        const dataHora = new Date(msg.data_hora);
        
        // Janela de busca: ±10 minutos (mais flexível)
        const dataInicio = new Date(dataHora.getTime() - 10 * 60 * 1000);

        console.log(`\n[FORCE-RECOVER] 🔍 Processando: ${msg.id}`);
        console.log(`   Data/Hora: ${dataHora.toISOString()}`);
        console.log(`   Tipo: ${msg.tipo}`);
        console.log(`   Texto: ${msg.texto?.substring(0, 50) || '(vazio)'}`);
        console.log(`   Cliente: ${msg.cliente_id}`);

        // Buscar na Twilio
        const urlRecover = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json?From=${encodeURIComponent(msg.cliente_id)}&To=${encodeURIComponent(twilioWhatsappNumber)}&DateSent>=${dataInicio.toISOString()}&PageSize=50`;

        const recoverResponse = await fetch(urlRecover, {
          headers: { 'Authorization': `Basic ${authHeader}` }
        });

        if (!recoverResponse.ok) {
          console.error(`   ❌ Erro Twilio API: ${recoverResponse.status}`);
          erros++;
          continue;
        }

        const recoverData = await recoverResponse.json();
        const candidatos = recoverData.messages || [];

        console.log(`   📊 Candidatos encontrados: ${candidatos.length}`);

        if (candidatos.length === 0) {
          console.log(`   ⚠️ Nenhum candidato na Twilio`);
          naoEncontradas++;
          detalhes.push({
            id: msg.id,
            status: 'nao_encontrada',
            data_hora: msg.data_hora,
            texto: msg.texto?.substring(0, 50),
          });
          continue;
        }

        let melhorMatch: any = null;
        let melhorScore = 0;

        // Procurar melhor match
        for (const msgTwilio of candidatos) {
          const twilioDate = new Date(msgTwilio.date_sent);
          const diffMinutos = Math.abs(twilioDate.getTime() - dataHora.getTime()) / (1000 * 60);

          let score = 0;

          // Pontuação por proximidade
          if (diffMinutos <= 1) score += 100;
          else if (diffMinutos <= 3) score += 50;
          else if (diffMinutos <= 5) score += 25;
          else if (diffMinutos <= 10) score += 10;

          // Pontuação por tipo
          if (msg.tipo !== 'texto' && msgTwilio.num_media && parseInt(msgTwilio.num_media) > 0) {
            score += 50;
          }

          // Pontuação por texto
          if (msg.texto && msgTwilio.body) {
            const textoNorm = msg.texto.trim().toLowerCase().substring(0, 100);
            const twilioNorm = msgTwilio.body.trim().toLowerCase().substring(0, 100);
            
            if (textoNorm === twilioNorm) {
              score += 100;
            } else if (textoNorm.includes(twilioNorm) || twilioNorm.includes(textoNorm)) {
              score += 75;
            }
          }

          // Ambos vazios
          if ((!msg.texto || msg.texto.trim() === '') && (!msgTwilio.body || msgTwilio.body.trim() === '')) {
            score += 30;
          }

          if (score > melhorScore) {
            melhorScore = score;
            melhorMatch = msgTwilio;
          }
        }

        // Match se score >= 50
        if (melhorMatch && melhorScore >= 50) {
          console.log(`   ✅ MATCH! Score: ${melhorScore}, SID: ${melhorMatch.sid}`);
          
          const { error: updateError } = await supabase
            .from('mensagens')
            .update({ message_sid: melhorMatch.sid })
            .eq('id', msg.id);

          if (!updateError) {
            recuperadas++;
            detalhes.push({
              id: msg.id,
              status: 'recuperada',
              message_sid: melhorMatch.sid,
              score: melhorScore,
            });
          } else {
            erros++;
          }
        } else {
          console.log(`   ⚠️ Score baixo: ${melhorScore}`);
          naoEncontradas++;
          detalhes.push({
            id: msg.id,
            status: 'score_baixo',
            melhor_score: melhorScore,
          });
        }

      } catch (err) {
        console.error(`   💥 Erro: ${err}`);
        erros++;
      }
    }

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        duration_ms: duration,
        total_processadas: mensagensSemSid.length,
        recuperadas,
        nao_encontradas: naoEncontradas,
        erros,
        detalhes,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Erro geral:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
