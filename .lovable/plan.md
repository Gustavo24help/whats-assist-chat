

## Diagnóstico: "Link inválido" no formulário de orçamento

### Causa raiz identificada

Os IDs de fichas contêm o caractere `@` (ex: `FGM1@20251030`). O `@` é um caractere especial em URLs (usado na sintaxe `user@host`). Quando o link é enviado via WhatsApp e o prestador clica nele, o navegador embutido do WhatsApp ou o próprio WhatsApp pode:

1. Interpretar tudo antes do `@` como "userinfo" da URL, truncando ou removendo o parâmetro `?ficha=`
2. Quebrar a URL no `@`, fazendo com que o parâmetro nunca chegue ao React Router

Resultado: `fichaId` chega como `null` → exibe "Link inválido".

### Solução

Duas correções complementares:

**1. Codificar o ficha ID nos links gerados**

Em 3 arquivos onde o link é montado, aplicar `encodeURIComponent()` no ID da ficha:

- `src/components/FichaCard.tsx` (linha 131)
- `src/components/OrcamentosTab.tsx` (linha 125)  
- `src/pages/Settings.tsx` (linha 181)

Antes: 
```
`https://chat.24help.com.br/orcamento?ficha=${ficha.id}`
```
Depois:
```
`https://chat.24help.com.br/orcamento?ficha=${encodeURIComponent(ficha.id)}`
```

**2. Decodificar no componente público**

Em `src/pages/OrcamentoPublico.tsx`, garantir que o `fichaId` lido da URL seja decodificado:

```ts
const fromRouter = searchParams.get("ficha");
// searchParams.get() já decodifica automaticamente, mas adicionar fallback:
```

O `URLSearchParams.get()` já decodifica automaticamente, então a leitura funciona sem mudança. A correção principal está na **geração** do link.

**3. Adicionar `public-orcamento-data` ao config.toml**

A função não está listada com `verify_jwt = false`. Embora funcione agora, é prudente adicioná-la para evitar problemas futuros com atualizações de deploy.

### Arquivos modificados
- `src/components/FichaCard.tsx` — encodeURIComponent no link
- `src/components/OrcamentosTab.tsx` — encodeURIComponent no link
- `src/pages/Settings.tsx` — encodeURIComponent no link
- `supabase/config.toml` — adicionar `[functions.public-orcamento-data] verify_jwt = false`

### Impacto em dados existentes
Nenhum. A mudança afeta apenas links **gerados a partir de agora**. Links antigos sem encoding continuarão funcionando para fichas sem `@` no ID (como `FS1-260319`).

