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
    const { to, message, mediaUrl, reply_to_message_id } = await req.json();
    console.log('📤 [send-whatsapp] Iniciando envio:', {
      to,
      message: message?.substring(0, 50),
      hasMedia: !!mediaUrl,
      reply_to_message_id,
      hasReply: !!reply_to_message_id
    });

    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      throw new Error('Credenciais Twilio não configuradas');
    }

    // Verificar janela de 24h
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: cliente } = await supabase
      .from('clientes')
      .select('ultima_interacao')
      .eq('telefone', to)
      .single();

    const now = new Date();
    const ultimaInteracao = cliente?.ultima_interacao ? new Date(cliente.ultima_interacao) : null;
    const diferencaHoras = ultimaInteracao 
      ? (now.getTime() - ultimaInteracao.getTime()) / (1000 * 60 * 60)
      : 25;

    const dentroJanela24h = diferencaHoras < 24;

    console.log("Verificação janela 24h:", { diferencaHoras, dentroJanela24h });

    // 🔗 Se há reply_to_message_id, buscar o message_sid da mensagem original
    let replyContext = null;
    if (reply_to_message_id) {
      console.log('🔗 REPLY SOLICITADO! Buscando message_sid:', reply_to_message_id);
      
      const { data: originalMsg, error: replyError } = await supabase
        .from('mensagens')
        .select('message_sid, texto, remetente, data_hora')
        .eq('id', reply_to_message_id)
        .single();
      
      if (replyError) {
        console.error('❌ Erro ao buscar mensagem original:', replyError);
      }
      
      console.log('📋 Resultado da busca:', {
        found: !!originalMsg,
        id: reply_to_message_id,
        message_sid: originalMsg?.message_sid || '❌ NULL',
        remetente: originalMsg?.remetente,
        data_hora: originalMsg?.data_hora,
        texto: originalMsg?.texto?.substring(0, 30)
      });
      
      if (originalMsg?.message_sid) {
        replyContext = originalMsg.message_sid;
        console.log('✅ Context configurado para Twilio:', replyContext);
      } else {
        console.warn('⚠️ AVISO: Mensagem original encontrada mas SEM message_sid!');
        console.warn('💡 Isso significa que a Twilio não está enviando MessageSid no webhook');
        console.warn('💡 Reply não funcionará até que o MessageSid seja capturado corretamente');
      }
    }

    if (!dentroJanela24h) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'FORA_JANELA_24H',
          message: 'Conversa fora da janela de 24h. Use um template aprovado.'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Enviar via Twilio
    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
    
    // Garantir que o número From tenha o mesmo formato que o To (com prefixo whatsapp: se necessário)
    const fromNumber = to.startsWith('whatsapp:') && !twilioPhoneNumber.startsWith('whatsapp:') 
      ? `whatsapp:${twilioPhoneNumber}` 
      : twilioPhoneNumber;
    
    const body = new URLSearchParams();
    body.append('To', to);
    body.append('From', fromNumber);
    body.append('Body', message);
    if (mediaUrl) {
      body.append('MediaUrl', mediaUrl);
    }
    if (replyContext) {
      body.append('QuotedMessageSid', replyContext);
      console.log('📎 [REPLY] QuotedMessageSid adicionado ao payload Twilio:', {
        QuotedMessageSid: replyContext,
        originalMessageId: reply_to_message_id,
        willShowAsReplyOnWhatsApp: true,
        correctField: 'QuotedMessageSid (não Context)'
      });
    } else if (reply_to_message_id) {
      console.warn('⚠️ Reply solicitado mas QuotedMessageSid não pode ser adicionado (sem message_sid)');
      console.warn('💡 Isso significa que a mensagem original não tem message_sid no banco');
    }
    
    console.log('📤 Payload completo sendo enviado para Twilio:', {
      To: to,
      From: fromNumber,
      Body: message?.substring(0, 50),
      hasMedia: !!mediaUrl,
      hasQuotedMessageSid: !!replyContext,
      QuotedMessageSid: replyContext || 'N/A',
      isReply: !!reply_to_message_id
    });

    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      }
    );

    const twilioData = await twilioResponse.json();
    
    console.log("📬 ========== RESPOSTA DA TWILIO ==========");
    console.log("Status HTTP:", twilioResponse.status);
    console.log("Resposta completa:", JSON.stringify(twilioData, null, 2));
    
    if (replyContext) {
      console.log("🔗 [REPLY] Verificando se o reply foi enviado corretamente:");
      console.log("  - QuotedMessageSid enviado:", replyContext);
      console.log("  - SID da mensagem criada:", twilioData.sid);
      console.log("  - Status da mensagem:", twilioData.status);
      console.log("  - Erro (se houver):", twilioData.error_message || twilioData.message || 'Nenhum erro');
      console.log("  - Código de erro:", twilioData.code || 'Nenhum código');
      
      if (twilioData.error_message || twilioData.message) {
        console.error("❌ ERRO AO ENVIAR REPLY:", twilioData.error_message || twilioData.message);
        console.error("💡 Possíveis causas:");
        console.error("   1. QuotedMessageSid inválido ou expirado");
        console.error("   2. Mensagem original não existe mais");
        console.error("   3. Campo QuotedMessageSid não suportado pela Twilio");
      } else {
        console.log("✅ Reply enviado com sucesso!");
      }
    }
    console.log("📬 ========================================");

    if (!twilioResponse.ok) {
      console.error("Erro Twilio:", twilioData);
      throw new Error(twilioData.message || 'Erro ao enviar mensagem via Twilio');
    }

    console.log("Mensagem enviada com sucesso:", twilioData.sid);

    // Salvar mensagem no banco (usando telefone como PK de clientes)
    const { error: insertError } = await supabase.from('mensagens').insert({
      cliente_id: to,
      remetente: 'atendente',
      texto: message,
      tipo: mediaUrl ? 'arquivo' : 'texto',
      arquivo_url: mediaUrl || null,
      status: 'enviado',
      data_hora: new Date().toISOString(),
      message_sid: twilioData.sid,
      reply_to_message_id: reply_to_message_id || null,
    });

    if (insertError) {
      console.error("Erro ao inserir mensagem:", insertError);
      throw new Error(`Erro ao salvar mensagem: ${insertError.message}`);
    }

    // Atualizar última interação
    const { error: updateError } = await supabase
      .from('clientes')
      .update({ ultima_interacao: new Date().toISOString() })
      .eq('telefone', to);

    if (updateError) {
      console.error("Erro ao atualizar cliente:", updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageSid: twilioData.sid,
        dentroJanela24h 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
