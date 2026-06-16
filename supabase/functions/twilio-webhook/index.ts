// twilio-webhook — COM detecção de lead FSE (landing page) — 10/06
// Base: versão do repositório local (whats-assist-chat-main). ANTES de publicar,
// confira se a versão live no Supabase não tem mudanças mais novas que esta base.
//
// O que mudou (1 bloco só): na rota CLIENTES, depois de garantir o cliente,
// se a mensagem contém o marcador FSE- (bot_config.fse_marker):
//   1. chama a RPC handle_fse_lead (cria ficha FSE<n>@<data>, soneca infinity
//      9-aware, vincula ficha_ativa_id, notifica operadores);
//   2. se a RPC criou (não-duplicado), envia a mensagem automática via Twilio
//      (texto em bot_config.fse_auto_message) — a resposta volta por este
//      mesmo webhook e é logada em `mensagens` normalmente.
// Procure por "FSE" para achar o bloco.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";
import {
  getManagedWhatsappNumbers,
  isManagedWhatsappNumber,
  normalizeWhatsappNumber,
  isPrestadoresNumber,
} from "../_shared/twilioNumbers.ts";
import { variantesTelefone } from "../_shared/telefoneBR.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MANAGED_WHATSAPP_NUMBERS = getManagedWhatsappNumbers();

async function fetchTwilioMessageDate(messageSid: string, requestId: string): Promise<string | null> {
  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!accountSid || !authToken || !messageSid) return null;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${messageSid}.json`;
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}` },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.date_sent) {
        const dateSent = new Date(data.date_sent).toISOString();
        console.log(`[${requestId}] 📅 DateSent real da Twilio: ${dateSent}`);
        return dateSent;
      }
    }
  } catch (e) {
    console.log(`[${requestId}] ⚠️ Falha ao buscar DateSent: ${e}`);
  }
  return null;
}

serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`\n${"=".repeat(80)}`);
  console.log(`📤 [${requestId}] TWILIO WEBHOOK - ${new Date().toISOString()}`);
  console.log(`${"=".repeat(80)}\n`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Parsear dados
    const rawBody = await req.text();

    let formData: FormData;
    const reqClone = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: rawBody,
    });

    try {
      formData = await reqClone.formData();
    } catch (e) {
      console.log(`[${requestId}] ⚠️ Não foi FormData, tentando JSON...`);
      const jsonData = JSON.parse(rawBody);
      formData = new FormData();
      for (const [key, value] of Object.entries(jsonData)) {
        formData.append(key, String(value));
      }
    }

    const from = normalizeWhatsappNumber(formData.get("From") as string);
    const to = normalizeWhatsappNumber(formData.get("To") as string);
    const body = (formData.get("Body") as string) || "";
    const messageSid = formData.get("MessageSid") as string;
    const numMedia = parseInt((formData.get("NumMedia") as string) || "0", 10);

    console.log(`[${requestId}] 📤 From: ${from}`);
    console.log(`[${requestId}] 📤 To: ${to}`);
    console.log(`[${requestId}] 📤 MessageSid: ${messageSid}`);
    console.log(`[${requestId}] 💬 Body: ${body?.substring(0, 100)}`);
    console.log(`[${requestId}] 📎 NumMedia: ${numMedia}`);

    // Determinar direção da mensagem
    const isBotMessage = isManagedWhatsappNumber(from, MANAGED_WHATSAPP_NUMBERS);
    const isClientMessage = isManagedWhatsappNumber(to, MANAGED_WHATSAPP_NUMBERS) && !isBotMessage;
    const directionLabel = isBotMessage ? "BOT → CLIENTE" : isClientMessage ? "CLIENTE → BOT" : "DESCONHECIDO";
    const directionKey = isBotMessage ? "bot_to_client" : isClientMessage ? "client_to_bot" : "unknown";

    // O telefone do CLIENTE é sempre o número que NÃO é gerenciado pela 24help
    const clienteTelefone = isBotMessage ? to : from;
    const remetente = from;

    console.log(`[${requestId}] 🔀 Direção: ${directionLabel}`);
    console.log(`[${requestId}] 👤 Cliente telefone: ${clienteTelefone}`);
    console.log(`[${requestId}] ☎️ Números gerenciados: ${MANAGED_WHATSAPP_NUMBERS.join(", ")}`);

    // Log debug
    await supabase.from("webhook_debug_logs").insert({
      timestamp: new Date().toISOString(),
      source: "twilio_webhook",
      event_type: isBotMessage ? "bot_message" : "client_message",
      message_sid: messageSid,
      client_phone: clienteTelefone,
      success: true,
      error_message: null,
      step: "RECEIVED",
      processed_data: { from, to, body: body?.substring(0, 200), messageSid, direction: directionKey },
    });

    // Ignorar mensagens de loop (from === to)
    if (from === to) {
      console.log(`[${requestId}] ⚠️ Mensagem de teste ou loop, ignorando`);
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
      });
    }

    // ========== ROTEAMENTO: Prestadores vs Clientes ==========
    // Determinar qual número da 24help recebeu/enviou a mensagem
    const numeroDestino = isBotMessage ? from : to;
    const isPrestadorRoute = isPrestadoresNumber(numeroDestino);

    if (isPrestadorRoute) {
      console.log(`[${requestId}] 🔧 ROTA PRESTADORES - número: ${numeroDestino}`);

      // Verificar duplicidade em mensagens_prestadores
      if (messageSid) {
        const { data: existing } = await supabase
          .from("mensagens_prestadores")
          .select("id")
          .eq("message_sid", messageSid)
          .maybeSingle();

        if (existing) {
          console.log(`[${requestId}] ⚠️ Mensagem prestador já existe (SID: ${messageSid}), ignorando`);
          return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
            headers: { ...corsHeaders, "Content-Type": "text/xml" },
          });
        }
      }

      // Buscar ou criar prestador_chat
      let { data: prestadorChat } = await supabase
        .from("prestadores_chat")
        .select("telefone, nome, cpf")
        .eq("telefone", clienteTelefone)
        .maybeSingle();

      if (!prestadorChat && isClientMessage) {
        // Tentar encontrar nome do prestador na tabela prestadores
        const phoneDigits = clienteTelefone.replace("whatsapp:", "").replace("+", "").replace("55", "");
        const { data: prestadorCadastrado } = await supabase
          .from("prestadores")
          .select("nome, cpf, telefone")
          .or(`telefone.ilike.%${phoneDigits}`)
          .limit(1)
          .maybeSingle();

        const profileName = ((formData.get("ProfileName") as string) || "").trim();
        const nomePrestador =
          profileName || prestadorCadastrado?.nome || clienteTelefone.replace("whatsapp:", "").replace("+", "");

        console.log(`[${requestId}] 🆕 Criando prestador_chat: ${clienteTelefone} (nome: ${nomePrestador})`);
        const { data: novoPrestador, error: createError } = await supabase
          .from("prestadores_chat")
          .insert({
            telefone: clienteTelefone,
            nome: nomePrestador,
            cpf: prestadorCadastrado?.cpf || null,
            status_conversa: "aberta",
            ultima_interacao: new Date().toISOString(),
            tags: [],
            numero_twilio: numeroDestino,
          })
          .select("telefone, nome, cpf")
          .single();

        if (createError) {
          console.error(`[${requestId}] ❌ Erro ao criar prestador_chat:`, createError);
        } else {
          prestadorChat = novoPrestador;
        }
      }

      if (!prestadorChat) {
        console.log(`[${requestId}] ⚠️ Prestador chat não encontrado: ${clienteTelefone}`);
        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
        });
      }

      // Update name from WhatsApp ProfileName whenever it differs from the stored value
      if (isClientMessage && prestadorChat) {
        const profileName = ((formData.get("ProfileName") as string) || "").trim();
        const currentName = (prestadorChat.nome || "").trim();
        if (profileName && profileName !== currentName) {
          console.log(`[${requestId}] 📝 Atualizando nome prestador: ${currentName} → ${profileName}`);
          await supabase.from("prestadores_chat").update({ nome: profileName }).eq("telefone", clienteTelefone);
          prestadorChat.nome = profileName;
        }
      }

      // Determinar tipo de mídia
      let tipo = "texto";
      let arquivoUrl: string | null = null;
      if (numMedia > 0) {
        const mediaContentType = (formData.get("MediaContentType0") as string) || "";
        const mediaUrl = (formData.get("MediaUrl0") as string) || "";
        if (mediaContentType.startsWith("image/")) tipo = "imagem";
        else if (mediaContentType.startsWith("video/")) tipo = "video";
        else if (mediaContentType.startsWith("audio/")) tipo = "audio";
        else tipo = "arquivo";
        arquivoUrl = mediaUrl || null;
      }

      const realDateSent = messageSid ? await fetchTwilioMessageDate(messageSid, requestId) : null;
      const dataHora = realDateSent || new Date().toISOString();

      const mensagemPrestador = {
        prestador_telefone: prestadorChat.telefone,
        remetente: remetente,
        texto: body || (numMedia > 0 ? `Arquivo ${numMedia}` : ""),
        tipo,
        arquivo_url: arquivoUrl,
        status: isClientMessage ? "recebido" : "enviado",
        data_hora: dataHora,
        numero_twilio: numeroDestino,
        message_sid: messageSid,
      };

      const { data: savedPrestMsg, error: saveError } = await supabase
        .from("mensagens_prestadores")
        .insert(mensagemPrestador)
        .select("id")
        .single();

      if (saveError) {
        console.error(`[${requestId}] ❌ Erro ao salvar msg prestador:`, saveError);
      } else {
        console.log(`[${requestId}] ✅ Mensagem prestador salva com sucesso!`);
        if (isClientMessage) {
          await supabase
            .from("prestadores_chat")
            .update({ ultima_interacao: new Date().toISOString() })
            .eq("telefone", prestadorChat.telefone);
        }

        // Fire-and-forget: transcribe audio messages
        if (tipo === "audio" && arquivoUrl && savedPrestMsg?.id) {
          console.log(`[${requestId}] 🎙️ Disparando transcrição para msg prestador ${savedPrestMsg.id}`);
          fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              messageId: savedPrestMsg.id,
              audioUrl: arquivoUrl,
              table: "mensagens_prestadores",
            }),
          }).catch((e) => console.error(`[${requestId}] ⚠️ Erro ao chamar transcribe-audio:`, e));
        }
      }
    } else {
      // ========== ROTA CLIENTES (lógica 100% original) ==========

      // Verificar duplicidade por message_sid
      if (messageSid) {
        const { data: existing } = await supabase
          .from("mensagens")
          .select("id")
          .eq("message_sid", messageSid)
          .maybeSingle();

        if (existing) {
          console.log(`[${requestId}] ⚠️ Mensagem já existe (SID: ${messageSid}), ignorando`);
          return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
            headers: { ...corsHeaders, "Content-Type": "text/xml" },
          });
        }
      }

      // Buscar cliente de forma TOLERANTE (variantes com/sem 9º dígito).
      // Se existir, usamos o telefone canônico já cadastrado (onde está a ficha).
      const varsCliente = variantesTelefone(clienteTelefone);
      const lookupTelefones = varsCliente.length ? varsCliente : [clienteTelefone];
      let { data: cliente } = await supabase
        .from("clientes")
        .select("telefone")
        .in("telefone", lookupTelefones)
        .limit(1)
        .maybeSingle();
      if (cliente?.telefone && cliente.telefone !== clienteTelefone) {
        console.log(
          `[${requestId}] 🔗 Cliente existente encontrado por variante: ${clienteTelefone} → ${cliente.telefone}`,
        );
      }

      if (!cliente && isClientMessage) {
        const profileName = formData.get("ProfileName") as string;
        const nomeCliente = profileName || clienteTelefone.replace("whatsapp:", "").replace("+", "");
        console.log(`[${requestId}] 🆕 Criando novo cliente: ${clienteTelefone} (nome: ${nomeCliente})`);
        const { data: novoCliente, error: createError } = await supabase
          .from("clientes")
          .insert({
            telefone: clienteTelefone,
            nome: nomeCliente,
            status_conversa: "aberta",
            ultima_interacao: new Date().toISOString(),
            tags: [],
          })
          .select("telefone")
          .single();

        if (createError) {
          console.error(`[${requestId}] ❌ Erro ao criar cliente:`, createError);
        } else {
          cliente = novoCliente;
        }
      }

      if (!cliente) {
        console.log(`[${requestId}] ⚠️ Cliente não encontrado: ${clienteTelefone}`);
        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
        });
      }

      // ========== FSE: lead de landing page → bypass do bot ==========
      // Detecta o marcador (bot_config.fse_marker) na msg do cliente:
      // cria ficha FSE + soneca infinity + notifica operadores (RPC) e
      // envia a mensagem automática (1x por lead; dedupe na RPC).
      if (isClientMessage && body) {
        try {
          const { data: cfgRows } = await supabase
            .from("bot_config")
            .select("key, value")
            .in("key", ["fse_marker", "fse_auto_message"]);
          const cfg = Object.fromEntries((cfgRows || []).map((r: any) => [r.key, r.value]));
          const marker = (cfg["fse_marker"] || "FSE-").toUpperCase();

          if (body.toUpperCase().includes(marker)) {
            console.log(`[${requestId}] 🔥 Lead FSE detectado!`);
            const profileName = ((formData.get("ProfileName") as string) || "").trim();

            const { data: fse, error: fseErr } = await supabase.rpc("handle_fse_lead", {
              p_telefone: cliente.telefone,
              p_nome: profileName || null,
              p_texto: body,
            });

            if (fseErr) {
              console.error(`[${requestId}] ❌ handle_fse_lead:`, fseErr);
            } else {
              console.log(`[${requestId}] ✅ FSE: ${JSON.stringify(fse)}`);

              if (fse?.created) {
                const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
                const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
                const autoMsg =
                  cfg["fse_auto_message"] ||
                  "✅ Recebemos seu pedido pelo site da 24help! Um dos nossos operadores já está com o seu atendimento e fala com você em instantes. 🛠️";

                if (accountSid && authToken) {
                  const params = new URLSearchParams({ From: to, To: from, Body: autoMsg });
                  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
                    method: "POST",
                    headers: {
                      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
                      "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: params,
                  });
                  console.log(`[${requestId}] 📨 Msg automática FSE enviada: HTTP ${resp.status}`);
                } else {
                  console.error(
                    `[${requestId}] ⚠️ TWILIO_ACCOUNT_SID/AUTH_TOKEN ausentes — msg automática não enviada`,
                  );
                }
              }
            }
          }
        } catch (e) {
          // FSE nunca pode derrubar o log da mensagem — segue o fluxo normal
          console.error(`[${requestId}] ⚠️ Erro no tratamento FSE:`, e);
        }
      }
      // ========== fim do bloco FSE ==========

      // Buscar ficha ativa do cliente (prioriza ficha_ativa_id)
      const { data: clienteComFicha } = await supabase
        .from("clientes")
        .select("ficha_ativa_id")
        .eq("telefone", cliente.telefone)
        .maybeSingle();

      let fichaId = clienteComFicha?.ficha_ativa_id || null;

      // Fallback: buscar ficha com status Agendado se não houver ficha_ativa_id
      if (!fichaId) {
        const { data: ficha } = await supabase
          .from("fichas_de_servico")
          .select("id")
          .eq("telefone_cliente", cliente.telefone)
          .eq("status", "Agendado")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        fichaId = ficha?.id || null;
      }
      console.log(`[${requestId}] 📋 ficha_id para mensagem: ${fichaId}`);

      // Determinar tipo de mídia
      let tipo = "texto";
      let arquivoUrl: string | null = null;

      if (numMedia > 0) {
        const mediaContentType = (formData.get("MediaContentType0") as string) || "";
        const mediaUrl = (formData.get("MediaUrl0") as string) || "";

        if (mediaContentType.startsWith("image/")) tipo = "imagem";
        else if (mediaContentType.startsWith("video/")) tipo = "video";
        else if (mediaContentType.startsWith("audio/")) tipo = "audio";
        else tipo = "arquivo";

        arquivoUrl = mediaUrl || null;
        console.log(`[${requestId}] 📎 Mídia: tipo=${tipo}, url=${arquivoUrl?.substring(0, 50)}...`);
      }

      // Buscar timestamp real da Twilio
      const realDateSent = messageSid ? await fetchTwilioMessageDate(messageSid, requestId) : null;
      const dataHora = realDateSent || new Date().toISOString();

      // Salvar mensagem
      const mensagem = {
        cliente_id: cliente.telefone,
        remetente: remetente,
        texto: body || (numMedia > 0 ? `Arquivo ${numMedia}` : ""),
        tipo,
        arquivo_url: arquivoUrl,
        status: isClientMessage ? "recebido" : "enviado",
        data_hora: dataHora,
        ficha_id: fichaId,
        message_sid: messageSid,
        reply_to_message_id: null,
        tipo_remetente: isClientMessage ? "cliente" : "bot",
        operador_nome: isBotMessage ? "Bot Automático" : null,
      };

      console.log(
        `[${requestId}] 💾 Salvando: cliente_id=${mensagem.cliente_id}, remetente=${mensagem.remetente}, status=${mensagem.status}`,
      );

      const { data: savedMsg, error: saveError } = await supabase
        .from("mensagens")
        .insert(mensagem)
        .select("id")
        .single();

      if (saveError) {
        console.error(`[${requestId}] ❌ Erro ao salvar:`, saveError);

        await supabase.from("webhook_debug_logs").insert({
          timestamp: new Date().toISOString(),
          source: "twilio_webhook",
          event_type: "save_error",
          message_sid: messageSid,
          client_phone: clienteTelefone,
          success: false,
          error_message: saveError.message,
          step: "SAVE_ERROR",
        });
      } else {
        console.log(`[${requestId}] ✅ Mensagem salva com sucesso! (${isBotMessage ? "bot" : "cliente"})`);

        if (isClientMessage) {
          // ⚠️ Não escrever mais `marcado_nao_lido` global — leitura é por operador
          // (mensagem_leitura_operador). O badge de não-lido é derivado de
          // `mensagens.data_hora > last_read_at` por usuário.
          await supabase
            .from("clientes")
            .update({
              ultima_interacao: new Date().toISOString(),
              ultima_mensagem_recebida: new Date().toISOString(),
            })
            .eq("telefone", cliente.telefone);

          // Boas-vindas automática para leads do site (ficha FSE*)
          if (fichaId && /^FSE/.test(fichaId)) {
            const { data: fichaLead } = await supabase
              .from("fichas_de_servico")
              .select("boas_vindas_lead_enviada")
              .eq("id", fichaId)
              .maybeSingle();
            if (fichaLead && (fichaLead as any).boas_vindas_lead_enviada === false) {
              fetch(`${supabaseUrl}/functions/v1/enviar-boas-vindas-lead`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  telefone: cliente.telefone,
                  ficha_id: fichaId,
                  numero_origem: numeroDestino,
                }),
              }).catch((e) => console.error(`[${requestId}] erro boas-vindas-lead:`, e));
            }
          }
        }

        // Fire-and-forget: transcribe audio messages
        if (tipo === "audio" && arquivoUrl && savedMsg?.id) {
          console.log(`[${requestId}] 🎙️ Disparando transcrição para msg cliente ${savedMsg.id}`);
          fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              messageId: savedMsg.id,
              audioUrl: arquivoUrl,
              table: "mensagens",
            }),
          }).catch((e) => console.error(`[${requestId}] ⚠️ Erro ao chamar transcribe-audio:`, e));
        }

        await supabase.from("webhook_debug_logs").insert({
          timestamp: new Date().toISOString(),
          source: "twilio_webhook",
          event_type: isBotMessage ? "bot_message_saved" : "client_message_saved",
          message_sid: messageSid,
          client_phone: clienteTelefone,
          success: true,
          error_message: null,
          step: "SAVED",
        });
      }
    }

    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error(`[${requestId}] ❌ ERRO:`, error);

    try {
      await supabase.from("webhook_debug_logs").insert({
        timestamp: new Date().toISOString(),
        source: "twilio_webhook",
        event_type: "fatal_error",
        success: false,
        error_message: error instanceof Error ? error.message : String(error),
        step: "ERROR",
      });
    } catch (e) {
      console.error("Erro ao salvar log:", e);
    }

    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  }
});
