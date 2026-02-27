

# Substituir Templates Antigos pelos Novos (_2 e _3)

## Situacao Atual

Templates **antigos** (a remover):
- `aviso_pagamento` (HXe54ac...) - mapeamento: var 1 = cliente.nome
- `botao_abrir_conversa` (HXb899...) - sem mapeamento
- `cobranca_cliente` (HX18a5...) - mapeamento: var 1 = cliente.nome
- `novo_orcamento` (HXa2ed...) - sem mapeamento
- `promocao_fimdeano` (HX282b...) - mapeamento: var 1 = cliente.nome

Templates **novos** (que ficam):
- `aviso_pagamento_3` (HXff01...) - var 1, sem mapeamento
- `botao_abrir_conversa_3` (HXebff...) - var 1, sem mapeamento
- `cobranca_cliente_2` (HXfeaf...) - var 1, sem mapeamento
- `novo_orcamento_2` (HX075e...) - var 1, sem mapeamento

## Plano

### 1. Transferir mapeamentos de variaveis dos antigos para os novos

Os templates novos que possuem variaveis (`aviso_pagamento_3`, `botao_abrir_conversa_3`, `cobranca_cliente_2`, `novo_orcamento_2`) precisam receber o mapeamento `cliente.nome` no index 0, que era o padrao dos antigos.

**Migracao SQL:**
```text
UPDATE whatsapp_templates 
SET variable_mapping = '[{"index": 0, "field": "cliente.nome"}]'::jsonb
WHERE friendly_name IN (
  'aviso_pagamento_3', 
  'botao_abrir_conversa_3', 
  'cobranca_cliente_2', 
  'novo_orcamento_2'
);
```

### 2. Remover templates antigos

```text
DELETE FROM whatsapp_templates 
WHERE friendly_name IN (
  'aviso_pagamento', 
  'botao_abrir_conversa', 
  'cobranca_cliente', 
  'novo_orcamento', 
  'promocao_fimdeano'
);
```

### Resultado

Nenhuma alteracao de codigo necessaria -- os templates sao carregados dinamicamente do banco. Apos a migracao, os dialogs de "Abrir Conversa" e "Nova Conversa" mostrarao apenas os templates novos com mapeamento automatico de `cliente.nome`.

