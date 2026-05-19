## Apagar ficha duplicada FGM4@260519

### Situação
O cliente `whatsapp:+554196868812` (Regina Lugnani) tem **duas fichas criadas hoje**:

| ficha | criada em | status |
|---|---|---|
| `FGM4@260519` | 14:21 | Ficha Criada (duplicada — apagar) |
| `FS5-260519` | 14:58 | Ficha Criada (manter) |

### Referências encontradas em `FGM4@260519`
- `mensagens`: **27 registros** vinculados
- `conversa_ficha_vinculo`: **1 registro** ativo
- Nenhuma referência em transações financeiras, tarefas, contas a receber, NPS, histórico de status, pré-qualificação, bot, coaching, grupos, etc.
- Nenhum cliente tem `ficha_ativa_id = 'FGM4@260519'`

### Ação proposta (uma migration de dados, atômica)

1. `UPDATE mensagens SET ficha_id = 'FS5-260519' WHERE ficha_id = 'FGM4@260519'` — preserva o histórico de chat na ficha correta (mesmo telefone, mesmo cliente).
2. `UPDATE conversa_ficha_vinculo SET ficha_id = 'FS5-260519' WHERE ficha_id = 'FGM4@260519'` — religa o vínculo de conversa à ficha que fica.
3. `DELETE FROM fichas_de_servico WHERE id = 'FGM4@260519'` — remove a ficha duplicada.

### Validação pós-execução
- `FGM4@260519` não existe mais em `fichas_de_servico`.
- `FS5-260519` aparece com **27+ mensagens** na conversa (sem perda de histórico).
- Nenhuma outra ficha, cliente, transação ou agendamento é tocada.

### Fora de escopo
Qualquer alteração nas outras 39 fichas `FGM4@*` listadas, ou em `FS5-260519`.