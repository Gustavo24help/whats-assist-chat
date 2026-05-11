## Objetivo

No calendário, ao abrir uma ficha (`AgendamentoDetalhesModal`), exibir qual operador colocou aquela ficha em **Agendado** (ou em **Retorno**, no caso de slot de retorno), com data/hora.

## Diagnóstico

- A tabela `fichas_de_servico` **não** tem coluna de "operador que agendou".
- A tabela `ficha_status_historico` registra cada mudança de status via trigger `registrar_mudanca_status`, mas **não** guarda quem fez a mudança (sem `user_id`).
- `system_logs` não cobre mudanças de status.

A fonte natural é o histórico de status — basta enriquecê-lo com o autor.

## Mudanças

### 1. Banco (migration)

- Adicionar em `ficha_status_historico`:
  - `alterado_por uuid` (nullable)
  - `alterado_por_nome text` (nullable)
- Atualizar a função `registrar_mudanca_status()` para preencher esses campos com `auth.uid()` e o nome buscado em `profiles` (quando disponível). Quando a mudança vier de service role / webhook (sem `auth.uid()`), os campos ficam nulos — comportamento idêntico ao atual para registros antigos.
- **Sem backfill / sem alteração de dados existentes**: registros antigos seguem com os campos nulos; a UI mostra `—`. Nenhum dado de status, horário ou ficha é tocado.

### 2. Frontend — `src/components/calendario/AgendamentoDetalhesModal.tsx`

- Ao abrir o modal, fazer um `select` em `ficha_status_historico` filtrando por:
  - `ficha_id = ficha.id`
  - `status_novo = 'Agendado'` (slots normais/visita) ou `status_novo = 'Retorno'` (quando `tipoSlot === 'retorno'`/`ficha.tipo_agendamento === 'retorno'`)
  - `order by created_at desc limit 1`
- Exibir um novo bloco no grid de informações:
  - **"Agendado por"**: `alterado_por_nome` (ou `—` se nulo) + data/hora formatada (`dd/MM/yyyy HH:mm`).
- Estado de loading discreto enquanto busca.

### 3. Sem efeitos colaterais

- Nenhuma alteração em horários, fuso, valores ou status existentes.
- Trigger continua registrando histórico exatamente como hoje; só passa a anexar o autor quando houver sessão autenticada.
- Outras telas que leem `ficha_status_historico` (ex.: `FichaDetalhes` aba Histórico) continuam funcionando — campos novos são opcionais.

## Detalhes técnicos

```sql
ALTER TABLE public.ficha_status_historico
  ADD COLUMN IF NOT EXISTS alterado_por uuid,
  ADD COLUMN IF NOT EXISTS alterado_por_nome text;

-- atualizar registrar_mudanca_status() para INSERT com:
--   alterado_por      := auth.uid(),
--   alterado_por_nome := (select nome from profiles where id = auth.uid())
```

UI (resumo do bloco novo no modal):

```tsx
<div>
  <span className="text-muted-foreground">Agendado por</span>
  <p className="font-medium">
    {agendadoPor?.nome ?? '—'}
    {agendadoPor?.created_at && (
      <span className="text-xs text-muted-foreground ml-1">
        ({format(new Date(agendadoPor.created_at), "dd/MM/yyyy HH:mm")})
      </span>
    )}
  </p>
</div>
```
