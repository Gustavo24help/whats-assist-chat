alter table public.fichas_de_servico
  add column if not exists agendamento_provisorio boolean not null default false,
  add column if not exists boas_vindas_lead_enviada boolean not null default false;

update public.fichas_de_servico set boas_vindas_lead_enviada = true where boas_vindas_lead_enviada = false;