

# Revisao Dashboard TV: Origem dos Dados e Novo Filtro de Datas

## 1. Mapeamento Completo das Fontes de Dados

Cada metrica do Dashboard TV vem do hook `useDashboardTV.ts`, que consulta diretamente as tabelas do banco:

| Metrica | Tabela / Fonte | Filtro Aplicado | Observacao |
|---|---|---|---|
| **Receita Total** | `fichas_de_servico` | `status = 'Finalizado'` + periodo `created_at` | **PROBLEMA**: Nao verifica `pagamento_realizado = true`. Inclui fichas finalizadas mas nao pagas |
| **Lucro Bruto** | Calculado | `receita - mao_obra - pecas` (ou `receita * 0.23` se custos zerados) | Fallback de 23% pode distorcer |
| **Servicos Fechados** | `fichas_de_servico` | Mesmo filtro da receita (count) | Mesmo problema: conta finalizados sem pagamento |
| **Ticket Medio** | Calculado | `receitaTotal / servicosFechados` | Depende dos dados acima |
| **Margem Media** | Calculado | `(lucroBruto / receitaTotal) * 100` | Depende dos dados acima |
| **FS Criadas** | `fichas_de_servico` | Todas fichas no periodo (`created_at`) | Correto |
| **Agendados** | `fichas_de_servico` | `status IN ('Agendado', 'Visita Tecnica')` + servicosFechados | Logica acumulativa: soma fichas atualmente agendadas com finalizadas |
| **Executados** | `fichas_de_servico` | `status IN ('Em andamento', 'Finalizado')` + servicosFechados | **BUG**: 'Finalizado' ja esta no filtro IN e e somado novamente via servicosFechados. Contagem dupla! |
| **Pagos** | `fichas_de_servico` | Igual a servicosFechados (status='Finalizado') | **PROBLEMA**: Label diz "Pagos" mas conta todos finalizados |
| **Cliques Anuncios** | `google_ads_metrics` | `data_referencia` no periodo | Correto |
| **Conversas Iniciadas** | RPC `calculate_conversas_iniciadas` | Periodo + filtros opcionais | Correto |
| **NPS Geral** | `nps_respostas` | Media de `nota` no periodo | Correto |
| **Avaliacao Prestadores** | `avaliacao_prestador` | Media de `nota` no periodo | Correto |
| **Metas** | `dashboard_metas` | `tipo = 'diarias'` (sempre diarias, mesmo em periodos maiores) | Pode nao fazer sentido para periodos de 30 dias |
| **Orcamentos Pendentes >2h** | `fichas_de_servico` | `status IN ('Orcamento Enviado', 'Negociacao')` + `updated_at > 2h atras` | Correto |
| **Tempo Resposta** | Nao implementado | Retorna `null` sempre | Placeholder |
| **Tempo Orcamento** | Nao implementado | Retorna `null` sempre | Placeholder |
| **Tempo FS->Agendado** | `ficha_status_historico` + `fichas_de_servico` | Calcula diferenca entre created_at da ficha e data_inicio do status 'Agendado' | Correto |
| **Tempo Agendado->Executado** | `ficha_status_historico` | Diferenca entre status 'Agendado' e 'Em andamento' | Correto |
| **Ciclo Completo** | `fichas_de_servico` | `updated_at - created_at` para finalizadas pagas | Correto |
| **Conversas Abertas** | `fichas_de_servico` + `mensagens` | Fichas com status nao-fechado, cruza com ultima mensagem do cliente | Correto |

### Bugs Identificados

1. **Executados conta Finalizado duas vezes**: A query filtra `status IN ('Em andamento', 'Finalizado')` e depois soma `servicosFechados` (que tambem e Finalizado). Resultado: fichas finalizadas sao contadas 2x.

2. **Receita/Pagos nao verificam pagamento**: O filtro usa apenas `status = 'Finalizado'` sem `pagamento_realizado = true`. Fichas finalizadas mas ainda nao pagas entram na receita.

3. **Variacao de Pagos usa metrica errada**: Linha 557 calcula `calcVariation(servicosFechados, servicosPrev)` -- deveria comparar pagos com pagos do periodo anterior, nao servicos fechados.

---

## 2. Correcoes dos Dados

### No arquivo `src/hooks/useDashboardTV.ts`:

**Corrigir Receita/Pagos** (linha 270-274): Adicionar `.eq('pagamento_realizado', true)` na query de fichasPagas, e fazer o mesmo para fichasPagasPrev.

**Corrigir Executados** (linha 372): Mudar de `(executadosRes.count || 0) + servicosFechados` para apenas `executadosRes.count || 0`, ja que 'Finalizado' ja esta incluido no filtro IN.

**Corrigir variacao de Pagos** (linha 557): Ja esta correto apos a correcao de receita.

---

## 3. Novo Sistema de Filtro de Datas

### Design

Substituir os dropdowns de periodo/comparacao por:

```text
[Periodo: 01/02/2026 - 25/02/2026]  [Comparar: 01/01/2026 - 25/01/2026]  [25 dias corridos | 18 DU]  vs  [25 dias corridos | 17 DU]
```

- Dois seletores de calendario (inicio/fim), cada um abrindo um `Popover` com `Calendar` em modo `range`
- Dias uteis destacados com cor/marcacao diferente no calendario (usando o modulo `businessDays2026.ts` existente)
- Ao selecionar comparacao, exibir badges com contagem de dias corridos e dias uteis de cada periodo
- Manter filtros de prestador, categoria e metas como estao

### Alteracoes em arquivos

#### `src/hooks/useDashboardTV.ts`
- Corrigir os 3 bugs de dados listados acima
- Ajustar `TVFilters` para usar `customRange` e `comparisonRange` como `{ from: Date; to: Date }` ao inves dos modos predefinidos
- Simplificar `getDateRange` e `getComparisonRange` para usar ranges diretos
- Manter os modos predefinidos como atalhos que preenchem as datas automaticamente

#### `src/pages/DashboardTV.tsx`
- Substituir os `Select` de periodo/comparacao por dois `Popover` + `Calendar` com modo `range`
- Adicionar marcacao visual de dias uteis no calendario (usando `modifiers` e `modifiersStyles` do DayPicker + `isBusinessDay()`)
- Exibir badges ao lado dos filtros mostrando: "X dias corridos | Y DU" para cada periodo selecionado
- Adicionar atalhos rapidos (Hoje, 7 dias, 30 dias, Mes) como botoes pequenos acima do calendario principal
- Manter os filtros existentes (prestador, categoria, metas, dias uteis)

#### `src/components/ui/calendar.tsx`
- Nenhuma alteracao necessaria (o componente ja suporta modifiers nativamente via props do DayPicker)

### Experiencia do Usuario

1. Clicar em "Periodo" abre popover com calendario de selecao de intervalo + atalhos rapidos
2. Dias uteis aparecem com uma bolinha verde ou fundo levemente diferente
3. Clicar em "Comparar" abre outro popover semelhante
4. Ao lado dos filtros, badges mostram: `25 dias | 18 DU` vs `25 dias | 17 DU`
5. Os badges ajudam a entender se a comparacao e justa (mesmo numero de dias uteis)

### Calculo de dias uteis nos badges

Usar `getBusinessDaysInRange(from, to).length` do modulo `businessDays2026.ts` existente para contar dias uteis em cada intervalo selecionado.

