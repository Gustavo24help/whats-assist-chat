## Problema

No `/chat-beta`, ao clicar no banner âmbar **"X atendimentos precisando de resposta"**:

1. O sistema ativa `showAguardandoRespostaOnly = true` e força `statusFilter="all"` + `conversaStatusFilter="todas"`.
2. Conforme o operador trata as fichas (status sai de `Ficha Criada` / `Orçamento Enviado` / `Visita Técnica` vencida), elas deixam de ser elegíveis e a contagem cai.
3. Quando `aguardandoRespostaCount` chega a **0**, o banner é desmontado (`{aguardandoRespostaCount > 0 && ...}`).
4. Mas o estado `showAguardandoRespostaOnly` continua **true** — o filtro segue ativo e a lista mostra "Nenhuma conversa encontrada", mesmo havendo 1522 conversas.

Resultado: o operador "perde" a lista inteira e não tem como destravar (o botão sumiu junto com o banner).

Há ainda um efeito colateral: ao ativar o alerta, ele zera `statusFilter` e `conversaStatusFilter`, mas **não restaura** os valores anteriores quando o operador desativa manualmente — eles ficam `"all"` / `"todas"` permanentemente.

## Solução

Arquivo: `src/components/ConversationListBeta.tsx`

### 1. Auto-desligar o filtro quando a contagem zera

Adicionar um `useEffect` que, quando `aguardandoRespostaCount === 0` e `showAguardandoRespostaOnly === true`, desliga o filtro automaticamente e restaura filtros prévios.

### 2. Memorizar os filtros anteriores ao ativar

Antes de forçar `statusFilter="all"` / `conversaStatusFilter="todas"`, salvar os valores correntes em refs (`prevStatusFilterRef`, `prevConversaStatusFilterRef`). Ao desativar o filtro (manual ou automático), restaurar esses valores.

### 3. Salvaguarda visual: manter o botão visível enquanto ativo

Mudar a condição do banner para:
```
aguardandoRespostaCount > 0 || showAguardandoRespostaOnly
```
Quando ativo mas contagem = 0, mostrar texto **"Nenhum atendimento pendente"** com o `X` ainda clicável para sair do modo. Isso cobre o caso em que o `useEffect` ainda não rodou (corrida de renders).

### 4. Revisão das outras regras de filtro

Auditar o mesmo padrão para evitar bugs análogos:

- **`showServicosParaFinalizarOnly`** — mesma classe de bug. Aplicar o mesmo tratamento (auto-desligar + manter botão enquanto ativo).
- **`showBotDisabledOnly`** — controlado externamente; verificar se some quando contagem zera.
- **`showBookmarked`** — só some se o operador remove todos os marcadores; mesmo padrão recomendado.
- **`unreadFilter === "nao_lidas"`** — não deve auto-desligar (operador escolhe explicitamente).

Para `showServicosParaFinalizarOnly` e `showBookmarked`, aplicar a mesma lógica defensiva: o toggle continua visível enquanto o filtro estiver ativo, com o ícone `X` para sair, mesmo que a contagem caia para 0.

## Garantias de não-regressão

- Nenhum dado é alterado: somente estado de UI local.
- O comportamento de **ativar** o banner permanece idêntico.
- Operador que **manualmente** clicou para desligar continua tendo o mesmo efeito.
- A restauração dos filtros prévios só acontece para valores que o próprio botão sobrescreveu — outros filtros (tags, bot, pagamento) ficam intactos.

## Arquivos modificados

- `src/components/ConversationListBeta.tsx` — adicionar refs, useEffect de auto-desligamento, ajustar condição de render do banner e replicar para os outros filtros "modo único".
