import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Buscando informações do template...");
    
    const { contentSid } = await req.json();
    
    if (!contentSid) {
      throw new Error("contentSid é obrigatório");
    }
    
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.error("Credenciais não configuradas");
      throw new Error("Credenciais Twilio não configuradas");
    }

    console.log("Fazendo requisição para:", `https://content.twilio.com/v1/Content/${contentSid}`);

    const authHeader = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const response = await fetch(`https://content.twilio.com/v1/Content/${contentSid}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authHeader}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro na resposta da Twilio:", response.status, errorText);
      throw new Error(`Erro ao buscar template: ${response.status}`);
    }

    const template = await response.json();
    console.log("📋 Template encontrado:", template.friendly_name);
    console.log("📋 Tipos disponíveis:", Object.keys(template.types || {}));

    // Buscar body em diferentes tipos de template
    // Ordem de prioridade: quick-reply (botões) > text > list-picker > call-to-action
    let body = '';
    let templateType = '';
    
    if (template.types?.['twilio/quick-reply']?.body) {
      body = template.types['twilio/quick-reply'].body;
      templateType = 'quick-reply';
      console.log("✅ Body encontrado em quick-reply");
    } else if (template.types?.['twilio/text']?.body) {
      body = template.types['twilio/text'].body;
      templateType = 'text';
      console.log("✅ Body encontrado em text");
    } else if (template.types?.['twilio/list-picker']?.body) {
      body = template.types['twilio/list-picker'].body;
      templateType = 'list-picker';
      console.log("✅ Body encontrado em list-picker");
    } else if (template.types?.['twilio/call-to-action']?.body) {
      body = template.types['twilio/call-to-action'].body;
      templateType = 'call-to-action';
      console.log("✅ Body encontrado em call-to-action");
    } else {
      console.warn("⚠️ Nenhum body encontrado nos tipos conhecidos");
      console.log("Tipos disponíveis:", JSON.stringify(template.types, null, 2));
    }

    // Extrair variáveis do body
    const variables = [...body.matchAll(/\{\{(\d+)\}\}/g)].map(match => match[1]);
    
    console.log("📝 Variáveis encontradas:", variables);
    console.log("📝 Body extraído:", body.substring(0, 100) + (body.length > 100 ? '...' : ''));

    return new Response(
      JSON.stringify({ 
        success: true,
        template: {
          sid: template.sid,
          friendly_name: template.friendly_name,
          body: body,
          variables: variables,
          type: templateType,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Erro na função:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
