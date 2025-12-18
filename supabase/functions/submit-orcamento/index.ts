import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// Declare EdgeRuntime for Supabase Edge Functions
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para enviar webhook de forma assíncrona (não bloqueia a resposta)
async function sendWebhookAsync(webhookUrl: string, payload: Record<string, unknown>) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // Timeout de 10 segundos
  
  try {
    console.log('📤 Enviando webhook para:', webhookUrl);
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error('❌ Erro ao enviar webhook:', await response.text());
    } else {
      console.log('✅ Webhook enviado com sucesso');
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
    console.log('📝 Orçamento recebido:', orcamentoData);

    // Buscar webhook configurado
    const { data: config } = await supabaseClient
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'webhook_orcamento')
      .single();

    // Retornar sucesso IMEDIATAMENTE para o cliente
    // O webhook será enviado em background
    const response = new Response(
      JSON.stringify({ success: true, message: 'Orçamento processado com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    // Enviar webhook de forma assíncrona (não bloqueia a resposta)
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

      // Usar EdgeRuntime.waitUntil para processar em background
      EdgeRuntime.waitUntil(sendWebhookAsync(config.valor, webhookPayload));
    } else {
      console.log('⚠️ Webhook não configurado');
    }

    return response;
  } catch (error) {
    console.error('❌ Erro ao processar orçamento:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
