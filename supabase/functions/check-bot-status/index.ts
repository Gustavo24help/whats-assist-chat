import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface RequestBody {
  telefone: string;
}

/**
 * Gera todas as variações de telefone que podem existir no banco para
 * o mesmo cliente (legado tem registros em múltiplos formatos).
 *
 * Recebe qualquer formato (whatsapp:+5541999999999, +5541999999999,
 * 5541999999999, 41999999999) e devolve todos eles.
 */
function buildPhoneVariants(input: string): string[] {
  const variants = new Set<string>();
  if (!input) return [];

  const raw = input.trim();
  variants.add(raw);

  // Remove prefixo whatsapp:
  const noWhats = raw.replace(/^whatsapp:/i, '').trim();
  variants.add(noWhats);

  // Mantém só dígitos para normalizar
  const digits = noWhats.replace(/\D/g, '');
  if (!digits) return Array.from(variants);

  // Garante DDI 55 quando aplicável
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  const withoutCountry = withCountry.startsWith('55') ? withCountry.slice(2) : withCountry;

  // Variantes canônicas
  variants.add(digits);
  variants.add(withCountry);
  variants.add(withoutCountry);
  variants.add(`+${withCountry}`);
  variants.add(`+${digits}`);
  variants.add(`whatsapp:+${withCountry}`);
  variants.add(`whatsapp:+${digits}`);
  variants.add(`whatsapp:${withCountry}`);

  return Array.from(variants).filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { telefone }: RequestBody = await req.json();

    if (!telefone) {
      return new Response(
        JSON.stringify({ error: 'Telefone é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const variants = buildPhoneVariants(telefone);
    console.log(`[check-bot-status] telefone="${telefone}" variants=`, variants);

    // Busca TODOS os registros que casarem com qualquer variação do telefone.
    // Se QUALQUER um estiver com bot_habilitado=false, o status final é "disabled".
    const { data: rows, error } = await supabase
      .from('clientes')
      .select('id, telefone, bot_habilitado, bot_desligado_manualmente, atendente_id, status_conversa')
      .in('telefone', variants);

    if (error) {
      console.error('[check-bot-status] Erro ao consultar clientes:', error);
      // Fail-open só em erro de infraestrutura, com log para auditoria.
      await supabase.from('system_logs').insert({
        event_type: 'check_bot_status_db_error',
        event_data: { telefone, variants, error: error.message },
      }).then(() => {}, () => {});
      return new Response(
        JSON.stringify({
          bot_status: 'enabled',
          telefone,
          message: 'Erro ao consultar banco; bot habilitado por padrão',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rows || rows.length === 0) {
      // Nenhum cliente em NENHUM dos formatos — provável primeiro contato.
      // Mantém fail-open mas registra para detectarmos casos suspeitos.
      console.log(`[check-bot-status] Nenhum cliente encontrado em nenhum formato. Bot=enabled (default).`);
      await supabase.from('system_logs').insert({
        event_type: 'check_bot_status_no_client',
        event_data: { telefone, variants },
      }).then(() => {}, () => {});
      return new Response(
        JSON.stringify({
          bot_status: 'enabled',
          telefone,
          message: 'Cliente não encontrado, bot habilitado por padrão',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fail-closed: qualquer registro com bot_habilitado=false vence.
    const anyDisabled = rows.some((r: any) => r.bot_habilitado === false);
    const botStatus = anyDisabled ? 'disabled' : 'enabled';

    if (rows.length > 1) {
      // Loga duplicidade para tratarmos na Fase C.
      console.warn(`[check-bot-status] Múltiplos registros (${rows.length}) para ${telefone}:`, rows.map((r: any) => ({ id: r.id, telefone: r.telefone, bot: r.bot_habilitado })));
      await supabase.from('system_logs').insert({
        event_type: 'check_bot_status_duplicate_clients',
        event_data: {
          telefone_consulta: telefone,
          variants,
          registros: rows.map((r: any) => ({ id: r.id, telefone: r.telefone, bot_habilitado: r.bot_habilitado })),
          resolvido_como: botStatus,
        },
      }).then(() => {}, () => {});
    }

    console.log(`[check-bot-status] telefone="${telefone}" → ${botStatus} (matched=${rows.length}, anyDisabled=${anyDisabled})`);

    return new Response(
      JSON.stringify({
        bot_status: botStatus,
        telefone,
        matched_records: rows.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[check-bot-status] Erro:', error);
    return new Response(
      JSON.stringify({
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
