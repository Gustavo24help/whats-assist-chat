
## Diagnóstico atual

Hoje, no dashboard, os 3 cards usam a tabela `transacoes_financeiras` filtrando por `data_pagamento_realizada` (data em que a 24help pagou o prestador) dentro da janela do dashboard. Resultado: enquanto o repasse não é feito, o KPI fica zerado — mesmo com a ficha já finalizada e paga pelo cliente. Além disso, há um erro paralelo na consulta de `orcamentos` (colunas inexistentes) que está derrubando todo o `Promise.all` e zerando ainda mais cards. Vou consertar tudo no mesmo passe.

## Regras de negócio (suas, reescritas para confirmação)

Para cada **ficha** dentro da janela do dashboard (período = mês da ficha, definido pelo `created_at` da ficha — mesma regra já usada em "Operational KPIs"), considerando apenas fichas em status financeiramente válido (`Finalizado`, `Garantia`, `Retorno` — exclui `Perdido`):

- **Pago a Prestadores** = soma de `valor_a_pagar_prestador` da `transacoes_financeiras` vinculada à ficha. Não depende mais de `status_pagamento_prestador = 'pago'` nem de `data_pagamento_realizada` — basta a transação existir vinculada à ficha do mês.
- **Líquido 24help** = `valor_total` (FS) − `valor_a_pagar_prestador` − (`valor_material` **se** `material_pago_24help = true`).
- **% Take Rate 24help** = `Líquido 24help / Σ valor_total das fichas × 100`. Renomear o card de "Margem Bruta 24help" para **"% Take Rate 24help"**.

Tooltip novo do Take Rate: "Quanto a 24help retém sobre o valor total faturado nas fichas do período (Líquido 24help ÷ Valor total das FS)."

## Plano de implementação

### 1. Corrigir a fonte de dados em `src/hooks/useOperationalKPIs.ts`

Substituir a branch `transacoesPagasRes` (linhas ~412–424) por uma busca que:
- Pega as fichas do período (mesma lista já usada em `fichasNoPeriodoRes`) — incluindo `valor_total` e `status`.
- Filtra fichas com status em `['Finalizado','Garantia','Retorno']`.
- Busca em `transacoes_financeiras` por `ficha_id IN (chunks de 200)` os campos: `ficha_id, valor_a_pagar_prestador, valor_material, material_pago_24help`.
- Para cada ficha elegível, agrupa as transações pelo `ficha_id` (uma ficha pode ter 2 transações em caso de troca de prestador — somar ambas).

### 2. Recalcular os 3 valores (linhas ~519–546)

```ts
let somaFS = 0;
let somaPrestador = 0;
let somaMaterial24help = 0;

for (const f of fichasElegiveis) {
  const fsValor = Number(f.valor_total ?? 0);
  somaFS += fsValor;
  const txs = txsByFicha.get(f.id) ?? [];
  for (const t of txs) {
    somaPrestador += Number(t.valor_a_pagar_prestador ?? 0);
    if (t.material_pago_24help) {
      somaMaterial24help += Number(t.valor_material ?? 0);
    }
  }
}

const valorPagoPrestadores = somaPrestador;
const valorLiquido24help   = somaFS - somaPrestador - somaMaterial24help;
const takeRate24help       = somaFS > 0 ? Number(((valorLiquido24help / somaFS) * 100).toFixed(1)) : 0;
```

Manter o nome do campo `margemBruta24help` no objeto (para não quebrar outros consumidores) e apenas mudar o **rótulo + tooltip** no card. Alternativa mais limpa: adicionar `takeRate24help` e marcar `margemBruta24help` como deprecated/alias do mesmo número — decido por **alias** para evitar refactor amplo.

### 3. Renomear card em `src/components/dashboard/OperationalKPIsSection.tsx` (linha ~267)

- `label="Margem Bruta 24help"` → `label="% Take Rate 24help"`.
- Atualizar `tooltip` para a nova fórmula.
- O drill-down mantém a chave `'margemBruta24help'` por baixo dos panos, mas o título fica `% Take Rate 24help`.

### 4. Corrigir bug paralelo que zera tudo

A branch `totalOrcamentosRes` (linhas ~427–448) consulta `orcamentos.created_at` e `orcamentos.ficha_id`, colunas que **não existem** (a tabela usa `data_criacao` e `ficha_nome`). Isso está disparando erros no Postgres e quebrando o `Promise.all` inteiro — daí os zeros que você está vendo agora. Vou:
- Trocar `created_at` → `data_criacao`.
- Trocar `fichas_de_servico!inner` (que precisa de FK `ficha_id`) por busca em duas etapas via `ficha_nome IN (chunks)`, igual ao padrão já usado em `fsComOrcamento`.
- Trocar o `Promise.all` por `Promise.allSettled` para que uma futura falha isolada não derrube a seção inteira.

### 5. Drill-down (`KPIDrillDownDialog`)

Quando o usuário clicar em qualquer dos 3 cards, abrir a lista de **fichas do período** com colunas: ID, status, `valor_total`, `valor_a_pagar_prestador` (somado das transações), `valor_material` (se `material_pago_24help`), e o líquido individual. Hoje o drill já existe — só ajusto a fonte para refletir a nova lógica.

### 6. Não alterar dados existentes

Apenas leitura. Nenhuma migração, nenhum `update`, nenhuma mudança em transação ou ficha. As regras antigas que dependiam de `data_pagamento_realizada` continuam disponíveis em outros lugares (ex.: `/contas-pagar`) e não são tocadas.

### 7. Verificação

Após o deploy, com período padrão "Últimos 30 dias" e contexto atual (abril/2026):
- Fichas elegíveis no período: rodar `SELECT count(*), sum(valor_total) FROM fichas_de_servico WHERE created_at >= ... AND status IN ('Finalizado','Garantia','Retorno')` e bater com o card.
- Conferir manualmente 2–3 fichas (ex.: `FS1-260423`, `FGM3@260414`) para validar que o Líquido bate com `FS − prestador − material(se 24help paga)`.

## Resumo do que muda na tela

| Card                       | Antes                                          | Depois                                                                |
|----------------------------|------------------------------------------------|-----------------------------------------------------------------------|
| Pago a Prestadores         | Só somava transações com repasse já efetuado   | Soma do `valor_a_pagar_prestador` de toda ficha do mês (Fin/Gar/Ret)  |
| Líquido 24help             | `valor_cliente_final − prestador`              | `FS − prestador − material(se 24help paga)`                           |
| Margem Bruta 24help        | `Líquido / Pago Prestadores × 100`             | Renomeado para **% Take Rate 24help** = `Líquido / Σ FS × 100`        |
