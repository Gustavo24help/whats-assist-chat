
create or replace function public.get_unread_cliente_msgs(
  _telefones text[],
  _read_map jsonb
)
returns table (
  cliente_id text,
  ultima_data timestamptz,
  total_nao_lidas int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.cliente_id,
    max(m.data_hora) as ultima_data,
    count(*) filter (
      where (_read_map ->> m.cliente_id) is null
         or m.data_hora > (_read_map ->> m.cliente_id)::timestamptz
    )::int as total_nao_lidas
  from public.mensagens m
  where m.cliente_id = any(_telefones)
    and (m.tipo_remetente = 'cliente' or m.remetente = 'cliente')
  group by m.cliente_id;
$$;

grant execute on function public.get_unread_cliente_msgs(text[], jsonb) to anon, authenticated;
