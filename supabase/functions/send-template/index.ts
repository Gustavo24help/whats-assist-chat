import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("📤 Iniciando envio de template...");
    
    const { to, contentSid, contentVariables, templateBody, userId } = await req.json();
    
    console.log("📋 Dados recebidos:", { 
      to, 
      contentSid, 
      contentVariables,
      templateBody: templateBody || '[não fornecido]',
      templateBodyLength: templateBody?.length || 0,
      userId: userId || '[não informado]'
    });
    
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.error("❌ Credenciais não configuradas");
      throw new Error("Credenciais Twilio não configuradas");
    }

    if (!to || !contentSid) {
      console.error("❌ Parâmetros faltando:", { to, contentSid });
      throw new Error("Parâmetros obrigatórios faltando: to, contentSid");
    }

    // Garantir que o número tem o formato correto para WhatsApp
    let whatsappNumber = to;
    if (!to.startsWith('whatsapp:')) {
      const phoneNumber = to.startsWith('+') ? to : `+${to}`;
      whatsappNumber = `whatsapp:${phoneNumber}`;
    }
    
    const whatsappFrom = `whatsapp:${TWILIO_PHONE_NUMBER}`;

    console.log("📞 Enviando de:", whatsappFrom, "para:", whatsappNumber);
    console.log("📄 Content SID:", contentSid);

    // Enviar mensagem usando Content Template
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const authHeader = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const formData = new URLSearchParams();
    formData.append('To', whatsappNumber);
    formData.append('From', whatsappFrom);
    formData.append('ContentSid', contentSid);
    
    if (contentVariables && Object.keys(contentVariables).length > 0) {
      formData.append('ContentVariables', JSON.stringify(contentVariables));
      console.log("Variáveis do template:", JSON.stringify(contentVariables));
    }

    // Adicionar StatusCallback para receber atualizações de status (delivered, read)
    const statusCallbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/update-message-status`;
    formData.append('StatusCallback', statusCallbackUrl);
    console.log('📡 StatusCallback configurado:', statusCallbackUrl);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error("❌ Erro na resposta da Twilio:", {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      });
      
      let errorMessage = `Erro ${response.status}: ${response.statusText}`;
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        // Se não conseguir parsear, usa o texto bruto
        errorMessage += ` - ${responseText}`;
      }
      
      throw new Error(errorMessage);
    }

    const data = JSON.parse(responseText);
    console.log("✅ Template enviado com sucesso via Twilio!", {
      sid: data.sid,
      status: data.status,
      to: data.to,
      templateBody: templateBody || '[não fornecido]',
      willSaveInDB: true,
      nextStep: 'Salvando mensagem no banco de dados'
    });

    // Salvar mensagem no banco de dados
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Se não tiver templateBody, tentar montar a mensagem a partir das variáveis
    let mensagemTexto = templateBody || '';
    
    // Se ainda estiver vazio, criar uma mensagem descritiva
    if (!mensagemTexto || mensagemTexto.trim() === '') {
      if (contentVariables && Object.keys(contentVariables).length > 0) {
        const vars = Object.entries(contentVariables)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        mensagemTexto = `📋 Template com variáveis: ${vars}`;
      } else {
        mensagemTexto = '📋 Template enviado';
      }
    }
    
    console.log("💾 Salvando template no banco:", {
      cliente_id: whatsappNumber,
      texto_preview: mensagemTexto?.substring(0, 100),
      texto_completo_length: mensagemTexto?.length,
      message_sid: data.sid,
      remetente: 'atendente',
      tipo: 'texto',
      status: 'enviado',
      tinha_templateBody: !!templateBody
    });

    const { error: insertError } = await supabase.from('mensagens').insert({
      cliente_id: whatsappNumber,
      remetente: 'atendente',
      texto: mensagemTexto,
      tipo: 'texto',
      arquivo_url: null,
      status: 'enviado',
      data_hora: new Date().toISOString(),
      message_sid: data.sid,
      reply_to_message_id: null,
      enviado_por_id: userId || null,
    });

    if (insertError) {
      console.error("❌ Erro ao inserir mensagem do template:", insertError);
    } else {
      console.log("✅ Mensagem do template salva no banco");
    }

    // Atualizar última interação do cliente
    const { error: updateError } = await supabase
      .from('clientes')
      .update({ ultima_interacao: new Date().toISOString() })
      .eq('telefone', whatsappNumber);

    if (updateError) {
      console.error("❌ Erro ao atualizar cliente:", updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageSid: data.sid,
        status: data.status
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("❌ Erro na função send-template:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "N/A");
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro desconhecido",
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 200, // Retornar 200 mas com success: false para melhor tratamento
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
