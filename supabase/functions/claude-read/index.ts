// Edge Function: claude-read
// Acesso de leitura para Claude externo. Auth via header X-Claude-Token.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-claude-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BLOCKED_TABLES = new Set([
  "user_roles",
  "profiles",
]);

const ALLOWED_OPS = new Set([
  "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is",
]);

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResp({ error: "Method not allowed" }, 405);

  const expected = Deno.env.get("CLAUDE_READ_TOKEN");
  if (!expected) return jsonResp({ error: "Server not configured" }, 500);

  const provided = req.headers.get("x-claude-token") ?? "";
  if (!provided || !timingSafeEqual(provided, expected)) {
    return jsonResp({ error: "Unauthorized" }, 401);
  }

  let payload: any;
  try { payload = await req.json(); }
  catch { return jsonResp({ error: "Invalid JSON body" }, 400); }

  const table = String(payload?.table ?? "").trim();
  if (!table || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    return jsonResp({ error: "Invalid 'table'" }, 400);
  }
  if (BLOCKED_TABLES.has(table)) {
    return jsonResp({ error: `Table '${table}' is blocked` }, 403);
  }

  const select = typeof payload?.select === "string" && payload.select.trim() ? payload.select : "*";
  const limit = Math.min(Math.max(parseInt(payload?.limit ?? 100, 10) || 100, 1), 1000);
  const offset = Math.max(parseInt(payload?.offset ?? 0, 10) || 0, 0);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let q: any = supabase.from(table).select(select, { count: "exact" });

  if (Array.isArray(payload?.filters)) {
    for (const f of payload.filters) {
      const col = String(f?.col ?? "");
      const op = String(f?.op ?? "");
      const val = f?.val;
      if (!col || !ALLOWED_OPS.has(op)) {
        return jsonResp({ error: `Invalid filter: ${JSON.stringify(f)}` }, 400);
      }
      try {
        if (op === "in") {
          const arr = Array.isArray(val) ? val : String(val).split(",");
          q = q.in(col, arr);
        } else if (op === "is") {
          q = q.is(col, val);
        } else {
          q = (q as any)[op](col, val);
        }
      } catch (e) {
        return jsonResp({ error: `Filter error: ${(e as Error).message}` }, 400);
      }
    }
  }

  if (payload?.order && typeof payload.order === "object") {
    const col = String(payload.order.col ?? "");
    const dir = payload.order.dir === "desc" ? "desc" : "asc";
    if (col) q = q.order(col, { ascending: dir === "asc" });
  }

  q = q.range(offset, offset + limit - 1);

  const { data, error, count } = await q;
  if (error) return jsonResp({ ok: false, error: error.message, code: error.code }, 400);

  return jsonResp({ ok: true, count: count ?? data?.length ?? 0, returned: data?.length ?? 0, data });
});
