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

    // Detectar o Content-Type
    const contentType = req.headers.get('content-type') || '';
    console.log("📝 Content-Type recebido:", contentType);

    let allFields: Record<string, string> = {};
    let formData: FormData;

    try {
      if (contentType.includes('application/json')) {
        // Tentar como JSON
        console.log("📦 Tentando processar como JSON...");
        const jsonData = await req.json();
        console.log("📦 Dados JSON recebidos:", JSON.stringify(jsonData, null, 2));
        
        // Converter JSON para o formato esperado
        allFields = jsonData;
        
        // Criar um FormData mock para compatibilidade com o código existente
        formData = new FormData();
        for (const [key, value] of Object.entries(jsonData)) {
          formData.append(key, String(value));
        }
        
        console.log("✅ Dados processados como JSON com sucesso");
      } else {
        // Tentar como FormData (padrão)
        console.log("📦 Tentando processar como FormData...");
        formData = await req.formData();
        
        // Coletar todos os campos
        for (const [key, value] of formData.entries()) {
          allFields[key] = String(value);
        }
        
        console.log("✅ Dados processados como FormData com sucesso");
      }
    } catch (parseError) {
      console.error("❌ Erro ao processar webhook:", parseError);
      console.error("💡 Content-Type:", contentType);
      console.error("💡 Tente verificar o formato de envio no Twilio Studio");
      
      const errorMessage = parseError instanceof Error ? parseError.message : 'Erro desconhecido';
      
      return new Response(
        JSON.stringify({ 
          error: "Formato de dados inválido", 
          contentType,
          message: errorMessage 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log("📦 ========== TODOS OS CAMPOS RECEBIDOS DA TWILIO ==========");
    console.log("📦 TOTAL DE CAMPOS:", Object.keys(allFields).length);

    for (const [key, value] of Object.entries(allFields)) {
      console.log(`  ✓ ${key}: ${value}`);
    }

    console.log("📦 TODOS OS CAMPOS (JSON):", JSON.stringify(allFields, null, 2));
    console.log("📦 =======================================================");
    
    // 🔍 Extrair campos básicos
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;
    const numMedia = formData.get('NumMedia') as string;
    const profileName = formData.get('ProfileName') as string;
    
    // 🆔 Extrair MessageSid - tentar TODAS as variações possíveis
    console.log('🆔 [DEBUG] Tentando capturar MessageSid de várias formas:');
    console.log('  - allFields["MessageSid"]:', allFields['MessageSid'] || '❌');
    console.log('  - allFields["SmsMessageSid"]:', allFields['SmsMessageSid'] || '❌');
    console.log('  - allFields["SmsSid"]:', allFields['SmsSid'] || '❌');
    console.log('  - allFields["message_sid"]:', allFields['message_sid'] || '❌');
    console.log('  - formData.get("MessageSid"):', formData.get('MessageSid') || '❌');
    console.log('  - formData.get("SmsMessageSid"):', formData.get('SmsMessageSid') || '❌');
    console.log('  - formData.get("SmsSid"):', formData.get('SmsSid') || '❌');
    
    const messageSid = (
      allFields['MessageSid'] ||
      allFields['SmsMessageSid'] ||
      allFields['SmsSid'] ||
      allFields['message_sid'] ||
      formData.get('MessageSid') ||
      formData.get('SmsMessageSid') ||
      formData.get('SmsSid') ||
      formData.get('message_sid')
    ) as string;
    
    if (messageSid) {
      console.log('✅ MessageSid capturado com sucesso:', messageSid);
    } else {
      console.error('❌ CRÍTICO: MessageSid NÃO CAPTURADO!');
      console.error('💡 Isso significa que REPLIES NÃO FUNCIONARÃO!');
      console.error('💡 Verifique se a Twilio está enviando o MessageSid no webhook');
    }
    
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
    
    // 🔘 Campos para templates com botões - tentar múltiplas variações
    const buttonPayload = (
      allFields['ButtonPayload'] ||
      allFields['buttonPayload'] ||
      allFields['button_payload'] ||
      formData.get('ButtonPayload') ||
      formData.get('buttonPayload') ||
      formData.get('button_payload')
    ) as string;
    
    const buttonText = (
      allFields['ButtonText'] ||
      allFields['buttonText'] ||
      allFields['button_text'] ||
      allFields['Button'] ||
      formData.get('ButtonText') ||
      formData.get('buttonText') ||
      formData.get('button_text') ||
      formData.get('Button')
    ) as string;
    
    // Também verificar se o Body contém indicação de botão
    const isButtonResponse = body && (
      body.startsWith('button:') || 
      body.startsWith('btn:') ||
      allFields['EventType'] === 'BUTTON'
    );
    
    console.log('🔘 [DEBUG] Tentativa de captura de botão:', {
      buttonPayload_variations: {
        ButtonPayload: allFields['ButtonPayload'] || '❌',
        buttonPayload: allFields['buttonPayload'] || '❌',
        button_payload: allFields['button_payload'] || '❌'
      },
      buttonText_variations: {
        ButtonText: allFields['ButtonText'] || '❌',
        buttonText: allFields['buttonText'] || '❌',
        button_text: allFields['button_text'] || '❌',
        Button: allFields['Button'] || '❌'
      },
      body: body || '❌',
      isButtonResponse,
      finalButtonPayload: buttonPayload || 'N/A',
      finalButtonText: buttonText || 'N/A'
    });
    
    if (buttonPayload || buttonText || isButtonResponse) {
      console.log('🔘 TEMPLATE BUTTON DETECTADO:', {
        buttonText: buttonText || body || 'N/A',
        buttonPayload: buttonPayload || 'N/A',
        isButtonResponse,
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
    
    // Se detectamos um botão, formatar a mensagem adequadamente
    if (buttonText || buttonPayload || isButtonResponse) {
      const displayText = buttonText || body || 'Botão';
      const payloadInfo = buttonPayload ? `\n[Payload: ${buttonPayload}]` : '';
      
      finalBody = `🔘 Botão clicado: ${displayText}${payloadInfo}`;
      
      console.log('🔘 Mensagem de botão formatada:', {
        original: body,
        formatted: finalBody
      });
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

    // Se há mídia, criar uma mensagem para cada arquivo
    if (mediaUrls.length > 0) {
      for (let i = 0; i < mediaUrls.length; i++) {
        const textoMidia = i === 0 && finalBody ? finalBody : (body || `Arquivo ${i + 1}`);
        const mensagem = {
          cliente_id: cliente.telefone,
          remetente: 'cliente',
          texto: textoMidia,
          tipo: getTipoMensagem(mediaTypes[i]),
          arquivo_url: mediaUrls[i],
          status: 'recebido',
          data_hora: new Date().toISOString(),
          ficha_id: fichaAtiva?.id || null,
          message_sid: messageSid,
          reply_to_message_id: replyToMessageId,
        };

        console.log('💾 Salvando mensagem de mídia:', {
          tipo: mensagem.tipo,
          hasText: !!mensagem.texto,
          hasButton: !!(buttonText || buttonPayload || isButtonResponse)
        });

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
        texto: finalBody || body || '',
        tipo: 'texto',
        arquivo_url: null,
        status: 'recebido',
        data_hora: new Date().toISOString(),
        ficha_id: fichaAtiva?.id || null,
        message_sid: messageSid,
        reply_to_message_id: replyToMessageId,
      };

      console.log('💾 Salvando mensagem de texto:', {
        texto: mensagem.texto?.substring(0, 50),
        hasButton: !!(buttonText || buttonPayload || isButtonResponse),
        buttonDetected: {
          buttonText: !!buttonText,
          buttonPayload: !!buttonPayload,
          isButtonResponse
        }
      });

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
