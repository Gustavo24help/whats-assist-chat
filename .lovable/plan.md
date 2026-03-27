

# Registrar template `recibo_confirmado` e corrigir variáveis

## O que fazer

### 1. Inserir template na tabela `whatsapp_templates`
Migration SQL para cadastrar o template com o Content SID fornecido:
- `friendly_name`: `recibo_confirmado`
- `content_sid`: `HX7cc2b987e2d793fb99d4d02cb1e5ebb7`
- `body`: texto do template
- `variables`: `{"1": "nome_cliente", "2": "nome_ficha", "3": "valor_total"}`

### 2. Corrigir duplicação de "R$" no `send-recibo`
O template já contém `R${{3}}`, mas o código envia `"3": "R$ 150.00"`. Resultado atual seria **"R$R$ 150.00"**.

**Correção**: remover o prefixo `R$` da variável 3, enviando apenas o valor numérico formatado (ex: `"150.00"`).

Linha 339 do `send-recibo/index.ts`:
```
// DE:
"3": `R$ ${valorFormatado}`,
// PARA:
"3": valorFormatado,
```

## Arquivos alterados
- Nova migration SQL — insert do template
- `supabase/functions/send-recibo/index.ts` — corrigir variável 3

