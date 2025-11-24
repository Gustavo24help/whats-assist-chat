import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    console.log('Orçamento recebido:', orcamentoData);

    // Buscar webhook configurado
    const { data: config } = await supabaseClient
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'webhook_orcamento')
      .single();

    if (config?.valor) {
      console.log('Enviando para webhook:', config.valor);
      
      // Preparar payload para o Make
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

      // Enviar para webhook do Make
      const webhookResponse = await fetch(config.valor, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });

      if (!webhookResponse.ok) {
        console.error('Erro ao enviar webhook:', await webhookResponse.text());
      } else {
        console.log('Webhook enviado com sucesso');
      }
    } else {
      console.log('Webhook não configurado');
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Orçamento processado com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao processar orçamento:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
