import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[RECOVER] 🔄 Iniciando recuperação de MessageSids...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Credenciais da Twilio
    const twilioAccountSid =
      Deno.env.get('TWILIO_ACCOUNT_SID') ||
      'AC13e7e780450a855f503451bca7114c07';

    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');

    let twilioWhatsappNumber =
      Deno.env.get('TWILIO_PHONE_NUMBER') || 'whatsapp:+554138911555';

    if (!twilioWhatsappNumber.startsWith('whatsapp:')) {
      twilioWhatsappNumber = 'whatsapp:' + twilioWhatsappNumber;
    }

    if (!twilioAuthToken) {
      throw new Error('TWILIO_AUTH_TOKEN não configurado');
    }

    // Buscar mensagens sem MessageSid (últimos 7 dias, limite 100)
    const { data: mensagensSemSid, error: fetchError } = await supabase
      .from('mensagens')
      .select('id, cliente_id, texto, tipo, data_hora, arquivo_url')
      .is('message_sid', null)
      .eq('remetente', 'cliente')
      .gte(
        'data_hora',
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      )
      .order('data_hora', { ascending: false })
      .limit(100);

    if (fetchError) {
      throw fetchError;
    }

    console.log(
      `[RECOVER] Encontradas ${
        mensagensSemSid?.length || 0
      } mensagens sem MessageSid`
    );

    let recuperadas = 0;
    let naoEncontradas = 0;
    let erros = 0;
    const detalhes: any[] = [];

    // Processar cada mensagem
    for (const msg of mensagensSemSid || []) {
      try {
        const dataHora = new Date(msg.data_hora);
        const dataInicio = new Date(dataHora.getTime() - 5 * 60 * 1000);
        const dataFim = new Date(dataHora.getTime() + 5 * 60 * 1000);

        const authHeader = btoa(
          `${twilioAccountSid}:${twilioAuthToken}`
        );

        const url =
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json` +
          `?From=${encodeURIComponent(msg.cliente_id)}` +
          `&To=${encodeURIComponent(twilioWhatsappNumber)}` +
          `&DateSent>=${dataInicio.toISOString()}` +
          `&PageSize=50`;

        const response = await fetch(url, {
          headers: {
            Authorization: `Basic ${authHeader}`,
          },
        });

        if (!response.ok) {
          console.error(
            `[RECOVER] Erro ao buscar Twilio para msg ${msg.id}`
          );
          erros++;
          continue;
        }

        const data = await response.json();
        const mensagensTwilio = data.messages || [];

        let encontrada = false;

        for (const msgTwilio of mensagensTwilio) {
          const twilioDate = new Date(msgTwilio.date_sent);
          const diffMinutos =
            Math.abs(
              twilioDate.getTime() - dataHora.getTime()
            ) /
            (1000 * 60);

          if (diffMinutos < 2) {
            // Comparação de texto
            if (msg.texto && msgTwilio.body) {
              const textoNormalizado =
                msg.texto.trim().toLowerCase();
              const twilioNormalizado =
                msgTwilio.body.trim().toLowerCase();

              if (
                textoNormalizado === twilioNormalizado ||
                textoNormalizado.includes(twilioNormalizado) ||
                twilioNormalizado.includes(textoNormalizado)
              ) {
                encontrada = true;
              }
            }
            // Comparação de mídia
            else if (
              msg.tipo !== 'texto' &&
              msgTwilio.num_media &&
              parseInt(msgTwilio.num_media) > 0
            ) {
              encontrada = true;
            }
            // Ambos sem texto
            else if (
              (!msg.texto || msg.texto.trim() === '') &&
              (!msgTwilio.body ||
                msgTwilio.body.trim() === '')
            ) {
              encontrada = true;
            }

            if (encontrada) {
              const { error: updateError } = await supabase
                .from('mensagens')
                .update({ message_sid: msgTwilio.sid })
                .eq('id', msg.id);

              if (updateError) {
                console.error(
                  `[RECOVER] Erro ao atualizar msg ${msg.id}:`,
                  updateError
                );
                erros++;
              } else {
                console.log(
                  `[RECOVER] ✅ Recuperado: ${msg.id} → ${msgTwilio.sid}`
                );

                recuperadas++;
                detalhes.push({
                  id: msg.id,
                  message_sid: msgTwilio.sid,
                  data_hora: msg.data_hora,
                  texto: msg.texto?.substring(0, 50),
                });
              }

              break;
            }
          }
        }

        if (!encontrada) {
          console.log(
            `[RECOVER] ⚠️ Não encontrada na Twilio: ${msg.id}`
          );
          naoEncontradas++;
        }
      } catch (err) {
        console.error(
          `[RECOVER] Erro ao processar msg ${msg.id}:`,
          err
        );
        erros++;
      }
    }

    const duration = Date.now() - startTime;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ RECUPERAÇÃO CONCLUÍDA`);
    console.log(`${'='.repeat(60)}`);
    console.log(`⏱️ Duração: ${duration}ms`);
    console.log(
      `📊 Processadas: ${mensagensSemSid?.length || 0}`
    );
    console.log(`✅ Recuperadas: ${recuperadas}`);
    console.log(`⚠️ Não encontradas: ${naoEncontradas}`);
    console.log(`❌ Erros: ${erros}`);
    console.log(`${'='.repeat(60)}\n`);

    return new Response(
      JSON.stringify({
        success: true,
        duration_ms: duration,
        total_processadas: mensagensSemSid?.length || 0,
        recuperadas,
        nao_encontradas: naoEncontradas,
        erros,
        detalhes,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[RECOVER] 💥 Erro geral:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erro desconhecido',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
