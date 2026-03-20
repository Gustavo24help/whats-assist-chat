

# Plano: Módulo Calendário de Agendamentos

## Resumo
Criar página `/calendario` com visualizações mensal/semanal/diária para gerenciar agendamentos de serviços, visitas técnicas e retornos. Inclui estados visuais dinâmicos (cores, animações), modal de detalhes com alteração de status, e atualização automática.

## 1. Migração de Banco de Dados

**Adicionar enum e colunas:**
```sql
ALTER TYPE status_ficha_enum ADD VALUE 'Retorno';

ALTER TABLE fichas_de_servico
ADD COLUMN tipo_agendamento text,
ADD COLUMN hora_inicio_agendamento time,
ADD COLUMN hora_fim_agendamento time,
ADD COLUMN data_retorno timestamptz,
ADD COLUMN hora_inicio_retorno time,
ADD COLUMN hora_fim_retorno time;
```

Nota: CHECK constraint no `tipo_agendamento` será feito via validation trigger (não CHECK) para evitar problemas de restauração.

## 2. Arquivos a Criar

### `src/pages/Calendario.tsx`
- Página principal com tabs: Mensal / Semanal / Diário
- Filtros: tipo de agendamento, status, prestador
- Legenda de cores + contadores
- Auto-refresh a cada 60s
- Query: `fichas_de_servico` com joins em `prestadores`, `clientes`, `categorias`
- Filtro base: fichas com `horario_agendamento` preenchido OU `data_retorno` preenchido

### `src/components/calendario/CalendarioMensal.tsx`
- Grid mensal com dias, cada dia mostrando mini-cards dos agendamentos
- Cards coloridos por tipo com animações de estado

### `src/components/calendario/CalendarioSemanal.tsx`
- Grid horário 7h-22h x 7 dias
- Cards ocupando slots de horário proporcionais

### `src/components/calendario/CalendarioDiario.tsx`
- Grid horário vertical para um dia
- Cards detalhados no slot de horário

### `src/components/calendario/AgendamentoCard.tsx`
- Card com: ficha ID, cliente, prestador, horário, status
- Cor dinâmica via `calcularEstadoAgendamento()`
- Classes CSS: `agendamento-alerta` (piscar warning) e `agendamento-atrasado` (piscar vermelho)
- onClick abre modal de detalhes

### `src/components/calendario/AgendamentoDetalhesModal.tsx`
- Modal com informações completas da ficha
- Dropdown de status (todos os valores do enum)
- Campo observação opcional
- Botão salvar com confirmação
- Ao salvar: update status + fechar + refresh

### `src/lib/calcularEstadoAgendamento.ts`
- Função pura com a lógica de estado descrita no prompt
- Retorna `{ estado, cor, piscar, classe }`

## 3. Arquivos a Modificar

### `src/App.tsx`
- Adicionar rota `/calendario` protegida

### `src/pages/Home.tsx`
- Adicionar card de navegação para Calendário

### `src/index.css`
- Adicionar keyframes `blink-warning` e `blink-danger` + classes `.agendamento-alerta` e `.agendamento-atrasado`

## 4. Lógica de Negócio

- **Retorno automático**: Ao definir `tipo_agendamento = 'retorno'`, status muda para `'Retorno'` automaticamente (no código, antes do update)
- **Trigger existente** `registrar_mudanca_status` já cuida do histórico
- **Responsividade**: Desktop grid completo, tablet semanal compacto, mobile lista por dia, TV fonts ampliadas
- **Agendamentos cancelados** (Perdido, Não foi adiante): exibidos com opacidade reduzida

## 5. Ordem de Execução

1. Migração SQL (enum + colunas)
2. `calcularEstadoAgendamento.ts`
3. CSS animations
4. Componentes do calendário (Card, Modal, Mensal, Semanal, Diário)
5. Página `Calendario.tsx`
6. Rota em `App.tsx` + link em `Home.tsx`

