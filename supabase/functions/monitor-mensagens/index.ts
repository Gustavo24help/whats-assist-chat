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
  console.log('[MONITOR] 📊 Iniciando monitoramento de mensagens...');

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

    if (!twilioAuthToken) {
      throw new Error('TWILIO_AUTH_TOKEN não configurado');
    }

    // Período de análise (últimas 24 horas)
    const periodoInicio = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const periodoFim = new Date();

    console.log(`[MONITOR] Período: ${periodoInicio.toISOString()} até ${periodoFim.toISOString()}`);

    // ===== BUSCAR MENSAGENS DA TWILIO =====
    const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json?To=${encodeURIComponent(twilioWhatsappNumber)}&DateSent>=${periodoInicio.toISOString()}&PageSize=1000`;

    console.log('[MONITOR] Buscando mensagens da Twilio...');
    const response = await fetch(url, {
      headers: { 'Authorization': `Basic ${authHeader}` }
    });

    if (!response.ok) {
      throw new Error(`Twilio API error: ${response.status}`);
    }

    const data = await response.json();
    const mensagensTwilio = data.messages || [];

    // Análise das mensagens da Twilio
    const twilioStats = {
      total: mensagensTwilio.length,
      com_midia: 0,
      sem_corpo: 0,
      sids: new Set<string>(),
      por_hora: {} as Record<string, number>,
    };

    mensagensTwilio.forEach((msg: any) => {
      twilioStats.sids.add(msg.sid);
      
      if (msg.num_media && parseInt(msg.num_media) > 0) {
        twilioStats.com_midia++;
      }
      
      if (!msg.body || msg.body.trim() === '') {
        twilioStats.sem_corpo++;
      }

      // Agrupar por hora
      const hora = new Date(msg.date_sent).toISOString().substring(0, 13); // YYYY-MM-DDTHH
      twilioStats.por_hora[hora] = (twilioStats.por_hora[hora] || 0) + 1;
    });

    console.log(`[MONITOR] Twilio: ${twilioStats.total} mensagens encontradas`);

    // ===== BUSCAR MENSAGENS DO SUPABASE =====
    const { data: mensagensSupabase, error: supabaseError } = await supabase
      .from('mensagens')
      .select('message_sid, texto, tipo, arquivo_url, remetente, data_hora')
      .gte('data_hora', periodoInicio.toISOString())
      .lte('data_hora', periodoFim.toISOString())
      .eq('remetente', 'cliente')
      .order('data_hora', { ascending: false });

    if (supabaseError) {
      throw supabaseError;
    }

    // Análise das mensagens do Supabase
    const supabaseStats = {
      total: mensagensSupabase?.length || 0,
      com_message_sid: 0,
      sem_message_sid: 0,
      em_branco: 0,
      com_arquivo: 0,
      sids: new Set<string>(),
      por_hora: {} as Record<string, number>,
      tipos: {} as Record<string, number>,
    };

    mensagensSupabase?.forEach((msg) => {
      if (msg.message_sid) {
        supabaseStats.com_message_sid++;
        supabaseStats.sids.add(msg.message_sid);
      } else {
        supabaseStats.sem_message_sid++;
      }

      if (!msg.texto || msg.texto.trim() === '' || msg.texto === 'NULL') {
        supabaseStats.em_branco++;
      }

      if (msg.arquivo_url) {
        supabaseStats.com_arquivo++;
      }

      // Agrupar por hora
      const hora = new Date(msg.data_hora).toISOString().substring(0, 13);
      supabaseStats.por_hora[hora] = (supabaseStats.por_hora[hora] || 0) + 1;

      // Agrupar por tipo
      supabaseStats.tipos[msg.tipo] = (supabaseStats.tipos[msg.tipo] || 0) + 1;
    });

    console.log(`[MONITOR] Supabase: ${supabaseStats.total} mensagens encontradas`);

    // ===== IDENTIFICAR DIVERGÊNCIAS =====
    const mensagensFaltando = Array.from(twilioStats.sids).filter(
      sid => !supabaseStats.sids.has(sid)
    );

    const mensagensExtras = Array.from(supabaseStats.sids).filter(
      sid => !twilioStats.sids.has(sid)
    );

    // Calcular taxa de perda
    const taxaPerda = twilioStats.total > 0 
      ? ((mensagensFaltando.length / twilioStats.total) * 100).toFixed(2)
      : '0.00';

    // ===== BUSCAR DETALHES DAS MENSAGENS FALTANDO =====
    const detalhesFaltando = [];
    for (const sid of mensagensFaltando.slice(0, 10)) { // Limitar a 10 para performance
      const msgTwilio = mensagensTwilio.find((m: any) => m.sid === sid);
      if (msgTwilio) {
        detalhesFaltando.push({
          message_sid: msgTwilio.sid,
          data: msgTwilio.date_sent,
          from: msgTwilio.from,
          body: msgTwilio.body?.substring(0, 50) || '(vazio)',
          num_media: msgTwilio.num_media,
          status: msgTwilio.status,
        });
      }
    }

    // ===== BUSCAR MENSAGENS EM BRANCO NO SUPABASE =====
    const { data: mensagensEmBranco } = await supabase
      .from('mensagens')
      .select('message_sid, data_hora, tipo, arquivo_url, remetente')
      .gte('data_hora', periodoInicio.toISOString())
      .eq('remetente', 'cliente')
      .or('texto.is.null,texto.eq.,texto.eq.NULL')
      .limit(20);

    // ===== BUSCAR HISTÓRICO DO SYNC =====
    const { data: syncHistory } = await supabase
      .from('twilio_sync_control')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(10);

    const syncStats = {
      ultima_execucao: syncHistory?.[0]?.updated_at || null,
      total_encontradas_ultimas_24h: 0,
      total_novas_ultimas_24h: 0,
      total_erros_ultimas_24h: 0,
    };

    syncHistory?.forEach((sync) => {
      const syncDate = new Date(sync.updated_at);
      if (syncDate >= periodoInicio) {
        syncStats.total_encontradas_ultimas_24h += sync.messages_found || 0;
        syncStats.total_novas_ultimas_24h += sync.messages_new || 0;
        syncStats.total_erros_ultimas_24h += sync.errors || 0;
      }
    });

    // ===== ANÁLISE POR HORA (últimas 6 horas) =====
    const horasRecentes = [];
    for (let i = 0; i < 6; i++) {
      const hora = new Date(Date.now() - i * 60 * 60 * 1000).toISOString().substring(0, 13);
      horasRecentes.push({
        hora: hora.substring(11, 13) + 'h', // Apenas hora
        twilio: twilioStats.por_hora[hora] || 0,
        supabase: supabaseStats.por_hora[hora] || 0,
        divergencia: (twilioStats.por_hora[hora] || 0) - (supabaseStats.por_hora[hora] || 0),
      });
    }

    // ===== MONTAR RESPOSTA =====
    const duration = Date.now() - startTime;

    const resultado = {
      timestamp: new Date().toISOString(),
      periodo: {
        inicio: periodoInicio.toISOString(),
        fim: periodoFim.toISOString(),
        horas: 24,
      },
      resumo: {
        total_twilio: twilioStats.total,
        total_supabase: supabaseStats.total,
        mensagens_faltando: mensagensFaltando.length,
        mensagens_extras: mensagensExtras.length,
        taxa_perda_percentual: parseFloat(taxaPerda),
        mensagens_em_branco: supabaseStats.em_branco,
        mensagens_sem_message_sid: supabaseStats.sem_message_sid,
      },
      twilio: {
        total: twilioStats.total,
        com_midia: twilioStats.com_midia,
        sem_corpo: twilioStats.sem_corpo,
        percentual_midia: twilioStats.total > 0 
          ? ((twilioStats.com_midia / twilioStats.total) * 100).toFixed(2)
          : '0.00',
      },
      supabase: {
        total: supabaseStats.total,
        com_message_sid: supabaseStats.com_message_sid,
        sem_message_sid: supabaseStats.sem_message_sid,
        em_branco: supabaseStats.em_branco,
        com_arquivo: supabaseStats.com_arquivo,
        tipos: supabaseStats.tipos,
      },
      sync: {
        ultima_execucao: syncStats.ultima_execucao,
        total_encontradas_24h: syncStats.total_encontradas_ultimas_24h,
        total_recuperadas_24h: syncStats.total_novas_ultimas_24h,
        total_erros_24h: syncStats.total_erros_ultimas_24h,
        execucoes_24h: syncHistory?.filter(s => new Date(s.updated_at) >= periodoInicio).length || 0,
      },
      divergencias: {
        mensagens_faltando: {
          total: mensagensFaltando.length,
          message_sids: mensagensFaltando.slice(0, 20), // Limitar a 20
          detalhes: detalhesFaltando,
        },
        mensagens_extras: {
          total: mensagensExtras.length,
          message_sids: mensagensExtras.slice(0, 20),
        },
        mensagens_em_branco: {
          total: mensagensEmBranco?.length || 0,
          exemplos: mensagensEmBranco || [],
        },
      },
      analise_por_hora: horasRecentes.reverse(),
      saude_sistema: {
        status: mensagensFaltando.length === 0 ? 'EXCELENTE' : 
                mensagensFaltando.length <= 5 ? 'BOM' :
                mensagensFaltando.length <= 20 ? 'ATENÇÃO' : 'CRÍTICO',
        taxa_sucesso: (100 - parseFloat(taxaPerda)).toFixed(2) + '%',
        sync_funcionando: syncStats.ultima_execucao 
          ? (Date.now() - new Date(syncStats.ultima_execucao).getTime() < 5 * 60 * 1000)
          : false,
      },
      performance: {
        duracao_ms: duration,
        timestamp: new Date().toISOString(),
      },
    };

    console.log(`[MONITOR] ✅ Análise concluída em ${duration}ms`);
    console.log(`[MONITOR] Taxa de perda: ${taxaPerda}%`);
    console.log(`[MONITOR] Status: ${resultado.saude_sistema.status}`);

    return new Response(
      JSON.stringify(resultado, null, 2),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        } 
      }
    );

  } catch (error) {
    console.error('[MONITOR] 💥 Erro:', error);
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
