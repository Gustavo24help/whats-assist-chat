import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Accept both GET (query params) and POST (body)
    let fichaId: string | null = null;
    let pagamentoLink: string | undefined = undefined;
    let pagamentoRealizado: boolean | undefined = undefined;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      fichaId = url.searchParams.get('ficha_id');
      const linkParam = url.searchParams.get('pagamento_link');
      const realizadoParam = url.searchParams.get('pagamento_realizado');
      
      if (linkParam !== null) pagamentoLink = linkParam;
      if (realizadoParam !== null) pagamentoRealizado = realizadoParam === 'true';
    } else if (req.method === 'POST') {
      const body = await req.json();
      fichaId = body.ficha_id;
      pagamentoLink = body.pagamento_link;
      pagamentoRealizado = body.pagamento_realizado;
    } else {
      return new Response(
        JSON.stringify({ error: 'Método não suportado. Use GET ou POST.' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[update-pagamento] Recebido: ficha_id=${fichaId}, link=${pagamentoLink}, realizado=${pagamentoRealizado}`);

    if (!fichaId) {
      return new Response(
        JSON.stringify({ error: 'ficha_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (pagamentoLink !== undefined) updateData.pagamento_link = pagamentoLink;
    if (pagamentoRealizado !== undefined) updateData.pagamento_realizado = pagamentoRealizado;

    if (Object.keys(updateData).length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum campo para atualizar. Envie pagamento_link e/ou pagamento_realizado.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the ficha
    const { data, error } = await supabase
      .from('fichas_de_servico')
      .update(updateData)
      .eq('id', fichaId)
      .select('id, pagamento_link, pagamento_realizado')
      .single();

    if (error) {
      console.error(`[update-pagamento] Erro ao atualizar ficha: ${error.message}`);
      return new Response(
        JSON.stringify({ error: `Erro ao atualizar ficha: ${error.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: `Ficha ${fichaId} não encontrada` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[update-pagamento] Ficha ${fichaId} atualizada com sucesso`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Ficha ${fichaId} atualizada com sucesso`,
        data 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error(`[update-pagamento] Erro: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
