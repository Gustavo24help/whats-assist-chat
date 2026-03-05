

# Plano: Criar UI para inputar metas diárias (`daily_goals`)

## Resumo
Adicionar uma interface na página de Configurações (aba existente ou nova seção) para que admins possam cadastrar e editar as metas diárias de agendamento (quantidade e valor).

## Abordagem

### Opção recomendada: Adicionar seção na página Settings
Criar um novo componente `DailyGoalsManager` e incluí-lo numa nova aba "Metas Diárias" na página Settings (acessível apenas para admins).

### Funcionalidades
- Seletor de data (calendário) para escolher o dia
- Campos: `meta_agendamento_quantidade` (inteiro) e `meta_agendamento_valor` (R$)
- Botão salvar que faz upsert na tabela `daily_goals` (onConflict: 'date')
- Possibilidade de copiar metas de um dia para vários dias (ex: preencher a semana inteira)
- Listagem das metas já cadastradas no mês selecionado

### Arquivos a criar/editar
1. **Criar** `src/components/DailyGoalsManager.tsx` — componente com formulário + listagem
2. **Editar** `src/pages/Settings.tsx` — adicionar aba "Metas Diárias" (visível apenas para admins)

### Nenhuma alteração de banco necessária
A tabela `daily_goals` já existe com as colunas corretas e RLS configurado para admins.

