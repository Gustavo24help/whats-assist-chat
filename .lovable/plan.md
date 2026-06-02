# CRM de Clientes Reais — Plano

## Decisões confirmadas
- **Single-tenant:** sem `org_id`. RLS aberta para `authenticated` (roles internas via `has_role`), como o restante das tabelas operacionais.
- **Backfill + trigger contínuo:** popular agora a partir de `fichas_de_servico` e manter sincronizado quando fichas mudarem.
- **`customers` paralela a `clientes`:** ligadas por `phone = clientes.telefone` (sem FK rígida para não acoplar). `clientes` segue sendo a fonte do chat.
- **Cliente real = tem ao menos 1 ficha com `status IN ('Finalizado','Garantia','Retorno')`.** Caso contrário → `leads`.

## Mapeamento de status fichas → `customer_services.status`
| Status atual           | CRM status            |
|------------------------|-----------------------|
| Finalizado             | finalizado            |
| Garantia               | em_garantia           |
| Retorno                | finalizado (com flag `had_warranty_claim=true` se vier de Garantia anterior) |
| Agendado, Em andamento, Visita Técnica | em_andamento |
| Orçamento Enviado, Ficha Criada, Contato Inicial, pendente | sem_resposta |
| Perdido, Não foi adiante | orcamento_recusado  |

Serviços "finalizados ou em garantia" contam como fechados nos agregados de `customers`.

## 1. Migração SQL
Cria três tabelas com GRANTs + RLS + índices, conforme prompt do usuário, **sem** `org_id` nem `referred_by_customer_id` (campo continua existindo, mas sem FK obrigatória para evitar problemas no backfill).

- `customers` (unique em `phone`)
- `customer_services` (FK → `customers.id`, índice em `ficha_id` único para idempotência)
- `leads` (unique em `phone`)

**RLS:** `SELECT/INSERT/UPDATE/DELETE` liberado para `authenticated`; bloqueado para `anon`. Service role com `ALL`.

## 2. Backfill (uma vez, dentro da mesma migração)
1. Para cada `telefone` distinto em `fichas_de_servico`:
   - Se tem ≥1 ficha em `('Finalizado','Garantia','Retorno')` → cria `customers` + insere TODAS as fichas em `customer_services`.
   - Senão → cria `leads` + agrega `total_quotes_requested`, `last_sku_requested`, etc.
2. Dados puxados de `clientes` (nome, cpf, endereco, bairro, cidade) quando disponíveis.
3. Agregados (`total_services_completed`, `total_spent`, `avg_ticket`, `first/last_service_at`, `preferred_provider_id/name`) calculados em CTEs.

## 3. Triggers de sincronização contínua
- **`fichas_de_servico` AFTER INSERT/UPDATE:** upsert em `customer_services` (idempotente por `ficha_id`), depois recalcula agregados em `customers`. Se telefone só existe em `leads` e a ficha vira `Finalizado/Garantia/Retorno`, **promove**: cria `customers`, migra serviços, marca `leads.converted_at` + `converted_to_customer_id` (não deleta).
- **`mensagens` AFTER INSERT:** atualiza `customers.last_contact_at` / `leads.last_contact_at`.
- Função `recalc_customer_aggregates(_customer_id)` reutilizável.

Triggers usam `SECURITY DEFINER` e `SET search_path=public`, padrão do projeto.

## 4. Frontend — página `/clientes`
Rota nova `src/pages/Customers.tsx` adicionada ao sidebar (visível para admin/chefe/operador).

**Layout:**
- **Cards topo (linha 1 — Clientes):** total de clientes, ticket médio, taxa de conversão (finalizados/total interações), clientes em risco de churn (>90 dias sem serviço).
- **Cards topo (linha 2 — Leads):** total de leads, conversão lead→cliente, leads quentes (`em_negociacao`).
- **Tabs:** "Clientes" · "Re-engajamento" · "Leads".

**Tab Clientes:** tabela com busca (nome/telefone), filtros (status, segment, tags). Colunas: nome, telefone, total gasto, qtd serviços, último serviço, status badge. Click → drawer/modal de detalhe.

**Detalhe do cliente:** perfil + timeline de `customer_services` com cores (verde=finalizado, amarelo=em_garantia, vermelho=cancelado/recusado, cinza=sem_resposta). Edição inline de `notes` e `tags`.

**Tab Re-engajamento:** lista de `customer_services` com status `orcamento_recusado` ou `sem_resposta`, ordenado por data desc, com SKU em destaque + botão "Abrir chat" (deep link `?telefone=`).

**Tab Leads:** tabela com filtros (status, SKU, último contato). Botão **"Promover a cliente"** chama função RPC `promote_lead_to_customer(_lead_id)` que cria `customers`, marca o lead, e migra eventuais `customer_services` (caso já existam por trigger).

**Componentes:** shadcn `Table`, `Tabs`, `Dialog`, `Badge`, `Input`, `Select`. Tokens semânticos do design system.

## 5. Salvaguardas (project-knowledge)
- Backfill é **idempotente** (`ON CONFLICT DO NOTHING` em `customer_services.ficha_id`).
- Trigger nunca sobrescreve `notes`, `tags`, `status` manuais — só recalcula campos derivados.
- Não toca em `clientes`, `fichas_de_servico`, nem altera timezones/valores existentes.
- Promoção lead→cliente preserva o registro do lead com `converted_at` (não deleta).

## Detalhes técnicos
- `customers.phone` UNIQUE; `leads.phone` UNIQUE; um telefone nunca está nos dois ativos (lead vira `converted` ao promover).
- `customer_services.ficha_id` UNIQUE para garantir idempotência do trigger.
- Função `has_role` já existente é usada nas RLS via `EXISTS`.
- Triggers de agregação debounceadas por ficha (uma execução por mudança de status/valor).

## Entregáveis
1. Uma migração: tabelas + GRANTs + RLS + índices + função `recalc_customer_aggregates` + triggers + backfill + RPC `promote_lead_to_customer`.
2. `src/pages/Customers.tsx` + sub-componentes (`CustomersTab`, `LeadsTab`, `ReengagementTab`, `CustomerDetailDialog`).
3. Hooks: `useCustomers`, `useLeads`, `useCustomerServices`, `useCustomerMetrics` (com `fetchAllPaginated`).
4. Entrada no sidebar.

Sem mudanças em código de chat, fichas, financeiro ou automações existentes.
