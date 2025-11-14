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
    console.log('🤖 [reactivate-bots-24h] Iniciando verificação de bots...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calcular timestamp de 24 horas atrás
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    console.log('⏰ Timestamp de corte (24h atrás):', twentyFourHoursAgo);

    // Buscar clientes com bot desabilitado E última interação > 24h atrás
    const { data: clientes, error: fetchError } = await supabase
      .from('clientes')
      .select('telefone, nome, ultima_interacao, bot_habilitado, data_bot_desabilitado')
      .eq('bot_habilitado', false)
      .lt('ultima_interacao', twentyFourHoursAgo);

    if (fetchError) {
      console.error('❌ Erro ao buscar clientes:', fetchError);
      throw fetchError;
    }

    console.log(`🔍 Encontrados ${clientes?.length || 0} clientes com bot desabilitado e janela de 24h fechada`);

    if (!clientes || clientes.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum bot para reativar',
          processed: 0
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Reativar cada bot
    let reactivated = 0;
    let errors = 0;

    for (const cliente of clientes) {
      console.log(`🔄 Reativando bot para: ${cliente.nome} (${cliente.telefone})`);
      console.log(`   Última interação: ${cliente.ultima_interacao}`);
      console.log(`   Data desabilitação: ${cliente.data_bot_desabilitado}`);
      
      const { error: updateError } = await supabase
        .from('clientes')
        .update({
          bot_habilitado: true,
          data_bot_desabilitado: null,
          bot_desativado_notificacao_vista: false
        })
        .eq('telefone', cliente.telefone);

      if (updateError) {
        console.error(`❌ Erro ao reativar bot para ${cliente.telefone}:`, updateError);
        errors++;
      } else {
        console.log(`✅ Bot reativado para ${cliente.nome}`);
        reactivated++;
      }
    }

    console.log(`🎉 Reativação concluída: ${reactivated} bots reativados, ${errors} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: clientes.length,
        reactivated,
        errors,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('💥 Erro no reactivate-bots-24h:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
