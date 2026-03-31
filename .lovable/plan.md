

# Redesign da Home: Sidebar + Avisos na tela principal

## Visão geral

Substituir os blocos enormes da página inicial por um layout com:
- **Sidebar esquerda** colapsável com links para todos os módulos
- **Área principal** mostrando avisos diretamente (com lido/não lido), sem precisar navegar para `/avisos`

## Alterações

### 1. `src/pages/Home.tsx` — Reescrita completa

**Layout**: Flex row com sidebar + main content

**Sidebar esquerda** (colapsável):
- Logo 24Help no topo
- Lista de módulos com ícones (mesmos que existem hoje nos blocos): Chat, Chat Prestadores, Dashboard, Dashboard TV, Gerenciamento Prestadores, Análise de Serviços, Financeiro, Manutenção, Calendário, Planilha, Fichas de Serviço, Registro de Ponto, Mensagens Internas, Avisos, Configurações
- Cada item navega com `openRoute()` (abre em nova aba, comportamento atual)
- Botão de colapsar/expandir (chevron)
- Perfil do usuário + botão Sair no rodapé
- Estado colapsado mostra apenas ícones (mini sidebar ~w-16), expandido ~w-64
- Persistir estado no localStorage

**Área principal — Avisos**:
- Header com saudação "Olá, {nome}!" e contador de não lidos
- Lista de avisos carregados diretamente (reutilizando a mesma lógica de `loadAvisos` do `Avisos.tsx`)
- Cada aviso mostrado como card com: título, conteúdo (truncado), data, badge Lido/Não lido
- Ao clicar no aviso: expande inline ou abre dialog com conteúdo completo + imagem + marca como lido (mesma lógica do `openAviso`)
- Admin vê "Quem leu" e botões de arquivar/excluir
- Tabs: Avisos ativos | Arquivados (admin)
- Botão "Escrever aviso" para admin (pode abrir dialog ou redirecionar para `/avisos`)

### 2. Arquivos alterados
- `src/pages/Home.tsx` — reescrita com sidebar + avisos inline

### 3. O que NÃO muda
- `/avisos` continua existindo como rota separada (para acesso direto)
- Toda a lógica de criação de avisos, upload de imagens, destinatários etc. permanece na página `/avisos`
- A sidebar é específica da Home (não afeta Dashboard ou outras páginas que já têm sua própria sidebar)

## Detalhes técnicos

- Sidebar própria da Home (componente inline ou extraído), não reutiliza `dashboard/Sidebar.tsx` pois tem navegação diferente
- Estado colapsado via `useState` + `localStorage`
- Avisos: copiar lógica essencial de carregamento (`loadAvisos`, `markAsRead`, `openAviso`) do `Avisos.tsx` para a Home
- Na Home, admin pode criar avisos clicando em botão que redireciona para `/avisos?tab=novo`
- Cards de aviso com visual compacto, não os blocos enormes atuais

