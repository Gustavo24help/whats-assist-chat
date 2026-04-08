
Objetivo: eliminar o crash React ligado ao `useOpenInNewTab` sem alterar dados nem o fluxo de redirecionamento já corrigido.

Diagnóstico
- O stack atual aponta sempre para `useOpenInNewTab` chamado dentro de `PageLayout`.
- Hoje esse hook mistura duas responsabilidades:
  1. estado persistido (`sameTab` com `useState`/`useEffect`)
  2. ação de navegação (`openRoute`)
- Ele é usado em vários lugares (`PageLayout`, `Chat`, `ChatPrestadores`, `Settings`), então qualquer inconsistência nele afeta praticamente todo o app.
- O erro “Should have a queue” costuma ser efeito colateral de hooks desincronizados; o caminho mais seguro é tirar o estado desse hook compartilhado.

Plano de implementação
1. Enxugar `useOpenInNewTab`
- Refatorar o hook para ficar estável e sem estado interno compartilhado.
- Ele deve expor só a ação `openRoute(path)` e verificar `isAdminTI`.

2. Isolar a preferência de navegação
- Mover a leitura/gravação de `sameTab` para helpers puros de `localStorage`.
- Deixar o `useState` dessa preferência apenas em `Settings.tsx`, que é a única tela que edita isso.

3. Atualizar os consumidores
- `PageLayout.tsx`, `Chat.tsx` e `ChatPrestadores.tsx` passam a usar apenas a navegação enxuta.
- `Settings.tsx` controla o toggle localmente, sem depender de um hook global com estado.

4. Preservar comportamento atual
- Continuar abrindo em nova aba por padrão.
- Permitir mesma aba somente para `admin_ti`.
- Manter URLs absolutas e sem mexer na lógica de auth/redirect já feita.

5. Estabilizar a árvore de render
- Remover a gambiarra de “clean rebuild”.
- Revisar os arquivos afetados para garantir que não exista retorno condicional envolvendo esse hook.

Arquivos a ajustar
- `src/hooks/useOpenInNewTab.ts`
- `src/pages/Settings.tsx`
- `src/components/PageLayout.tsx`
- `src/pages/Chat.tsx`
- `src/pages/ChatPrestadores.tsx`

Safeguards
- Sem mudanças em banco, horários, registros ou dados já salvos.
- Correção restrita à navegação frontend e ao estado local da preferência de abertura.

Validação
- Abrir Home, Chat, Chat Prestadores e Settings sem blank screen.
- Alternar “mesma aba / nova aba” em Settings.
- Testar os links do menu lateral e os atalhos do Chat.
- Fazer hard refresh no preview após a correção.
- Publicar e repetir os testes no domínio publicado.
