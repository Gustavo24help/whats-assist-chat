
# Performance dos chats + fim do reload ao criar ficha

Dois problemas distintos, atacados juntos.

## 1. Acabar com o reload após criar ficha (impacto imediato)

Hoje, em `src/components/CriarFichaDialog.tsx` (linha 197), após criar a ficha o código faz:

```ts
setTimeout(() => { window.location.reload(); }, 3000);
```

Isso recarrega a página inteira — recarrega chat, lista, mensagens, conexões realtime. É o que dá a sensação de "tudo travou" depois de criar ficha.

**O que fazer:**
- Remover o `window.location.reload()`.
- Em vez disso, sinalizar a atualização localmente:
  - Disparar um `CustomEvent` (ex.: `ficha-criada`) com `{ telefone, fichaId }`.
  - `FichaPanel` escuta o evento e chama `fetchFichas()` se o telefone bater (já existe lógica de refetch lá).
  - `ConversationListBeta` já recebe o realtime de `fichas_de_servico` via canal `fichas-para-finalizar-list` e `clientes-changes` (atualização de `ficha_ativa_id`), então a lista atualiza sozinha em ~1.5s sem reload.
- Fechar o diálogo imediatamente após o insert + toast de sucesso (sem o setTimeout de 3s).
- Manter o webhook em background como já está.

Resultado: criar ficha vira instantâneo, sem perder estado do chat aberto, sem reabrir conexões realtime.

## 2. Lentidão geral nos chats

Investiguei `ConversationListBeta.tsx` (2127 linhas) e `ChatWindowBeta.tsx` (3219 linhas). Achei os gargalos reais:

### 2a. `fetchClientes()` é pesadíssimo e roda demais

Em `ConversationListBeta.tsx` (linha 1128) cada execução faz:
1. `count` de arquivados
2. Paginação de TODOS os clientes (sem teto) com join em `profiles`
3. `chunkedIn` de mensagens para TODOS os telefones (chunks de 500) — duas vezes (`mensagens` filtrado + `mensagens` qualquer)
4. `chunkedIn` de fichas ativas
5. `chunkedIn` de últimas fichas para quem não tem ativa
6. Mais consultas auxiliares depois

E esse `fetchClientes` é disparado (debounced 1.5s, maxWait 5s) por **qualquer** INSERT/UPDATE/DELETE em `mensagens`, `clientes` e `mensagem_leitura_operador`. Em horário de pico, ele praticamente nunca para de rodar.

**O que fazer:**
- **Atualização incremental no realtime, em vez de refetch global.**
  - No handler de `mensagens-beta-changes`, ler `payload.new.cliente_id`. Se o cliente já está na lista, atualizar só o campo `ultima_interacao` / `ultima_msg_por` desse item no estado (mutação local em O(1)).
  - Só chamar `fetchClientes()` quando o `cliente_id` da mensagem não estiver na lista carregada (cliente novo).
- No handler de `clientes-changes`, idem: atualizar a linha local pelo `payload.new`.
- No handler de `mensagem_leitura_operador`, atualizar apenas o `unread state` do telefone do payload, sem refetch.
- Filtrar os canais postgres_changes que dá pra filtrar (`mensagem_leitura_operador` já tem `filter: user_id=eq.<id>`, manter).

### 2b. Queries iniciais excessivamente largas

- Substituir a dupla varredura de `mensagens` por uma única consulta com `select cliente_id, data_hora, remetente, tipo_remetente, operador_nome` e derivar ambos os mapas em memória.
- Reduzir o `select` de `clientes` a colunas realmente usadas no card da lista (`telefone, nome, ultima_interacao, ficha_ativa_id, atendente_id, status_conversa, arquivado, bot_habilitado, tags, ...`) em vez de `*`. Hoje vem coluna por coluna inútil + payload duplicado por realtime.
- Manter o `chunkedIn` mas usar `Promise.all` entre os chunks (já é sequencial hoje — fica ~2-3x mais rápido em listas grandes).

### 2c. Polling redundante

`pollingInterval` (linha 548) chama `fetchClientes + fetchServicosParaFinalizar + fetchSemOrcamento` a cada 5 minutos. Com as atualizações incrementais acima, dá pra subir para 15 min apenas como rede de segurança.

### 2d. ChatWindowBeta — canais realtime por cliente

Cada conversa aberta cria 4 canais (`mensagens-${tel}`, `bot-messages-${tel}`, `bot-status-${tel}`, `takeover-${tel}`). Já é o esperado; o que está doendo é re-render. Aplicar:
- `React.memo` no item da lista de mensagens (`MessageBubble`/equivalente) com comparação por `id` + `texto` + `status`.
- Garantir que callbacks passados pra cada bubble usem `useCallback` estável (alguns hoje recriam por render).

## 3. Ordem de execução

```text
1. Remover reload do CriarFichaDialog + emitir CustomEvent
2. Atualização incremental no canal mensagens-beta-changes
3. Atualização incremental no canal clientes-changes
4. Unificar a dupla query de mensagens em fetchClientes
5. Reduzir colunas do select de clientes
6. (Opcional) Memoizar MessageBubble e estabilizar callbacks
```

Cada passo é independente e seguro: nenhum altera dados gravados, fuso horário ou regras de negócio — só muda como o cliente busca/atualiza o que já existe.

## 4. Riscos e salvaguardas

- Atualização incremental pode "perder" alguma alteração rara — por isso mantemos o polling de segurança (15 min) e mantemos `debouncedFetchClientes` como fallback se o `payload.new` vier sem `cliente_id` (não deve, mas garantimos).
- Remoção do reload: garantir que `FichaPanel` realmente recarrega ao receber o evento (já existe `fetchFichas()` no `useEffect([clienteTelefone])`, vamos adicionar listener pro evento custom também).
- Nenhuma alteração em Edge Function, migrations, schema, RLS ou triggers.

## 5. O que NÃO entra agora

- Virtualização da lista de conversas (react-window): só vale a pena depois das melhorias acima; posso fazer numa segunda rodada se ainda houver lentidão visível em listas > 500 cards.
- Upgrade do Lovable Cloud (instance size): só sugerir se, após as otimizações de código, o monitor ainda mostrar fila no backend.
