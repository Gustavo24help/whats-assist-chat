import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  telefone: string;
  bot_status: 'enabled' | 'disabled';
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { telefone, bot_status }: RequestBody = await req.json();

    // Validar inputs
    if (!telefone) {
      return new Response(
        JSON.stringify({ error: 'Telefone é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!bot_status || !['enabled', 'disabled'].includes(bot_status)) {
      return new Response(
        JSON.stringify({ error: 'bot_status deve ser "enabled" ou "disabled"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[toggle-bot-status] Alterando status do bot para ${telefone}: ${bot_status}`);

    const botHabilitado = bot_status === 'enabled';
    const dataDesabilitado = bot_status === 'disabled' ? new Date().toISOString() : null;
    const notificacaoVista = bot_status === 'disabled' ? false : null;
    // Marcar como desligado manualmente quando desabilitar, limpar quando habilitar
    const desligadoManualmente = bot_status === 'disabled' ? true : false;

    // Atualizar status do bot no cliente
    const { error: updateError } = await supabase
      .from('clientes')
      .update({
        bot_habilitado: botHabilitado,
        data_bot_desabilitado: dataDesabilitado,
        bot_desativado_notificacao_vista: notificacaoVista,
        bot_desligado_manualmente: desligadoManualmente
      })
      .eq('telefone', telefone);

    if (updateError) {
      console.error('[toggle-bot-status] Erro ao atualizar cliente:', updateError);
      throw updateError;
    }

    console.log(`[toggle-bot-status] ✅ Status do bot atualizado para ${telefone}: ${bot_status}`);

    return new Response(
      JSON.stringify({
        success: true,
        telefone: telefone,
        bot_status: bot_status,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[toggle-bot-status] Erro:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
