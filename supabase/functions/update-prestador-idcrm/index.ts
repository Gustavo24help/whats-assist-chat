import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cpf, id_crm } = await req.json();
    
    console.log("Atualizando id_crm do prestador:", { cpf, id_crm });

    if (!cpf || !id_crm) {
      throw new Error('CPF e ID_CRM são obrigatórios');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar se o prestador existe
    const { data: prestadorExistente, error: checkError } = await supabase
      .from('prestadores')
      .select('*')
      .eq('cpf', cpf)
      .maybeSingle();

    if (checkError) {
      console.error("Erro ao verificar prestador:", checkError);
      throw new Error(`Erro ao verificar prestador: ${checkError.message}`);
    }

    if (!prestadorExistente) {
      console.error("Prestador não encontrado:", cpf);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Prestador não encontrado',
          cpf
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log("Prestador encontrado:", prestadorExistente);

    // Atualizar o id_crm usando cpf como filtro
    const { data: updatedData, error: updateError } = await supabase
      .from('prestadores')
      .update({ id_crm })
      .eq('cpf', cpf)
      .select()
      .single();

    if (updateError) {
      console.error("Erro ao atualizar id_crm:", updateError);
      throw new Error(`Erro ao atualizar id_crm: ${updateError.message}`);
    }

    console.log("ID_CRM atualizado com sucesso:", updatedData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        prestador: updatedData,
        message: `ID_CRM atualizado para ${id_crm}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error("Erro ao processar atualização:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
