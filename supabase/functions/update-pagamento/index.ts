import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[update-pagamento] Nova requisição recebida');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // ===== AUTENTICAÇÃO FLEXÍVEL =====
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    const makeSecret = req.headers.get('x-make-secret');
    
    let authenticatedUser = null;
    let authSource = 'none';

    // Opção 1: Chamada do Make.com com secret
    if (makeSecret && makeSecret === Deno.env.get('MAKE_SECRET_KEY')) {
      console.log('[update-pagamento] ✅ Autenticado via Make.com secret');
      authSource = 'make';
    }
    // Opção 2: Chamada autenticada de usuário
    else if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      console.log('[update-pagamento] Tentando autenticar usuário...');
      
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      
      const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
      
      if (userError || !userData?.user) {
        console.error('[update-pagamento] ❌ Erro ao validar token:', userError?.message);
        console.error('[update-pagamento] Token recebido (primeiros 50 chars):', token.substring(0, 50));
        
        return new Response(
          JSON.stringify({ 
            error: 'Token inválido ou expirado',
            details: userError?.message 
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      authenticatedUser = userData.user;
      authSource = 'user';
      console.log(`[update-pagamento] ✅ Autenticado como usuário: ${authenticatedUser.email}`);
    }
    // Rejeitar se não tem nenhuma autenticação válida
    else {
      console.error('[update-pagamento] ❌ Nenhuma autenticação válida encontrada');
      console.error('[update-pagamento] Headers recebidos:', {
        hasAuth: !!authHeader,
        hasMakeSecret: !!makeSecret,
        authPrefix: authHeader?.substring(0, 20)
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized - Bearer token ou x-make-secret requerido',
          hint: 'Envie Authorization: Bearer <token> OU x-make-secret: <secret>' 
        }),
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

    console.log(`[update-pagamento] Parâmetros: ficha_id=${fichaId}, link=${!!pagamentoLink}, realizado=${pagamentoRealizado}`);

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
      console.error(`[update-pagamento] ❌ Erro ao atualizar ficha: ${error.message}`);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar ficha', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data) {
      console.error(`[update-pagamento] ❌ Ficha não encontrada: ${fichaId}`);
      return new Response(
        JSON.stringify({ error: 'Ficha não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[update-pagamento] ✅ Sucesso em ${duration}ms - Fonte: ${authSource}, Ficha: ${fichaId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data,
        auth_source: authSource,
        duration_ms: duration
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error(`[update-pagamento] 💥 Erro interno:`, err);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: err instanceof Error ? err.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});