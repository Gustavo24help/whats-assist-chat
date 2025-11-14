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
    
    // 🔍 Extrair campos DIRETAMENTE (mais confiável que loop)
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;
    const numMedia = formData.get('NumMedia') as string;
    const profileName = formData.get('ProfileName') as string;
    
    // CAMPOS CORRETOS segundo documentação Twilio:
    const messageSid = (formData.get('MessageSid') || formData.get('SmsMessageSid') || formData.get('SmsSid')) as string;
    const originalRepliedMessageSid = formData.get('OriginalRepliedMessageSid') as string; // Campo correto para reply!
    
    // Log detalhado
    console.log("📨 Campos extraídos:", {
      from,
      body: body?.substring(0, 50),
      numMedia,
      profileName,
      messageSid: messageSid || '❌ NULL',
      originalRepliedMessageSid: originalRepliedMessageSid || '❌ NULL',
      hasMessageSid: !!messageSid,
      hasReply: !!originalRepliedMessageSid
    });
    
    // Log de TODOS os campos do FormData para debug
    console.log("📦 Todos os campos disponíveis:");
    const allFields: Record<string, any> = {};
    for (const [key, value] of formData.entries()) {
      allFields[key] = value;
      console.log(`  ${key}: ${typeof value === 'string' ? value.substring(0, 100) : value}`);
    }
    
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

    console.log("✉️ Mensagem processada:", { 
      from, 
      body: body?.substring(0, 50), 
      numMedia, 
      mediaCount: mediaUrls.length,
      profileName, 
      originalRepliedMessageSid,
      messageSid,
      hasMessageSid: !!messageSid,
      hasReply: !!originalRepliedMessageSid
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

    // Buscar mensagem original se houver reply (OriginalRepliedMessageSid)
    let replyToMessageId = null;
    if (originalRepliedMessageSid) {
      console.log('🔍 Mensagem é REPLY! Buscando original por SID:', originalRepliedMessageSid);
      
      const { data: originalMsg, error: originalError } = await supabase
        .from('mensagens')
        .select('id, texto, remetente')
        .eq('message_sid', originalRepliedMessageSid)
        .single();
      
      if (originalError) {
        console.error('❌ Erro ao buscar mensagem original:', originalError);
      }
      
      if (originalMsg) {
        replyToMessageId = originalMsg.id;
        console.log('✅ Mensagem original encontrada:', {
          id: replyToMessageId,
          texto: originalMsg.texto?.substring(0, 30),
          remetente: originalMsg.remetente
        });
      } else {
        console.warn('⚠️ Mensagem original não encontrada com SID:', originalRepliedMessageSid);
      }
    }

    // Determinar tipo de mensagem baseado na mídia
    const getTipoMensagem = (contentType: string): string => {
      if (contentType.startsWith('image/')) return 'imagem';
      if (contentType.startsWith('video/')) return 'video';
      if (contentType.startsWith('audio/')) return 'audio';
      return 'arquivo';
    };

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
