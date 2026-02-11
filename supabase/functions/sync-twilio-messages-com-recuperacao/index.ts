import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('🔄 [SYNC] Iniciando sincronização de mensagens da Twilio...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Credenciais da Twilio
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID') || 'AC13e7e780450a855f503451bca7114c07';
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    let twilioWhatsappNumber = Deno.env.get('TWILIO_PHONE_NUMBER') || 'whatsapp:+554138911555';

    if (!twilioWhatsappNumber.startsWith('whatsapp:')) {
      twilioWhatsappNumber = 'whatsapp:' + twilioWhatsappNumber;
    }

    console.log(`📞 Configuração Twilio:`);
    console.log(`   Account SID: ${twilioAccountSid}`);
    console.log(`   WhatsApp Number: ${twilioWhatsappNumber}`);
    console.log(`   Auth Token: ${twilioAuthToken ? '✅ Configurado' : '❌ FALTANDO'}`);

    if (!twilioAuthToken) {
      throw new Error('TWILIO_AUTH_TOKEN não configurado');
    }

    // Buscar último sync
    const { data: syncControl } = await supabase
      .from('twilio_sync_control')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Buscar mensagens dos últimos 5 minutos (ou desde o último sync)
    const lastSyncTime = syncControl?.last_sync_timestamp
      ? new Date(syncControl.last_sync_timestamp)
      : new Date(Date.now() - 5 * 60 * 1000);

    const dateSentAfter = lastSyncTime.toISOString();

    console.log(`🔍 Buscando mensagens desde: ${dateSentAfter}`);

    // Autenticação Basic da Twilio
    const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    // Buscar mensagens RECEBIDAS (To = nosso número)
    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json?To=${encodeURIComponent(twilioWhatsappNumber)}&DateSent>=${dateSentAfter}&PageSize=100`;

    console.log(`📡 Chamando Twilio API...`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro da Twilio API: ${response.status}`);
      throw new Error(`Twilio API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const mensagensTwilio = data.messages || [];

    console.log(`📊 Encontradas ${mensagensTwilio.length} mensagens na Twilio`);

    let mensagensNovas = 0;
    let mensagensJaExistem = 0;
    let erros = 0;
    const errosDetalhados: string[] = [];

    // ===== PARTE 1: SYNC NORMAL (salvar novas) =====
    for (const msgTwilio of mensagensTwilio) {
      try {
        // Verificar se já existe no Supabase
        const { data: existente } = await supabase
          .from('mensagens')
          .select('id')
          .eq('message_sid', msgTwilio.sid)
          .maybeSingle();

        if (existente) {
          mensagensJaExistem++;
          continue;
        }

        console.log(`📥 Processando nova: ${msgTwilio.sid}`);

        // Buscar ou criar cliente
        const telefoneCliente = msgTwilio.from;

        let { data: cliente } = await supabase
          .from('clientes')
          .select('*')
          .eq('telefone', telefoneCliente)
          .maybeSingle();

        if (!cliente) {
          console.log(`   Criando novo cliente: ${telefoneCliente}`);
          const nomeCliente = telefoneCliente.replace('whatsapp:', '').replace('+', '');
          const { data: novoCliente, error: createClienteError } = await supabase
            .from('clientes')
            .insert({
              telefone: telefoneCliente,
              nome: nomeCliente,
              status_conversa: 'aberta',
              ultima_interacao: new Date().toISOString(),
              tags: [],
            })
            .select()
            .single();

          if (createClienteError) {
            console.error(`❌ Erro ao criar cliente:`, createClienteError);
            erros++;
            errosDetalhados.push(`Cliente ${telefoneCliente}: ${createClienteError.message}`);
            continue;
          }

          cliente = novoCliente;
        }

        // Determinar tipo e URL de arquivo
        let tipo = 'texto';
        let arquivoUrl = null;
        let texto = msgTwilio.body || '';

        if (msgTwilio.num_media && parseInt(msgTwilio.num_media) > 0) {
          const mediaUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages/${msgTwilio.sid}/Media.json`;

          const mediaResponse = await fetch(mediaUrl, {
            headers: { Authorization: `Basic ${authHeader}` },
          });

          if (mediaResponse.ok) {
            const mediaData = await mediaResponse.json();
            if (mediaData.media_list && mediaData.media_list.length > 0) {
              const media = mediaData.media_list[0];
              arquivoUrl = `https://api.twilio.com${media.uri.replace('.json', '')}`;

              const contentType = media.content_type || '';
              if (contentType.startsWith('image/')) tipo = 'imagem';
              else if (contentType.startsWith('video/')) tipo = 'video';
              else if (contentType.startsWith('audio/')) tipo = 'audio';
              else tipo = 'arquivo';

              if (!texto) texto = `Arquivo 1`;
            }
          }
        }

        // Buscar ficha ativa
        const { data: fichaAtiva } = await supabase
          .from('fichas_de_servico')
          .select('id')
          .eq('telefone_cliente', telefoneCliente)
          .eq('status', 'Agendado')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Inserir mensagem
        const dataSent = new Date(msgTwilio.date_sent);

        const mensagem = {
          cliente_id: telefoneCliente,
          remetente: 'cliente',
          texto,
          tipo,
          arquivo_url: arquivoUrl,
          status: 'recebido',
          data_hora: dataSent.toISOString(),
          ficha_id: fichaAtiva?.id || null,
          message_sid: msgTwilio.sid,
          reply_to_message_id: null,
        };

        const { error } = await supabase.from('mensagens').insert(mensagem);

        if (error) {
          console.error(`❌ Erro ao salvar:`, error);
          erros++;
          errosDetalhados.push(`${msgTwilio.sid}: ${error.message}`);
        } else {
          console.log(`✅ Salva: ${texto.substring(0, 30)}...`);
          mensagensNovas++;
        }
      } catch (err) {
        console.error(`💥 Erro ao processar:`, err);
        erros++;
        errosDetalhados.push(`Erro: ${err instanceof Error ? err.message : 'Desconhecido'}`);
      }
    }

    // ===== PARTE 2: RECUPERAÇÃO AUTOMÁTICA DE MessageSids =====
    console.log('\n🔧 [RECOVER] Iniciando recuperação automática de MessageSids...');
    
    let recuperadas = 0;
    
    // Buscar até 20 mensagens sem MessageSid (últimas 48h)
    const { data: mensagensSemSid } = await supabase
      .from('mensagens')
      .select('id, cliente_id, texto, tipo, data_hora, arquivo_url')
      .is('message_sid', null)
      .eq('remetente', 'cliente')
      .gte('data_hora', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order('data_hora', { ascending: false })
      .limit(20);

    if (mensagensSemSid && mensagensSemSid.length > 0) {
      console.log(`[RECOVER] Encontradas ${mensagensSemSid.length} mensagens sem MessageSid`);

      for (const msg of mensagensSemSid) {
        try {
          const dataHora = new Date(msg.data_hora);
          const dataInicio = new Date(dataHora.getTime() - 5 * 60 * 1000);
          const dataFim = new Date(dataHora.getTime() + 5 * 60 * 1000);

          // Buscar na Twilio
          const urlRecover = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json?From=${encodeURIComponent(msg.cliente_id)}&To=${encodeURIComponent(twilioWhatsappNumber)}&DateSent>=${dataInicio.toISOString()}&PageSize=20`;

          const recoverResponse = await fetch(urlRecover, {
            headers: { 'Authorization': `Basic ${authHeader}` }
          });

          if (!recoverResponse.ok) continue;

          const recoverData = await recoverResponse.json();
          const candidatos = recoverData.messages || [];

          // Encontrar correspondência
          for (const msgTwilio of candidatos) {
            const twilioDate = new Date(msgTwilio.date_sent);
            const diffMinutos = Math.abs(twilioDate.getTime() - dataHora.getTime()) / (1000 * 60);

            if (diffMinutos < 3) {
              let match = false;

              // Comparar por texto
              if (msg.texto && msgTwilio.body) {
                const textoNorm = msg.texto.trim().toLowerCase().substring(0, 100);
                const twilioNorm = msgTwilio.body.trim().toLowerCase().substring(0, 100);
                
                if (textoNorm === twilioNorm || textoNorm.includes(twilioNorm) || twilioNorm.includes(textoNorm)) {
                  match = true;
                }
              }
              // Comparar por mídia
              else if (msg.tipo !== 'texto' && msgTwilio.num_media && parseInt(msgTwilio.num_media) > 0) {
                match = true;
              }
              // Ambos vazios
              else if ((!msg.texto || msg.texto.trim() === '') && (!msgTwilio.body || msgTwilio.body.trim() === '')) {
                match = true;
              }

              if (match) {
                // Atualizar MessageSid
                const { error: updateError } = await supabase
                  .from('mensagens')
                  .update({ message_sid: msgTwilio.sid })
                  .eq('id', msg.id);

                if (!updateError) {
                  console.log(`[RECOVER] ✅ ${msg.id} → ${msgTwilio.sid}`);
                  recuperadas++;
                }
                break;
              }
            }
          }
        } catch (err) {
          // Silenciosamente ignora erros individuais para não travar o sync
          console.error(`[RECOVER] Erro ao recuperar ${msg.id}:`, err);
        }
      }

      console.log(`[RECOVER] 🎉 Recuperadas: ${recuperadas} de ${mensagensSemSid.length}`);
    } else {
      console.log('[RECOVER] ✅ Nenhuma mensagem sem MessageSid encontrada!');
    }

    // ===== ATUALIZAR CONTROLE =====
    const { error: updateError } = await supabase.from('twilio_sync_control').upsert({
      id: syncControl?.id || crypto.randomUUID(),
      last_sync_timestamp: new Date().toISOString(),
      messages_found: mensagensTwilio.length,
      messages_new: mensagensNovas,
      messages_already_exist: mensagensJaExistem,
      errors: erros,
      last_message_sid: mensagensTwilio[0]?.sid || null,
      updated_at: new Date().toISOString(),
    });

    if (updateError) {
      console.error('⚠️ Erro ao atualizar sync_control:', updateError);
    }

    const duration = Date.now() - startTime;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ SINCRONIZAÇÃO CONCLUÍDA`);
    console.log(`${'='.repeat(60)}`);
    console.log(`⏱️  Duração: ${duration}ms`);
    console.log(`📊 Encontradas: ${mensagensTwilio.length}`);
    console.log(`✅ Novas: ${mensagensNovas}`);
    console.log(`⏭️  Já existem: ${mensagensJaExistem}`);
    console.log(`🔧 MessageSids recuperados: ${recuperadas}`);
    console.log(`❌ Erros: ${erros}`);
    console.log(`${'='.repeat(60)}\n`);

    if (errosDetalhados.length > 0) {
      console.log('📋 Erros:');
      errosDetalhados.forEach((erro, i) => console.log(`  ${i + 1}. ${erro}`));
    }

    return new Response(
      JSON.stringify({
        success: true,
        duration_ms: duration,
        messages_found: mensagensTwilio.length,
        messages_new: mensagensNovas,
        messages_already_exist: mensagensJaExistem,
        message_sids_recovered: recuperadas,
        errors: erros,
        errors_details: errosDetalhados,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('💥 Erro geral:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: error instanceof Error ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
