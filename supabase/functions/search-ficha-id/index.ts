import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ===== Authentication: Validate JWT token =====
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', phones: [] }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', phones: [] }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { term } = await req.json();

    if (!term || typeof term !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Term is required', phones: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedTerm = term.trim().substring(0, 100); // Limit length

    if (trimmedTerm.length < 3) {
      return new Response(
        JSON.stringify({ error: 'Term must be at least 3 characters', phones: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize: only allow alphanumeric, spaces, hyphens
    const sanitized = trimmedTerm.replace(/[^a-zA-Z0-9\s\-_àáâãéêíóôõúüçÀÁÂÃÉÊÍÓÔÕÚÜÇ]/g, '');
    if (sanitized.length < 3) {
      return new Response(
        JSON.stringify({ error: 'Invalid search term', phones: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: fichas, error } = await supabase
      .from('fichas_de_servico')
      .select('id, telefone_cliente')
      .or(`id.ilike.%${sanitized}%,nome_ficha.ilike.%${sanitized}%`)
      .limit(50);

    if (error) {
      console.error('[search-ficha-id] Database error');
      return new Response(
        JSON.stringify({ error: 'Database error', phones: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!fichas || fichas.length === 0) {
      return new Response(
        JSON.stringify({ phones: [], matchedIds: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const phones = [...new Set(fichas.map(f => f.telefone_cliente))];
    const matchedIds = [...new Set(fichas.map(f => f.id))];

    return new Response(
      JSON.stringify({ phones, matchedIds }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[search-ficha-id] Unexpected error');
    return new Response(
      JSON.stringify({ error: 'Internal server error', phones: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
