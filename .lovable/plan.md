

# Plano: Reorganizar Financeiro + Melhorias Tarefas Operacionais

## 1. Reorganizar navegação do Financeiro

**Problema**: O sidebar tem "Financeiro > Financeiro" e "Financeiro > Contas a Receber" como páginas separadas, sendo que Contas a Receber é duplicação acidental. A página `/financeiro` já tem as duas abas (Pagamento Clientes e Pagamento Prestadores).

**Solução**: 
- Renomear os dois itens do sidebar para **"Contas a Receber"** (rota `/financeiro`, que mostra aba Pagamento Clientes) e **"Contas a Pagar"** (rota `/contas-pagar`, que mostra aba Pagamento Prestadores)
- Eliminar a rota `/contas-receber` duplicada
- Separar as abas em duas páginas independentes:
  - `/financeiro` → Contas a Receber (atual PagamentoClientesTabV2 + KPIs de clientes)
  - `/contas-pagar` → Contas a Pagar (atual PagamentoPrestadoresTabV2 + KPIs de prestadores)
- Manter a Planilha como terceiro item do grupo

**Arquivos**: `PageLayout.tsx`, `Financeiro.tsx` (renomear/dividir), `App.tsx` (adicionar rota `/contas-pagar`, remover `/contas-receber`)

## 2. Aba Delegação com indicador laranja

**Problema**: O operador não percebe quando tem delegações pendentes.

**Solução**: 
- No `TarefasOperacionais.tsx`, fazer uma query para contar delegações pendentes (status != "resolvido") atribuídas ao usuário, filtrando apenas `tipo != 'atribuicao_chat'` (ou tipo IS NULL) — somente criadas manualmente
- Se houver pendentes, aplicar classe `bg-orange-500 text-white` na tab "Delegação"

## 3. Filtrar delegações — somente manuais

**Problema**: Delegações criadas automaticamente pelo sistema (tipo `atribuicao_chat` vindas de auto-atribuição ao enviar mensagem) poluem a lista.

**Solução**: No `DelegacaoTab.tsx`, na query de tarefas, adicionar filtro para excluir tarefas onde `tipo = 'atribuicao_chat'` **E** `criado_por = user.id` (auto-atribuição). Ou seja, manter as atribuições feitas por outros operadores (que são manuais), mas excluir as auto-geradas.

Melhor abordagem: excluir todas que foram geradas por auto-atribuição. Na prática, o `atribuirOperador` com `isSelf=true` gera essas tarefas. Vou adicionar um campo ou simplesmente filtrar: se `tipo = 'atribuicao_chat'` e `criado_por` é o mesmo que o atribuído, excluir.

No `DelegacaoTab.tsx`, após carregar as tarefas, filtrar no JS: remover tarefas onde `tipo === 'atribuicao_chat'` e o criador é o próprio usuário atribuído (auto-atribuição ao enviar mensagem).

## 4. Conversas a Resolver — remover filtro de atribuição

**Problema**: A aba só mostra fichas de clientes atribuídos ao operador, mas deveria mostrar TODAS as conversas ativas que requerem ação.

**Solução**: No `ConversasResolver.tsx`, remover a consulta a `clientes.atendente_id` e mostrar todas as fichas com status que requerem o operador (excluindo Finalizado, Perdido, Não foi adiante). Manter filtro por status.

## Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `src/components/PageLayout.tsx` | Renomear itens sidebar: "Contas a Receber" e "Contas a Pagar" |
| `src/pages/Financeiro.tsx` | Transformar em página "Contas a Receber" (só PagamentoClientesTabV2) |
| `src/pages/ContasPagar.tsx` | Nova página com PagamentoPrestadoresTabV2 |
| `src/App.tsx` | Adicionar rota `/contas-pagar`, remover `/contas-receber` |
| `src/pages/TarefasOperacionais.tsx` | Adicionar badge laranja na tab Delegação quando há pendentes |
| `src/components/tarefas-op/DelegacaoTab.tsx` | Filtrar tarefas auto-geradas por sistema |
| `src/components/tarefas-op/ConversasResolver.tsx` | Remover filtro de atribuição, mostrar todas fichas ativas |

