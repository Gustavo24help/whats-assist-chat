import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    
    const { to, contentSid, contentVariables } = await req.json();
    
    console.log("📋 Dados recebidos:", { to, contentSid, contentVariables });
    
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
    console.log("✅ Template enviado com sucesso!", {
      sid: data.sid,
      status: data.status,
      to: data.to
    });

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
