

## Diagnóstico e Plano de Correção — 3 Problemas Identificados

### Problema 1: Deletar um alerta de status não salva automaticamente
**Causa**: O botão de lixeira (`removeRule`) apenas remove a regra do estado local. O salvamento só acontece ao clicar "Salvar regras". Quando o usuário deleta um alerta e sai da página sem clicar salvar, a exclusão se perde.
**Correção**: Fazer o `handleSave` ser chamado automaticamente após `removeRule`, ou adicionar auto-save via `useEffect` quando `rules` muda (com debounce). Vou optar por chamar save automaticamente após remoção.

### Problema 2: O tempo em minutos fica diminuindo nos alertas
**Causa**: Na `ConversationList`, o `minutosNoStatus` é calculado como `(Date.now() - data_inicio) / (1000 * 60)`. Isso está correto — mostra há quantos minutos o registro está naquele status. Se o valor parece "diminuir", é provavelmente porque ao re-renderizar/recarregar, fichas diferentes aparecem na lista (mudança de dados). A lógica em si está correta. Porém, é possível que o `data_inicio` do `ficha_status_historico` esteja sendo sobrescrito por algo. Vou verificar a query que busca o histórico de status para garantir que pega o registro correto (o que tem `data_fim IS NULL`).

**Verificação necessária**: A query no `ConversationList` que busca `ficha_status_historico` — confirmar que filtra por `data_fim IS NULL` para pegar o registro ativo.

### Problema 3: Widget rotativo mostra apenas o conteúdo fixo atual ("conversas-abertas")
**Causa**: No `renderWidgetContent` (linha 717-721), o case `widget-rotativo` só verifica se `activeRotatingWidget === 'conversas-abertas'` e renderiza esse widget. Para qualquer outro item no ciclo, retorna `null`. Não há outros widgets configuráveis para rotação implementados — o sistema de rotating widget foi preparado na configuração (TVMonitorSettings) mas só tem uma opção ("conversas-abertas"), e no código de render não existem mais cases.

**Correção**: O widget rotativo precisa poder renderizar QUALQUER widget do dashboard, não apenas "conversas-abertas". Vou:
1. Adicionar mais opções ao TVMonitorSettings (ex: funil, métricas de tempo, KPIs)
2. No `renderWidgetContent` case `widget-rotativo`, reutilizar o `renderWidgetContent` do widget selecionado pelo ciclo (chamando recursivamente ou extraindo a lógica)

---

### Tarefas de Implementação

1. **StatusAlertSettings — Auto-save ao deletar**: Chamar `handleSave()` automaticamente quando uma regra é removida (ou melhor, fazer um `useEffect` com debounce que salva quando `rules` muda após o carregamento inicial).

2. **Verificar query de `ficha_status_historico`** na ConversationList para garantir que busca o registro com `data_fim IS NULL` e confirmar que o cálculo de minutos está correto e estável.

3. **Widget Rotativo — Expandir para múltiplos widgets**: Modificar o case `widget-rotativo` no `DashboardTV.tsx` para poder renderizar qualquer widget pelo seu `id`, e adicionar mais opções de widgets ao TVMonitorSettings para que o usuário possa escolher quais widgets entram no ciclo de rotação.

