import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const defaultCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const getCorsHeaders = (req: Request) => ({
  ...defaultCorsHeaders,
  "Access-Control-Allow-Headers":
    req.headers.get("Access-Control-Request-Headers") ?? defaultCorsHeaders["Access-Control-Allow-Headers"],
});

// Variacoes de telefone (mesmo padrao do check-bot-status).
const buildPhoneVariants = (input: string): string[] => {
  const v = new Set<string>();
  if (!input) return [];
  const raw = input.trim();
  v.add(raw);
  const noWhats = raw.replace(/^whatsapp:/i, "").trim();
  v.add(noWhats);
  const digits = noWhats.replace(/\D/g, "");
  if (!digits) return [...v];
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  v.add(digits);
  v.add(withCountry);
  v.add(withCountry.slice(2));
  v.add(`+${withCountry}`);
  v.add(`+${digits}`);
  v.add(`whatsapp:+${withCountry}`);
  v.add(`whatsapp:+${digits}`);
  v.add(`whatsapp:${withCountry}`);
  return [...v].filter(Boolean);
};

// Bot em "soneca" (desligado) se bot_snoozed_until = infinity ou data futura.
const isSnoozed = (val: unknown): boolean => {
  if (val == null) return false;
  if (val === "infinity") return true;
  const t = Date.parse(String(val));
  return !isNaN(t) && t > Date.now();
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ===== Authentication =====
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      to,
      message,
      mediaUrl,
      userId,
      remetente,
      replyToMessageId,
      fromNumber,
      ficha_id,
      conversation_id,
      operador_nome,
      tipo_remetente,
      fallbackToTemplate,
      templateContentSid,
      templateVariables,
    } = await req.json();

    // Input validation
    if (!to || typeof to !== "string" || to.length > 50) {
      return new Response(JSON.stringify({ success: false, error: "Invalid recipient" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if ((!message && !mediaUrl) || (message && typeof message !== "string") || (message && message.length > 5000)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("📤 [send-whatsapp] Enviando:", {
      to,
      messagePreview: message?.substring(0, 50),
      hasMedia: !!mediaUrl,
      executedBy: userData.user.id,
    });

    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
    const twilioPhoneNumber2 = Deno.env.get("TWILIO_PHONE_NUMBER_2");

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      throw new Error("Credenciais Twilio não configuradas");
    }

    // Determinar número de envio (padrão = número de clientes)
    // Frontend pode enviar "TWILIO_PHONE_NUMBER_2" como indicador ou o número real
    const isPrestadorMessage =
      !!fromNumber && (fromNumber === "TWILIO_PHONE_NUMBER_2" || fromNumber === twilioPhoneNumber2);
    const activePhoneNumber = isPrestadorMessage ? twilioPhoneNumber2 : twilioPhoneNumber;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ========== DEDUP DEFENSIVO: bloquear envio idêntico nos últimos 10s ==========
    // Captura cliques duplos / Enter duplo em qualquer ponto da UI antes de chamar a Twilio.
    // Só aplica para texto puro (sem mídia) — reenvio de arquivo/template é responsabilidade da UI.
    if (message && typeof message === "string" && !mediaUrl) {
      const dedupSince = new Date(Date.now() - 10_000).toISOString();
      const targetTable = isPrestadorMessage ? "mensagens_prestadores" : "mensagens";
      const targetIdCol = isPrestadorMessage ? "prestador_telefone" : "cliente_id";
      try {
        const { data: dupRows } = await supabase
          .from(targetTable)
          .select("id, message_sid, data_hora, texto, remetente, tipo_remetente")
          .eq(targetIdCol, to)
          .gte("data_hora", dedupSince)
          .order("data_hora", { ascending: false })
          .limit(10);

        const dup = (dupRows || []).find((r: any) => {
          if (!r?.texto || r.texto !== message) return false;
          const fromOperator =
            r.tipo_remetente === "atendente" ||
            r.tipo_remetente === "operador" ||
            (r.remetente && r.remetente.startsWith("whatsapp:+5541389"));
          return fromOperator;
        });

        if (dup) {
          console.warn("🛑 [send-whatsapp] DEDUP: envio idêntico bloqueado", {
            to,
            messagePreview: message.substring(0, 60),
            existing_id: dup.id,
            existing_sid: dup.message_sid,
            operador: userData.user.id,
          });
          try {
            await supabase.from("system_logs").insert({
              nivel: "warn",
              categoria: "automation",
              mensagem: `send_whatsapp_dedup_block: envio duplicado bloqueado para ${to}`,
              detalhes: {
                event: "send_whatsapp_dedup_block",
                to,
                operador_id: userData.user.id,
                ficha_id: ficha_id || null,
                texto_preview: message.substring(0, 120),
                existing_message_id: dup.id,
                existing_message_sid: dup.message_sid,
                existing_data_hora: dup.data_hora,
              },
              url: "edge://send-whatsapp",
            } as any);
          } catch (_) {
            /* não falhar por causa do log */
          }

          return new Response(
            JSON.stringify({
              success: true,
              deduplicated: true,
              message_sid: dup.message_sid || null,
              message_id: dup.id,
              info: "Mensagem idêntica já enviada há poucos segundos — envio duplicado ignorado.",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } catch (e) {
        console.warn("[send-whatsapp] dedup check falhou (seguindo envio):", (e as Error)?.message);
      }
    }

    // ========== PROTEÇÃO FAIL-CLOSED: bot desabilitado ==========
    // Esta edge JÁ exige JWT válido (validado acima nas linhas 28-45),
    // então qualquer chamada aqui é de OPERADOR autenticado pela UI.
    // O bot real envia via Twilio Studio Flow (não passa por esta função).
    // Por isso só bloqueamos se o caller EXPLICITAMENTE marcar como bot
    // (tipo_remetente='bot' ou remetente='bot'). Operador autenticado
    // sempre pode mandar mensagem manual, mesmo com bot desligado.
    if (!isPrestadorMessage && (tipo_remetente === "bot" || remetente === "bot")) {
      const variants = buildPhoneVariants(to);
      const { data: botRows } = await supabase.from("clientes").select("bot_snoozed_until").in("telefone", variants);

      const snoozed = (botRows ?? []).some((r: any) => isSnoozed(r.bot_snoozed_until));
      if (snoozed) {
        console.log(
          `⛔ [send-whatsapp] BLOQUEANDO envio do BOT - bot em SONECA para ${to} (operador=${userData.user.id})`,
        );
        return new Response(
          JSON.stringify({
            success: false,
            error: "BOT_DESABILITADO",
            message: "Bot está desabilitado (soneca) para este cliente.",
            blocked: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ========== Verificar janela de 24h ==========
    if (isPrestadorMessage) {
      // Para prestadores, verificar janela usando mensagens_prestadores
      const { data: prestadorChat } = await supabase
        .from("prestadores_chat")
        .select("ultima_interacao")
        .eq("telefone", to)
        .single();

      const { data: recentMsgsPrest } = await supabase
        .from("mensagens_prestadores")
        .select("data_hora, remetente")
        .eq("prestador_telefone", to)
        .not("data_hora", "is", null)
        .order("data_hora", { ascending: false })
        .limit(20);

      const ultimaMsgPrest = recentMsgsPrest?.find(
        (msg) => msg.data_hora && !msg.remetente?.startsWith("whatsapp:+5541389"),
      );

      const now = new Date();
      const refJanela = ultimaMsgPrest?.data_hora ?? prestadorChat?.ultima_interacao ?? null;
      const ultimaInt = refJanela ? new Date(refJanela) : null;
      const diffHoras = ultimaInt ? (now.getTime() - ultimaInt.getTime()) / (1000 * 60 * 60) : 25;

      if (diffHoras >= 24) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "FORA_JANELA_24H",
            message: "Conversa fora da janela de 24h. Use um template aprovado.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      // Para clientes, lógica original
      const { data: cliente } = await supabase.from("clientes").select("ultima_interacao").eq("telefone", to).single();

      const { data: recentMessages, error: recentMessagesError } = await supabase
        .from("mensagens")
        .select("data_hora, remetente")
        .eq("cliente_id", to)
        .not("data_hora", "is", null)
        .order("data_hora", { ascending: false })
        .limit(20);

      if (recentMessagesError) {
        console.warn("[send-whatsapp] Erro ao buscar histórico recente:", recentMessagesError.message);
      }

      const ultimaMensagemCliente = recentMessages?.find(
        (msg) => msg.data_hora && (msg.remetente === "cliente" || msg.remetente === to),
      );

      const now = new Date();
      const referenciaJanela24h = ultimaMensagemCliente?.data_hora ?? cliente?.ultima_interacao ?? null;
      const ultimaInteracao = referenciaJanela24h ? new Date(referenciaJanela24h) : null;
      const diferencaHoras = ultimaInteracao ? (now.getTime() - ultimaInteracao.getTime()) / (1000 * 60 * 60) : 25;

      const dentroJanela24h = diferencaHoras < 24;

      if (!dentroJanela24h) {
        // Se fallback para template está habilitado, enviar via template
        if (fallbackToTemplate && templateContentSid) {
          console.log("[send-whatsapp] Fora da janela 24h — usando fallback para template:", templateContentSid);

          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
          const authStr = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
          const sendFrom = activePhoneNumber!.startsWith("whatsapp:")
            ? activePhoneNumber!
            : `whatsapp:${activePhoneNumber}`;
          const sendTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

          const templateForm = new URLSearchParams();
          templateForm.append("To", sendTo);
          templateForm.append("From", sendFrom);
          templateForm.append("ContentSid", templateContentSid);
          if (templateVariables) {
            templateForm.append(
              "ContentVariables",
              typeof templateVariables === "string" ? templateVariables : JSON.stringify(templateVariables),
            );
          }

          const templateRes = await fetch(twilioUrl, {
            method: "POST",
            headers: {
              Authorization: `Basic ${authStr}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: templateForm,
          });

          const templateData = await templateRes.json();

          if (!templateRes.ok) {
            console.error("[send-whatsapp] Erro ao enviar template fallback:", templateData);
            return new Response(
              JSON.stringify({ success: false, error: "TEMPLATE_FALLBACK_FAILED", details: templateData }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }

          console.log("[send-whatsapp] Template fallback enviado com sucesso:", templateData.sid);
          return new Response(JSON.stringify({ success: true, sid: templateData.sid, sentViaTemplate: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({
            success: false,
            error: "FORA_JANELA_24H",
            message: "Conversa fora da janela de 24h. Use um template aprovado.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Enviar via Twilio
    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
    const sendFromNumber =
      to.startsWith("whatsapp:") && !activePhoneNumber!.startsWith("whatsapp:")
        ? `whatsapp:${activePhoneNumber}`
        : activePhoneNumber!;

    // ========== Quote textual para "responder mensagem" ==========
    // Twilio/WhatsApp Business API NÃO suporta enviar contexto de citação real.
    // Para que o cliente veja a referência, prefixamos a mensagem com o trecho citado
    // usando o formato de citação do WhatsApp (linhas iniciadas por "> ").
    let finalMessage = message;
    if (replyToMessageId && message) {
      try {
        const tabelaQuote = isPrestadorMessage ? "mensagens_prestadores" : "mensagens";
        const { data: msgOriginal } = await supabase
          .from(tabelaQuote)
          .select("texto, tipo, arquivo_url")
          .eq("id", replyToMessageId)
          .maybeSingle();

        if (msgOriginal) {
          let trecho = (msgOriginal.texto || "").trim();
          if (!trecho) {
            // Mídia sem texto: descrever pelo tipo
            const tipoMap: Record<string, string> = {
              audio: "🎤 Áudio",
              imagem: "🖼️ Imagem",
              video: "🎬 Vídeo",
              arquivo: "📎 Arquivo",
            };
            trecho = tipoMap[msgOriginal.tipo as string] || "Mensagem";
          }
          // Limitar a 180 chars para não ficar gigante
          if (trecho.length > 180) trecho = trecho.substring(0, 177) + "...";
          // Prefixar cada linha com "> " (formato de citação)
          const quoted = trecho
            .split("\n")
            .map((l) => `> ${l}`)
            .join("\n");
          finalMessage = `${quoted}\n\n${message}`;
          console.log("[send-whatsapp] 💬 Quote textual aplicado para replyToMessageId:", replyToMessageId);
        }
      } catch (e) {
        console.warn("[send-whatsapp] Falha ao montar quote textual:", e);
      }
    }

    const body = new URLSearchParams();
    body.append("To", to);
    body.append("From", sendFromNumber);
    if (finalMessage) {
      body.append("Body", finalMessage);
    }
    if (mediaUrl) {
      body.append("MediaUrl", mediaUrl);
    }

    // Adicionar StatusCallback para receber atualizações de status (delivered, read)
    const statusCallbackUrl = `${supabaseUrl}/functions/v1/update-message-status`;
    body.append("StatusCallback", statusCallbackUrl);
    console.log("📡 StatusCallback configurado:", statusCallbackUrl);

    const twilioResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Erro Twilio:", twilioData);
      throw new Error(twilioData.message || "Erro ao enviar mensagem via Twilio");
    }

    // Detectar tipo de mídia
    const getMediaType = (url: string): "audio" | "imagem" | "video" | "arquivo" => {
      const lower = url.toLowerCase();
      if (lower.match(/\.(ogg|opus|mp3|m4a|aac|amr|3gp|wav|webm)(\?|$)/)) return "audio";
      if (lower.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/)) return "imagem";
      if (lower.match(/\.(mp4|mov|avi)(\?|$)/)) return "video";
      return "arquivo";
    };

    // Salvar mensagem na tabela correta
    if (isPrestadorMessage) {
      const { error: insertError } = await supabase.from("mensagens_prestadores").insert({
        prestador_telefone: to,
        remetente: sendFromNumber,
        texto: message,
        tipo: mediaUrl ? getMediaType(mediaUrl) : "texto",
        arquivo_url: mediaUrl || null,
        status: "enviado",
        data_hora: new Date().toISOString(),
        message_sid: twilioData.sid,
        enviado_por_id: userData.user.id,
        reply_to_message_id: replyToMessageId || null,
        numero_twilio: sendFromNumber,
        ficha_id: ficha_id || null,
      });

      if (insertError) {
        console.error("Erro ao inserir mensagem prestador:", insertError);
        throw new Error(`Erro ao salvar mensagem: ${insertError.message}`);
      }

      await supabase.from("prestadores_chat").update({ ultima_interacao: new Date().toISOString() }).eq("telefone", to);
    } else {
      const { error: insertError } = await supabase.from("mensagens").insert({
        cliente_id: to,
        remetente: sendFromNumber,
        texto: message,
        tipo: mediaUrl ? getMediaType(mediaUrl) : "texto",
        arquivo_url: mediaUrl || null,
        status: "enviado",
        data_hora: new Date().toISOString(),
        message_sid: twilioData.sid,
        enviado_por_id: userData.user.id,
        reply_to_message_id: replyToMessageId || null,
        ficha_id: ficha_id || null,
        conversation_id: conversation_id || null,
        operador_nome: operador_nome || null,
        tipo_remetente: tipo_remetente || (remetente === "bot" ? "bot" : "atendente"),
      });

      if (insertError) {
        console.error("Erro ao inserir mensagem:", insertError);
        throw new Error(`Erro ao salvar mensagem: ${insertError.message}`);
      }

      // Atualizar última interação e atribuir operador (se não for bot)
      const clienteUpdate: Record<string, unknown> = { ultima_interacao: new Date().toISOString() };
      if (remetente !== "bot") {
        clienteUpdate.atendente_id = userData.user.id;
      }
      await supabase.from("clientes").update(clienteUpdate).eq("telefone", to);
    }

    return new Response(JSON.stringify({ success: true, messageSid: twilioData.sid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    return new Response(JSON.stringify({ success: false, error: "Erro interno ao enviar mensagem" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
