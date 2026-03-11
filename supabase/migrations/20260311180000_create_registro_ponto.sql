create table if not exists public.registro_ponto (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entrada_em timestamptz not null default now(),
  saida_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_registro_ponto_user_id_entrada_em
  on public.registro_ponto (user_id, entrada_em desc);

alter table public.registro_ponto enable row level security;

create policy "Users can read own registro_ponto"
  on public.registro_ponto
  for select
  using (auth.uid() = user_id);

create policy "Users can create own registro_ponto"
  on public.registro_ponto
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own registro_ponto"
  on public.registro_ponto
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
