

## Diagnóstico — divergência no alerta "precisando de resposta"

Você tem **3 fichas com status "Ficha Criada"** e **6 com "Orçamento Enviado"** (total = 9). O alerta no Chat BETA mostra **5**. A divergência tem duas causas distintas que se combinam.

### Causa 1 — A regra atual NÃO conta todas as fichas no escopo

Hoje a regra do alerta (em `ConversationListBeta.tsx`, linhas 1137-1143 e 441-447) exige **três condições simultâneas**:

1. `bot_habilitado = false` (bot desligado)
2. `marcado_nao_lido = true` (a conversa foi marcada como não lida pelo operador)
3. status da ficha em `Ficha Criada` ou `Orçamento Enviado` **OU** Visita Técnica já passou

Pelo banco hoje: das 9 fichas no escopo (3 + 6), nenhuma tem `bot_habilitado = false` E `marcado_nao_lido = true` ao mesmo tempo. A contagem real pela regra atual seria **0**, não 5 nem 9.

Conclusão: a regra está restritiva demais. Você quer que **toda conversa em "Ficha Criada" / "Orçamento Enviado" / "Visita Técnica passada" entre no alerta** — independente de bot/leitura. É isso que bate com o número 9 esperado.

### Causa 2 — O "5" que aparece é estado obsoleto

As 3 conversas que hoje têm `bot off + não lido` não estão no escopo (estão em Perdido / Agendado / Finalizado). Ou seja, com a regra atual, deveria mostrar **0**. O "5" provavelmente vem de um snapshot anterior (antes do último ajuste) que ainda não atualizou na sua tela, ou de fichas que mudaram de status depois que a contagem foi feita.

---

## Mudança proposta

Reescrever a regra de elegibilidade do alerta e do filtro para refletir exatamente o que você descreveu antes:

**Nova regra:** uma conversa entra no alerta/filtro "precisando de resposta" se:

- A ficha ativa está em status **"Ficha Criada"** ou **"Orçamento Enviado"**, **OU**
- A ficha ativa tem uma **Visita Técnica agendada cuja hora já passou** (independente do status atual da ficha)

Removidas as exigências de `bot_habilitado = false` e `marcado_nao_lido = true` — elas não fazem parte do critério que você definiu.

### Detalhes técnicos

Arquivo: `src/components/ConversationListBeta.tsx`

1. **Função `isAguardandoRespostaEligivel`** (linhas 50-66): manter como está (já implementa a regra correta de status + VT passada).

2. **`aguardandoRespostaCount`** (linhas 1137-1143): remover as duas checagens extras, mantendo só `isAguardandoRespostaEligivel(c)`.

3. **Filtro `showAguardandoRespostaOnly`** (linhas 441-447): mesma simplificação — aplicar apenas `isAguardandoRespostaEligivel(c)`.

### Resultado esperado

Com os dados atuais do banco:
- Alerta passará a mostrar **9** (3 Ficha Criada + 6 Orçamento Enviado + 0 VT passada)
- Ao clicar no alerta, o filtro listará exatamente essas 9 conversas

### Garantias de segurança

- Não altera nenhum dado armazenado (apenas lógica de exibição em memória)
- Não toca em fuso/horário/agendamento
- Não modifica RLS, schema ou Edge Functions
- A função helper já existente é reaproveitada — comportamento continua determinístico

