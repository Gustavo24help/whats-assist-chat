import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[search-ficha-id] Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized', phones: [] }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { term } = await req.json();
    
    console.log('[search-ficha-id] Searching for term:', term);

    // Validate term
    if (!term || typeof term !== 'string') {
      console.log('[search-ficha-id] Invalid term provided');
      return new Response(
        JSON.stringify({ error: 'Term is required', phones: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedTerm = term.trim();
    
    // Require minimum length for security (avoid too broad searches)
    if (trimmedTerm.length < 3) {
      console.log('[search-ficha-id] Term too short:', trimmedTerm.length);
      return new Response(
        JSON.stringify({ error: 'Term must be at least 3 characters', phones: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with SERVICE ROLE to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Search by ID (primary) and optionally nome_ficha for redundancy
    const { data: fichas, error } = await supabase
      .from('fichas_de_servico')
      .select('id, telefone_cliente')
      .or(`id.ilike.%${trimmedTerm}%,nome_ficha.ilike.%${trimmedTerm}%`);

    if (error) {
      console.error('[search-ficha-id] Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Database error', phones: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!fichas || fichas.length === 0) {
      console.log('[search-ficha-id] No fichas found for term:', trimmedTerm);
      return new Response(
        JSON.stringify({ phones: [], matchedIds: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract unique phone numbers and matched IDs
    const phones = [...new Set(fichas.map(f => f.telefone_cliente))];
    const matchedIds = [...new Set(fichas.map(f => f.id))];

    console.log('[search-ficha-id] Found', phones.length, 'unique phones from', matchedIds.length, 'fichas');

    return new Response(
      JSON.stringify({ phones, matchedIds }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[search-ficha-id] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', phones: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
