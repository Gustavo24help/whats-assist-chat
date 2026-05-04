// Reconciliação Twilio x Lovable
// - Lista mensagens presentes na Twilio que NÃO existem no banco (por message_sid)
// - Pode recuperar (insert) as faltantes preservando date_sent, mídia e rota cliente/prestador
// - Grava histórico em twilio_reconciliation_runs
// SAFEGUARDS:
// - Nunca atualiza mensagens existentes
// - Só insere quando o message_sid não existe nem em `mensagens` nem em `mensagens_prestadores`
// - Em caso de falha de insert, grava na fila `mensagens_backup_queue`
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  getManagedWhatsappNumbers,
  isManagedWhatsappNumber,
  normalizeWhatsappNumber,
  isPrestadoresNumber,
} from "../_shared/twilioNumbers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Mode = "diagnose" | "recover" | "verify";

interface ReqBody {
  mode?: Mode;
  hours?: number;
  customer_phone?: string;
  scope?: "all" | "cliente" | "prestador";
  limit_recover?: number;
}

const fetchAllTwilioMessages = async (
  url: string,
  authHeader: string,
  label: string,
) => {
  const messages: any[] = [];
  let nextUrl: string | null = url;
  let pages = 0;
  while (nextUrl && pages < 20) {
    pages += 1;
    const r: Response = await fetch(nextUrl, {
      headers: { Authorization: `Basic ${authHeader}` },
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Twilio API ${label} ${r.status}: ${t.slice(0, 300)}`);
    }
    const data: any = await r.json();
    messages.push(...(data.messages || []));
    nextUrl = data.next_page_uri ? `https://api.twilio.com${data.next_page_uri}` : null;
  }
  console.log(`📡 [RECON] ${label}: ${messages.length} msgs em ${pages} pág`);
  return messages;
};

const fetchMessageMedia = async (msg: any, authHeader: string, sid: string) => {
  const numMedia = parseInt(String(msg.num_media ?? "0"), 10);
  if (!numMedia) return { tipo: "texto", arquivoUrl: null as string | null, fallback: "" };
  const mediaPath = msg.subresource_uris?.media
    ? `https://api.twilio.com${msg.subresource_uris.media}`
    : `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages/${msg.sid}/Media.json`;
  const r = await fetch(mediaPath, { headers: { Authorization: `Basic ${authHeader}` } });
  if (!r.ok) return { tipo: "arquivo", arquivoUrl: null, fallback: `Arquivo ${numMedia}` };
  const data = await r.json();
  const m = data.media_list?.[0];
  if (!m) return { tipo: "arquivo", arquivoUrl: null, fallback: `Arquivo ${numMedia}` };
  const ct = String(m.content_type || "");
  let tipo = "arquivo";
  if (ct.startsWith("image/")) tipo = "imagem";
  else if (ct.startsWith("video/")) tipo = "video";
  else if (ct.startsWith("audio/")) tipo = "audio";
  return {
    tipo,
    arquivoUrl: `https://api.twilio.com${String(m.uri || "").replace(".json", "")}`,
    fallback: `Arquivo ${numMedia}`,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const start = Date.now();
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const accountSid =
      Deno.env.get("TWILIO_ACCOUNT_SID") || "AC13e7e780450a855f503451bca7114c07";
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!authToken) throw new Error("TWILIO_AUTH_TOKEN não configurado");

    const body = (await req.json().catch(() => ({}))) as ReqBody;
    const mode: Mode = body.mode || "diagnose";

    // ===== Verify =====
    if (mode === "verify") {
      const r = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
        { headers: { Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}` } },
      );
      const ok = r.ok;
      const data = ok ? await r.json() : await r.text();
      return new Response(
        JSON.stringify({
          success: ok,
          status: r.status,
          account_sid: accountSid,
          friendly_name: ok ? (data as any).friendly_name : null,
          error: ok ? null : data,
          duration_ms: Date.now() - start,
        }),
        { status: ok ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const hours = Math.max(1, Math.min(24 * 14, Number(body.hours) || 24));
    const periodStart = new Date(Date.now() - hours * 3600_000);
    const periodEnd = new Date();
    const customerPhone = body.customer_phone
      ? normalizeWhatsappNumber(body.customer_phone)
      : "";
    const scope = body.scope || "all";
    const limitRecover = Math.max(0, Math.min(500, Number(body.limit_recover) || 200));

    const managedNumbers = getManagedWhatsappNumbers();
    const authHeader = btoa(`${accountSid}:${authToken}`);
    const dateSentAfter = periodStart.toISOString();

    // ===== Buscar Twilio (in + out) por número gerenciado =====
    const [incoming, outgoing] = await Promise.all([
      Promise.all(
        managedNumbers.map((n) =>
          fetchAllTwilioMessages(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json?To=${encodeURIComponent(n)}&DateSent>=${encodeURIComponent(dateSentAfter)}&PageSize=100`,
            authHeader,
            `in:${n}`,
          ),
        ),
      ).then((r) => r.flat()),
      Promise.all(
        managedNumbers.map((n) =>
          fetchAllTwilioMessages(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json?From=${encodeURIComponent(n)}&DateSent>=${encodeURIComponent(dateSentAfter)}&PageSize=100`,
            authHeader,
            `out:${n}`,
          ),
        ),
      ).then((r) => r.flat()),
    ]);

    const all = Array.from(
      new Map([...incoming, ...outgoing].map((m: any) => [m.sid, m])).values(),
    ) as any[];

    // Aplicar filtros customer/scope
    const filtered = all.filter((m) => {
      const from = normalizeWhatsappNumber(m.from);
      const to = normalizeWhatsappNumber(m.to);
      const isOut = isManagedWhatsappNumber(from, managedNumbers);
      const cliente = isOut ? to : from;
      if (!cliente || isManagedWhatsappNumber(cliente, managedNumbers)) return false;
      if (customerPhone && cliente !== customerPhone) return false;
      const numeroGer = isOut ? from : to;
      const isPrest = isPrestadoresNumber(numeroGer);
      if (scope === "cliente" && isPrest) return false;
      if (scope === "prestador" && !isPrest) return false;
      return true;
    });

    const sids = filtered.map((m) => m.sid).filter(Boolean);

    // ===== Buscar SIDs já existentes em ambas as tabelas (em chunks de 500) =====
    const existingSids = new Set<string>();
    const chunk = <T,>(arr: T[], n: number) =>
      Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

    for (const part of chunk(sids, 500)) {
      const [{ data: a }, { data: b }] = await Promise.all([
        supabase.from("mensagens").select("message_sid").in("message_sid", part),
        supabase.from("mensagens_prestadores").select("message_sid").in("message_sid", part),
      ]);
      a?.forEach((r: any) => r.message_sid && existingSids.add(r.message_sid));
      b?.forEach((r: any) => r.message_sid && existingSids.add(r.message_sid));
    }

    const missing = filtered.filter((m) => m.sid && !existingSids.has(m.sid));

    const missingDetails = missing.slice(0, 100).map((m: any) => {
      const from = normalizeWhatsappNumber(m.from);
      const to = normalizeWhatsappNumber(m.to);
      const isOut = isManagedWhatsappNumber(from, managedNumbers);
      const cliente = isOut ? to : from;
      const numeroGer = isOut ? from : to;
      return {
        sid: m.sid,
        date_sent: m.date_sent,
        direction: isOut ? "outbound" : "inbound",
        rota: isPrestadoresNumber(numeroGer) ? "prestador" : "cliente",
        numero_twilio: numeroGer,
        cliente,
        body_preview: String(m.body || "").slice(0, 80),
        num_media: m.num_media,
        status_twilio: m.status,
        error_code: m.error_code,
        error_message: m.error_message,
      };
    });

    let recovered = 0;
    let recoveryErrors = 0;
    const recoveryDetails: any[] = [];
    const errorsDetails: any[] = [];

    if (mode === "recover" && missing.length > 0) {
      const toRecover = missing.slice(0, limitRecover);
      for (const m of toRecover) {
        try {
          const from = normalizeWhatsappNumber(m.from);
          const to = normalizeWhatsappNumber(m.to);
          const isOut = isManagedWhatsappNumber(from, managedNumbers);
          const cliente = isOut ? to : from;
          const numeroGer = isOut ? from : to;
          const isPrest = isPrestadoresNumber(numeroGer);
          const media = await fetchMessageMedia(m, authHeader, accountSid);
          const dataHora = new Date(
            m.date_sent || m.date_created || m.date_updated || Date.now(),
          ).toISOString();
          const texto = String(m.body || media.fallback || "");

          if (isPrest) {
            // Garantir prestador_chat existe
            const { data: pc } = await supabase
              .from("prestadores_chat")
              .select("telefone")
              .eq("telefone", cliente)
              .maybeSingle();
            if (!pc) {
              await supabase.from("prestadores_chat").insert({
                telefone: cliente,
                nome: cliente.replace("whatsapp:", "").replace("+", ""),
                status_conversa: "aberta",
                ultima_interacao: dataHora,
                tags: [],
                numero_twilio: numeroGer,
              });
            }
            const { error } = await supabase.from("mensagens_prestadores").insert({
              prestador_telefone: cliente,
              remetente: isOut ? from : cliente,
              texto,
              tipo: media.tipo,
              arquivo_url: media.arquivoUrl,
              status: isOut ? "enviado" : "recebido",
              data_hora: dataHora,
              numero_twilio: numeroGer,
              message_sid: m.sid,
            });
            if (error) throw error;
          } else {
            // Cliente
            const { data: c } = await supabase
              .from("clientes")
              .select("telefone, ficha_ativa_id")
              .eq("telefone", cliente)
              .maybeSingle();
            let fichaId = c?.ficha_ativa_id ?? null;
            if (!c) {
              await supabase.from("clientes").insert({
                telefone: cliente,
                nome: cliente.replace("whatsapp:", "").replace("+", ""),
                status_conversa: "aberta",
                ultima_interacao: dataHora,
                tags: [],
              });
            }
            const { error } = await supabase.from("mensagens").insert({
              cliente_id: cliente,
              remetente: isOut ? from : cliente,
              texto,
              tipo: media.tipo,
              arquivo_url: media.arquivoUrl,
              status: isOut ? "enviado" : "recebido",
              data_hora: dataHora,
              ficha_id: fichaId,
              message_sid: m.sid,
              tipo_remetente: isOut ? "bot" : "cliente",
              operador_nome: isOut ? "Bot Automático" : null,
            });
            if (error) throw error;
          }
          recovered++;
          recoveryDetails.push({ sid: m.sid, cliente, rota: isPrest ? "prestador" : "cliente" });
        } catch (e) {
          recoveryErrors++;
          const msg = e instanceof Error ? e.message : String(e);
          errorsDetails.push({ sid: m.sid, error: msg });
          // Grava na fila de backup para retry posterior
          try {
            await supabase.from("mensagens_backup_queue").insert({
              message_sid: m.sid,
              cliente_id: normalizeWhatsappNumber(
                isManagedWhatsappNumber(normalizeWhatsappNumber(m.from), managedNumbers)
                  ? m.to
                  : m.from,
              ),
              payload: m,
              tentativas: 0,
              processado: false,
              erro_ultimo: msg,
            });
          } catch (_) {}
        }
      }
    }

    // Total no Lovable no mesmo período (cliente + prestador)
    const [{ count: lovClientes }, { count: lovPrest }] = await Promise.all([
      supabase
        .from("mensagens")
        .select("id", { count: "exact", head: true })
        .gte("data_hora", periodStart.toISOString())
        .lte("data_hora", periodEnd.toISOString()),
      supabase
        .from("mensagens_prestadores")
        .select("id", { count: "exact", head: true })
        .gte("data_hora", periodStart.toISOString())
        .lte("data_hora", periodEnd.toISOString()),
    ]);
    const totalLovable = (lovClientes || 0) + (lovPrest || 0);

    const lossRate = filtered.length > 0
      ? Number(((missing.length / filtered.length) * 100).toFixed(2))
      : 0;

    const duration = Date.now() - start;

    // Gravar histórico
    const { data: runRow } = await supabase
      .from("twilio_reconciliation_runs")
      .insert({
        triggered_by: mode,
        scope,
        customer_phone: customerPhone || null,
        managed_numbers: managedNumbers,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        total_twilio: filtered.length,
        total_lovable: totalLovable,
        total_missing: missing.length,
        total_extra: 0,
        total_recovered: recovered,
        total_recovery_errors: recoveryErrors,
        loss_rate_pct: lossRate,
        duration_ms: duration,
        missing_details: missingDetails,
        recovery_details: recoveryDetails,
        errors_details: errorsDetails,
      })
      .select("id")
      .maybeSingle();

    return new Response(
      JSON.stringify({
        success: true,
        run_id: runRow?.id ?? null,
        mode,
        period: { start: periodStart.toISOString(), end: periodEnd.toISOString(), hours },
        scope,
        customer_phone: customerPhone || null,
        managed_numbers: managedNumbers,
        totals: {
          twilio: filtered.length,
          lovable: totalLovable,
          missing: missing.length,
          recovered,
          recovery_errors: recoveryErrors,
          loss_rate_pct: lossRate,
        },
        missing: missingDetails,
        recovery_details: recoveryDetails,
        errors_details: errorsDetails,
        duration_ms: duration,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("💥 [RECON] Erro:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg, duration_ms: Date.now() - start }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
