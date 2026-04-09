

# Plano: Desativar popup de tarefas + Corrigir agendamentos sumindo

## Diagnóstico

### 1. Popup persistente
O popup que a Paula vê **não é o `AtribuicaoOperadorPopup`** (que já foi desativado). É o **`TarefaOpPopupOverlay`**, um componente separado que escuta INSERTs na tabela `tarefas_operacionais_atribuidos` via Realtime. Sempre que o sistema cria uma tarefa operacional de atribuição de chat, esse popup dispara.

### 2. Agendamentos sumindo
Investigação no banco revelou dados corrompidos:
- **FS14-260407**: foi "Agendado" em 07/04, agora está "Orçamento Enviado" com `horario_agendamento: null` e apenas `hora_inicio_agendamento: 13:00` sobreviveu
- **FGM1@260409**: tem `horario_agendamento: 0002-02-12` (data corrompida — ano 0002)
- **FS6-260402**: mudou para "Retorno" em 09/04, agora está "Perdido" sem dados de retorno

**Causa raiz**: a função `salvarFichaEEnviarWebhook` recebe `dataAgend` e `horaAgend` como parâmetros, mas lê `horaFimAgendamento`, `dataRetorno`, `horaRetorno`, `horaFimRetorno` direto do **state do componente** (closures). O autoSave (debounce 500ms) pode disparar com valores de state já limpos (ex: ao trocar de ficha), sobrescrevendo campos válidos do banco com `null`.

Além disso, qualquer save (incluindo mudança de status, pagamento, etc.) reescreve **todos** os campos de agendamento, mesmo quando nenhum campo de agendamento foi alterado.

### 3. Campos "travados"
O campo `hora_fim_agendamento` e os campos de Retorno/Visita Técnica hora-fim **não disparam autoSave** — apenas atualizam state local sem salvar. O operador edita mas nada acontece até salvar manualmente.

---

## Solução

### Arquivo 1: `src/components/TarefaOpPopupOverlay.tsx`
Desativar completamente — retornar `null`, igual ao `AtribuicaoOperadorPopup`.

### Arquivo 2: `src/components/FichaServicoTab.tsx`
Três correções:

**A) Passar TODOS os campos de agendamento como parâmetros** do `salvarFichaEEnviarWebhook` e do `autoSave`, eliminando dependência de closures stale. Adicionar `horaFimAgendamento`, `dataRetorno`, `horaRetorno`, `horaFimRetorno` como parâmetros explícitos.

**B) Os campos `hora_fim_agendamento`, `hora_fim_retorno`, `hora_fim_visita_tecnica` devem disparar autoSave** ao serem alterados, assim como já fazem `dataAgendamento` e `horaAgendamento`.

**C) Não sobrescrever campos de agendamento quando não houver dados para gravar.** Na construção do `updateData`, se os parâmetros de agendamento estão todos vazios E a ficha no banco já tem dados, não incluir esses campos no update. Concretamente: antes de escrever `horario_agendamento: null`, verificar se a ficha carregada (`ficha`) já possuía esse campo preenchido e se o operador intencionalmente limpou (via botão "Limpar agendamento").

---

## Impacto
- Nenhum popup de tarefa operacional aparecerá mais
- Agendamentos existentes no banco não serão mais sobrescritos acidentalmente
- Campos de hora-fim passam a salvar automaticamente ao serem preenchidos
- Dados já corrompidos (ex: FS14-260407) precisarão ser corrigidos manualmente pelos operadores
