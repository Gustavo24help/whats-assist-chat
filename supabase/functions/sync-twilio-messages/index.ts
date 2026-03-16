import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_LOOKBACK_MINUTES = 5;
const MAX_LOOKBACK_MINUTES = 24 * 60;
const PLACEHOLDER_REPAIR_WINDOW_MS = 15 * 1000;

const normalizeWhatsappNumber = (value?: string | null) => {
  if (!value) return "";
  return value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;
};

const isValidDate = (value: Date) => !Number.isNaN(value.getTime());

const parseJsonBody = async (req: Request) => {
  try {
    const raw = await req.text();
    if (!raw.trim()) return {} as Record<string, unknown>;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
};

const fetchAllTwilioMessages = async (
  url: string,
  authHeader: string,
  label: string,
) => {
  const messages: any[] = [];
  let nextUrl: string | null = url;
  let pages = 0;

  while (nextUrl && pages < 10) {
    pages += 1;

    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro da Twilio API [${label}] ${response.status}: ${errorText.substring(0, 300)}`);
      throw new Error(`Twilio API error [${label}] ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    messages.push(...(data.messages || []));

    nextUrl = data.next_page_uri ? `https://api.twilio.com${data.next_page_uri}` : null;
  }

  console.log(`📡 [SYNC] ${label}: ${messages.length} mensagens em ${pages} página(s)`);
  return messages;
};

const fetchMessageMedia = async (
  msgTwilio: any,
  authHeader: string,
  twilioAccountSid: string,
) => {
  const numMedia = parseInt(String(msgTwilio.num_media ?? "0"), 10);
  if (!numMedia) {
    return {
      tipo: "texto",
      arquivoUrl: null as string | null,
      textoFallback: "",
    };
  }

  const mediaPath = msgTwilio.subresource_uris?.media
    ? `https://api.twilio.com${msgTwilio.subresource_uris.media}`
    : `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages/${msgTwilio.sid}/Media.json`;

  const mediaResponse = await fetch(mediaPath, {
    headers: {
      Authorization: `Basic ${authHeader}`,
    },
  });

  if (!mediaResponse.ok) {
    console.warn(`⚠️ Não foi possível buscar mídia para ${msgTwilio.sid}: ${mediaResponse.status}`);
    return {
      tipo: "arquivo",
      arquivoUrl: null as string | null,
      textoFallback: `Arquivo ${numMedia}`,
    };
  }

  const mediaData = await mediaResponse.json();
  const media = mediaData.media_list?.[0];

  if (!media) {
    return {
      tipo: "arquivo",
      arquivoUrl: null as string | null,
      textoFallback: `Arquivo ${numMedia}`,
    };
  }

  const contentType = String(media.content_type || "");
  let tipo = "arquivo";

  if (contentType.startsWith("image/")) tipo = "imagem";
  else if (contentType.startsWith("video/")) tipo = "video";
  else if (contentType.startsWith("audio/")) tipo = "audio";

  return {
    tipo,
    arquivoUrl: `https://api.twilio.com${String(media.uri || "").replace(".json", "")}`,
    textoFallback: `Arquivo ${numMedia}`,
  };
};

const findOutgoingPlaceholder = async (
  supabase: ReturnType<typeof createClient>,
  clienteId: string,
  remetente: string,
  sentAtIso: string,
) => {
  const sentAt = new Date(sentAtIso);
  const windowStart = new Date(sentAt.getTime() - PLACEHOLDER_REPAIR_WINDOW_MS).toISOString();
  const windowEnd = new Date(sentAt.getTime() + PLACEHOLDER_REPAIR_WINDOW_MS).toISOString();

  const { data, error } = await supabase
    .from("mensagens")
    .select("id, texto, arquivo_url, message_sid, data_hora")
    .eq("cliente_id", clienteId)
    .eq("remetente", remetente)
    .gte("data_hora", windowStart)
    .lte("data_hora", windowEnd)
    .order("data_hora", { ascending: true });

  if (error || !data?.length) return null;

  return data.find((mensagem) => {
    const semSid = !mensagem.message_sid;
    const semTexto = !String(mensagem.texto || "").trim();
    const semArquivo = !mensagem.arquivo_url;
    return semSid && semTexto && semArquivo;
  }) ?? null;
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
    const requestBody = await parseJsonBody(req);

    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "AC13e7e780450a855f503451bca7114c07";
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    let twilioWhatsappNumber = normalizeWhatsappNumber(
      Deno.env.get("TWILIO_PHONE_NUMBER") || "whatsapp:+554138911555",
    );

    if (!twilioAuthToken) {
      throw new Error("TWILIO_AUTH_TOKEN não configurado");
    }

    const requestedLookback = Number(requestBody.lookback_minutes);
    const lookbackMinutes = Number.isFinite(requestedLookback) && requestedLookback > 0
      ? Math.min(requestedLookback, MAX_LOOKBACK_MINUTES)
      : DEFAULT_LOOKBACK_MINUTES;

    const requestedCustomerPhone = typeof requestBody.customer_phone === "string"
      ? normalizeWhatsappNumber(requestBody.customer_phone)
      : "";

    const requestedSince = typeof requestBody.since === "string"
      ? new Date(requestBody.since)
      : null;

    const { data: syncControl } = await supabase
      .from("twilio_sync_control")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastSyncTime = requestedSince && isValidDate(requestedSince)
      ? requestedSince
      : Number.isFinite(requestedLookback) && requestedLookback > 0
        ? new Date(Date.now() - lookbackMinutes * 60 * 1000)
        : syncControl?.last_sync_timestamp
          ? new Date(syncControl.last_sync_timestamp)
          : new Date(Date.now() - DEFAULT_LOOKBACK_MINUTES * 60 * 1000);

    const dateSentAfter = lastSyncTime.toISOString();
    const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    console.log(`📞 Configuração Twilio:`);
    console.log(`   Account SID: ${twilioAccountSid}`);
    console.log(`   WhatsApp Number: ${twilioWhatsappNumber}`);
    console.log(`   Customer filter: ${requestedCustomerPhone || "(nenhum)"}`);
    console.log(`   Desde: ${dateSentAfter}`);

    const incomingUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json?To=${encodeURIComponent(twilioWhatsappNumber)}&DateSent>=${encodeURIComponent(dateSentAfter)}&PageSize=100`;
    const outgoingUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json?From=${encodeURIComponent(twilioWhatsappNumber)}&DateSent>=${encodeURIComponent(dateSentAfter)}&PageSize=100`;

    const [incomingMessages, outgoingMessages] = await Promise.all([
      fetchAllTwilioMessages(incomingUrl, authHeader, "incoming"),
      fetchAllTwilioMessages(outgoingUrl, authHeader, "outgoing"),
    ]);

    const combinedMessages = [...incomingMessages, ...outgoingMessages];
    const uniqueMessages = Array.from(
      new Map(
        combinedMessages.map((message: any) => [
          message.sid || `${message.from}|${message.to}|${message.date_sent}|${message.body}`,
          message,
        ]),
      ).values(),
    ).sort((a: any, b: any) => {
      const dateA = new Date(a.date_sent || a.date_created || 0).getTime();
      const dateB = new Date(b.date_sent || b.date_created || 0).getTime();
      return dateA - dateB;
    });

    console.log(`📊 [SYNC] Total combinado: ${combinedMessages.length} | único: ${uniqueMessages.length}`);

    let mensagensNovas = 0;
    let mensagensJaExistem = 0;
    let mensagensReparadas = 0;
    let erros = 0;
    const errosDetalhados: string[] = [];

    for (const msgTwilio of uniqueMessages) {
      try {
        const from = normalizeWhatsappNumber(msgTwilio.from);
        const to = normalizeWhatsappNumber(msgTwilio.to);
        const isOutgoing = from === twilioWhatsappNumber;
        const telefoneCliente = isOutgoing ? to : from;

        if (!telefoneCliente || telefoneCliente === twilioWhatsappNumber) {
          continue;
        }

        if (requestedCustomerPhone && telefoneCliente !== requestedCustomerPhone) {
          continue;
        }

        if (msgTwilio.sid) {
          const { data: existente } = await supabase
            .from("mensagens")
            .select("id")
            .eq("message_sid", msgTwilio.sid)
            .maybeSingle();

          if (existente) {
            mensagensJaExistem++;
            continue;
          }
        }

        let { data: cliente } = await supabase
          .from("clientes")
          .select("telefone, nome, ficha_ativa_id")
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
            .select("telefone, nome, ficha_ativa_id")
            .single();

          if (createClienteError) {
            erros++;
            errosDetalhados.push(`Cliente ${telefoneCliente}: ${createClienteError.message}`);
            continue;
          }

          cliente = novoCliente;
        }

        const mediaInfo = await fetchMessageMedia(msgTwilio, authHeader, twilioAccountSid);
        const rawDate = msgTwilio.date_sent || msgTwilio.date_created || msgTwilio.date_updated;
        const parsedDate = rawDate ? new Date(rawDate) : new Date();
        const dataHora = isValidDate(parsedDate) ? parsedDate.toISOString() : new Date().toISOString();
        const texto = String(msgTwilio.body || mediaInfo.textoFallback || "");

        const mensagemPayload = {
          cliente_id: telefoneCliente,
          remetente: isOutgoing ? twilioWhatsappNumber : telefoneCliente,
          texto,
          tipo: mediaInfo.tipo,
          arquivo_url: mediaInfo.arquivoUrl,
          status: isOutgoing ? "enviado" : "recebido",
          data_hora: dataHora,
          ficha_id: cliente?.ficha_ativa_id || null,
          message_sid: msgTwilio.sid || null,
          reply_to_message_id: null,
        };

        if (isOutgoing && msgTwilio.sid) {
          const placeholder = await findOutgoingPlaceholder(
            supabase,
            telefoneCliente,
            twilioWhatsappNumber,
            dataHora,
          );

          if (placeholder) {
            const { error: repairError } = await supabase
              .from("mensagens")
              .update(mensagemPayload)
              .eq("id", placeholder.id);

            if (repairError) {
              throw repairError;
            }

            mensagensReparadas++;
            continue;
          }
        }

        const { error: insertError } = await supabase
          .from("mensagens")
          .insert(mensagemPayload);

        if (insertError) {
          throw insertError;
        }

        if (!isOutgoing) {
          await supabase
            .from("clientes")
            .update({ ultima_interacao: dataHora })
            .eq("telefone", telefoneCliente);
        }

        mensagensNovas++;
      } catch (err) {
        console.error("💥 Erro ao processar mensagem Twilio:", err);
        erros++;
        errosDetalhados.push(err instanceof Error ? err.message : "Erro desconhecido ao processar mensagem");
      }
    }

    const processedCount = requestedCustomerPhone
      ? uniqueMessages.filter((message: any) => {
          const from = normalizeWhatsappNumber(message.from);
          const to = normalizeWhatsappNumber(message.to);
          const telefoneCliente = from === twilioWhatsappNumber ? to : from;
          return telefoneCliente === requestedCustomerPhone;
        }).length
      : uniqueMessages.length;

    const { error: updateError } = await supabase.from("twilio_sync_control").upsert({
      id: syncControl?.id || crypto.randomUUID(),
      last_sync_timestamp: new Date().toISOString(),
      messages_found: processedCount,
      messages_new: mensagensNovas,
      messages_already_exist: mensagensJaExistem,
      errors: erros,
      last_message_sid: uniqueMessages[uniqueMessages.length - 1]?.sid || null,
      updated_at: new Date().toISOString(),
    });

    if (updateError) {
      console.error("⚠️ Erro ao atualizar twilio_sync_control:", updateError);
    }

    const duration = Date.now() - startTime;

    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ SINCRONIZAÇÃO CONCLUÍDA`);
    console.log(`${"=".repeat(60)}`);
    console.log(`⏱️  Duração: ${duration}ms`);
    console.log(`📊 Processadas: ${processedCount}`);
    console.log(`✅ Novas: ${mensagensNovas}`);
    console.log(`🩹 Reparadas: ${mensagensReparadas}`);
    console.log(`⏭️  Já existiam: ${mensagensJaExistem}`);
    console.log(`❌ Erros: ${erros}`);
    console.log(`${"=".repeat(60)}\n`);

    return new Response(
      JSON.stringify({
        success: true,
        duration_ms: duration,
        messages_found: processedCount,
        messages_new: mensagensNovas,
        messages_repaired: mensagensReparadas,
        messages_already_exist: mensagensJaExistem,
        errors: erros,
        errors_details: errosDetalhados,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("💥 Erro geral:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
        stack: error instanceof Error ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});