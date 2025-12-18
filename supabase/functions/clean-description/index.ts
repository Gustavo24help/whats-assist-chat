import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { descricao } = await req.json();
    
    if (!descricao || descricao.trim() === '') {
      return new Response(
        JSON.stringify({ descricaoLimpa: 'Serviço realizado conforme solicitação' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY não configurada');
      return new Response(
        JSON.stringify({ descricaoLimpa: descricao }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente que limpa e simplifica descrições de serviços para recibos.

Regras:
1. Remova completamente qualquer texto como "Não informado", "N/A", "Cliente não informou", "não especificado", "sem informação"
2. Remova menções a "cliente enviou imagens", "fotos anexadas", etc.
3. Simplifique a descrição mantendo APENAS o essencial do serviço realizado
4. Use linguagem profissional e concisa
5. Se a descrição original estiver muito vaga ou vazia, retorne apenas "Serviço realizado"
6. Máximo de 150 caracteres
7. Retorne APENAS o texto limpo, sem explicações ou formatação adicional`
          },
          {
            role: 'user',
            content: `Limpe e simplifique esta descrição de serviço para um recibo:\n\n"${descricao}"`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na API:', response.status, errorText);
      
      // Fallback: limpar manualmente
      let descricaoLimpa = descricao
        .replace(/não informado/gi, '')
        .replace(/n\/a/gi, '')
        .replace(/cliente enviou imagens?/gi, '')
        .replace(/fotos? anexadas?/gi, '')
        .replace(/sem informação/gi, '')
        .replace(/não especificado/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (!descricaoLimpa || descricaoLimpa.length < 5) {
        descricaoLimpa = 'Serviço realizado conforme solicitação';
      }
      
      return new Response(
        JSON.stringify({ descricaoLimpa }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    let descricaoLimpa = data.choices?.[0]?.message?.content?.trim() || descricao;
    
    // Garantir que não está vazio
    if (!descricaoLimpa || descricaoLimpa.length < 3) {
      descricaoLimpa = 'Serviço realizado conforme solicitação';
    }
    
    // Limitar tamanho
    if (descricaoLimpa.length > 200) {
      descricaoLimpa = descricaoLimpa.substring(0, 197) + '...';
    }

    console.log('Descrição original:', descricao);
    console.log('Descrição limpa:', descricaoLimpa);

    return new Response(
      JSON.stringify({ descricaoLimpa }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função clean-description:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage, descricaoLimpa: 'Serviço realizado' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
