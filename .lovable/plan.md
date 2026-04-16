

## Plano: Vincular fichas de serviço entre clientes/conversas

### Contexto e descoberta

- A ficha hoje tem **1:1** com `telefone_cliente`. Toda visualização (FichaPanel, FichaServicoTab, FichasOverview, ConversasResolver) busca por `telefone_cliente`.
- Já existe a tabela `conversa_ficha_vinculo` (usada apenas no chat de prestadores hoje, sem registros) — mas ela vincula **conversa→ficha**, não **ficha↔ficha**. Não atende ao que o usuário pediu.
- Necessidade: quando dois clientes diferentes (telefones diferentes) falam do **mesmo serviço**, queremos **relacionar fichas** (não duplicar). E se cada cliente já tem uma ficha, queremos **agrupá-las**.

### Modelo proposto: grupos de fichas

Criar conceito de "Grupo de Ficha" (vínculo bidirecional N:N via grupo):

**Nova tabela `ficha_grupos`** (1 linha = 1 agrupamento):
- `id uuid pk`
- `ficha_principal_id text` (a ficha "mestre" — onde valores/status canônicos vivem)
- `criado_por uuid`, `criado_em timestamptz`, `motivo text`

**Nova tabela `ficha_grupo_membros`**:
- `id uuid pk`
- `grupo_id uuid fk → ficha_grupos`
- `ficha_id text fk → fichas_de_servico` **UNIQUE** (uma ficha só pode estar em 1 grupo)
- `papel text` ('principal' | 'vinculada')
- `adicionado_em timestamptz`, `adicionado_por uuid`

**Por que essa estrutura (não um simples `ficha_pai_id`):** permite N fichas no mesmo grupo, futura expansão, e mantém rastreio de quem vinculou. Não altera nenhuma coluna existente em `fichas_de_servico` — zero risco a dados atuais.

### Fluxo de uso (UX)

**1. Na FichaPanel (chat do cliente B), botão novo "🔗 Vincular a ficha existente":**
- Abre dialog com busca (por ID, nome_ficha, nome_cliente, telefone, descrição).
- Mostra fichas ativas (não Finalizado/Perdido), com chips: cliente, status, prestador, valor.
- Ao confirmar:
  - Se ficha B já existe e ficha A já existe → cria/usa grupo, adiciona ambas.
  - Se cliente B ainda não tem ficha → cria ficha "espelho" mínima vinculada (mantém `telefone_cliente` de B, herda `nome_ficha` com sufixo `(vinculada)`, `descricao`, `categoria_id`, `prestador_id`, `endereco`). Status, valores e pagamento permanecem somente na principal.
- Confirmação obrigatória via AlertDialog (segue padrão de mudanças sensíveis do projeto).

**2. Indicador visual nas fichas vinculadas:**
- Badge "🔗 Vinculada — ver ficha principal: {ID}" no topo da FichaServicoTab e em FichaCard, FichasOverview, FichaDetalhes, AcompanhamentoTab e OrcamentosTab.
- Em fichas vinculadas (não-principal), todos os campos canônicos (status, valores, prestador, agendamento, pagamento, orçamentos) ficam **read-only** com aviso "Editar na ficha principal" e botão para abrir a principal em nova aba (`useOpenInNewTab`).
- Na ficha **principal**, banner mostra "Esta ficha está vinculada a N outras conversas: [chips clicáveis]".

**3. Sincronização de informação (sem duplicação):**
- Não duplicamos status nem valores. As fichas vinculadas **leem** da principal via JOIN no momento da exibição (hook `useFichaComGrupo` que, se a ficha for membro vinculado, retorna os dados da principal mesclados com `telefone_cliente`/`nome_cliente` da vinculada).
- Mensagens do WhatsApp continuam por telefone (cada cliente recebe no próprio número), mas notificações de status, NPS, link de pagamento podem ser disparadas opcionalmente para **todos os telefones do grupo** (toggle "enviar para todas as conversas vinculadas" — default OFF para preservar comportamento atual).

**4. Tarefas Operacionais (`/tarefas-operacionais`):**
- Em `ConversasResolver` e `DelegacaoTab`, quando uma ficha pertence a grupo, exibir badge "🔗 +N" e ao clicar mostrar todas as conversas vinculadas (cada telefone vira link para `/chat?telefone=...`).
- Auto-resolução: marcar ficha principal como resolvida marca as vinculadas também.

**5. FichasOverview, FichasGeral, FichaDetalhes, Calendario, Financeiro:**
- Listagens passam a marcar fichas vinculadas com badge 🔗 e, por padrão, **agrupar** vinculadas sob a principal (toggle "expandir vínculos").
- Financeiro/Dashboard: para evitar contagem dupla de receita, KPIs/relatórios consideram **apenas a ficha principal** do grupo (fichas vinculadas são excluídas de somatórios). Isso preserva os números atuais — fichas hoje sem grupo continuam contando normalmente.

**6. Desvincular:** botão na principal e em cada vinculada (com AlertDialog). Remove do grupo; se sobrar só a principal, deleta o grupo.

### Mudanças técnicas (resumo)

- **Migration:** criar `ficha_grupos`, `ficha_grupo_membros` com RLS aberta para `anon` (consistente com tabelas operacionais), índices em `ficha_id` e `grupo_id`.
- **Novo hook:** `src/hooks/useFichaGrupo.ts` — retorna `{ grupo, principal, membros, isPrincipal, isVinculada }` para qualquer `fichaId`.
- **Novo dialog:** `src/components/VincularFichaDialog.tsx` — busca + seleção + confirmação.
- **Componente badge:** `src/components/FichaVinculoBadge.tsx` — reutilizado em todas as listagens.
- **Edits:** `FichaPanel.tsx` (botão vincular + banner), `FichaServicoTab.tsx` (read-only quando vinculada, banner principal), `FichaCard.tsx`, `FichasOverview.tsx`, `FichaDetalhes.tsx`, `AcompanhamentoTab.tsx`, `OrcamentosTab.tsx`, `ConversasResolver.tsx`, `DelegacaoTab.tsx`, `FichasDashboard.tsx`, e KPIs financeiros (excluir vinculadas dos somatórios).
- **Edge functions:** `auto-finalizacao` e `send-nps` ganham parâmetro opcional `incluir_vinculadas` (default false → preserva comportamento atual).

### Salvaguardas (project-knowledge)

- **Sem alteração de colunas existentes** em `fichas_de_servico` → nenhum dado atual muda.
- Fichas hoje **continuam funcionando idênticas** se não forem vinculadas (zero entradas em `ficha_grupos` = comportamento atual preservado).
- KPIs/Financeiro: lógica de exclusão de vinculadas só ativa quando há grupo — relatórios históricos não mudam.
- Vincular/desvincular sempre via AlertDialog com texto claro ("Isso fará a ficha B passar a refletir os dados de A. Tem certeza?").
- `data_version` da ficha incrementa em vincular/desvincular para invalidar caches.

### Fora de escopo (perguntar depois)

- Mesclar mensagens do WhatsApp em uma única timeline (pode causar confusão de remetente — sugiro deixar separado).
- Migrar a tabela legada `conversa_ficha_vinculo` (mantemos como está, não conflita).

