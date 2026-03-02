
# Plano: Corrigir persistencia do layout TV e clarificar metricas

## Problemas Identificados

### 1. Layout reseta ao mudar resolucao
O layout e salvo em `localStorage`, porem quando o usuario aplica um preset de monitor (4:3, 16:9, 21:9) em `TVMonitorSettings`, isso NAO afeta os widgets diretamente. O problema real e que o contexto `TVFreeformContext` faz merge dos widgets salvos com `DEFAULT_WIDGETS` usando `map(def => ...)` — se novos widgets foram adicionados ao codigo (como os recentes `meta-diaria-finalizados`) e nao existem no `localStorage` antigo, eles recebem posicoes default e bagunçam o layout. Alem disso, quando o usuario clica "Resetar" ou aplica um preset, **todo o layout customizado e perdido**.

**Solucao**: Persistir o layout no banco de dados (tabela `dashboard_metas` ou nova tabela) em vez de depender exclusivamente do `localStorage`. Isso garante que o layout sobrevive a limpeza de cache, troca de dispositivo e mudancas de codigo.

### 2. "Agendados = 3" no funil vs "Agendamentos Hoje = 2"
Sao metricas diferentes:
- **"Agendamentos Hoje" (widget meta)**: Conta transicoes para status 'Agendado' no dia via `ficha_status_historico` = **2 fichas** (FS3-260302 e FS4-260302). Correto.
- **"Agendados" no funil**: Conta fichas com status ATUAL 'Agendado' ou 'Visita Tecnica' + finalizados (`agendadosRes.count + servicosFechados`). Isso inclui fichas que foram criadas no periodo filtrado e estao nesses status agora. E uma metrica diferente.

### 3. "Meta diaria finalizados = 2"
Correto. Existem 2 transicoes para 'Finalizado' hoje: FGM4@260203 e FS4-260226.

## Solucao Tecnica

### Etapa 1: Persistir layout no banco de dados

Criar tabela `tv_layouts` para salvar configuracoes de layout:

```text
tv_layouts
  - id: uuid (PK)
  - user_id: uuid (ref auth.users)
  - nome: text
  - widgets: jsonb
  - is_default: boolean (default false)
  - created_at: timestamptz
  - updated_at: timestamptz
```

RLS: usuarios autenticados podem CRUD nos proprios layouts.

### Etapa 2: Atualizar TVFreeformContext

- Ao iniciar, carregar o layout marcado como `is_default` do banco (fallback para `localStorage`, depois `DEFAULT_WIDGETS`)
- Ao salvar/editar layout, gravar no banco automaticamente
- `saveLayout` e `loadLayout` usam a tabela `tv_layouts`
- Manter `localStorage` como cache local para carregamento instantaneo, mas a fonte de verdade passa a ser o banco
- Ao sair do modo de edicao, auto-salvar o layout atual

### Etapa 3: Clarificar widgets do funil

Renomear o widget do funil de "Agendados" para algo como "Status Agendado" ou adicionar tooltip, para nao confundir com "Agendamentos" (transicoes). O funil conta fichas no **status atual**, enquanto as metas contam **transicoes** no dia.

### Etapa 4: Metas — garantir que save funciona

Verificar se o `upsert` no `MetasModal` funciona corretamente. O `onConflict: 'tipo'` exige que `tipo` tenha constraint UNIQUE. Verificar e criar se necessario.

## Arquivos a editar

1. **Migracao SQL**: Criar tabela `tv_layouts` + politicas RLS + indice unique em `dashboard_metas(tipo)`
2. **`src/contexts/TVFreeformContext.tsx`**: Carregar/salvar layouts do banco, auto-save ao sair da edicao
3. **`src/pages/DashboardTV.tsx`**: Ajustar labels dos widgets do funil para diferenciar de metas

## O que NAO sera alterado

- Logica de calculo das metas (ficha_status_historico)
- Posicoes default dos widgets
- Monitor settings (fontSize, brightness, safeZone)
- Dados existentes no banco
