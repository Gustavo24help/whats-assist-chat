## Criar tabela `pre_qualificacao_bot`

### Ajuste necessário
`fichas_de_servico.id` é do tipo `text` (ex: `FS-TESTE-003`), não `uuid`. Por isso `ficha_id` precisa ser `text` para o FK funcionar. Mantenho todo o resto do que você pediu.

### Migration

```sql
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

-- Service role (usado pelas Edge Functions com SUPABASE_SERVICE_ROLE_KEY) bypassa RLS por padrão,
-- então não é necessária policy adicional para inserts da edge function `receber-ficha`.
```

### Após migration rodar
Confirmo o sucesso e fico aguardando você disparar o teste com `FS-TESTE-004` para validar que `receber-ficha` agora grava em `pre_qualificacao_bot` (a função já tenta inserir — só estava falhando silenciosamente com warning no log).

### Observação
As policies pedidas são para `authenticated`. A edge function usa `service_role`, que ignora RLS — então o insert vai funcionar independentemente. Se você quiser também permitir leitura pelo cliente anon (como outras tabelas operacionais do projeto), me avise para adicionar policies `anon`.