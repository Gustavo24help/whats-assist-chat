import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🤖 [reactivate-bots-24h] Função desativada - reativação agora é controlada apenas pelo trigger de 10 dias após Finalizado');
    
    // Esta função foi desativada.
    // A reativação do bot agora acontece apenas:
    // 1. Quando uma ficha é marcada como "Finalizado" - um trigger agenda a reativação para 10 dias depois
    // 2. A função process-bot-reactivation processa esses agendamentos
    //
    // A lógica de reativar bots após 24h de inatividade foi REMOVIDA
    // conforme solicitado pelo usuário.

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Função desativada - reativação agora é controlada apenas pelo trigger de 10 dias após Finalizado',
        processed: 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('💥 Erro no reactivate-bots-24h:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
