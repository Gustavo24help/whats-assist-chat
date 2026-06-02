## Diagnóstico

Tirei um raio-X do banco. O disco está em 58% porque o Postgres está fazendo varreduras completas (seq scan) excessivas em poucas tabelas pequenas, lendo bilhões de linhas:

| Tabela | Seq scans | Linhas lidas em seq scan |
|---|---|---|
| `mensagens` (72k linhas, 42 MB) | 4,37 milhões | **18,6 bilhões** |
| `fichas_de_servico` (1,5k linhas) | 3,78 milhões | 665 milhões |
| `clientes` (1,8k linhas) | 601 mil | 640 milhões |
| `mensagem_leitura_operador` | 59 mil | 166 milhões |
| `orcamentos` | 191 mil | 153 milhões |

Também há ~100 MB de tabelas de backup/log que não são mais usadas (`mensagens_backup_teste` 52 MB, `webhook_debug_logs` 37 MB, `mensagens_backup` 12 MB) inflando o disco e os backups WAL.

Memória em 74% e 2,4 M de transações com rollback (provavelmente conflitos de inserts duplicados do Realtime/Twilio) também contribuem.

**Conclusão:** dá para reduzir bem o IO sem upgrade, atacando as causas. Plano abaixo é só ajuste de banco e queries — não muda nenhuma regra de negócio nem nenhum dado salvo.

## Plano (apenas otimização, sem mudar comportamento)

### 1. Limpar tabelas mortas (≈ 100 MB liberados)
Migration única, com `DROP TABLE IF EXISTS` apenas para tabelas comprovadamente sem uso:
- `mensagens_backup_teste` (52 MB, nenhuma referência no código).
- `mensagens_backup` (12 MB, nenhuma referência no código).
- Truncar `webhook_debug_logs` mantendo só últimos 7 dias (37 MB → ~2 MB) e criar policy de retenção (cron diário já existente).

Antes de cada drop a migration faz `SELECT count(*)` e grava num log para você poder auditar. Nenhum dado operacional é tocado.

### 2. Índices que estão faltando (causa principal dos seq scans)
Adicionar como `CREATE INDEX CONCURRENTLY IF NOT EXISTS` (não bloqueia o app):

- `mensagens(data_hora DESC)` — usado por sync-twilio, reconcile, painel.
- `mensagens(remetente, data_hora DESC)` — usado pela RPC `get_ultima_msg_cliente` (hoje filtra `remetente <> '...whatsapp:+554138911555'` sem índice composto).
- `mensagens(tipo_remetente)` parcial onde `tipo_remetente IS NOT NULL`.
- `fichas_de_servico(status, created_at DESC)` — dashboards e KPIs filtram por status + data.
- `fichas_de_servico(cliente_id)` se a coluna existir (verifico antes).
- `clientes(status_conversa)` e `clientes(ultima_interacao DESC)` — usado pelo Chat BETA.
- `orcamentos(ficha_id)` e `orcamentos(created_at DESC)`.
- `mensagem_leitura_operador(cliente_telefone)` — leituras de unread por telefone.

Já existe o índice certo para `(cliente_id, data_hora DESC)`, então as RPCs novas vão começar a usar plano correto assim que os índices acima entrarem e o ANALYZE rodar.

### 3. Ajustar a RPC `get_ultima_msg_cliente`
Substituir `MAX(data_hora) ... GROUP BY cliente_id` por `DISTINCT ON (cliente_id) ... ORDER BY cliente_id, data_hora DESC`. Mesmo resultado, mas usa direto o índice `(cliente_id, data_hora DESC)` em loose-index-scan e evita ler todas as linhas do cliente. Comportamento idêntico para o frontend.

### 4. Reduzir poll/refetch redundante (sem mudar UX)
Sem mexer em regras, só em frequência:
- `ConversationListBeta`: trocar refetch de fichas/orçamentos a cada mudança Realtime por debounce de 800 ms (hoje dispara várias vezes por segundo quando chega rajada de mensagens).
- `useDashboardSummary` e `useDashboardTV`: aumentar intervalo de re-execução de 30 s para 60 s (valor já era arbitrário; nada visual muda perceptivelmente).
- Remover `select('*')` em 3 lugares onde só são lidas 2–3 colunas (`ChatWindow`, `MobileConversationList`, `useClienteSignalsBeta`), reduzindo bytes lidos por chamada.

### 5. VACUUM + ANALYZE pós-migration
Migration final roda `VACUUM (ANALYZE)` em `mensagens`, `fichas_de_servico`, `clientes`, `mensagem_leitura_operador`, `orcamentos` para o planner usar os novos índices imediatamente.

### Salvaguardas
- Todos os índices são `CREATE INDEX CONCURRENTLY IF NOT EXISTS` → não trava tabela, não muda dados.
- Drops só nas duas tabelas de backup que não aparecem em nenhum arquivo do projeto (`rg` confirmado).
- Truncamento de `webhook_debug_logs` mantém últimos 7 dias para preservar auditoria recente.
- Mudança na RPC mantém assinatura e retorno idênticos; o frontend não precisa mudar.
- Nenhuma alteração em RLS, em valores, em fusos, em status, em campos de horário, ou em dados de fichas/clientes/mensagens.

## Impacto esperado
- Seq scans em `mensagens` devem cair em mais de 90% (consultas que hoje leem 72k linhas vão ler dezenas).
- Disk IO budget projetado: **58% → ~20–25%**.
- Latência percebida no Chat BETA e nas listas cai (menos round trips, menos bytes).
- Sem necessidade de upgrade da instância no curto prazo.

Se aprovar, eu já mando: 1 migration de limpeza + 1 migration de índices + 1 migration da RPC ajustada, mais os 4 ajustes de frontend (debounce/intervalo/colunas).