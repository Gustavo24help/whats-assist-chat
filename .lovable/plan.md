

# Correções no Chat BETA: Filtro de Ficha, Não Lido, Resumo de Fichas e Alerta de Atendimento

## Problemas identificados

### 1. Filtro por ficha mostra mensagens erradas
**Causa**: Na linha 2571 do `ChatWindowBeta.tsx`, o filtro permite mensagens sem `ficha_id` (`|| !m.ficha_id`). Isso faz com que qualquer mensagem antiga (antes do sistema de vinculação por ficha) apareça junto. O correto é: quando filtrando por ficha, mostrar APENAS mensagens dessa ficha, sem incluir mensagens sem ficha.

### 2. Notificação de não lido não desaparece ao ler
**Causa**: O `clearUnreadMark` é chamado ao montar o `ChatWindowBeta` (linha 425), mas o `ConversationListBeta` atualiza via polling (60s). O problema é que ao selecionar um cliente, `handleSelectCliente` no `ChatBeta.tsx` faz `setUnreadMessages(prev => ({ ...prev, [cliente.telefone]: 0 }))` — porém o `ConversationCard` usa `cliente.marcado_nao_lido` (calculado pelo `perOperatorUnread` dentro de `fetchClientes`), não o `unreadMessages` do pai. A atualização de `last_read_at` no banco ocorre via `clearUnreadMark`, mas o `fetchClientes` só roda no próximo polling ou evento realtime. O canal realtime para `mensagem_leitura_operador` já existe (linha 254), mas pode não disparar imediatamente pois o filtro `user_id=eq.${user.id}` exige que o registro já exista antes do subscribe.

**Correção**: Forçar atualização local imediata do `marcado_nao_lido` quando o operador seleciona uma conversa, sem esperar o polling.

### 3. Resumo de fichas no painel direito não bate
**Causa**: O `FichaPanelBeta` mostra apenas 3 quadros (Ativas, Finalizado, S/ Orçamento). Faltam os quadros de "Perdidas". Além disso, "S/ Orçamento" está filtrando por `status === 'Ficha Criada'` que pode não representar corretamente fichas sem orçamento enviado.

**Correção**: Adicionar 4 quadros conforme solicitado: Finalizadas, Perdidas, Ficha Criada, S/ Orçamento (fichas sem orçamento na tabela `orcamentos`).

### 4. Alerta de clientes aguardando resposta no frontend
**Causa**: A edge function `check-unanswered-clients` já faz a análise por IA mas só notifica via WhatsApp. Precisa replicar essa lógica no frontend como indicador visual na lista de conversas.

## Plano de implementação

### Passo 1: Corrigir filtro por ficha (ChatWindowBeta.tsx)
- Linha 2571: mudar `m.ficha_id === fichaFilterId || !m.ficha_id` para `m.ficha_id === fichaFilterId` apenas
- Mensagens sem `ficha_id` não devem aparecer quando o filtro por ficha está ativo

### Passo 2: Corrigir não lido ao abrir conversa (ConversationListBeta.tsx)
- Quando `onSelectCliente` é chamado, atualizar localmente o `marcado_nao_lido` do cliente para `false` imediatamente no estado `clientes`, sem esperar o polling
- Adicionar um `useEffect` ou callback que, ao mudar `selectedClienteTelefone`, seta o `marcado_nao_lido` local para `false` no array `clientes`

### Passo 3: Corrigir resumo de fichas (FichaPanelBeta.tsx)
- Trocar os 3 quadros atuais por 4: **Ficha Criada**, **Finalizadas**, **Perdidas**, **S/ Orçamento**
- "S/ Orçamento" será calculado buscando na tabela `orcamentos` quais fichas do cliente têm ou não orçamento vinculado
- "Perdidas" = fichas com status `Perdido` ou `Não foi adiante`
- Layout: `grid-cols-4` com quadros menores

### Passo 4: Alerta de clientes aguardando resposta (ConversationListBeta.tsx)
- Reutilizar a lógica do `check-unanswered-clients` no frontend: buscar clientes com bot desabilitado, onde a última mensagem é do cliente e tem mais de 30 minutos
- Não precisa chamar IA no frontend — basta a heurística simples: última mensagem é do cliente + mais de 30 min sem resposta + bot desabilitado
- Exibir um indicador amarelo (estilo do botão de "atendimento" existente) mostrando: "XX atendimentos precisando de resposta"
- Ao clicar, filtrar a lista para mostrar apenas essas conversas

### Arquivos modificados
- `src/components/ChatWindowBeta.tsx` — fix filtro ficha (1 linha)
- `src/components/ConversationListBeta.tsx` — fix não lido ao selecionar + alerta aguardando resposta
- `src/components/FichaPanelBeta.tsx` — 4 quadros de resumo com busca de orçamentos

