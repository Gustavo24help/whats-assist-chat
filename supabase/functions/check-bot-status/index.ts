import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  telefone: string;
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

    const { telefone }: RequestBody = await req.json();

    if (!telefone) {
      return new Response(
        JSON.stringify({ error: 'Telefone é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[check-bot-status] Consultando status do bot para ${telefone}`);

    // Buscar status do bot para o cliente
    const { data: cliente, error } = await supabase
      .from('clientes')
      .select('bot_habilitado')
      .eq('telefone', telefone)
      .maybeSingle();

    if (error) {
      console.error('[check-bot-status] Erro ao consultar cliente:', error);
      // Se não encontrar cliente, retornar "enabled" por padrão
      return new Response(
        JSON.stringify({
          bot_status: 'enabled',
          telefone: telefone,
          message: 'Cliente não encontrado, bot habilitado por padrão'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se cliente não existe ou bot_habilitado é null, retornar enabled
    const botStatus = cliente?.bot_habilitado !== false ? 'enabled' : 'disabled';
    
    console.log(`[check-bot-status] Status do bot para ${telefone}: ${botStatus}`);

    return new Response(
      JSON.stringify({
        bot_status: botStatus,
        telefone: telefone
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[check-bot-status] Erro:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
