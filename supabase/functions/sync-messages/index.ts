import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2";

console.log("Sync cron job started");

// Sync a cada 30 segundos
Deno.cron("Sync Twilio Messages", "*/30 * * * * *", async () => {
  const startTime = Date.now();
  console.log(`[CRON] 🔄 Iniciando sync automático...`);
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar lock de concorrência
    const { data: syncControl } = await supabase
      .from("twilio_sync_control")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (syncControl?.sync_in_progress) {
      const startedAt = new Date(syncControl.sync_started_at).getTime();
      const elapsed = Date.now() - startedAt;
      
      // Se começou há menos de 120s, pular execução
      if (elapsed < 120_000) {
        console.log(`[CRON] ⏭️ Sync já em andamento há ${Math.round(elapsed / 1000)}s, pulando...`);
        return;
      }
      console.log(`[CRON] ⚠️ Lock antigo (${Math.round(elapsed / 1000)}s), forçando nova execução...`);
    }

    // Marcar sync_in_progress = true
    if (syncControl?.id) {
      await supabase
        .from("twilio_sync_control")
        .update({ sync_in_progress: true, sync_started_at: new Date().toISOString() })
        .eq("id", syncControl.id);
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/sync-twilio-messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    const result = await response.json();
    const duration = Date.now() - startTime;
    
    console.log(`[CRON] ✅ Sync concluído em ${duration}ms`);
    console.log(`[CRON] 📊 Encontradas: ${result.messages_found}`);
    console.log(`[CRON] ✅ Novas: ${result.messages_new}`);
    console.log(`[CRON] ⏭️  Já existem: ${result.messages_already_exist}`);
    
    if (result.errors > 0) {
      console.error(`[CRON] ❌ Erros: ${result.errors}`);
      console.error(`[CRON] Detalhes:`, result.errors_details);
    }

    // Liberar lock
    if (syncControl?.id) {
      await supabase
        .from("twilio_sync_control")
        .update({ sync_in_progress: false })
        .eq("id", syncControl.id);
    }
  } catch (error) {
    console.error(`[CRON] 💥 Erro ao executar sync:`, error);
    
    // Tentar liberar lock mesmo em caso de erro
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase
        .from("twilio_sync_control")
        .update({ sync_in_progress: false })
        .neq("id", "00000000-0000-0000-0000-000000000000");
    } catch (_) {
      // ignore cleanup error
    }
  }
});
