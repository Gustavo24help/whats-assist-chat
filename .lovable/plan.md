

## Escopo do que será corrigido no `/chat-beta`

Quatro frentes pedidas, todas no Chat BETA (e ajuste no Dashboard TV onde indicado):

---

### 1. Alinhar contagem por status entre Chat BETA e Dashboard TV

**Diagnóstico**
- Sidebar do `/chat-beta` conta uma conversa por cliente, usando `clientes.status_ficha` (status da ficha **ativa** daquele cliente).
- O painel "Acompanhamento de Conversas" do Dashboard TV consulta `fichas_de_servico` direto e conta **todas** as fichas naqueles status. Por isso aparece 14 em "Orçamento Enviado" enquanto o Chat BETA mostra 13: existe pelo menos uma ficha "Orçamento Enviado" que **não** é a ficha ativa de nenhum cliente (cliente já avançou para outra ficha mais nova).

**Correção (Dashboard TV)**
- Em `src/components/AcompanhamentoConversas.tsx`, mudar a fonte para a mesma base do Chat BETA: ler `clientes` (com `status_ficha`, `ficha_ativa_id`, `nome`, `telefone`, `nome_ficha`) e cruzar com `fichas_de_servico` apenas para pegar `created_at`, `valor_total` e `ficha_status_historico` da ficha ativa de cada cliente.
- Filtrar pelos 4 status atuais (`Ficha Criada`, `Orçamento Enviado`, `Visita Técnica`, `Agendado`) usando `clientes.status_ficha`.
- Resultado: contagem do TV passa a bater 1:1 com a do Chat BETA, sem alterar nada nos dados, só na fonte da consulta.

---

### 2. Bolinha de não lido voltando a aparecer no Chat BETA

**Diagnóstico**
- A política nova baseada em `mensagem_leitura_operador` está correta no `chatBetaUnread.ts`.
- O efeito ainda volta porque o `ChatBeta.tsx` continua passando `unreadMessages` (estado local alimentado por `NotificationSystem`) para `ConversationListBeta`, e o componente ainda usa esse prop em alguns pontos para compor o badge / filtros, fazendo o número reaparecer alguns segundos depois do `markConversationRead`.
- Além disso, ainda existe um `setUnreadMessages(prev => …, 0)` em `handleSelectCliente` que mascara o problema mas não resolve, pois novas inserções via realtime tornam a chave > 0 de novo.

**Correção**
- Remover por completo o estado `unreadMessages` e o callback `onNewMessage` do `ChatBeta.tsx`.
- `NotificationSystem` continua só com som + toast (nenhum badge).
- Em `ConversationListBeta.tsx`:
  - Eliminar todas as referências a `unreadMessages` no cálculo de badge e do filtro "não lidas".
  - Manter como única fonte: `marcado_nao_lido` (que vem do snapshot derivado de `mensagem_leitura_operador`).
- Em `ChatWindowBeta.tsx`: garantir que `markConversationRead` é chamado:
  - ao montar a janela com a conversa atual,
  - ao chegar mensagem do cliente enquanto a janela está visível,
  - ao trocar de conversa (cleanup do useEffect chama read na anterior se ainda aberta? não — apenas a nova é marcada como lida).
- Resultado: ler → badge some → permanece zero. "Marcar como não lido" no menu continua funcionando porque mexe só na flag `manual_unread`.

---

### 3. Incluir nome do prestador no Resumo (aba Resumo do painel direito)

- `src/components/chat-beta/ResumoFichaTab.tsx` hoje busca `id, nome_ficha, status, categoria_id, valor_total, descricao, preferencia_horario_cliente, horario_agendamento`.
- Adicionar `prestador_id` à query e um segundo `select` em `prestadores` (`nome`) por `cpf = prestador_id`.
- Renderizar um novo bloco "Prestador" entre "Categoria/Valor" e "Resumo do serviço": ícone de pessoa, nome do prestador, ou "Sem prestador atribuído" em itálico.

---

### 4. Topo encavalado + coluna direita sempre aberta + reorganização

**Mudanças no painel direito (`FichaPanelBeta.tsx`)**
- Remover os 4 cartões "Ficha Criada / Finalizadas / Perdidas / S/Orçamento" do topo (a informação já está na ficha e na aba Histórico).
- Remover os 4 botões grandes do topo do painel direito ("Abrir / Av. Prestador / Satisfação / Assumido"). Eles passam a viver no header do chat.
- Painel direito fica: seletor de ficha (compacto) + abas (Resumo, Cliente, Histórico, Informações, Nina, Orçamento).

**Mudanças no `ChatBeta.tsx`**
- Coluna 4 deixa de ser fechável. Remover qualquer botão/state de fechar/abrir o painel direito.
- Tornar a coluna 4 sempre presente quando há conversa selecionada, com largura fixa responsiva (`w-[380px] xl:w-[420px]` mantém, sem botão de toggle, sem aba "Coach IA" duplicada — Coach IA já está dentro da aba Nina).
- Remover o `col4Tab` ("ficha" / "coach"). O `FichaPanelBeta` é o único conteúdo.

**Mudanças no header do chat (`ChatWindowBeta.tsx`)**
- Reorganizar todos os botões do header em **duas linhas** controladas (`flex flex-wrap`), com altura do header passando de fixa `h-14` para `min-h-14`, permitindo quebrar.
- Linha 1 (informativa): nome do cliente + telefone + status da ficha + status do bot.
- Linha 2 (ações), agrupadas em blocos com `Separator` vertical:
  - Bloco "Conversa": Buscar mensagens, Exportar transcrição, Notas, Histórico do bot.
  - Bloco "Atribuição": Abrir conversa, Atribuir operador, Assumir.
  - Bloco "Cliente / Pós-venda" (vindo do painel direito): **Av. Prestador**, **Satisfação (NPS)**.
- Cada botão recebe `size="sm"`, `h-8`, ícone + label curto, com `title` para tooltip.
- Em telas estreitas, o `flex-wrap` quebra naturalmente em 2+ linhas sem cortar nada.

**Critérios de aceite**
- Coluna 4 nunca pode ser fechada; sempre visível em `lg+`.
- Header nunca corta botão. Em qualquer largura `≥ 1024px`, todos os botões são alcançáveis sem scroll horizontal.
- Botões "Av. Prestador", "Satisfação", "Abrir" e "Assumir" só aparecem agora no header do chat (zero duplicação no painel direito).
- Os 4 quadrados de status saem do painel direito.
- Nome do prestador aparece na aba Resumo.
- Contagens "Ficha Criada / Orçamento Enviado / Visita Técnica / Agendado" do Dashboard TV passam a ser idênticas às da sidebar do Chat BETA.
- Marcar como lido remove a bolinha e ela não volta sozinha.

---

### Salvaguardas
- Nenhuma migração de banco. Nenhuma alteração em `mensagens`, `clientes.ultima_interacao`, horários de agendamento, `fichas_de_servico` etc.
- Mudança no Dashboard TV é só de **fonte de leitura**, sem escrita.
- Remoção de `unreadMessages` é puramente de UI; a tabela `mensagem_leitura_operador` continua intacta como fonte de verdade.
- Botões movidos preservam exatamente os mesmos componentes (`AvaliacaoPrestadorFlowPanel`, `NPSFlowPanel`, `AbrirConversaDialog`) — só mudam de container.

### Arquivos afetados
- `src/components/AcompanhamentoConversas.tsx`
- `src/components/ConversationListBeta.tsx`
- `src/components/ChatWindowBeta.tsx`
- `src/components/FichaPanelBeta.tsx`
- `src/components/chat-beta/ResumoFichaTab.tsx`
- `src/pages/ChatBeta.tsx`

