import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ASAAS_API_URL = 'https://api.asaas.com/v3';

interface ReconcileResult {
  ficha_id: string;
  link_id: string;
  status: 'paid' | 'pending' | 'not_found' | 'error' | 'already_paid';
  payment_id?: string;
  detail?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[reconcile-asaas-payments] Iniciando reconciliação');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const asaasApiKey = Deno.env.get('ASAAS_API_KEY');

    if (!asaasApiKey) {
      return new Response(
        JSON.stringify({ error: 'ASAAS_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json().catch(() => ({}));
    const onlyFichaId: string | undefined = body?.ficha_id;

    // Buscar fichas pendentes com link Asaas
    let query = supabase
      .from('fichas_de_servico')
      .select('id, valor_total, pagamento_link, status, pagamento_realizado')
      .eq('status', 'Finalizado')
      .or('pagamento_realizado.is.null,pagamento_realizado.eq.false')
      .gt('valor_total', 0)
      .like('pagamento_link', '%asaas.com/c/%');

    if (onlyFichaId) query = query.eq('id', onlyFichaId);

    const { data: fichas, error: fichasError } = await query;
    if (fichasError) throw fichasError;

    console.log(`[reconcile-asaas-payments] ${fichas?.length || 0} fichas a verificar`);

    const results: ReconcileResult[] = [];

    for (const ficha of fichas || []) {
      const linkMatch = ficha.pagamento_link?.match(/asaas\.com\/c\/([a-z0-9]+)/i);
      const linkShortId = linkMatch?.[1];
      if (!linkShortId) {
        results.push({ ficha_id: ficha.id, link_id: '', status: 'error', detail: 'Link inválido' });
        continue;
      }

      try {
        // 1. Buscar paymentLink pelo shortId
        const linkResp = await fetch(`${ASAAS_API_URL}/paymentLinks?limit=10&name=`, {
          headers: { 'access_token': asaasApiKey },
        });
        // Melhor: buscar por externalReference se existir, senão listar pagamentos pelo paymentLink
        // Primeiro tentamos via /payments?externalReference
        const byRefResp = await fetch(
          `${ASAAS_API_URL}/payments?externalReference=${encodeURIComponent(ficha.id)}&limit=20`,
          { headers: { 'access_token': asaasApiKey } }
        );
        const byRefData = await byRefResp.json();

        let payments: any[] = byRefData?.data || [];

        // Se nada por externalReference, tentar listar pagamentos do paymentLink (precisamos do ID interno)
        if (payments.length === 0) {
          // Buscar paymentLink por URL não é direto; usamos endpoint /paymentLinks/{id}/payments
          // Como não temos o ID interno, listamos paymentLinks e procuramos pela URL
          const linksResp = await fetch(`${ASAAS_API_URL}/paymentLinks?limit=100`, {
            headers: { 'access_token': asaasApiKey },
          });
          const linksData = await linksResp.json();
          const matchedLink = (linksData?.data || []).find((l: any) => l.url === ficha.pagamento_link);

          if (matchedLink?.id) {
            const linkPaymentsResp = await fetch(
              `${ASAAS_API_URL}/payments?paymentLink=${matchedLink.id}&limit=20`,
              { headers: { 'access_token': asaasApiKey } }
            );
            const linkPaymentsData = await linkPaymentsResp.json();
            payments = linkPaymentsData?.data || [];
          }
        }

        // Procurar pagamento confirmado (RECEIVED ou CONFIRMED)
        const paid = payments.find((p) =>
          ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status)
        );

        if (!paid) {
          results.push({
            ficha_id: ficha.id,
            link_id: linkShortId,
            status: payments.length === 0 ? 'not_found' : 'pending',
            detail: `${payments.length} pagamento(s) encontrado(s), nenhum confirmado`,
          });
          continue;
        }

        // Atualizar ficha como paga
        const nowIso = new Date().toISOString();
        const { error: updErr } = await supabase
          .from('fichas_de_servico')
          .update({
            pagamento_realizado: true,
            notas: null, // mantém notas existentes via concat abaixo
            updated_at: nowIso,
          })
          .eq('id', ficha.id);

        // append nota
        const { data: fichaAtual } = await supabase
          .from('fichas_de_servico')
          .select('notas')
          .eq('id', ficha.id)
          .single();
        const novaNota = `\n[${nowIso}] Pagamento reconciliado via Asaas (payment ${paid.id}, R$ ${paid.value})`;
        await supabase
          .from('fichas_de_servico')
          .update({ notas: (fichaAtual?.notas || '') + novaNota })
          .eq('id', ficha.id);

        // Atualizar contas_receber
        await supabase.from('contas_receber').upsert(
          {
            ficha_id: ficha.id,
            cliente_telefone: 'reconcile',
            status: 'pago',
            data_pagamento: nowIso.slice(0, 10),
            asaas_id: paid.id,
            asaas_status: paid.status,
            updated_at: nowIso,
          },
          { onConflict: 'ficha_id', ignoreDuplicates: false }
        );

        // Auditoria
        await supabase.from('automation_audit').insert({
          ficha_id: ficha.id,
          etapa: 'reconcile_asaas',
          status: 'success',
          payment_id: paid.id,
          detalhe: `Reconciliado: status=${paid.status}, valor=${paid.value}`,
        });

        results.push({
          ficha_id: ficha.id,
          link_id: linkShortId,
          status: 'paid',
          payment_id: paid.id,
          detail: `R$ ${paid.value} (${paid.status})`,
        });
      } catch (err) {
        console.error(`[reconcile] Erro na ficha ${ficha.id}:`, err);
        results.push({
          ficha_id: ficha.id,
          link_id: linkShortId,
          status: 'error',
          detail: err instanceof Error ? err.message : 'erro desconhecido',
        });
      }
    }

    const summary = {
      total: results.length,
      paid: results.filter((r) => r.status === 'paid').length,
      pending: results.filter((r) => r.status === 'pending').length,
      not_found: results.filter((r) => r.status === 'not_found').length,
      errors: results.filter((r) => r.status === 'error').length,
    };

    console.log('[reconcile-asaas-payments] Concluído:', summary);

    return new Response(
      JSON.stringify({ success: true, summary, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[reconcile-asaas-payments] 💥 Erro:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'erro' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
