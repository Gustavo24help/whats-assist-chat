import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Iniciando busca de templates da Twilio...");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.error("Credenciais não configuradas");
      throw new Error("Credenciais Twilio não configuradas");
    }

    // Buscar content templates aprovados (WhatsApp Business)
    const url = `https://content.twilio.com/v1/Content`;
    const authHeader = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    
    console.log("Fazendo requisição para:", url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro na resposta da Twilio:", response.status, errorText);
      throw new Error(`Erro ao buscar templates: ${response.status}`);
    }

    const data = await response.json();
    console.log("Resposta recebida, total de conteúdos:", data.contents?.length || 0);

    // Filtrar templates aprovados para WhatsApp
    const whatsappTemplates = (data.contents || []).filter((template: any) => {
      const hasWhatsAppApproval = template.approval_requests?.whatsapp === 'approved';
      const hasTextType = template.types && template.types['twilio/text'];
      return hasWhatsAppApproval && hasTextType;
    });

    console.log(`${whatsappTemplates.length} templates aprovados encontrados`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        templates: whatsappTemplates,
        total: whatsappTemplates.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Erro na função:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro desconhecido",
        templates: []
      }),
      { 
        status: 200, // Retornar 200 mas com success: false
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
