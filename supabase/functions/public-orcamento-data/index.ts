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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action } = body;

    if (action === 'verificar-ficha') {
      const { ficha_id } = body;
      if (!ficha_id || typeof ficha_id !== 'string') {
        return new Response(JSON.stringify({ success: false, error: 'ficha_id obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: ficha, error } = await supabase
        .from('fichas_de_servico')
        .select('id, nome_ficha, descricao, formulario_orcamento_ativo, categoria_id, categorias(nome), prestador_id, prestadores(nome)')
        .eq('id', ficha_id)
        .maybeSingle();

      if (error || !ficha) {
        return new Response(JSON.stringify({ success: false, error: 'Ficha não encontrada' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: categorias } = await supabase
        .from('categorias')
        .select('id, nome')
        .order('nome');

      return new Response(JSON.stringify({ success: true, ficha, categorias: categorias || [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'validar-cpf') {
      const { cpf } = body;
      if (!cpf || typeof cpf !== 'string' || cpf.replace(/\D/g, '').length !== 11) {
        return new Response(JSON.stringify({ success: false, valido: false }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const cpfLimpo = cpf.replace(/\D/g, '');
      const { data } = await supabase
        .from('prestadores')
        .select('cpf, nome')
        .eq('cpf', cpfLimpo)
        .maybeSingle();

      return new Response(JSON.stringify({
        success: true,
        valido: !!data,
        nome: data?.nome || null,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'inserir-orcamento') {
      const { orcamento } = body;
      if (!orcamento || !orcamento.ficha_nome || !orcamento.prestador_cpf) {
        return new Response(JSON.stringify({ success: false, error: 'Dados incompletos' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify ficha still active
      const { data: ficha } = await supabase
        .from('fichas_de_servico')
        .select('id, formulario_orcamento_ativo')
        .eq('id', orcamento.ficha_nome)
        .maybeSingle();

      if (!ficha) {
        return new Response(JSON.stringify({ success: false, error: 'Ficha não encontrada' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!ficha.formulario_orcamento_ativo) {
        return new Response(JSON.stringify({ success: false, error: 'Formulário encerrado' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await supabase
        .from('orcamentos')
        .insert([orcamento]);

      if (error) {
        console.error('[public-orcamento-data] Insert error:', error);
        return new Response(JSON.stringify({ success: false, error: 'Erro ao salvar orçamento' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Ação inválida' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[public-orcamento-data] Error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});