# 🔄 ATUALIZAÇÃO - Campos Adicionais Incluídos

## ✅ NOVOS CAMPOS ADICIONADOS

### **Na Tabela `transacoes_financeiras`:**

1. **prestador_nome** (TEXT) - Nome do prestador
2. **prestador_codigo** (TEXT) - Código interno do prestador
3. **prestador_cpf** (TEXT) - CPF do prestador
4. **prestador_cnpj** (TEXT) - CNPJ do prestador
5. **cliente_nome** (TEXT) - Nome do cliente
6. **taxa_visita** (DECIMAL) - Taxa de visita cobrada
7. **adiantamento_cliente** (DECIMAL) - Valor já pago pelo cliente
8. **adiantamento_prestador** (DECIMAL) - Valor já pago ao prestador

---

## 📊 CÁLCULOS ATUALIZADOS

### **Subtotal agora inclui:**
```
Subtotal = Mão de Obra + Material + Taxa de Visita
```

### **Valor ao Cliente:**
```
Valor Calculado = (Subtotal - Adiantamento Cliente) / 0.77
Valor Final = Arredondado para terminar em 8
```

### **Valor ao Prestador:**
```
Se Material pago pela 24help:
  Base = Mão de Obra + Taxa Visita
Senão:
  Base = Mão de Obra + Material + Taxa Visita

Valor Final = Base - Adiantamento Prestador - Adiantamentos da Tabela
```

---

## 🎨 INTERFACE ATUALIZADA

### **Popup agora exibe:**

#### **Cabeçalho:**
- ✅ ID Serviço
- ✅ Nome do Prestador
- ✅ Código do Prestador
- ✅ CPF do Prestador
- ✅ CNPJ do Prestador
- ✅ Nome do Cliente
- ✅ Telefone do Cliente
- ✅ Categoria

#### **Campos Editáveis:**
- ✅ Mão de Obra (R$)
- ✅ Material (R$)
- ✅ Taxa de Visita (R$)
- ✅ Adiantamento Cliente (R$)
- ✅ Adiantamento Prestador (R$)
- ✅ Margem 24help (%)
- ✅ Material pago pela 24help (checkbox)

#### **Cálculos Exibidos:**
- ✅ Mão de Obra
- ✅ Material
- ✅ Taxa Visita
- ✅ Subtotal
- ✅ Adiantamento Cliente (se houver)
- ✅ Valor Calculado
- ✅ **Valor Final Cliente (arredondado)**
- ✅ Lucro Bruto 24help
- ✅ Margem Real (%)
- ✅ Adiantamento Prestador (se houver)
- ✅ **Valor a Pagar Prestador**

---

## 📤 DADOS ENVIADOS PARA MAKE.COM

### **Payload Completo:**

```json
{
  "transacao_id": "uuid",
  "ficha_id": "FS1-260211",
  "id_servico": "FS1-260211",
  
  "prestador": {
    "id": "...",
    "nome": "João Silva",
    "codigo": "PREST001",
    "cpf": "123.456.789-00",
    "cnpj": "12.345.678/0001-90",
    "pix": "11999999999"
  },
  
  "cliente": {
    "nome": "Maria Santos",
    "telefone": "whatsapp:+5511999999999"
  },
  
  "valores": {
    "mao_obra": 100.00,
    "material": 50.00,
    "taxa_visita": 30.00,
    "adiantamento_cliente": 20.00,
    "adiantamento_prestador": 10.00,
    "subtotal": 180.00,
    "total_cliente": 198.00,
    "lucro_bruto": 18.00,
    "margem_percentual": 9.09,
    "valor_prestador": 170.00
  },
  
  "datas": {
    "contratacao": "2026-02-11T10:00:00Z",
    "execucao": "2026-02-11T16:00:00Z",
    "pagamento_previsto": "2026-02-13T16:00:00Z"
  },
  
  "forma_pagamento": "pix",
  "categoria": "Elétrica",
  "observacoes": "..."
}
```

---

## 🔄 MIGRAÇÃO DO BANCO DE DADOS

### **Execute este SQL adicional:**

```sql
-- Adicionar colunas na tabela existente (se já criou antes)
ALTER TABLE transacoes_financeiras 
ADD COLUMN IF NOT EXISTS prestador_nome TEXT,
ADD COLUMN IF NOT EXISTS prestador_codigo TEXT,
ADD COLUMN IF NOT EXISTS prestador_cpf TEXT,
ADD COLUMN IF NOT EXISTS prestador_cnpj TEXT,
ADD COLUMN IF NOT EXISTS cliente_nome TEXT,
ADD COLUMN IF NOT EXISTS taxa_visita DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS adiantamento_cliente DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS adiantamento_prestador DECIMAL(10,2) DEFAULT 0;

-- Atualizar coluna calculada de subtotal
ALTER TABLE transacoes_financeiras 
DROP COLUMN IF EXISTS valor_subtotal CASCADE;

ALTER TABLE transacoes_financeiras 
ADD COLUMN valor_subtotal DECIMAL(10,2) 
GENERATED ALWAYS AS (valor_mao_obra + valor_material + taxa_visita) STORED;

-- Preencher dados retroativos (opcional)
UPDATE transacoes_financeiras t
SET 
  prestador_nome = p.nome,
  prestador_codigo = p.codigo,
  prestador_cpf = p.cpf,
  prestador_cnpj = p.cnpj
FROM prestadores p
WHERE t.prestador_id = p.id
  AND t.prestador_nome IS NULL;

UPDATE transacoes_financeiras t
SET cliente_nome = c.nome
FROM clientes c
WHERE t.cliente_id = c.telefone
  AND t.cliente_nome IS NULL;
```

---

## 📋 CHECKLIST DE ATUALIZAÇÃO

### **Arquivos Atualizados:**
- [x] schema-financeiro.sql
- [x] PopupConfirmacaoFinanceira.tsx
- [ ] ModuloFinanceiro.tsx (não precisa atualizar)
- [ ] GUIA-IMPLEMENTACAO-FINANCEIRO.md (veja este arquivo)

### **Banco de Dados:**
- [ ] Executar SQL de atualização acima
- [ ] Verificar se colunas foram criadas
- [ ] Testar cálculo de subtotal

### **Interface:**
- [ ] Substituir PopupConfirmacaoFinanceira.tsx
- [ ] Testar com uma ficha real
- [ ] Conferir se todos os campos aparecem

### **Make.com:**
- [ ] Atualizar webhook para receber novos campos
- [ ] Atualizar mapeamento no Google Sheets
- [ ] Testar envio completo

---

## 🎯 EXEMPLO PRÁTICO

### **Cenário:**
- Mão de Obra: R$ 100,00
- Material: R$ 50,00
- Taxa Visita: R$ 30,00
- Adiantamento Cliente: R$ 20,00
- Adiantamento Prestador: R$ 10,00
- Material pago 24help: NÃO

### **Cálculos:**

1. **Subtotal:** 100 + 50 + 30 = **R$ 180,00**

2. **Valor Cliente:**
   - Base: 180 - 20 (adiant. cliente) = 160
   - Com margem: 160 / 0.77 = 207.79
   - Arredondado: **R$ 208,00**

3. **Lucro 24help:** 208 - 180 = **R$ 28,00**

4. **Margem Real:** (28 / 208) × 100 = **13.46%**

5. **Valor Prestador:**
   - Base: 180 (mão + material + taxa)
   - Desconto: 180 - 10 (adiant. prestador) = **R$ 170,00**

---

## ✅ BENEFÍCIOS

- ✅ **Transparência Total** - Todos os dados do prestador visíveis
- ✅ **Adiantamentos Controlados** - Cliente e prestador separados
- ✅ **Taxa de Visita** - Cobrada e calculada corretamente
- ✅ **Identificação Completa** - CPF/CNPJ para relatórios
- ✅ **Rastreabilidade** - Nome do cliente salvo

---

## 🚀 PRÓXIMOS PASSOS

1. **Execute o SQL de migração** no Supabase
2. **Substitua** o PopupConfirmacaoFinanceira.tsx
3. **Atualize** o webhook do Make.com
4. **Teste** com uma ficha real
5. **Confira** no Google Sheets se todos os campos aparecem

---

**Pronto! Todos os campos adicionais foram incluídos!** 🎉
