import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoogleAdsMetric {
  data_referencia: string; // YYYY-MM-DD
  impressoes: number;
  cliques: number;
  conversoes: number;
  custo: number;
  ctr?: number;
  cpa?: number;
  campanha?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar método - DEVE ser POST
    if (req.method !== 'POST') {
      console.log('[sync-google-ads] Método incorreto:', req.method);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Method not allowed. Use POST with JSON body.',
          expected_format: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: {
              data_referencia: '2025-01-15',
              impressoes: 1000,
              cliques: 50,
              conversoes: 5,
              custo: 100.50,
              campanha: 'Nome da Campanha (opcional)'
            }
          }
        }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar se há body
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Content-Type must be application/json' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body;
    try {
      const text = await req.text();
      if (!text || text.trim() === '') {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Request body is empty. Send JSON with metrics data.' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      body = JSON.parse(text);
    } catch (parseError) {
      console.error('[sync-google-ads] JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid JSON in request body' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[sync-google-ads] Received payload:', JSON.stringify(body, null, 2));

    // Suporta tanto um único objeto quanto um array de métricas
    const metrics: GoogleAdsMetric[] = Array.isArray(body) ? body : [body];

    if (metrics.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No metrics provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const metric of metrics) {
      // Validar campos obrigatórios
      if (!metric.data_referencia) {
        console.error('[sync-google-ads] Missing data_referencia in metric:', metric);
        results.push({ error: 'Missing data_referencia', metric });
        continue;
      }

      // Calcular CTR e CPA se não fornecidos
      const ctr = metric.ctr ?? (metric.impressoes > 0 
        ? (metric.cliques / metric.impressoes) * 100 
        : 0);
      
      const cpa = metric.cpa ?? (metric.conversoes > 0 
        ? metric.custo / metric.conversoes 
        : 0);

      // Upsert: inserir ou atualizar se já existir
      const { data, error } = await supabase
        .from('google_ads_metrics')
        .upsert({
          data_referencia: metric.data_referencia,
          impressoes: metric.impressoes || 0,
          cliques: metric.cliques || 0,
          conversoes: metric.conversoes || 0,
          custo: metric.custo || 0,
          ctr: Number(ctr.toFixed(2)),
          cpa: Number(cpa.toFixed(2)),
          campanha: metric.campanha || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'data_referencia,campanha',
        })
        .select();

      if (error) {
        console.error('[sync-google-ads] Error upserting metric:', error);
        results.push({ error: error.message, metric });
      } else {
        console.log('[sync-google-ads] Successfully upserted metric:', data);
        results.push({ success: true, data });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => r.error).length;

    console.log(`[sync-google-ads] Completed: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        success: errorCount === 0,
        message: `Processed ${metrics.length} metrics: ${successCount} success, ${errorCount} errors`,
        results 
      }),
      { status: errorCount === 0 ? 200 : 207, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[sync-google-ads] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
