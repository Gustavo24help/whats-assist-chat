create table public.pre_qualificacao_bot (
  id uuid primary key default gen_random_uuid(),
  ficha_id text references public.fichas_de_servico(id) on delete cascade not null,
  dados jsonb,
  sku_sugerido text,
  confianca_classificacao numeric(3,2),
  created_at timestamptz default now()
);

create index idx_pre_qualif_ficha on public.pre_qualificacao_bot(ficha_id);

alter table public.pre_qualificacao_bot enable row level security;

create policy "Operadores leem pre_qualificacao"
  on public.pre_qualificacao_bot for select to authenticated using (true);

create policy "Edge Functions inserem pre_qualificacao"
  on public.pre_qualificacao_bot for insert to authenticated with check (true);

create policy "Edge Functions atualizam pre_qualificacao"
  on public.pre_qualificacao_bot for update to authenticated using (true);