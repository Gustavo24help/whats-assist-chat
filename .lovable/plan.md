

# Correcao do Erro 404 em /gerenciamento-prestadores/:cpf

## Problema

A rota `/gerenciamento-prestadores/:cpf` **nao existe** no `App.tsx`. Existe apenas a rota `/gerenciamento-prestadores` (sem parametro). Quando voce clica para ver detalhes de um prestador, a URL muda para `/gerenciamento-prestadores/12345678900`, mas como essa rota nao esta registrada, cai no catch-all `*` e mostra a pagina 404.

O `NotFound.tsx` tem um hack com regex que tenta redirecionar para `/gerenciamento-prestadores/:cpf`, mas como essa rota tambem nao existe no roteador, o redirecionamento nao resolve nada.

## Solucao

### 1. Adicionar a rota no App.tsx

Registrar a rota com parametro dinamico `:cpf` logo abaixo da rota existente de `/gerenciamento-prestadores`:

```text
<Route
  path="/gerenciamento-prestadores/:cpf"
  element={
    <ProtectedRoute>
      <PrestadorDetalhes />
    </ProtectedRoute>
  }
/>
```

Adicionar o import correspondente:
```text
import PrestadorDetalhes from "./pages/PrestadorDetalhes";
```

### 2. Remover hack do NotFound.tsx

Remover o `useEffect` com regex de redirecionamento para `/gerenciamento-prestadores/:cpf` do `NotFound.tsx`, pois nao sera mais necessario.

### Impacto

- Nenhum dado e alterado
- Apenas adiciona uma rota que ja deveria existir
- O componente `PrestadorDetalhes.tsx` ja esta pronto e funcional, so faltava a rota no roteador

