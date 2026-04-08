import { createClient } from "npm:@supabase/supabase-js@2";
import { normalizeWhatsappNumber, getNumeroPrestadores } from "../_shared/twilioNumbers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Recupera histórico completo de mensagens de prestadores da Twilio.
 * 
 * Body params:
 *   telefone? - telefone específico para recuperar (ex: "5541999198393")
 *   limit?    - máximo de telefones a processar (default 10)
 *   days?     - quantos dias no passado buscar (default 30)
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("🔧 [RECOVER-PRESTADOR] Iniciando recuperação histórica...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "AC13e7e780450a855f503451bca7114c07";
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const numeroPrestadores = getNumeroPrestadores();

    if (!twilioAuthToken) throw new Error("TWILIO_AUTH_TOKEN não configurado");
    if (!numeroPrestadores) throw new Error("TWILIO_PHONE_NUMBER_2 não configurado");

    let body: Record<string, unknown> = {};
    try {
      const raw = await req.text();
      if (raw.trim()) body = JSON.parse(raw);
    } catch { /* empty */ }

    let telefoneAlvo = "";
    if (body.telefone) {
      let raw = String(body.telefone).trim();
      // Ensure + prefix for bare numbers
      if (!raw.startsWith("whatsapp:") && !raw.startsWith("+")) {
        raw = "+" + raw;
      }
      telefoneAlvo = normalizeWhatsappNumber(raw);
    }
    const maxTelefones = Math.min(Number(body.limit) || 10, 50);
    const daysBack = Math.min(Number(body.days) || 30, 90);

    const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    // 1. Identificar telefones a recuperar
    let telefonesParaRecuperar: string[] = [];

    if (telefoneAlvo) {
      telefonesParaRecuperar = [telefoneAlvo];
    } else {
      // Buscar todos os prestadores_chat e filtrar os que não têm inbound
      // usando uma única query eficiente via left join simulado
      const { data: allChats } = await supabase
        .from("prestadores_chat")
        .select("telefone")
        .order("ultima_interacao", { ascending: false })
        .limit(maxTelefones * 3);

      if (allChats) {
        // Batch check: buscar todos telefones que TÊM pelo menos 1 inbound
        const telefones = allChats.map(c => c.telefone);
        const { data: comInbound } = await supabase
          .from("mensagens_prestadores")
          .select("prestador_telefone")
          .in("prestador_telefone", telefones)
          .eq("remetente", "cliente")
          .limit(1000);

        const telefonesComInbound = new Set(
          (comInbound || []).map((r: any) => r.prestador_telefone)
        );

        telefonesParaRecuperar = telefones
          .filter(t => !telefonesComInbound.has(t))
          .slice(0, maxTelefones);
      }
    }

    console.log(`📋 Telefones a recuperar: ${telefonesParaRecuperar.length}`);

    const dateSince = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
    let totalRecuperadas = 0;
    let totalJaExistem = 0;
    let totalErros = 0;
    const resultados: Record<string, { novas: number; ja_existem: number; erros: number }> = {};

    for (const telefone of telefonesParaRecuperar) {
      console.log(`\n📱 Processando ${telefone}...`);
      let novas = 0;
      let jaExistem = 0;
      let errosTel = 0;

      try {
        // Buscar mensagens INBOUND (prestador → nosso número)
        const inboundUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json?From=${encodeURIComponent(telefone)}&To=${encodeURIComponent(numeroPrestadores)}&DateSent>=${encodeURIComponent(dateSince)}&PageSize=200`;

        // Buscar mensagens OUTBOUND (nosso número → prestador)
        const outboundUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json?From=${encodeURIComponent(numeroPrestadores)}&To=${encodeURIComponent(telefone)}&DateSent>=${encodeURIComponent(dateSince)}&PageSize=200`;

        const [inboundRes, outboundRes] = await Promise.all([
          fetch(inboundUrl, { headers: { Authorization: `Basic ${authHeader}` } }),
          fetch(outboundUrl, { headers: { Authorization: `Basic ${authHeader}` } }),
        ]);

        const allMessages: any[] = [];

        if (inboundRes.ok) {
          const data = await inboundRes.json();
          allMessages.push(...(data.messages || []));
          // Paginate
          let nextUri = data.next_page_uri;
          let pages = 1;
          while (nextUri && pages < 5) {
            const nextRes = await fetch(`https://api.twilio.com${nextUri}`, {
              headers: { Authorization: `Basic ${authHeader}` },
            });
            if (!nextRes.ok) break;
            const nextData = await nextRes.json();
            allMessages.push(...(nextData.messages || []));
            nextUri = nextData.next_page_uri;
            pages++;
          }
        } else {
          console.warn(`⚠️ Erro buscando inbound de ${telefone}: ${inboundRes.status}`);
        }

        if (outboundRes.ok) {
          const data = await outboundRes.json();
          allMessages.push(...(data.messages || []));
          let nextUri = data.next_page_uri;
          let pages = 1;
          while (nextUri && pages < 5) {
            const nextRes = await fetch(`https://api.twilio.com${nextUri}`, {
              headers: { Authorization: `Basic ${authHeader}` },
            });
            if (!nextRes.ok) break;
            const nextData = await nextRes.json();
            allMessages.push(...(nextData.messages || []));
            nextUri = nextData.next_page_uri;
            pages++;
          }
        } else {
          console.warn(`⚠️ Erro buscando outbound de ${telefone}: ${outboundRes.status}`);
        }

        // Dedup by SID
        const uniqueByBySid = new Map<string, any>();
        for (const msg of allMessages) {
          if (msg.sid && !uniqueByBySid.has(msg.sid)) {
            uniqueByBySid.set(msg.sid, msg);
          }
        }

        const sorted = Array.from(uniqueByBySid.values()).sort((a, b) =>
          new Date(a.date_sent || a.date_created).getTime() - new Date(b.date_sent || b.date_created).getTime()
        );

        console.log(`   Twilio retornou ${sorted.length} mensagens únicas`);

        for (const msgTwilio of sorted) {
          try {
            // Check if already exists
            const { data: existente } = await supabase
              .from("mensagens_prestadores")
              .select("id")
              .eq("message_sid", msgTwilio.sid)
              .maybeSingle();

            if (existente) {
              jaExistem++;
              continue;
            }

            const from = normalizeWhatsappNumber(msgTwilio.from);
            const to = normalizeWhatsappNumber(msgTwilio.to);
            const isOutgoing = from === numeroPrestadores;
            const rawDate = msgTwilio.date_sent || msgTwilio.date_created;
            const dataHora = rawDate ? new Date(rawDate).toISOString() : new Date().toISOString();
            const texto = msgTwilio.body || "";

            // Detect media type
            let tipo = "texto";
            let arquivoUrl: string | null = null;
            const numMedia = parseInt(String(msgTwilio.num_media || "0"), 10);

            if (numMedia > 0) {
              try {
                const mediaPath = msgTwilio.subresource_uris?.media
                  ? `https://api.twilio.com${msgTwilio.subresource_uris.media}`
                  : `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages/${msgTwilio.sid}/Media.json`;

                const mediaRes = await fetch(mediaPath, {
                  headers: { Authorization: `Basic ${authHeader}` },
                });

                if (mediaRes.ok) {
                  const mediaData = await mediaRes.json();
                  const media = mediaData.media_list?.[0];
                  if (media) {
                    arquivoUrl = `https://api.twilio.com${String(media.uri || "").replace(".json", "")}`;
                    const ct = String(media.content_type || "");
                    if (ct.startsWith("image/")) tipo = "imagem";
                    else if (ct.startsWith("video/")) tipo = "video";
                    else if (ct.startsWith("audio/")) tipo = "audio";
                    else tipo = "arquivo";
                  }
                }
              } catch {
                tipo = "arquivo";
              }
            }

            const { error: insertError } = await supabase
              .from("mensagens_prestadores")
              .insert({
                prestador_telefone: telefone,
                remetente: isOutgoing ? numeroPrestadores : telefone,
                texto: texto || (numMedia > 0 ? `Arquivo ${numMedia}` : ""),
                tipo,
                arquivo_url: arquivoUrl,
                status: isOutgoing ? "enviado" : "recebido",
                data_hora: dataHora,
                numero_twilio: numeroPrestadores,
                message_sid: msgTwilio.sid,
              });

            if (insertError) {
              console.warn(`   ⚠️ Insert error: ${insertError.message}`);
              errosTel++;
            } else {
              novas++;
            }
          } catch (err) {
            errosTel++;
          }
        }

        // Update ultima_interacao if we found inbound messages
        if (novas > 0) {
          const { data: lastInbound } = await supabase
            .from("mensagens_prestadores")
            .select("data_hora")
            .eq("prestador_telefone", telefone)
            .eq("remetente", telefone)
            .order("data_hora", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastInbound) {
            await supabase
              .from("prestadores_chat")
              .update({ ultima_interacao: lastInbound.data_hora })
              .eq("telefone", telefone);
          }
        }
      } catch (err) {
        console.error(`💥 Erro processando ${telefone}:`, err);
        errosTel++;
      }

      resultados[telefone] = { novas, ja_existem: jaExistem, erros: errosTel };
      totalRecuperadas += novas;
      totalJaExistem += jaExistem;
      totalErros += errosTel;

      console.log(`   ✅ Novas: ${novas} | Já existiam: ${jaExistem} | Erros: ${errosTel}`);
    }

    const duration = Date.now() - startTime;
    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ RECUPERAÇÃO CONCLUÍDA em ${duration}ms`);
    console.log(`📊 Total recuperadas: ${totalRecuperadas}`);
    console.log(`⏭️  Já existiam: ${totalJaExistem}`);
    console.log(`❌ Erros: ${totalErros}`);
    console.log(`${"=".repeat(60)}`);

    return new Response(
      JSON.stringify({
        success: true,
        duration_ms: duration,
        telefones_processados: telefonesParaRecuperar.length,
        total_recuperadas: totalRecuperadas,
        total_ja_existem: totalJaExistem,
        total_erros: totalErros,
        resultados,
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
