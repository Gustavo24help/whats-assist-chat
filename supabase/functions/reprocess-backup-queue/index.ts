import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔄 [reprocess-backup-queue] Iniciando reprocessamento da fila de backup...");

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar mensagens não processadas com menos de 5 tentativas
    const { data: pendentes, error: fetchError } = await supabase
      .from('mensagens_backup_queue')
      .select('*')
      .eq('processado', false)
      .lt('tentativas', 5)
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error("❌ Erro ao buscar fila de backup:", fetchError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar fila", details: fetchError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendentes || pendentes.length === 0) {
      console.log("✅ Nenhuma mensagem pendente na fila de backup");
      return new Response(
        JSON.stringify({ success: true, processados: 0, message: "Fila vazia" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Encontradas ${pendentes.length} mensagens pendentes para reprocessar`);

    let processadosComSucesso = 0;
    let falhas = 0;

    for (const item of pendentes) {
      console.log(`🔄 Processando item ${item.id} (tentativa ${item.tentativas + 1})...`);

      try {
        const payload = item.payload as Record<string, unknown>;

        // Verificar se já foi salva (por message_sid ou arquivo_url)
        let jaSalva = false;

        if (payload.message_sid) {
          const { data: existente } = await supabase
            .from('mensagens')
            .select('id')
            .eq('message_sid', payload.message_sid)
            .limit(1)
            .maybeSingle();
          
          if (existente) {
            console.log(`⚠️ Mensagem já existe por message_sid: ${payload.message_sid}`);
            jaSalva = true;
          }
        }

        if (!jaSalva && payload.arquivo_url) {
          const { data: existente } = await supabase
            .from('mensagens')
            .select('id')
            .eq('arquivo_url', payload.arquivo_url)
            .limit(1)
            .maybeSingle();
          
          if (existente) {
            console.log(`⚠️ Mensagem já existe por arquivo_url`);
            jaSalva = true;
          }
        }

        if (jaSalva) {
          // Marcar como processada (já existe no banco)
          await supabase
            .from('mensagens_backup_queue')
            .update({ processado: true })
            .eq('id', item.id);
          
          processadosComSucesso++;
          continue;
        }

        // Tentar salvar a mensagem
        const { error: insertError } = await supabase
          .from('mensagens')
          .insert(payload);

        if (insertError) {
          console.error(`❌ Erro ao salvar mensagem ${item.id}:`, insertError);
          
          // Incrementar tentativas
          await supabase
            .from('mensagens_backup_queue')
            .update({ 
              tentativas: item.tentativas + 1,
              erro_ultimo: insertError.message
            })
            .eq('id', item.id);
          
          falhas++;
        } else {
          console.log(`✅ Mensagem ${item.id} salva com sucesso no reprocessamento`);
          
          // Marcar como processada
          await supabase
            .from('mensagens_backup_queue')
            .update({ processado: true })
            .eq('id', item.id);
          
          processadosComSucesso++;
        }
      } catch (err) {
        console.error(`⚠️ Exceção ao processar item ${item.id}:`, err);
        
        await supabase
          .from('mensagens_backup_queue')
          .update({ 
            tentativas: item.tentativas + 1,
            erro_ultimo: err instanceof Error ? err.message : 'Erro desconhecido'
          })
          .eq('id', item.id);
        
        falhas++;
      }
    }

    console.log(`📊 Reprocessamento finalizado: ${processadosComSucesso} sucesso, ${falhas} falhas`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processados: processadosComSucesso,
        falhas,
        total: pendentes.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("❌ Erro crítico no reprocessamento:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(
      JSON.stringify({ error: "Erro crítico", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
