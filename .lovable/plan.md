## Diagnóstico — o que está deixando o ChatBeta lento

Investiguei `ConversationListBeta.tsx`, `ChatWindowBeta.tsx` e `useClienteSignalsBeta.ts`. Os gargalos são:

### 1. Lista de conversas refaz tudo a cada evento
Em `ConversationListBeta.tsx` (linhas 243–309):
- Qualquer INSERT/UPDATE/DELETE em `mensagens` (de QUALQUER cliente, do sistema todo) chama `fetchClientes()`.
- Mesmo gatilho para `clientes`, `fichas_de_servico` e `mensagem_leitura_operador`.
- Mais um `setInterval` de 60s rodando `fetchClientes` + `fetchServicosParaFinalizar` + `fetchSemOrcamento`.
- Cada `fetchClientes()` executa ~7 queries grandes:
  1. paginação completa de `clientes` (1000 em 1000),
  2. `mensagens` (todos os telefones, em chunks de 500),
  3. `mensagens` de novo só para a tag "última msg por X",
  4. `fichas_de_servico` ativas,
  5. `fichas_de_servico` últimas para quem não tem ativa,
  6. `orcamentos`,
  7. `ficha_status_historico`,
  8. RPC `get_unread_cliente_msgs`.

Em ambiente real, isso roda dezenas de vezes por minuto. É a causa principal da lentidão na lista.

### 2. Lista renderiza 1500+ cards sem virtualização
Linha 1797: `filteredClientes.map(...)` renderiza todos os `ConversationCard` de uma vez. Com mais de 1.000 conversas, qualquer re-render trava o navegador. `react-window` já está instalado mas não é usado.

### 3. Janela de conversa carrega 100 mensagens de cara
`ChatWindowBeta.tsx` linha 203: `MESSAGES_PER_PAGE = 100`. Toda vez que abre uma conversa, busca 100 mensagens + busca todos os "reply_to" + roda `fetchClienteData` + `fetchAtendentes` em paralelo. Para conversas longas com mídia/áudio é pesado.

### 4. Polling extra dentro do ChatWindow
Linhas 746–787: a cada 30s busca até 200 mensagens recentes do cliente aberto + chama `fetchClienteData()`. O Realtime já cobre isso; o polling só serve de fallback para quem tem websocket bloqueado.

### 5. Coach IA dispara em toda mensagem nova
`useClienteSignalsBeta.ts` re-busca 30 mensagens + ficha + orçamentos + chama edge function `vendas-assistant` a cada INSERT em `mensagens` daquele cliente.

---

## Plano de otimização

Foco: reduzir o número de queries, paralelizar carga inicial, virtualizar a lista, paginar mensagens sob demanda. **Sem mudar nenhum dado, sem alterar layout, sem tocar em RLS, sem alterar fusos.**

### A. ConversationListBeta — refetch incremental e debounced

1. **Eliminar refetch global por evento Realtime.**  
   Trocar os handlers que chamam `fetchClientes()` por uma estratégia incremental:
   - INSERT/UPDATE em `mensagens`: atualizar apenas o cliente afetado no `state` (recalcular `ultima_msg_por`, `unread_count_real`, `dentroJanela`) — sem refetch.
   - UPDATE em `clientes`: atualizar só aquele registro no array.
   - INSERT/DELETE em `clientes`: aí sim refetch (raro).
   - `fichas_de_servico` / `orcamentos`: atualizar só o cliente cujo `ficha_id_real` coincide.

2. **Debounce de segurança.**  
   Quando refetch for inevitável, agrupar chamadas com debounce de 2s (`useDebouncedCallback`) para não disparar 10x em sequência.

3. **Reduzir o polling de 60s para 5min** como rede de proteção (Realtime já faz o trabalho).

4. **Carregar dados auxiliares só quando necessário:**
   - `ultimasMensagensQualquer` (a tag "última msg por X") atualmente faz uma 2ª varredura de `mensagens` em cima de TODOS os telefones. Mover esse dado para a mesma RPC `get_unread_cliente_msgs` (ampliando o retorno com `ultimo_remetente` e `ultimo_operador_nome`), ou tornar opcional.

### B. ConversationListBeta — virtualização da lista

5. **Adotar `react-window` (`FixedSizeList`)** no `filteredClientes.map` (linha 1797). Cada card tem altura previsível (~88–96px). Isso faz a lista renderizar só ~15 cards visíveis em vez de 1500+.

### C. ChatWindowBeta — abrir conversa rápido

6. **Reduzir página inicial de mensagens de 100 para 30.**  
   `MESSAGES_PER_PAGE = 30` no carregamento inicial; o botão "Carregar mais" continua funcionando e busca em blocos de 50.

7. **Cortar o polling de 30s** dentro do ChatWindow. Realtime + reconexão automática do Supabase já cobrem o caso comum. Manter apenas um "catch-up" único quando a aba volta ao foco (`visibilitychange`), não a cada 30s.

8. **Carregar `fetchClienteData` e `fetchAtendentes` em paralelo com `fetchMensagens`** (já é Promise.all, ok), mas **não bloquear a UI no `fetchAtendentes`** — pode rodar em background sem impactar `isLoadingMessages`.

### D. useClienteSignalsBeta — não bloquear

9. **Atrasar o disparo do coach IA em 1.5s após abrir a conversa** (já existe debounce parcial). Garantir que a chamada à edge function `vendas-assistant` não rode antes da conversa estar visível.
10. **Cancelar fetch anterior** ao trocar de cliente (AbortController) para não desperdiçar request.

### E. Memoização de cards

11. **`ConversationCard` já está com `React.memo`** (verificado). Garantir que as props passadas no `.map` sejam estáveis (objetos derivados memoizados) para que `memo` realmente evite re-renders quando só um cliente muda.

---

## O que NÃO vai mudar (segurança)

- Nenhuma alteração em queries de escrita, RLS, edge functions ou estrutura de tabelas.
- Nenhuma mudança em horários/timezones/cálculos de janela 24h.
- Nenhuma mudança em layout, cores, posicionamento ou comportamento de filtros.
- Funcionalidade de "marcar como não lida", takeover, atribuição, busca, tags — tudo permanece igual.
- Fallback de polling continua existindo (apenas em frequência muito menor) para redes que bloqueiam websocket.

## Arquivos que vou tocar

- `src/components/ConversationListBeta.tsx` — refetch incremental, debounce, virtualização, polling 5min.
- `src/components/ChatWindowBeta.tsx` — `MESSAGES_PER_PAGE = 30`, remover polling 30s, manter catch-up por visibilitychange.
- `src/hooks/useClienteSignalsBeta.ts` — debounce + AbortController.

## Resultado esperado

- Abrir o ChatBeta: de ~5–10s para ~1–2s.
- Trocar de conversa: de ~2–4s para instantâneo.
- Lista responsiva mesmo com 2.000+ conversas.
- Reduzir drasticamente uso de CPU e tráfego com o backend.
