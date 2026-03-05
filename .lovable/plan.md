

## Diagnóstico: Por que o relatório mostra dados incorretos

### Problema raiz

A trigger `registrar_mudanca_status` só dispara em **UPDATE** de status, nunca em **INSERT**. Quando uma ficha é criada com status "Ficha Criada", **nenhum registro** é inserido em `ficha_status_historico`. O primeiro registro só aparece quando o status muda para outra coisa (ex: "Orçamento Enviado").

Dados confirmados:
- 38 fichas criadas em março/2026
- Apenas 2 registros de "Ficha Criada" no histórico (ambos são fichas que voltaram para esse status, não fichas novas)
- Várias fichas não têm nenhum registro no histórico (ex: FS4-260305 ainda em "Ficha Criada" sem histórico algum)

Isso significa que o tempo em "Ficha Criada" quase nunca é registrado, e o mesmo problema afeta qualquer status inicial que não passe pela trigger.

### Plano de correção

**Arquivo: `src/components/RelatorioTempoStatus.tsx`**

1. **Buscar também `fichas_de_servico`** criadas no mês selecionado (`created_at` entre início e fim do mês), trazendo `id`, `created_at`, `status`

2. **Sintetizar o registro de "Ficha Criada"** para cada ficha:
   - `data_inicio` = `ficha.created_at`
   - `data_fim` = o menor `data_inicio` da tabela `ficha_status_historico` para essa ficha (primeiro cambio de status), ou `now()` se a ficha ainda está em "Ficha Criada"
   - Isso gera o tempo real que cada ficha passou em "Ficha Criada"

3. **Mesclar registros sintéticos com os reais** antes de calcular as médias, garantindo que:
   - As fichas que passaram por "Ficha Criada" (todas) sejam contadas
   - Os registros reais do histórico continuem sendo usados para os demais status
   - Sem duplicação (não contar 2x para fichas que por acaso voltaram a "Ficha Criada")

4. **Query adicional**: Para cada ficha do mês, buscar o primeiro registro de `ficha_status_historico` (para saber quando saiu de "Ficha Criada"):
   - Buscar `ficha_status_historico` agrupado por `ficha_id` com `MIN(data_inicio)` como timestamp da primeira mudança

### Detalhes técnicos

A query principal passa a ser:

```
// 1. Buscar fichas do mês
fichas_de_servico: id, created_at, status
WHERE created_at >= from AND created_at <= to

// 2. Buscar histórico do mês (já existe)
ficha_status_historico: status_novo, data_inicio, data_fim
WHERE data_inicio >= from AND data_inicio <= to

// 3. Buscar primeira mudança de status por ficha
ficha_status_historico: ficha_id, MIN(data_inicio)
WHERE ficha_id IN (ids das fichas do mês)
GROUP BY ficha_id
```

No `calcAverages`, antes de processar os registros reais, injetar um registro sintético para cada ficha:
```
{ status_novo: "Ficha Criada", data_inicio: ficha.created_at, data_fim: firstChange[ficha.id] || null }
```

E remover registros duplicados de "Ficha Criada" vindos do histórico real (para fichas que voltaram ao status).

### Sobre o "Histórico"

A mesma lógica se aplica ao modal de histórico: a query `allRecords` também precisa incluir os registros sintéticos de "Ficha Criada" para todos os meses, buscando todas as fichas e seus primeiros registros de mudança.

