
-- 1. Função principal de não-lidas: reconhecer remetente = cliente_id como inbound
CREATE OR REPLACE FUNCTION public.get_unread_state_for_user(_telefones text[])
 RETURNS TABLE(cliente_id text, ultima_data_cliente timestamp with time zone, total_nao_lidas integer, last_read_at timestamp with time zone, manual_unread boolean, is_unread boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with msgs as (
    select
      m.cliente_id,
      max(m.data_hora) as ultima_data_cliente
    from public.mensagens m
    where m.cliente_id = any(_telefones)
      and (
        m.tipo_remetente = 'cliente'
        or m.remetente = 'cliente'
        or (
          (m.tipo_remetente is null
            or m.tipo_remetente not in ('atendente','bot','operador','system','sistema'))
          and m.remetente = m.cliente_id
        )
      )
    group by m.cliente_id
  ),
  reads as (
    select r.cliente_telefone, r.last_read_at, coalesce(r.manual_unread, false) as manual_unread
    from public.mensagem_leitura_operador r
    where r.user_id = auth.uid()
      and r.cliente_telefone = any(_telefones)
  ),
  joined as (
    select
      t as cliente_id,
      msgs.ultima_data_cliente,
      reads.last_read_at,
      coalesce(reads.manual_unread, false) as manual_unread
    from unnest(_telefones) as t
    left join msgs on msgs.cliente_id = t
    left join reads on reads.cliente_telefone = t
  ),
  counts as (
    select
      m.cliente_id,
      count(*)::int as total_nao_lidas
    from public.mensagens m
    join joined j on j.cliente_id = m.cliente_id
    where (
        m.tipo_remetente = 'cliente'
        or m.remetente = 'cliente'
        or (
          (m.tipo_remetente is null
            or m.tipo_remetente not in ('atendente','bot','operador','system','sistema'))
          and m.remetente = m.cliente_id
        )
      )
      and (j.last_read_at is null or m.data_hora > j.last_read_at)
    group by m.cliente_id
  )
  select
    j.cliente_id,
    j.ultima_data_cliente,
    coalesce(c.total_nao_lidas, 0) as total_nao_lidas,
    j.last_read_at,
    j.manual_unread,
    case
      when j.manual_unread then true
      when j.ultima_data_cliente is not null
        and (j.last_read_at is null or j.ultima_data_cliente > j.last_read_at)
        then true
      else false
    end as is_unread
  from joined j
  left join counts c on c.cliente_id = j.cliente_id;
$function$;

-- 2. Função legada get_unread_cliente_msgs: mesma correção
CREATE OR REPLACE FUNCTION public.get_unread_cliente_msgs(_telefones text[], _read_map jsonb)
 RETURNS TABLE(cliente_id text, ultima_data timestamp with time zone, total_nao_lidas integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    m.cliente_id,
    max(m.data_hora) as ultima_data,
    count(*) filter (
      where (_read_map ->> m.cliente_id) is null
         or m.data_hora > (_read_map ->> m.cliente_id)::timestamptz
    )::int as total_nao_lidas
  from public.mensagens m
  where m.cliente_id = any(_telefones)
    and (
      m.tipo_remetente = 'cliente'
      or m.remetente = 'cliente'
      or (
        (m.tipo_remetente is null
          or m.tipo_remetente not in ('atendente','bot','operador','system','sistema'))
        and m.remetente = m.cliente_id
      )
    )
  group by m.cliente_id;
$function$;

-- 3. Remover trigger legado que dependia de remetente='cliente' (nunca casa)
DROP TRIGGER IF EXISTS aumentar_nao_lidos_nova_msg_trigger ON public.mensagens;
DROP TRIGGER IF EXISTS trigger_aumentar_nao_lidos ON public.mensagens;
