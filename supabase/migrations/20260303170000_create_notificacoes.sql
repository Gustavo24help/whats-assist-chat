create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  referencia_id text,
  usuario_destino uuid,
  titulo text not null,
  descricao text,
  lida boolean not null default false,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_notificacoes_usuario_lida
on public.notificacoes (usuario_destino, lida);

alter table public.notificacoes enable row level security;

create policy "Usuário pode ver suas notificações"
on public.notificacoes
for select
using (auth.uid() = usuario_destino);

create policy "Usuário pode marcar suas notificações"
on public.notificacoes
for update
using (auth.uid() = usuario_destino)
with check (auth.uid() = usuario_destino);

create or replace function public.criar_notificacoes_orcamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ficha_record record;
  role_record record;
  cliente_nome text;
begin
  select id, nome_ficha, telefone_cliente, status
    into ficha_record
  from public.fichas_de_servico
  where id = new.ficha_nome;

  if ficha_record is null or ficha_record.status <> 'Ficha Criada' then
    return new;
  end if;

  select nome
    into cliente_nome
  from public.clientes
  where telefone = ficha_record.telefone_cliente;

  for role_record in
    select ur.user_id
    from public.user_roles ur
    where ur.role in ('admin', 'supervisor', 'user')
  loop
    insert into public.notificacoes (
      tipo,
      referencia_id,
      usuario_destino,
      titulo,
      descricao
    ) values (
      'orcamento',
      ficha_record.id,
      role_record.user_id,
      'Novo orçamento recebido',
      coalesce(ficha_record.nome_ficha, ficha_record.id) || ' - ' || coalesce(cliente_nome, 'Cliente')
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trigger_criar_notificacoes_orcamento on public.orcamentos;

create trigger trigger_criar_notificacoes_orcamento
after insert on public.orcamentos
for each row
execute function public.criar_notificacoes_orcamento();
