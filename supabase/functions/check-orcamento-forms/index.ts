import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Verificando formulários de orçamento para encerramento...');

    // Encerrar formulários que tiveram primeiro orçamento há mais de 2 horas
    const { data, error } = await supabaseClient
      .from('fichas_de_servico')
      .update({
        formulario_orcamento_ativo: false,
        formulario_orcamento_encerrado_em: new Date().toISOString(),
      })
      .eq('formulario_orcamento_ativo', true)
      .not('formulario_orcamento_data_primeiro_envio', 'is', null)
      .lt('formulario_orcamento_data_primeiro_envio', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      .is('formulario_orcamento_encerrado_em', null)
      .select();

    if (error) {
      console.error('Erro ao encerrar formulários:', error);
      throw error;
    }

    console.log(`${data?.length || 0} formulários encerrados`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        encerrados: data?.length || 0,
        message: `${data?.length || 0} formulários foram encerrados` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao verificar formulários:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
