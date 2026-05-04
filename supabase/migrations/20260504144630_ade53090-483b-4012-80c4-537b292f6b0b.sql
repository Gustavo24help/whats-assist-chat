-- 1) Nova RPC: estado de não-lida POR USUÁRIO autenticado, calculado no banco
--    (não depende de o frontend trazer todas as linhas de mensagem_leitura_operador).
create or replace function public.get_unread_state_for_user(_telefones text[])
returns table (
  cliente_id text,
  ultima_data_cliente timestamptz,
  total_nao_lidas int,
  last_read_at timestamptz,
  manual_unread boolean,
  is_unread boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with msgs as (
    select
      m.cliente_id,
      max(m.data_hora) as ultima_data_cliente
    from public.mensagens m
    where m.cliente_id = any(_telefones)
      and (m.tipo_remetente = 'cliente' or m.remetente = 'cliente')
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
    where (m.tipo_remetente = 'cliente' or m.remetente = 'cliente')
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
$$;

grant execute on function public.get_unread_state_for_user(text[]) to authenticated;

-- 2) Remover trigger e função antigas que ainda escreviam clientes.marcado_nao_lido
drop trigger if exists on_new_client_message_mark_unread on public.mensagens;
drop function if exists public.mark_client_unread_on_new_message();