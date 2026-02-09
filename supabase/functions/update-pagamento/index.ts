import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // ===== Authentication =====
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Input validation
    if (!fichaId || typeof fichaId !== 'string' || fichaId.length > 100) {
      return new Response(
        JSON.stringify({ error: 'ficha_id é obrigatório e deve ser válido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (pagamentoLink !== undefined && typeof pagamentoLink === 'string' && pagamentoLink.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'pagamento_link excede o tamanho máximo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[update-pagamento] Recebido: ficha_id=${fichaId}, executado_por=${userData.user.id}`);

    const updateData: Record<string, unknown> = {};
    if (pagamentoLink !== undefined) updateData.pagamento_link = pagamentoLink;
    if (pagamentoRealizado !== undefined) updateData.pagamento_realizado = pagamentoRealizado;

    if (Object.keys(updateData).length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum campo para atualizar.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data, error } = await supabase
      .from('fichas_de_servico')
      .update(updateData)
      .eq('id', fichaId)
      .select('id, pagamento_link, pagamento_realizado')
      .single();

    if (error) {
      console.error(`[update-pagamento] Erro ao atualizar ficha: ${error.message}`);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar ficha' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: 'Ficha não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error(`[update-pagamento] Erro interno`);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
