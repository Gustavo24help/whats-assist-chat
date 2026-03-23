

# Correção: Variáveis de Templates WhatsApp Chegando com Valores Errados

## Problema Identificado

O template `novas_informacoes_cliente` no banco usa variáveis **nomeadas** no body: `{{nome}}`, `{{ficha_de_servico}}`, `{{status_do_servico}}`.

Porém, ao enviar para a Twilio, o código monta o `ContentVariables` com chaves **numéricas sequenciais**: `{"1": "valor", "2": "valor", "3": "valor"}`.

A API da Twilio espera que as chaves correspondam aos nomes das variáveis do Content Template. Como `"1"` não corresponde a `"nome"`, a Twilio ignora e usa os valores de amostra (Daniel, FS1-260125, agendado).

**Causa raiz:** Em `AbrirConversaDialog.tsx` (linha ~170) e `NovaConversaDialog.tsx` (linha ~213):
```js
// ERRADO - usa índice numérico como chave
contentVariables[(index + 1).toString()] = variableValues[index];

// CORRETO - deve usar o token real da variável
contentVariables[variable] = variableValues[index];
```

## Problema Secundário

O `get-twilio-templates` adiciona prefixo `var_` nas variáveis numéricas (ex: `{{1}}` vira `var_1`), causando incompatibilidade no DB para templates futuros.

## Correções

### 1. `src/components/AbrirConversaDialog.tsx`
Alterar construção de `contentVariables` para usar o token real da variável, removendo prefixo `var_` se presente:
```js
selectedTemplate.variables.forEach((variable, index) => {
  const key = variable.startsWith('var_') ? variable.replace('var_', '') : variable;
  contentVariables[key] = variableValues[index];
});
```

### 2. `src/components/NovaConversaDialog.tsx`
Mesma correção.

### 3. `supabase/functions/get-twilio-templates/index.ts`
Linha 77 — remover o prefixo `var_`:
```js
// DE:
const variables = [...body.matchAll(/\{\{(\d+)\}\}/g)].map(match => `var_${match[1]}`);
// PARA:
const variables = [...body.matchAll(/\{\{(\d+)\}\}/g)].map(match => match[1]);
```

### 4. Atualizar registros existentes no DB
Migração para corrigir templates com `var_N` → `N` no campo `variables`.

## Impacto
- Templates com variáveis nomeadas (`{{nome}}`) passarão a enviar valores corretos
- Templates com variáveis numéricas (`{{1}}`) continuam funcionando
- Templates existentes com `var_1` no DB serão corrigidos
- Zero impacto em outras funcionalidades

