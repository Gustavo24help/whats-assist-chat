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
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error("Credenciais Twilio não configuradas");
    }

    console.log("Buscando templates aprovados da Twilio...");

    // Buscar content templates aprovados (WhatsApp Business)
    const url = `https://content.twilio.com/v1/Content`;
    
    const authHeader = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro ao buscar templates:", errorText);
      throw new Error(`Erro ao buscar templates: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Templates recuperados:", data);

    // Filtrar apenas templates aprovados para WhatsApp
    const whatsappTemplates = (data.contents || []).filter((template: any) => 
      template.types && 
      template.types['twilio/text'] && 
      template.approval_requests &&
      template.approval_requests.whatsapp === 'approved'
    );

    console.log(`${whatsappTemplates.length} templates aprovados encontrados`);

    return new Response(
      JSON.stringify({ success: true, templates: whatsappTemplates }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
