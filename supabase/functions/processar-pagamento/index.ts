import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

async function logAudit(
  supabase: any,
  fichaId: string,
  status: string,
  detalhe?: string,
) {
  try {
    await supabase.from("automation_audit").insert({
      ficha_id: fichaId,
      etapa: "processar-pagamento",
      status,
      detalhe: detalhe?.substring(0, 1000),
    });
  } catch (e) {
    console.warn("[processar-pagamento] Erro ao registrar audit:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Autenticação via JWT do Supabase (verify_jwt = true por padrão)

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const fichaId: string = body.id;
  const status: string = body.status;
  const valorTotal: number = Number(body.valor_total ?? 0);
  const prestadorCpf: string | null = body.prestador_cpf ?? null;
  const telefoneCliente: string | null = body.telefone_cliente ?? null;
  const evento: string = body.evento ?? "ficha_atualizada";

  console.log(
    `[processar-pagamento] ficha=${fichaId} status=${status} valor=${valorTotal} prestador=${prestadorCpf} evento=${evento}`,
  );

  if (status !== "Finalizado") {
    return new Response(
      JSON.stringify({ success: true, skipped: true, reason: "status != Finalizado" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!valorTotal || valorTotal <= 0) {
    await logAudit(supabase, fichaId, "alerta",
      `Ficha finalizada sem valor_total. Valor recebido: ${body.valor_total}`);
    return new Response(
      JSON.stringify({ success: true, alerta: "sem_valor", ficha_id: fichaId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!prestadorCpf) {
    await logAudit(supabase, fichaId, "alerta", "Ficha finalizada sem prestador_cpf");
    return new Response(
      JSON.stringify({ success: true, alerta: "sem_prestador", ficha_id: fichaId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { data: prestador, error: errPrestador } = await supabase
    .from("prestadores")
    .select("cpf, nome, cnpj, chave_pix, nome_pix, banco, agencia, conta, telefone")
    .eq("cpf", prestadorCpf)
    .maybeSingle();

  if (errPrestador || !prestador) {
    const msg = `Prestador não encontrado: CPF ${prestadorCpf}`;
    await logAudit(supabase, fichaId, "erro", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { data: contaReceber } = await supabase
    .from("contas_receber")
    .select("id, status, pagamento_link, created_at")
    .eq("ficha_id", fichaId)
    .maybeSingle();

  if (!contaReceber) {
    console.log(`[processar-pagamento] contas_receber não encontrado para ${fichaId} — acionando auto-finalizacao`);
    try {
      const autoFinUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/auto-finalizacao`;
      await fetch(autoFinUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ ficha_id: fichaId }),
      });
    } catch (e) {
      console.warn("[processar-pagamento] Erro ao acionar auto-finalizacao:", e);
    }
  }

  await logAudit(supabase, fichaId, "processado",
    JSON.stringify({
      prestador_nome: prestador.nome,
      prestador_cpf: prestador.cpf,
      prestador_pix: prestador.chave_pix,
      valor_total: valorTotal,
      telefone_cliente: telefoneCliente,
      conta_receber_status: contaReceber?.status ?? "acionado agora",
    }),
  );

  return new Response(
    JSON.stringify({
      success: true,
      ficha_id: fichaId,
      prestador: {
        nome: prestador.nome,
        cpf: prestador.cpf,
        cnpj: prestador.cnpj,
        chave_pix: prestador.chave_pix,
      },
      valor_total: valorTotal,
      conta_receber: contaReceber
        ? { status: contaReceber.status, pagamento_link: contaReceber.pagamento_link }
        : { status: "acionado agora" },
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
