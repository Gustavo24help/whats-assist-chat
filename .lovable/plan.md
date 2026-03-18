

## Plano: Corrigir widget de meta de Agendamentos — usar data de Finalizado

### Problema atual
O código busca fichas que passaram por "Agendado" no `ficha_status_historico` usando `data_inicio` do status Agendado como referência temporal. Isso causa dois erros:
1. Fichas que regrediram (ex: voltaram para "Ficha Criada") são contadas indevidamente
2. A data de referência está errada — deveria ser a data em que foi **Finalizado**

### Nova lógica

A contagem de "agendamentos" passa a ser: **fichas Finalizadas que passaram por Agendado (excluindo VT→Agendado), contadas pela data em que entraram em Finalizado.**

Isso significa que uma ficha só "pontua" no widget quando é finalizada. Fichas ainda em Agendado não contam até serem finalizadas.

### Mudanças no arquivo `src/pages/DashboardTV.tsx` (query `tv-metas-independentes`)

**Substituir as queries `agendDia` e `agendMes`** por uma abordagem em 2 passos:

1. **Buscar fichas que entraram em "Finalizado"** no dia/mês (já existe: `finDia` e `finMes`)
2. **Filtrar apenas as que passaram por "Agendado" (excl. VT→Agendado)** via segunda query no histórico

Concretamente:
- Pegar os `finDiaIds` e `finMesIds` (fichas finalizadas no período)
- Para esses IDs, verificar no `ficha_status_historico` quais têm registro de `status_novo = 'Agendado'` com `status_anterior ≠ 'Visita Técnica'`
- A interseção = agendamentos válidos do período
- Buscar `valor_total` dessas fichas para o valor

Não é mais necessário verificar status atual (Perdido/Não foi adiante) porque se a ficha está em Finalizado, já passou por esse filtro naturalmente.

### Arquivos alterados
- `src/pages/DashboardTV.tsx` — reescrever bloco da query `tv-metas-independentes` (linhas ~269-315)

