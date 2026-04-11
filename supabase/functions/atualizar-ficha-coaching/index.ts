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
    const { cliente_telefone, signals, coaching } = await req.json();

    if (!cliente_telefone) {
      return new Response(
        JSON.stringify({ error: "cliente_telefone é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase
      .from("ficha_coaching")
      .upsert(
        {
          cliente_telefone,
          urgencia: signals?.urgencia ?? false,
          perguntas_tecnicas: signals?.perguntasTecnicas ?? 0,
          tempo_sem_resposta_minutos: signals?.tempoSemResposta ?? 0,
          profile_cliente: signals?.profileCliente ?? "normal",
          conversao_base: coaching?.conversaoBase ?? 0.27,
          conversao_meta: coaching?.conversaoMeta ?? 0.27,
          sugestao_mensagem: coaching?.sugestaoMensagem ?? null,
          proximo_passo: coaching?.proximoPassoLabel ?? null,
          prioridade: coaching?.prioridade ?? "normal",
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "cliente_telefone" }
      );

    if (error) {
      console.error("[atualizar-ficha-coaching] Erro:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[atualizar-ficha-coaching] Erro geral:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
