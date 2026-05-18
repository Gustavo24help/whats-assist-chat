import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("🔄 [SYNC] Iniciando sincronização de mensagens da Twilio...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "AC13e7e780450a855f503451bca7114c07";
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    let twilioWhatsappNumber = Deno.env.get("TWILIO_PHONE_NUMBER") || "whatsapp:+554138911555";

    if (!twilioWhatsappNumber.startsWith("whatsapp:")) {
      twilioWhatsappNumber = "whatsapp:" + twilioWhatsappNumber;
    }

    if (!twilioAuthToken) {
      throw new Error("TWILIO_AUTH_TOKEN não configurado");
    }

    // Buscar último sync
    const { data: syncControl } = await supabase
      .from("twilio_sync_control")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastSyncTime = syncControl?.last_sync_timestamp
      ? new Date(syncControl.last_sync_timestamp)
      : new Date(Date.now() - 5 * 60 * 1000);

    const dateSentAfter = lastSyncTime.toISOString();

    const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json?To=${encodeURIComponent(twilioWhatsappNumber)}&DateSent>=${dateSentAfter}&PageSize=100`;

    const response = await fetch(url, {
      headers: { Authorization: `Basic ${authHeader}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const mensagensTwilio = data.messages || [];

    console.log(`📊 Encontradas ${mensagensTwilio.length} mensagens na Twilio`);

    let mensagensNovas = 0;
    let mensagensJaExistem = 0;
    let erros = 0;

    // ===== PARTE 1: SYNC NORMAL =====
    for (const msgTwilio of mensagensTwilio) {
      try {
        const { data: existente } = await supabase
          .from("mensagens")
          .select("id")
          .eq("message_sid", msgTwilio.sid)
          .maybeSingle();

        if (existente) {
          mensagensJaExistem++;
          continue;
        }

        const telefoneCliente = msgTwilio.from;

        let { data: cliente } = await supabase
          .from("clientes")
          .select("*")
          .eq("telefone", telefoneCliente)
          .maybeSingle();

        if (!cliente) {
          const nomeCliente = telefoneCliente.replace("whatsapp:", "").replace("+", "");
          const { data: novoCliente, error: createClienteError } = await supabase
            .from("clientes")
            .insert({
              telefone: telefoneCliente,
              nome: nomeCliente,
              status_conversa: "aberta",
              ultima_interacao: new Date().toISOString(),
              tags: [],
            })
            .select()
            .single();

          if (createClienteError) {
            erros++;
            continue;
          }

          cliente = novoCliente;
        }

        let tipo = "texto";
        let arquivoUrl = null;
        let texto = msgTwilio.body || "";

        if (msgTwilio.num_media && parseInt(msgTwilio.num_media) > 0) {
          const mediaUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages/${msgTwilio.sid}/Media.json`;

          const mediaResponse = await fetch(mediaUrl, {
            headers: { Authorization: `Basic ${authHeader}` },
          });

          if (mediaResponse.ok) {
            const mediaData = await mediaResponse.json();
            if (mediaData.media_list && mediaData.media_list.length > 0) {
              const media = mediaData.media_list[0];
              arquivoUrl = `https://api.twilio.com${media.uri.replace(".json", "")}`;

              const contentType = media.content_type || "";
              if (contentType.startsWith("image/")) tipo = "imagem";
              else if (contentType.startsWith("video/")) tipo = "video";
              else if (contentType.startsWith("audio/")) tipo = "audio";
              else tipo = "arquivo";

              if (!texto) texto = `Arquivo 1`;
            }
          }
        }

        const { data: fichaAtiva } = await supabase
          .from("fichas_de_servico")
          .select("id")
          .eq("telefone_cliente", telefoneCliente)
          .eq("status", "Agendado")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const dataSent = new Date(msgTwilio.date_sent);

        const mensagem = {
          cliente_id: telefoneCliente,
          remetente: telefoneCliente,
          texto,
          tipo,
          arquivo_url: arquivoUrl,
          status: "recebido",
          data_hora: dataSent.toISOString(),
          ficha_id: fichaAtiva?.id || null,
          message_sid: msgTwilio.sid,
          reply_to_message_id: null,
          tipo_remetente: "cliente",
        };

        const { error } = await supabase.from("mensagens").insert(mensagem);

        if (error) {
          erros++;
        } else {
          mensagensNovas++;
        }
      } catch (err) {
        erros++;
      }
    }

    // ===== PARTE 2: RECUPERAÇÃO RÁPIDA E INTELIGENTE =====
    console.log("\n🔧 [RECOVER] Iniciando recuperação automática...");

    let recuperadas = 0;

    // Buscar até 100 mensagens sem MessageSid (aumentado de 20)
    const { data: mensagensSemSid } = await supabase
      .from("mensagens")
      .select("id, cliente_id, texto, tipo, data_hora, arquivo_url")
      .is("message_sid", null)
      .eq("remetente", "cliente")
      .gte("data_hora", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order("data_hora", { ascending: false })
      .limit(100);

    if (mensagensSemSid && mensagensSemSid.length > 0) {
      console.log(`[RECOVER] Encontradas ${mensagensSemSid.length} mensagens sem MessageSid`);

      for (const msg of mensagensSemSid) {
        try {
          const dataHora = new Date(msg.data_hora);

          // Janela mais ampla: ±10 minutos
          const dataInicio = new Date(dataHora.getTime() - 10 * 60 * 1000);

          const urlRecover = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json?From=${encodeURIComponent(msg.cliente_id)}&To=${encodeURIComponent(twilioWhatsappNumber)}&DateSent>=${dataInicio.toISOString()}&PageSize=50`;

          const recoverResponse = await fetch(urlRecover, {
            headers: { Authorization: `Basic ${authHeader}` },
          });

          if (!recoverResponse.ok) continue;

          const recoverData = await recoverResponse.json();
          const candidatos = recoverData.messages || [];

          if (candidatos.length === 0) continue;

          let melhorMatch: any = null;
          let melhorScore = 0;

          // Sistema de pontuação inteligente
          for (const msgTwilio of candidatos) {
            const twilioDate = new Date(msgTwilio.date_sent);
            const diffMinutos = Math.abs(twilioDate.getTime() - dataHora.getTime()) / (1000 * 60);

            let score = 0;

            // Pontuação por proximidade de horário
            if (diffMinutos <= 0.5) score += 100;
            else if (diffMinutos <= 1) score += 80;
            else if (diffMinutos <= 2) score += 60;
            else if (diffMinutos <= 5) score += 40;
            else if (diffMinutos <= 10) score += 20;

            // Pontuação por tipo de mídia
            if (msg.tipo !== "texto" && msgTwilio.num_media && parseInt(msgTwilio.num_media) > 0) {
              score += 60;
            }

            // Pontuação por texto
            if (msg.texto && msgTwilio.body) {
              const textoNorm = msg.texto.trim().toLowerCase().substring(0, 150);
              const twilioNorm = msgTwilio.body.trim().toLowerCase().substring(0, 150);

              if (textoNorm === twilioNorm) {
                score += 100;
              } else if (textoNorm.includes(twilioNorm) || twilioNorm.includes(textoNorm)) {
                score += 80;
              } else {
                // Similaridade por palavras
                const palavrasMsg = textoNorm.split(/\s+/);
                const palavrasTwilio = twilioNorm.split(/\s+/);
                const palavrasComuns = palavrasMsg.filter((p) => p.length > 3 && palavrasTwilio.includes(p));

                if (palavrasComuns.length > 0) {
                  const similaridade =
                    (palavrasComuns.length / Math.max(palavrasMsg.length, palavrasTwilio.length)) * 60;
                  score += similaridade;
                }
              }
            }

            // Ambos vazios (imagens sem legenda)
            if (
              (!msg.texto || msg.texto.trim() === "" || msg.texto === "Arquivo 1") &&
              (!msgTwilio.body || msgTwilio.body.trim() === "")
            ) {
              score += 40;
            }

            if (score > melhorScore) {
              melhorScore = score;
              melhorMatch = msgTwilio;
            }
          }

          // Match mais flexível: >= 40 pontos (era 50)
          if (melhorMatch && melhorScore >= 40) {
            const { error: updateError } = await supabase
              .from("mensagens")
              .update({ message_sid: melhorMatch.sid })
              .eq("id", msg.id);

            if (!updateError) {
              console.log(`[RECOVER] ✅ ${msg.id} → ${melhorMatch.sid} (score: ${melhorScore})`);
              recuperadas++;
            }
          }
        } catch (err) {
          // Ignora erros individuais
        }
      }

      console.log(`[RECOVER] 🎉 Recuperadas: ${recuperadas} de ${mensagensSemSid.length}`);
    }

    // ===== ATUALIZAR CONTROLE =====
    await supabase.from("twilio_sync_control").upsert({
      id: syncControl?.id || crypto.randomUUID(),
      last_sync_timestamp: new Date().toISOString(),
      messages_found: mensagensTwilio.length,
      messages_new: mensagensNovas,
      messages_already_exist: mensagensJaExistem,
      errors: erros,
      last_message_sid: mensagensTwilio[0]?.sid || null,
      updated_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;

    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ SINCRONIZAÇÃO CONCLUÍDA`);
    console.log(`${"=".repeat(60)}`);
    console.log(`⏱️  Duração: ${duration}ms`);
    console.log(`📊 Encontradas: ${mensagensTwilio.length}`);
    console.log(`✅ Novas: ${mensagensNovas}`);
    console.log(`⏭️  Já existem: ${mensagensJaExistem}`);
    console.log(`🔧 MessageSids recuperados: ${recuperadas}`);
    console.log(`❌ Erros: ${erros}`);
    console.log(`${"=".repeat(60)}\n`);

    return new Response(
      JSON.stringify({
        success: true,
        duration_ms: duration,
        messages_found: mensagensTwilio.length,
        messages_new: mensagensNovas,
        messages_already_exist: mensagensJaExistem,
        message_sids_recovered: recuperadas,
        errors: erros,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("💥 Erro geral:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
