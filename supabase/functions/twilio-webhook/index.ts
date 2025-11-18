import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔔 Webhook recebido do Twilio");
    
    // Parse form data from Twilio
    const formData = await req.formData();
    
  // 📋 PRIMEIRO: Coletar TODOS os campos para análise
  console.log("📦 ========== TODOS OS CAMPOS RECEBIDOS DA TWILIO ==========");
  
  const allFields: Record<string, string> = {};
  const allFieldsArray: Array<{key: string, value: string}> = [];
  
  for (const [key, value] of formData.entries()) {
    const strValue = String(value);
    allFields[key] = strValue;
    allFieldsArray.push({ key, value: strValue });
    console.log(`  ✓ ${key}: ${strValue}`);
  }
  
  console.log("📦 TOTAL DE CAMPOS:", allFieldsArray.length);
  console.log("📦 TODOS OS CAMPOS (JSON):", JSON.stringify(allFields, null, 2));
  console.log("📦 =======================================================");
    
    // 🔍 Extrair campos básicos
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;
    const numMedia = formData.get('NumMedia') as string;
    const profileName = formData.get('ProfileName') as string;
    
    // 🆔 Extrair MessageSid - tentar todos os campos possíveis
    const messageSid = (
      allFields['MessageSid'] ||
      allFields['SmsMessageSid'] ||
      allFields['SmsSid'] ||
      formData.get('MessageSid') ||
      formData.get('SmsMessageSid') ||
      formData.get('SmsSid')
    ) as string;
    
    console.log('🆔 [DEBUG] MessageSid - tentativas:', {
      fromAllFields_MessageSid: allFields['MessageSid'] || '❌',
      fromAllFields_SmsMessageSid: allFields['SmsMessageSid'] || '❌',
      fromFormData_MessageSid: formData.get('MessageSid') || '❌',
      final: messageSid || '❌ NENHUM MÉTODO FUNCIONOU'
    });
    
    // 🔗 Extrair OriginalRepliedMessageSid para replies
    const originalRepliedMessageSid = (
      allFields['OriginalRepliedMessageSid'] ||
      formData.get('OriginalRepliedMessageSid')
    ) as string;
    
    console.log('🔗 [DEBUG] OriginalRepliedMessageSid - tentativas:', {
      fromAllFields: allFields['OriginalRepliedMessageSid'] || '❌',
      fromFormData: formData.get('OriginalRepliedMessageSid') || '❌',
      final: originalRepliedMessageSid || '❌ NENHUM MÉTODO FUNCIONOU',
      isReply: !!originalRepliedMessageSid
    });
    
    // 🔘 Campos para templates com botões
    const buttonPayload = formData.get('ButtonPayload') as string;
    const buttonText = formData.get('ButtonText') as string;
    
    if (buttonPayload || buttonText) {
      console.log('🔘 TEMPLATE BUTTON DETECTADO:', {
        buttonText: buttonText || 'N/A',
        buttonPayload: buttonPayload || 'N/A',
        willSaveAsSpecialMessage: true,
        messageWillInclude: '🔘 Botão clicado'
      });
    }
    
    console.log("📨 Campos extraídos e processados:", {
      from,
      bodyPreview: body?.substring(0, 50),
      numMedia,
      profileName,
      messageSid: messageSid || '❌ NULL',
      originalRepliedMessageSid: originalRepliedMessageSid || '❌ NULL',
      buttonPayload: buttonPayload || 'N/A',
      buttonText: buttonText || 'N/A',
      hasMessageSid: !!messageSid,
      hasReply: !!originalRepliedMessageSid,
      hasButton: !!(buttonPayload || buttonText)
    });
    
    // Coletar todas as mídias (até 10 arquivos)
    const mediaUrls: string[] = [];
    const mediaTypes: string[] = [];
    const numMediaInt = parseInt(numMedia || '0');
    
    for (let i = 0; i < numMediaInt; i++) {
      const mediaUrl = formData.get(`MediaUrl${i}`) as string;
      const mediaType = formData.get(`MediaContentType${i}`) as string;
      if (mediaUrl) {
        mediaUrls.push(mediaUrl);
        mediaTypes.push(mediaType || 'unknown');
      }
    }

    // 📝 Construir texto da mensagem (incluindo botões se houver)
    let finalBody = body || '';
    if (buttonText && buttonPayload) {
      finalBody = finalBody 
        ? `${finalBody}\n\n🔘 Botão clicado: ${buttonText}`
        : `🔘 Botão clicado: ${buttonText}`;
    }
    
    console.log("✉️ Mensagem processada:", { 
      from, 
      originalBody: body?.substring(0, 50),
      finalBody: finalBody?.substring(0, 100),
      numMedia, 
      mediaCount: mediaUrls.length,
      profileName, 
      messageSid: messageSid || '❌ NULL',
      originalRepliedMessageSid: originalRepliedMessageSid || '❌ NULL',
      buttonPayload: buttonPayload || 'N/A',
      buttonText: buttonText || 'N/A',
      hasMessageSid: !!messageSid,
      hasReply: !!originalRepliedMessageSid,
      hasButton: !!(buttonText || buttonPayload)
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar ou criar contato (telefone é a PK)
    let { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('telefone', from)
      .maybeSingle();

    if (!cliente) {
      console.log("Criando novo cliente:", from);
      const nomeCliente = profileName || from.replace('whatsapp:', '').replace('+', '') || 'Desconhecido';
      const { data: novoCliente, error: createError } = await supabase
        .from('clientes')
        .insert({
          telefone: from,
          nome: nomeCliente,
          status_conversa: 'aberta',
          ultima_interacao: new Date().toISOString(),
          tags: [],
        })
        .select()
        .single();

      if (createError) {
        console.error("Erro ao criar cliente:", createError);
        // Return 200 to prevent Twilio retries
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/xml',
            },
          }
        );
      }
      cliente = novoCliente;
    } else {
      // Atualizar última interação e nome se disponível
      const updateData: any = { ultima_interacao: new Date().toISOString() };
      if (profileName && (cliente.nome === 'Desconhecido' || cliente.nome === from)) {
        updateData.nome = profileName;
      }
      
      const { error: updateError } = await supabase
        .from('clientes')
        .update(updateData)
        .eq('telefone', cliente.telefone);

      if (updateError) {
        console.error("Erro ao atualizar última interação:", updateError);
      }
    }

    console.log("Cliente identificado:", cliente.telefone);

    // Buscar ficha ativa do cliente
    const { data: fichaAtiva } = await supabase
      .from('fichas_de_servico')
      .select('id')
      .eq('telefone_cliente', cliente.telefone)
      .eq('status', 'Agendado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Buscar mensagem original se houver reply (OriginalRepliedMessageSid)
    let replyToMessageId = null;
    if (originalRepliedMessageSid) {
      console.log('🔗 REPLY DETECTADO! Buscando mensagem original:', {
        originalRepliedMessageSid,
        allPossibleFields: {
          OriginalRepliedMessageSid: allFields['OriginalRepliedMessageSid'],
          Context: allFields['Context'],
          ReferredMessage: allFields['ReferredMessage']
        }
      });
      
      const { data: originalMsg, error: originalError } = await supabase
        .from('mensagens')
        .select('id, texto, remetente, message_sid')
        .eq('message_sid', originalRepliedMessageSid)
        .single();
      
      if (originalError) {
        console.error('❌ Erro ao buscar mensagem original:', originalError);
      }
      
      if (originalMsg) {
        replyToMessageId = originalMsg.id;
        console.log('✅ Mensagem original encontrada:', {
          id: replyToMessageId,
          message_sid: originalMsg.message_sid,
          texto: originalMsg.texto?.substring(0, 30),
          remetente: originalMsg.remetente
        });
      } else {
        console.warn('⚠️ Mensagem original NÃO encontrada com SID:', originalRepliedMessageSid);
        console.warn('💡 Possíveis causas: MessageSid não foi salvo corretamente na mensagem original');
      }
    }

    // Determinar tipo de mensagem baseado na mídia
    const getTipoMensagem = (contentType: string): string => {
      if (contentType.startsWith('image/')) return 'imagem';
      if (contentType.startsWith('video/')) return 'video';
      if (contentType.startsWith('audio/')) return 'audio';
      return 'arquivo';
    };

    // Salvar mensagem(ns) no banco
    const mensagensParaSalvar = [];
    
    // Se houver botão, adicionar informação ao texto
    const textoComBotao = buttonText && buttonPayload
      ? (finalBody ? `${finalBody}\n[Payload: ${buttonPayload}]` : `🔘 Botão: ${buttonText}\n[Payload: ${buttonPayload}]`)
      : finalBody;
    
    if (finalBody || mediaUrls.length === 0) {
      const novaMensagem = {
        cliente_id: cliente.telefone,
        ficha_id: fichaAtiva?.id || null,
        remetente: 'cliente',
        texto: textoComBotao || finalBody,
        tipo: mediaUrls.length > 0 ? getTipoMensagem(mediaTypes[0]) : 'texto',
        arquivo_url: mediaUrls[0] || null,
        message_sid: messageSid || null,
        reply_to_message_id: replyToMessageId
      };
      
      console.log('💾 Salvando mensagem:', {
        ...novaMensagem,
        texto: novaMensagem.texto?.substring(0, 50),
        hasButtonData: !!(buttonText || buttonPayload)
      });
      
      mensagensParaSalvar.push(novaMensagem);
    }
    
    // Adicionar mensagens extras para múltiplas mídias
    for (let i = 1; i < mediaUrls.length; i++) {
      mensagensParaSalvar.push({
        cliente_id: cliente.telefone,
        ficha_id: fichaAtiva?.id || null,
        remetente: 'cliente',
        texto: null,
        tipo: getTipoMensagem(mediaTypes[i]),
        arquivo_url: mediaUrls[i],
        message_sid: messageSid || null,
        reply_to_message_id: replyToMessageId
      });
    }

    // Se há mídia, criar uma mensagem para cada arquivo
    if (mediaUrls.length > 0) {
      for (let i = 0; i < mediaUrls.length; i++) {
        const mensagem = {
          cliente_id: cliente.telefone,
          remetente: 'cliente',
          texto: body || `Arquivo ${i + 1}`,
          tipo: getTipoMensagem(mediaTypes[i]),
          arquivo_url: mediaUrls[i],
          status: 'recebido',
          data_hora: new Date().toISOString(),
          ficha_id: null,
          message_sid: messageSid,
          reply_to_message_id: replyToMessageId,
        };

        const { error: mensagemError } = await supabase
          .from('mensagens')
          .insert(mensagem);

        if (mensagemError) {
          console.error("Erro ao salvar mensagem de mídia:", mensagemError);
        }
      }
    } else {
      // Mensagem de texto apenas
      const mensagem = {
        cliente_id: cliente.telefone,
        remetente: 'cliente',
        texto: body || '',
        tipo: 'texto',
        arquivo_url: null,
        status: 'recebido',
        data_hora: new Date().toISOString(),
        ficha_id: null,
        message_sid: messageSid,
        reply_to_message_id: replyToMessageId,
      };

      const { error: mensagemError } = await supabase
        .from('mensagens')
        .insert(mensagem);

      if (mensagemError) {
        console.error("Erro ao salvar mensagem:", mensagemError);
        console.error("Dados da mensagem:", JSON.stringify(mensagem));
        // Return 200 to prevent Twilio retries
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/xml',
            },
          }
        );
      }
    }

    console.log("Mensagem(ns) salva(s) com sucesso");

    // Resposta TwiML vazia (não responde automaticamente)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/xml',
        },
      }
    );
  } catch (error) {
    console.error("Erro no webhook:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    // Always return 200 to Twilio to prevent retries
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/xml',
        },
      }
    );
  }
});
