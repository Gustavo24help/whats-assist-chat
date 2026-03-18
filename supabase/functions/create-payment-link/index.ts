import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const ASAAS_API_URL = 'https://api.asaas.com/v3';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[create-payment-link] Nova requisição recebida');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const asaasApiKey = Deno.env.get('ASAAS_API_KEY');

    if (!asaasApiKey) {
      console.error('[create-payment-link] ❌ ASAAS_API_KEY não configurada');
      return new Response(
        JSON.stringify({ error: 'ASAAS_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Autenticação do usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Token de autenticação requerido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[create-payment-link] ✅ Usuário: ${userData.user.email}`);

    const body = await req.json();
    const { ficha_id, nome_cliente, valor, descricao, forma_pagamento, parcelas } = body;

    if (!ficha_id) {
      return new Response(
        JSON.stringify({ error: 'ficha_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!valor || valor <= 0) {
      return new Response(
        JSON.stringify({ error: 'Valor deve ser maior que zero. Preencha o valor total na ficha antes de gerar o link.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[create-payment-link] 📋 Ficha: ${ficha_id}, Valor: R$${valor}, Parcelas: ${parcelas || 1}`);

    // Determinar billingType do Asaas
    let billingType = 'UNDEFINED'; // Permite todas as formas
    if (forma_pagamento === 'pix') billingType = 'PIX';
    else if (forma_pagamento === 'cartao_credito') billingType = 'CREDIT_CARD';
    else if (forma_pagamento === 'boleto') billingType = 'BOLETO';

    // Criar link de pagamento no Asaas
    const asaasPayload: Record<string, unknown> = {
      name: `${ficha_id} - ${nome_cliente || 'Cliente'}`,
      description: descricao || `Serviço ${ficha_id}`,
      value: valor,
      billingType,
      chargeType: 'DETACHED', // link avulso
      dueDateLimitDays: 30,
      externalReference: ficha_id, // Para matching no webhook Asaas
      ...(parcelas && parcelas > 1 && billingType === 'CREDIT_CARD' ? {
        maxInstallmentCount: parcelas,
      } : {}),
    };

    console.log('[create-payment-link] 📤 Payload Asaas:', JSON.stringify(asaasPayload));

    const asaasResponse = await fetch(`${ASAAS_API_URL}/paymentLinks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': asaasApiKey,
      },
      body: JSON.stringify(asaasPayload),
    });

    const asaasData = await asaasResponse.json();

    if (!asaasResponse.ok) {
      console.error(`[create-payment-link] ❌ Asaas erro (${asaasResponse.status}):`, JSON.stringify(asaasData));
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao criar link no Asaas',
          details: asaasData,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paymentUrl = asaasData.url;
    console.log(`[create-payment-link] ✅ Link criado: ${paymentUrl}`);

    // Atualizar a ficha com o link
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { error: updateError } = await supabase
      .from('fichas_de_servico')
      .update({ pagamento_link: paymentUrl })
      .eq('id', ficha_id);

    if (updateError) {
      console.error(`[create-payment-link] ⚠️ Link criado mas erro ao salvar na ficha:`, updateError.message);
    } else {
      console.log(`[create-payment-link] ✅ Link salvo na ficha ${ficha_id}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[create-payment-link] ✅ Concluído em ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        payment_url: paymentUrl,
        asaas_id: asaasData.id,
        duration_ms: duration,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error(`[create-payment-link] 💥 Erro:`, err);
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: err instanceof Error ? err.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
