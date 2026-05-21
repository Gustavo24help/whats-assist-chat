## Plano: Edge Function `processar-analise-diaria`

Cria função que analisa conversas do dia, detecta lacunas e gera análise IA (Claude Haiku) por cliente.

### 1. Tabela nova: `analise_operacional_diaria`

Campos:
- `data_analise` (date)
- `cliente_telefone` (text)
- `ficha_id` (uuid, nullable)
- `fase` (text) — `sem_ficha` | `pre_agendamento` | `pos_agendamento`
- `operador_principal` (text, nullable)
- `total_msgs_cliente`, `total_msgs_atendente` (int)
- `tempo_primeira_resposta_min`, `tempo_resposta_medio_min`, `tempo_em_fase_horas` (numeric, nullable)
- 5 flags `lacuna_*` (boolean)
- `lacuna_detalhes` (jsonb)
- `ia_resumo`, `ia_tom`, `ia_momento_critico`, `ia_sugestao` (text)
- `ia_qualidade_ortografica` (int), `ia_insatisfacao_detectada` (bool)
- `processado_em` (timestamptz), `tokens_usados` (int)
- PK: `(data_analise, cliente_telefone)` para `upsert` com `onConflict`
- Índices: `data_analise`, `ficha_id`, `operador_principal`
- RLS: somente leitura para usuários autenticados (escrita via service_role na Edge Function)

### 2. Edge Function `processar-analise-diaria`

- Arquivo: `supabase/functions/processar-analise-diaria/index.ts` com o código exato enviado.
- Adicionar bloco em `supabase/config.toml`:
  ```
  [functions.processar-analise-diaria]
  verify_jwt = false
  ```
  (permite chamada via cron / POST simples; segurança vem do service-role apenas no servidor)

### 3. Secret necessário

- `ANTHROPIC_API_KEY` — pedir via add_secret antes do deploy. As demais (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) já existem.

### 4. Observações

- Sem cron job nesta etapa — função aceita `POST { "data": "YYYY-MM-DD" }` para reprocessar, ou roda no dia atual sem body. Se quiser execução automática diária, posso adicionar `pg_cron` depois.
- Nenhum dado existente é alterado: a tabela é nova e os `upsert`s atingem apenas linhas dessa tabela. Mensagens, fichas e status históricos são apenas lidos.

### Pergunta (1)

Quer que eu já agende a execução automática diária (ex.: 19:00 BRT) via `pg_cron`, ou prefere rodar manual por enquanto?
