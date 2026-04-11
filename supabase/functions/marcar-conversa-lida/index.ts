import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { cliente_telefone, operador_id } = body;

    if (!cliente_telefone || !operador_id) {
      return new Response(
        JSON.stringify({ error: "cliente_telefone e operador_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const agora = new Date().toISOString();

    // STEP 1: Marcar ESTE operador como lido (zerar não lidos)
    const { error: errorUpdate } = await supabase
      .from("conversa_operador_leitura")
      .upsert(
        {
          cliente_telefone,
          operador_id,
          mensagens_nao_lidas: 0,
          ultima_leitura: agora,
          updated_at: agora,
        },
        { onConflict: "cliente_telefone,operador_id" }
      );

    if (errorUpdate) {
      console.error("[marcar-conversa-lida] Erro ao atualizar leitura:", errorUpdate);
      return new Response(
        JSON.stringify({ error: errorUpdate.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // STEP 2: Atualizar OUTROS operadores com "outro_operador_leu"
    const { error: errorOthers } = await supabase
      .from("conversa_operador_leitura")
      .update({
        outro_operador_leu_id: operador_id,
        outro_operador_leu_em: agora,
      })
      .eq("cliente_telefone", cliente_telefone)
      .neq("operador_id", operador_id);

    if (errorOthers) {
      console.error("[marcar-conversa-lida] Erro ao atualizar outros:", errorOthers);
    }

    console.log(`[marcar-conversa-lida] OK - Op: ${operador_id}, Tel: ${cliente_telefone}`);

    return new Response(
      JSON.stringify({ success: true, timestamp: agora }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[marcar-conversa-lida] Erro geral:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
