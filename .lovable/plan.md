

## Plano: Ajustar regras dos widgets de meta de Agendamentos no Dashboard TV

### Regras de negócio (resumo do que você pediu)

1. Contar apenas **agendamento de serviço** — excluir fichas que foram para "Visita Técnica"
2. Apenas **1 agendamento por ficha** (já funciona assim via `Set`)
3. Ficha que sai de "Agendado":
   - Se status atual = **Finalizado** → conta
   - Se status atual = **Perdido** / **Não foi adiante** → não conta
   - Se status atual = **Agendado** → conta (ainda está lá)
   - Se está em outro status intermediário (ex: "Em andamento") → conta (pode chegar a Finalizado)
4. Basicamente: **exclui apenas Perdido e Não foi adiante**

### O que muda

**Arquivo:** `src/pages/DashboardTV.tsx` (query `tv-metas-independentes`, linhas ~268-302)

**Lógica atual:**
- Busca `ficha_status_historico` com `status_novo = 'Agendado'` (inclui fichas que vieram de Visita Técnica para Agendado)
- Mensal: filtra `neq('status', 'Perdido')` na ficha atual

**Nova lógica:**
1. Na query do histórico, manter `status_novo = 'Agendado'` mas adicionar filtro para excluir registros onde `status_anterior = 'Visita Técnica'` — isso garante que só entra agendamento de serviço (fichas que foram direto para Agendado, não as que vieram de VT)
2. Na verificação mensal/acumulada do status atual da ficha, trocar `neq('status', 'Perdido')` por `.not('status', 'in', '("Perdido","Não foi adiante")')` — para excluir ambos os status de perda
3. Aplicar a mesma regra de exclusão para o valor (R$) dos agendados

**Nota:** O filtro diário atualmente não exclui Perdido. Vou aplicar a mesma regra para consistência (excluir Perdido e Não foi adiante também no diário).

### Arquivos alterados
- `src/pages/DashboardTV.tsx` — query `tv-metas-independentes`

