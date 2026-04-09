

# Corrigir link de orçamento truncado no WhatsApp

## Problema encontrado

O prestador acessa `chat.24help.com.br/orcamento?` sem o parâmetro `ficha`. O WhatsApp frequentemente trunca URLs com query parameters (`?ficha=XXXX`), cortando tudo após o `?`. Isso faz a página mostrar "Link inválido".

## Solução

Mudar de query parameter (`/orcamento?ficha=ID`) para path parameter (`/orcamento/ID`). URLs baseadas em path não são truncadas pelo WhatsApp.

Manter compatibilidade retroativa: se alguém usar o formato antigo `?ficha=ID`, continua funcionando.

## Alterações

### 1. `src/App.tsx`
- Adicionar rota: `<Route path="/orcamento/:fichaId" element={<OrcamentoPublico />} />`
- Manter rota existente `/orcamento` para compatibilidade

### 2. `src/pages/OrcamentoPublico.tsx`
- Importar `useParams` do react-router-dom
- No `getFichaId()`, priorizar `params.fichaId` (path), depois `searchParams.get("ficha")` (query), depois fallback `window.location`

### 3. Atualizar geração de links (3 arquivos)
- `src/components/FichaCard.tsx`: mudar para `/orcamento/${ficha.id}`
- `src/components/OrcamentosTab.tsx`: mudar para `/orcamento/${fichaNome}`
- `src/pages/Settings.tsx`: mudar para `/orcamento/${fichaId}` e atualizar texto de exemplo

## Impacto
- Links antigos com `?ficha=` continuam funcionando
- Novos links gerados usam formato `/orcamento/ID` que não é truncado
- Nenhuma alteração de dados

