import "jsr:@supabase/functions-js/edge-runtime.d.ts"

console.log("Sync cron job started");

// Sync a cada 30 segundos
Deno.cron("Sync Twilio Messages", "*/30 * * * * *", async () => {
  const startTime = Date.now();
  console.log(`[CRON] 🔄 Iniciando sync automático...`);
  
  try {
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-twilio-messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
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
  } catch (error) {
    console.error(`[CRON] 💥 Erro ao executar sync:`, error);
  }
});
