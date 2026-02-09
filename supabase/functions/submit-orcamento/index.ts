import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendWebhookAsync(webhookUrl: string, payload: Record<string, unknown>) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error('❌ Erro ao enviar webhook:', await response.text());
    }
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('⏱️ Webhook timeout após 10 segundos');
    } else {
      console.error('❌ Erro ao enviar webhook:', error);
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const orcamentoData = await req.json();

    // ===== Input Validation =====
    if (!orcamentoData.ficha_nome || typeof orcamentoData.ficha_nome !== 'string' || orcamentoData.ficha_nome.length > 200) {
      return new Response(
        JSON.stringify({ success: false, error: 'ficha_nome inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!orcamentoData.prestador_cpf || typeof orcamentoData.prestador_cpf !== 'string' || orcamentoData.prestador_cpf.length > 20) {
      return new Response(
        JSON.stringify({ success: false, error: 'prestador_cpf inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate numeric fields
    const numericFields = ['valor_mao_obra', 'valor_pecas', 'valor_total', 'porcentagem_desconto'];
    for (const field of numericFields) {
      if (orcamentoData[field] !== undefined && orcamentoData[field] !== null) {
        const val = Number(orcamentoData[field]);
        if (isNaN(val) || val < 0 || val > 99999999) {
          return new Response(
            JSON.stringify({ success: false, error: `${field} inválido` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Validate string length limits
    if (orcamentoData.observacoes && (typeof orcamentoData.observacoes !== 'string' || orcamentoData.observacoes.length > 2000)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Observações excede limite' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (orcamentoData.prestador_nome && (typeof orcamentoData.prestador_nome !== 'string' || orcamentoData.prestador_nome.length > 200)) {
      return new Response(
        JSON.stringify({ success: false, error: 'prestador_nome inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate ficha exists
    const { data: fichaExists } = await supabaseClient
      .from('fichas_de_servico')
      .select('id')
      .eq('id', orcamentoData.ficha_nome)
      .maybeSingle();

    if (!fichaExists) {
      return new Response(
        JSON.stringify({ success: false, error: 'Ficha não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate prestador exists
    const { data: prestadorExists } = await supabaseClient
      .from('prestadores')
      .select('cpf')
      .eq('cpf', orcamentoData.prestador_cpf)
      .maybeSingle();

    if (!prestadorExists) {
      return new Response(
        JSON.stringify({ success: false, error: 'Prestador não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📝 Orçamento válido, processando');

    // Buscar webhook configurado
    const { data: config } = await supabaseClient
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'webhook_orcamento')
      .single();

    const response = new Response(
      JSON.stringify({ success: true, message: 'Orçamento processado com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    if (config?.valor) {
      const webhookPayload = {
        ficha_id: orcamentoData.ficha_nome,
        prestador_cpf: orcamentoData.prestador_cpf,
        prestador_nome: orcamentoData.prestador_nome,
        categoria: orcamentoData.categoria,
        valor_mao_obra: orcamentoData.valor_mao_obra,
        valor_pecas: orcamentoData.valor_pecas,
        valor_total: orcamentoData.valor_total,
        tempo_servico: orcamentoData.tempo_servico,
        pode_horario: orcamentoData.pode_horario,
        servico_adicional: orcamentoData.servico_adicional,
        observacoes: orcamentoData.observacoes,
        porcentagem_desconto: orcamentoData.porcentagem_desconto,
        data_criacao: new Date().toISOString(),
      };

      EdgeRuntime.waitUntil(sendWebhookAsync(config.valor, webhookPayload));
    }

    return response;
  } catch (error) {
    console.error('❌ Erro ao processar orçamento');
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno ao processar orçamento' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
