

## Plano: Widget de Alertas na TV + Relatório de Tempo Médio por Status

### Feature 1: Simplificar o Widget Rotativo na Dashboard TV

**Objetivo**: Substituir o widget atual "Conversas em Aberto" (que mostra Ficha Criada + Orcamento Enviado com tabela completa) por um widget compacto que mostra apenas fichas em "Ficha Criada" que ultrapassaram 20 minutos, exibindo nome e telefone. Deve caber como 1 de 7 widgets na tela.

**Alteracoes**:

1. **`src/pages/DashboardTV.tsx`** -- Reescrever `renderOpenConversationsWidget()`:
   - Filtrar `data.conversasAbertas.lista` para mostrar apenas status "Ficha Criada" com `tempoNoStatus > 20`
   - Layout compacto: titulo com contagem, lista vertical simples (nome + telefone + tempo), sem tabela pesada
   - Cores de urgencia: amarelo >20min, vermelho >60min
   - Fonte menor e padding reduzido para caber como widget pequeno ao lado de 6 outros

2. **`src/hooks/useDashboardTV.ts`** -- Nenhuma alteracao necessaria, os dados ja vem com status e tempo

### Feature 2: Relatorio de Tempo Medio por Status (Analise de Servicos)

**Objetivo**: Criar um relatorio que calcule a media de tempo que as fichas passam em cada status durante o mes selecionado, usando dados de `ficha_status_historico`. Excluir status terminais (Finalizado, Perdido, Nao foi adiante). Incluir botao "Historico" para ver medias de meses anteriores.

**Dados**: Tabela `ficha_status_historico` com `ficha_id`, `status_novo`, `data_inicio`, `data_fim`. O tempo em cada status = `data_fim - data_inicio` (em minutos). Para registros com `data_fim IS NULL` e status terminal, ignorar. Para registros ativos (sem data_fim) em status de processo, calcular ate `now()`.

**Filtragem por mes**: Considerar apenas registros cuja `data_inicio` esta dentro do mes selecionado (para nao misturar meses).

**Alteracoes**:

1. **Novo componente `src/components/RelatorioTempoStatus.tsx`**:
   - Seletor de mes/ano (default: mes atual)
   - Query em `ficha_status_historico` filtrando por `data_inicio` dentro do mes
   - Excluir `status_novo` em ['Finalizado', 'Perdido', 'Nao foi adiante']
   - Calcular por status: media, minimo, maximo de duracao em minutos
   - Exibir em tabela: Status | Media | Min | Max | Quantidade
   - Formatar tempos (ex: "4h 23min", "2d 5h")
   - Botao "Historico" que abre dialog/modal mostrando a media de cada status para todos os meses anteriores registrados (agrupado por mes)

2. **`src/pages/AnaliseServicos.tsx`** -- Adicionar o componente como nova tab ou secao abaixo do FichasOverview. Usar Tabs para separar "Fichas" e "Tempo por Status".

**Status excluidos do calculo**: `Finalizado`, `Perdido`, `Nao foi adiante` -- porque ficam indefinidamente nesses status apos o processo.

**Historico**: Query agrupada por `DATE_TRUNC('month', data_inicio)` mostrando media por status por mes, em tabela com scroll horizontal.

