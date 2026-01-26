import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  telefone: string;
  bot_status: 'enabled' | 'disabled';
  origem?: 'manual' | 'automatico'; // Origem do desligamento
  executado_por_id?: string; // ID do usuário que executou a ação
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

    const { telefone, bot_status, origem = 'manual', executado_por_id }: RequestBody = await req.json();

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

    console.log(`[toggle-bot-status] Alterando status do bot para ${telefone}: ${bot_status}, origem: ${origem}, executado_por: ${executado_por_id || 'sistema'}`);

    const botHabilitado = bot_status === 'enabled';
    const dataDesabilitado = bot_status === 'disabled' ? new Date().toISOString() : null;
    
    // Lógica da exclamação amarela:
    // - Se desligou MANUALMENTE (botão): NÃO mostrar exclamação (notificacao_vista = true, desligado_manualmente = true)
    // - Se desligou AUTOMATICAMENTE (fim do fluxo): MOSTRAR exclamação (notificacao_vista = false, desligado_manualmente = false)
    // - Se habilitou: limpar tudo
    const isManual = origem === 'manual';
    const desligadoManualmente = bot_status === 'disabled' ? isManual : false;
    const notificacaoVista = bot_status === 'disabled' ? isManual : null;

    // Atualizar status do bot no cliente
    const { error: updateError } = await supabase
      .from('clientes')
      .update({
        bot_habilitado: botHabilitado,
        data_bot_desabilitado: dataDesabilitado,
        bot_desativado_notificacao_vista: notificacaoVista,
        bot_desligado_manualmente: desligadoManualmente,
        // Marcar que o bot já foi desligado alguma vez (só quando desabilitar)
        ...(bot_status === 'disabled' && { bot_ja_desligado_alguma_vez: true })
      })
      .eq('telefone', telefone);

    if (updateError) {
      console.error('[toggle-bot-status] Erro ao atualizar cliente:', updateError);
      throw updateError;
    }

    // Registrar no histórico
    const { error: historicoError } = await supabase
      .from('bot_historico')
      .insert({
        telefone_cliente: telefone,
        acao: bot_status === 'enabled' ? 'ligado' : 'desligado',
        origem: origem,
        executado_por_id: executado_por_id || null,
        observacao: `Bot ${bot_status === 'enabled' ? 'ativado' : 'desativado'} via toggle-bot-status`
      });

    if (historicoError) {
      console.error('[toggle-bot-status] Erro ao registrar histórico:', historicoError);
      // Não falha a operação, apenas loga o erro
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
