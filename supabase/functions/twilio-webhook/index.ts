import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ========== LOGGING DE DEBUG ==========
interface DebugLog {
  timestamp: string;
  source: string;
  event_type: string;
  raw_payload: any;
  processed_data: any;
  message_sid: string | null;
  client_phone: string | null;
  success: boolean;
  error_message: string | null;
  step: string;
}

async function logDebug(supabase: SupabaseClient, log: DebugLog) {
  try {
    await supabase.from("webhook_debug_logs").insert(log);
  } catch (e) {
    console.error("⚠️ Erro ao salvar debug log (não crítico):", e);
  }
}

// Função de sleep para backoff
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Salvar na fila de backup quando falhar
async function saveToBackupQueue(
  supabase: SupabaseClient,
  data: Record<string, unknown>,
  messageSid: string | null,
  clienteId: string,
  erro: string,
) {
  try {
    console.log("💾 [BACKUP] Salvando mensagem na fila de backup...");

    const { error } = await supabase.from("mensagens_backup_queue").insert({
      message_sid: messageSid,
      cliente_id: clienteId,
      payload: data,
      erro_ultimo: erro,
    });

    if (error) {
      console.error("❌ [BACKUP] Falha ao salvar na fila de backup:", error);
    } else {
      console.log("✅ [BACKUP] Mensagem salva na fila de backup para reprocessamento");
    }
  } catch (err) {
    console.error("❌ [BACKUP] Exceção ao salvar na fila:", err);
  }
}

// Função de save com retry e fallback para backup
async function saveMessageWithRetry(
  supabase: SupabaseClient,
  data: Record<string, unknown>,
  messageSid: string | null,
  clienteId: string,
  retries = 3,
): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const { error } = await supabase.from("mensagens").insert(data);

      if (!error) {
        console.log(`✅ Mensagem salva com sucesso (tentativa ${i + 1})`);
        return true;
      }

      console.error(`❌ Erro tentativa ${i + 1}:`, error);

      // Se for erro de duplicidade, considerar sucesso
      if (error.code === "23505") {
        console.log("⚠️ Mensagem já existe (duplicidade), considerando sucesso");
        return true;
      }

      // Backoff exponencial
      if (i < retries - 1) {
        const waitTime = 500 * Math.pow(2, i);
        console.log(`⏳ Aguardando ${waitTime}ms antes da próxima tentativa...`);
        await sleep(waitTime);
      }
    } catch (err) {
      console.error(`⚠️ Exceção tentativa ${i + 1}:`, err);

      if (i < retries - 1) {
        const waitTime = 500 * Math.pow(2, i);
        await sleep(waitTime);
      }
    }
  }

  // CRÍTICO: Salvar em tabela de backup se todas as tentativas falharam
  const erroMsg = "Falha após 3 tentativas de salvamento";
  await saveToBackupQueue(supabase, data, messageSid, clienteId, erroMsg);
  return false;
}

serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  const startTime = Date.now();

  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔔 [${requestId}] WEBHOOK INICIADO - ${new Date().toISOString()}`);
  console.log(`${"=".repeat(80)}\n`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // ========== PASSO 1: CAPTURAR RAW REQUEST ==========
    console.log(`[${requestId}] 📥 PASSO 1: Capturando raw request...`);

    const contentType = req.headers.get("content-type") || "";
    const rawBody = await req.text();

    console.log(`[${requestId}] Content-Type: ${contentType}`);
    console.log(`[${requestId}] Raw Body (primeiros 500 chars):`);
    console.log(rawBody.substring(0, 500));

    await logDebug(supabase, {
      timestamp: new Date().toISOString(),
      source: "twilio_webhook",
      event_type: "raw_request",
      raw_payload: { contentType, body: rawBody.substring(0, 1000) },
      processed_data: null,
      message_sid: null,
      client_phone: null,
      success: true,
      error_message: null,
      step: "STEP_1_RAW_REQUEST",
    });

    // ========== PASSO 2: PARSEAR DADOS ==========
    console.log(`\n[${requestId}] 🔧 PASSO 2: Parseando dados...`);

    let allFields: Record<string, string> = {};
    let formData: FormData;

    const reqClone = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: rawBody,
    });

    try {
      formData = await reqClone.formData();
      for (const [key, value] of formData.entries()) {
        allFields[key] = String(value);
      }
      console.log(`[${requestId}] ✅ Parseado como FormData`);
    } catch (e) {
      console.log(`[${requestId}] ⚠️ Não foi FormData, tentando JSON...`);
      try {
        const jsonData = JSON.parse(rawBody);
        allFields = jsonData;
        formData = new FormData();
        for (const [key, value] of Object.entries(jsonData)) {
          formData.append(key, String(value));
        }
        console.log(`[${requestId}] ✅ Parseado como JSON`);
      } catch (jsonErr) {
        console.error(`[${requestId}] ❌ ERRO: Não foi possível parsear`);
        throw new Error(`Formato não reconhecido`);
      }
    }

    console.log(`[${requestId}] 📊 Total de campos: ${Object.keys(allFields).length}`);
    console.log(`[${requestId}] 📋 Campos recebidos:`);
    for (const [key, value] of Object.entries(allFields)) {
      console.log(`  • ${key}: ${String(value).substring(0, 100)}`);
    }

    await logDebug(supabase, {
      timestamp: new Date().toISOString(),
      source: "twilio_webhook",
      event_type: "parsed_data",
      raw_payload: null,
      processed_data: allFields,
      message_sid: allFields["MessageSid"] || allFields["SmsMessageSid"] || null,
      client_phone: allFields["From"] || null,
      success: true,
      error_message: null,
      step: "STEP_2_PARSED_DATA",
    });

    // ========== PASSO 3: EXTRAIR CAMPOS CRÍTICOS ==========
    console.log(`\n[${requestId}] 🎯 PASSO 3: Extraindo campos críticos...`);

    const from = allFields["From"];
    const to = allFields["To"];
    const body = allFields["Body"] || "";
    const numMedia = allFields["NumMedia"] || "0";
    const profileName = allFields["ProfileName"] || "";

    // CRÍTICO: MessageSid
    const possibleSidFields = ["MessageSid", "SmsMessageSid", "SmsSid", "message_sid"];
    let messageSid = null;
    for (const field of possibleSidFields) {
      if (allFields[field]) {
        messageSid = allFields[field];
        console.log(`[${requestId}] ✅ MessageSid encontrado: ${field} = ${messageSid}`);
        break;
      }
    }

    if (!messageSid) {
      console.error(`[${requestId}] ❌ CRÍTICO: MessageSid NÃO ENCONTRADO!`);
    }

    const originalRepliedMessageSid = allFields["OriginalRepliedMessageSid"] || null;
    const buttonPayload = allFields["ButtonPayload"] || allFields["buttonPayload"] || null;
    const buttonText = allFields["ButtonText"] || allFields["buttonText"] || null;

    console.log(`[${requestId}] 📞 From: ${from}`);
    console.log(`[${requestId}] 📞 To: ${to}`);
    console.log(`[${requestId}] 💬 Body: ${body?.substring(0, 100)}`);
    console.log(`[${requestId}] 📎 NumMedia: ${numMedia}`);
    console.log(`[${requestId}] 🆔 MessageSid: ${messageSid || "❌ NULL"}`);
    console.log(`[${requestId}] 🔗 Reply: ${originalRepliedMessageSid || "Não"}`);

    await logDebug(supabase, {
      timestamp: new Date().toISOString(),
      source: "twilio_webhook",
      event_type: "extracted_fields",
      raw_payload: null,
      processed_data: { from, to, body: body?.substring(0, 200), numMedia, messageSid, originalRepliedMessageSid },
      message_sid: messageSid,
      client_phone: from,
      success: true,
      error_message: null,
      step: "STEP_3_EXTRACTED_FIELDS",
    });

    // ========== PASSO 4: PROCESSAR MÍDIAS ==========
    console.log(`\n[${requestId}] 📷 PASSO 4: Processando mídias...`);

    const mediaUrls: string[] = [];
    const mediaTypes: string[] = [];

    for (let i = 0; i < 10; i++) {
      const mediaUrl = allFields[`MediaUrl${i}`];
      const mediaType = allFields[`MediaContentType${i}`];

      if (mediaUrl && mediaUrl.trim()) {
        mediaUrls.push(mediaUrl);
        mediaTypes.push(mediaType || "unknown");
        console.log(`[${requestId}] 📎 Mídia ${i}: ${mediaType} - ${mediaUrl.substring(0, 80)}`);
      }
    }

    console.log(`[${requestId}] 📊 Mídias detectadas: ${mediaUrls.length} (NumMedia: ${numMedia})`);

    if (mediaUrls.length !== parseInt(numMedia)) {
      console.warn(`[${requestId}] ⚠️ DISCREPÂNCIA: NumMedia=${numMedia} mas encontramos ${mediaUrls.length}`);
    }

    await logDebug(supabase, {
      timestamp: new Date().toISOString(),
      source: "twilio_webhook",
      event_type: "media_processing",
      raw_payload: null,
      processed_data: { mediaUrls, mediaTypes, numMediaReported: numMedia, numMediaFound: mediaUrls.length },
      message_sid: messageSid,
      client_phone: from,
      success: true,
      error_message: null,
      step: "STEP_4_MEDIA_PROCESSING",
    });

    // ========== PASSO 5: VERIFICAR/CRIAR CLIENTE ==========
    console.log(`\n[${requestId}] 👤 PASSO 5: Verificando cliente...`);

    let { data: cliente, error: clienteError } = await supabase
      .from("clientes")
      .select("*")
      .eq("telefone", from)
      .maybeSingle();

    if (!cliente) {
      console.log(`[${requestId}] 🆕 Criando cliente...`);
      const nomeCliente = profileName || from.replace("whatsapp:", "").replace("+", "") || "Desconhecido";

      const { data: novoCliente, error: createError } = await supabase
        .from("clientes")
        .insert({
          telefone: from,
          nome: nomeCliente,
          status_conversa: "aberta",
          ultima_interacao: new Date().toISOString(),
          tags: [],
        })
        .select()
        .single();

      if (createError) {
        console.error(`[${requestId}] ❌ Erro ao criar cliente:`, createError);

        await logDebug(supabase, {
          timestamp: new Date().toISOString(),
          source: "twilio_webhook",
          event_type: "client_creation_error",
          raw_payload: null,
          processed_data: { error: createError },
          message_sid: messageSid,
          client_phone: from,
          success: false,
          error_message: createError.message,
          step: "STEP_5_CLIENT_ERROR",
        });

        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
        });
      }

      cliente = novoCliente;
      console.log(`[${requestId}] ✅ Cliente criado: ${cliente.telefone}`);
    } else {
      console.log(`[${requestId}] ✅ Cliente encontrado: ${cliente.telefone}`);

      const updateData: any = { ultima_interacao: new Date().toISOString() };
      if (profileName && (cliente.nome === "Desconhecido" || cliente.nome === from)) {
        updateData.nome = profileName;
      }

      await supabase.from("clientes").update(updateData).eq("telefone", cliente.telefone);
    }

    await logDebug(supabase, {
      timestamp: new Date().toISOString(),
      source: "twilio_webhook",
      event_type: "client_check",
      raw_payload: null,
      processed_data: { cliente_id: cliente.telefone },
      message_sid: messageSid,
      client_phone: from,
      success: true,
      error_message: null,
      step: "STEP_5_CLIENT_OK",
    });

    // ========== PASSO 6: BUSCAR FICHA ATIVA ==========
    const { data: fichaAtiva } = await supabase
      .from("fichas_de_servico")
      .select("id")
      .eq("telefone_cliente", cliente.telefone)
      .eq("status", "Agendado")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log(`[${requestId}] 📋 Ficha ativa: ${fichaAtiva?.id || "Nenhuma"}`);

    // ========== PASSO 7: BUSCAR REPLY ==========
    console.log(`\n[${requestId}] 🔗 PASSO 7: Verificando reply...`);

    let replyToMessageId = null;
    if (originalRepliedMessageSid) {
      console.log(`[${requestId}] 🔍 Reply detectado: ${originalRepliedMessageSid}`);

      const { data: originalMsg, error: originalError } = await supabase
        .from("mensagens")
        .select("id, texto, remetente")
        .eq("message_sid", originalRepliedMessageSid)
        .maybeSingle();

      if (originalMsg) {
        replyToMessageId = originalMsg.id;
        console.log(`[${requestId}] ✅ Mensagem original encontrada: ${replyToMessageId}`);
      } else {
        console.warn(`[${requestId}] ⚠️ Mensagem original NÃO encontrada`);
      }
    }

    // ========== PASSO 8: VERIFICAR DUPLICIDADE ==========
    console.log(`\n[${requestId}] 🔍 PASSO 8: Verificando duplicidade...`);

    if (messageSid) {
      const { data: existingBySid } = await supabase
        .from("mensagens")
        .select("id, texto, data_hora")
        .eq("message_sid", messageSid)
        .maybeSingle();

      if (existingBySid) {
        console.warn(`[${requestId}] ⚠️ DUPLICIDADE! Mensagem já existe: ${existingBySid.id}`);

        await logDebug(supabase, {
          timestamp: new Date().toISOString(),
          source: "twilio_webhook",
          event_type: "duplicate_detected",
          raw_payload: null,
          processed_data: { existingMessage: existingBySid },
          message_sid: messageSid,
          client_phone: from,
          success: true,
          error_message: "Duplicidade",
          step: "STEP_8_DUPLICATE",
        });

        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
        });
      }
    }

    console.log(`[${requestId}] ✅ Não é duplicidade`);

    // ========== PASSO 9: SALVAR MENSAGEM(NS) ==========
    console.log(`\n[${requestId}] 💾 PASSO 9: Salvando mensagem(ns)...`);

    const getTipoMensagem = (contentType: string): string => {
      if (contentType.startsWith("image/")) return "imagem";
      if (contentType.startsWith("video/")) return "video";
      if (contentType.startsWith("audio/")) return "audio";
      return "arquivo";
    };

    // Formatar body se for botão
    let finalBody = body || "";
    if (buttonText || buttonPayload) {
      finalBody = `🔘 Botão: ${buttonText || body}${buttonPayload ? ` [${buttonPayload}]` : ""}`;
    }

    let mensagensSalvas = 0;
    let errosSalvamento = 0;

    if (mediaUrls.length > 0) {
      console.log(`[${requestId}] 📷 Salvando ${mediaUrls.length} mídias...`);

      for (let i = 0; i < mediaUrls.length; i++) {
        const { data: existingByUrl } = await supabase
          .from("mensagens")
          .select("id")
          .eq("arquivo_url", mediaUrls[i])
          .maybeSingle();

        if (existingByUrl) {
          console.warn(`[${requestId}] ⚠️ Mídia ${i} já existe, pulando`);
          continue;
        }

        const textoMidia = i === 0 && finalBody ? finalBody : `Arquivo ${i + 1}`;
        const mensagem = {
          cliente_id: cliente.telefone,
          remetente: from, // ✅ CORRIGIDO - agora salva o telefone real
          texto: textoMidia,
          tipo: getTipoMensagem(mediaTypes[i]),
          arquivo_url: mediaUrls[i],
          status: "recebido",
          data_hora: new Date().toISOString(),
          ficha_id: fichaAtiva?.id || null,
          message_sid: messageSid,
          reply_to_message_id: replyToMessageId,
        };

        console.log(`[${requestId}] 💾 Salvando mídia ${i + 1}...`);

        const sucesso = await saveMessageWithRetry(supabase, mensagem, messageSid, cliente.telefone);

        if (sucesso) {
          mensagensSalvas++;

          await logDebug(supabase, {
            timestamp: new Date().toISOString(),
            source: "twilio_webhook",
            event_type: "message_saved",
            raw_payload: null,
            processed_data: { tipo: "midia", index: i },
            message_sid: messageSid,
            client_phone: from,
            success: true,
            error_message: null,
            step: `STEP_9_SAVE_MEDIA_${i}_OK`,
          });
        } else {
          errosSalvamento++;

          await logDebug(supabase, {
            timestamp: new Date().toISOString(),
            source: "twilio_webhook",
            event_type: "save_error",
            raw_payload: null,
            processed_data: { tipo: "midia", index: i },
            message_sid: messageSid,
            client_phone: from,
            success: false,
            error_message: "Falha após retries",
            step: `STEP_9_SAVE_MEDIA_${i}_ERROR`,
          });
        }
      }
    } else {
      // Mensagem de texto
      console.log(`[${requestId}] 💬 Salvando texto...`);

      const mensagem = {
        cliente_id: cliente.telefone,
        remetente: from, // ✅ CORRIGIDO - agora salva o telefone real
        texto: finalBody,
        tipo: "texto",
        arquivo_url: null,
        status: "recebido",
        data_hora: new Date().toISOString(),
        ficha_id: fichaAtiva?.id || null,
        message_sid: messageSid,
        reply_to_message_id: replyToMessageId,
      };

      const sucesso = await saveMessageWithRetry(supabase, mensagem, messageSid, cliente.telefone);

      if (sucesso) {
        mensagensSalvas++;

        await logDebug(supabase, {
          timestamp: new Date().toISOString(),
          source: "twilio_webhook",
          event_type: "message_saved",
          raw_payload: null,
          processed_data: { tipo: "texto", texto: finalBody?.substring(0, 50) },
          message_sid: messageSid,
          client_phone: from,
          success: true,
          error_message: null,
          step: "STEP_9_SAVE_TEXT_OK",
        });
      } else {
        errosSalvamento++;

        await logDebug(supabase, {
          timestamp: new Date().toISOString(),
          source: "twilio_webhook",
          event_type: "save_error",
          raw_payload: null,
          processed_data: { tipo: "texto" },
          message_sid: messageSid,
          client_phone: from,
          success: false,
          error_message: "Falha após retries",
          step: "STEP_9_SAVE_TEXT_ERROR",
        });
      }
    }

    // ========== NPS ==========
    const textoParaVerificar = body?.trim() || "";
    const npsScoreMatch = textoParaVerificar.match(/^(10|[0-9])$/);

    if (npsScoreMatch) {
      const { data: npsPendente } = await supabase
        .from("nps_respostas")
        .select("*")
        .eq("telefone_cliente", from)
        .is("nota", null)
        .not("enviado_em", "is", null)
        .order("enviado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (npsPendente) {
        const nota = parseInt(npsScoreMatch[1], 10);
        let classificacao = nota >= 9 ? "promotor" : nota >= 7 ? "neutro" : "detrator";

        await supabase
          .from("nps_respostas")
          .update({
            nota,
            classificacao,
            tipo_feedback: nota >= 9 ? "positivo" : nota >= 7 ? "neutro" : "negativo",
            respondido_em: new Date().toISOString(),
            prioridade: nota < 7,
          })
          .eq("id", npsPendente.id);

        console.log(`[${requestId}] 📊 NPS registrado: ${nota} (${classificacao})`);
      }
    }

    // ========== RESUMO FINAL ==========
    const duration = Date.now() - startTime;

    console.log(`\n${"=".repeat(80)}`);
    console.log(`✅ [${requestId}] WEBHOOK CONCLUÍDO`);
    console.log(`${"=".repeat(80)}`);
    console.log(`⏱️  Duração: ${duration}ms`);
    console.log(`📊 Salvas: ${mensagensSalvas} | Erros: ${errosSalvamento}`);
    console.log(`${"=".repeat(80)}\n`);

    await logDebug(supabase, {
      timestamp: new Date().toISOString(),
      source: "twilio_webhook",
      event_type: "webhook_complete",
      raw_payload: null,
      processed_data: { duration_ms: duration, messages_saved: mensagensSalvas, errors: errosSalvamento },
      message_sid: messageSid,
      client_phone: from,
      success: errosSalvamento === 0,
      error_message: errosSalvamento > 0 ? `${errosSalvamento} erros` : null,
      step: "STEP_10_COMPLETE",
    });

    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(`\n${"=".repeat(80)}`);
    console.error(`💥 [${requestId}] ERRO FATAL`);
    console.error(`${"=".repeat(80)}`);
    console.error(`⏱️  Duração até erro: ${duration}ms`);
    console.error(`❌ Erro:`, error);
    console.error(`${"=".repeat(80)}\n`);

    try {
      await logDebug(supabase, {
        timestamp: new Date().toISOString(),
        source: "twilio_webhook",
        event_type: "fatal_error",
        raw_payload: null,
        processed_data: { error: error instanceof Error ? error.message : String(error) },
        message_sid: null,
        client_phone: null,
        success: false,
        error_message: error instanceof Error ? (error.stack ?? error.message) : String(error),
        step: "ERROR_FATAL",
      });
    } catch (e) {
      console.error("Erro ao salvar log:", e);
    }

    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  }
});
