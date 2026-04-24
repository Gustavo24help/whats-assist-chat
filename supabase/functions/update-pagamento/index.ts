import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Validação de link Asaas (espelha src/lib/asaasLinkValidator.ts)
const ASAAS_HOST_RE = /^(www\.|sandbox\.)?asaas\.com$/i;
const ASAAS_PATH_RE = /^\/(c|i|b\/pix)\/[A-Za-z0-9_-]{4,}$/;

function validateAsaasLink(raw: string | null | undefined): { ok: true; normalized: string } | { ok: false; reason: string } {
  if (!raw || !raw.trim()) return { ok: true, normalized: '' };
  const trimmed = raw.trim();
  let url: URL;
  try { url = new URL(trimmed); } catch {
    return { ok: false, reason: 'URL inválida' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, reason: 'Protocolo inválido' };
  }
  if (!ASAAS_HOST_RE.test(url.hostname)) {
    return { ok: false, reason: `Domínio "${url.hostname}" não é Asaas` };
  }
  if (!ASAAS_PATH_RE.test(url.pathname)) {
    return { ok: false, reason: 'Formato do link Asaas não reconhecido' };
  }
  return { ok: true, normalized: `${url.protocol}//${url.hostname}${url.pathname}` };
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

    if (makeSecret && makeSecret === Deno.env.get('MAKE_SECRET_KEY')) {
      console.log('[update-pagamento] ✅ Autenticado via Make.com secret');
      authSource = 'make';
    } else if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
      if (userError || !userData?.user) {
        return new Response(
          JSON.stringify({ error: 'Token inválido ou expirado', details: userError?.message }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      authenticatedUser = userData.user;
      authSource = 'user';
    } else {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized - Bearer token ou x-make-secret requerido',
          hint: 'Envie Authorization: Bearer <token> OU x-make-secret: <secret>'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    if (!fichaId || typeof fichaId !== 'string' || fichaId.length > 100) {
      return new Response(
        JSON.stringify({ error: 'ficha_id é obrigatório e deve ser válido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== VALIDAÇÃO DE LINK ASAAS =====
    let pagamentoLinkNormalizado: string | null | undefined = undefined;
    if (pagamentoLink !== undefined) {
      if (typeof pagamentoLink === 'string' && pagamentoLink.length > 2000) {
        return new Response(
          JSON.stringify({ error: 'pagamento_link excede o tamanho máximo' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const v = validateAsaasLink(pagamentoLink);
      if (!v.ok) {
        console.warn(`[update-pagamento] ❌ Link inválido para ficha ${fichaId}: ${v.reason}`);
        return new Response(
          JSON.stringify({
            error: 'Link de pagamento inválido',
            reason: v.reason,
            hint: 'Apenas URLs Asaas (asaas.com/c/..., asaas.com/i/..., sandbox.asaas.com) são aceitas.'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      pagamentoLinkNormalizado = v.normalized || null;
    }

    const updateData: Record<string, unknown> = {};
    if (pagamentoLinkNormalizado !== undefined) updateData.pagamento_link = pagamentoLinkNormalizado;
    if (pagamentoRealizado !== undefined) updateData.pagamento_realizado = pagamentoRealizado;

    if (Object.keys(updateData).length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum campo para atualizar.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Snapshot anterior para detectar transição de pagamento_realizado false→true
    const { data: fichaAnterior } = await supabase
      .from('fichas_de_servico')
      .select('pagamento_realizado, recibo_enviado, telefone_cliente')
      .eq('id', fichaId)
      .maybeSingle();

    const { data, error } = await supabase
      .from('fichas_de_servico')
      .update(updateData)
      .eq('id', fichaId)
      .select('id, pagamento_link, pagamento_realizado, telefone_cliente')
      .single();

    if (error) {
      console.error(`[update-pagamento] ❌ Erro: ${error.message}`);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar ficha', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: 'Ficha não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== DISPARO AUTOMÁTICO DE RECIBO =====
    // Só dispara se pagamento_realizado transicionou para true E recibo ainda não foi enviado
    const transitionToPago = pagamentoRealizado === true && fichaAnterior?.pagamento_realizado !== true;
    if (transitionToPago && fichaAnterior?.recibo_enviado !== true && data.telefone_cliente) {
      try {
        const reciboRes = await fetch(`${supabaseUrl}/functions/v1/send-recibo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            ficha_id: fichaId,
            telefone_cliente: data.telefone_cliente,
            origem: authSource === 'make' ? 'make' : 'update-pagamento',
          }),
        });
        const txt = await reciboRes.text();
        console.log(`[update-pagamento] 📧 send-recibo status: ${reciboRes.status} body: ${txt.substring(0, 200)}`);
      } catch (reciboErr) {
        console.warn(`[update-pagamento] ⚠️ Falha não-bloqueante ao disparar recibo:`, reciboErr);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[update-pagamento] ✅ Sucesso em ${duration}ms - Fonte: ${authSource}, Ficha: ${fichaId}`);

    return new Response(
      JSON.stringify({ success: true, data, auth_source: authSource, duration_ms: duration }),
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
