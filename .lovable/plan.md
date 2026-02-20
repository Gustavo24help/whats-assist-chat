

## Adicionar acesso ao Dashboard TV na Sidebar

O Dashboard Elite (TV e Mobile) ja existe nas rotas `/dashboard-tv` e `/dashboard-mobile`, mas nao ha nenhum link de navegacao para chegar ate eles a partir do dashboard principal.

### Alteracao

**Arquivo: `src/components/dashboard/Sidebar.tsx`**

Adicionar um novo item de navegacao na lista `mainNavItems` com icone de TV (lucide `Monitor` ou `Tv`) apontando para `/dashboard-tv`:

```
{ label: 'Dashboard TV', icon: Monitor, path: '/dashboard-tv' }
```

Sera posicionado logo abaixo do item "Dashboard" existente para facil acesso.

### Arquivos afetados

| Arquivo | Tipo |
|---------|------|
| `src/components/dashboard/Sidebar.tsx` | Editar |

### Protecoes

- Nenhuma alteracao em dados ou logica existente
- Apenas adicao de um link de navegacao

