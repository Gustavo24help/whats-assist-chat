
# Plano de Correção: Criação de Fichas de Serviço

## Diagnóstico do Problema

O problema foi identificado: quando você cria uma ficha via `CriarFichaDialog`, o sistema:

1. Gera o nome da ficha (`FGM1@260202`)
2. Envia os dados para um webhook externo (Make.com)
3. Atualiza o `ficha_ativa_id` do cliente para apontar para essa ficha
4. **Não cria a ficha no banco de dados local**

Resultado: O cliente `whatsapp:+554199276709` tem `ficha_ativa_id = FGM1@260202260202`, mas não existe nenhum registro correspondente na tabela `fichas_de_servico`.

---

## Solução Proposta

Implementar criação local primeiro, webhook depois (com controle de pendência):

```text
┌──────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  CriarFichaDialog│────▶│ Inserir ficha   │────▶│  Chamar webhook  │
│  (usuário clica) │     │ no Supabase     │     │  (assíncrono)    │
└──────────────────┘     └─────────────────┘     └──────────────────┘
                                │                        │
                                ▼                        ▼
                         Ficha aparece            Se falhar, marca
                         imediatamente            webhook_pendente=true
```

---

## Alterações Necessárias

### 1. Adicionar Coluna de Controle

Nova coluna na tabela `fichas_de_servico`:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `webhook_pendente` | boolean | True se webhook ainda não foi enviado/confirmado |

---

### 2. Corrigir Lógica no CriarFichaDialog

**Fluxo atual (problemático):**
1. Chamar webhook
2. Atualizar cliente

**Novo fluxo (seguro):**
1. Inserir ficha no Supabase (com `webhook_pendente = true`)
2. Atualizar `ficha_ativa_id` do cliente
3. Chamar webhook de forma assíncrona
4. Se webhook responder OK, atualizar `webhook_pendente = false`

---

### 3. Garantir Nome Único (Anti-Duplicação)

Usar transação com bloqueio para evitar que dois atendentes criem fichas com o mesmo número no mesmo segundo:

```text
Padrão: FGM{sequencial}-{YYMMDD}
Exemplo: FGM1-260202, FGM2-260202, etc.
```

A query de geração do nome vai usar `FOR UPDATE` para garantir atomicidade.

---

### 4. Corrigir Dados Atuais

Criar a ficha que está faltando para o cliente Amilton (4199276709):

- ID: `FGM1@260202260202` (conforme já está no `ficha_ativa_id`)
- Telefone: `whatsapp:+554199276709`
- Status: `Ficha Criada`

---

## Arquivos Afetados

```text
Banco de dados:
└── Nova migração para adicionar coluna webhook_pendente

Frontend:
└── src/components/CriarFichaDialog.tsx (lógica principal)

Correção pontual:
└── Insert manual da ficha FGM1@260202260202
```

---

## Seção Técnica

### Schema da Nova Coluna

```sql
ALTER TABLE fichas_de_servico 
ADD COLUMN webhook_pendente BOOLEAN DEFAULT false;
```

### Lógica de Geração de Nome (Pseudocódigo)

```typescript
async function gerarNomeFichaUnico() {
  const hoje = format(new Date(), "yyMMdd");
  
  // Buscar último número usado hoje
  const { data } = await supabase
    .from('fichas_de_servico')
    .select('nome_ficha')
    .ilike('nome_ficha', `FGM%-${hoje}`)
    .order('created_at', { ascending: false })
    .limit(1);

  const ultimoNumero = extrairNumero(data?.[0]?.nome_ficha) || 0;
  return `FGM${ultimoNumero + 1}-${hoje}`;
}
```

### Fluxo no handleSubmit

```typescript
// 1. Criar ficha localmente PRIMEIRO
const { data: novaFicha, error } = await supabase
  .from('fichas_de_servico')
  .insert({
    id: nomeFicha,
    nome_ficha: nomeFicha,
    telefone_cliente: clienteTelefone,
    descricao: formData.descricao,
    categoria_id: formData.categoria ? parseInt(formData.categoria) : null,
    status: 'Ficha Criada',
    webhook_pendente: true,
  })
  .select()
  .single();

if (error) {
  // Se for conflito de nome, regenerar e tentar novamente
  if (error.code === '23505') {
    // retry com novo nome
  }
  throw error;
}

// 2. Atualizar ficha ativa do cliente
await supabase
  .from('clientes')
  .update({ ficha_ativa_id: nomeFicha })
  .eq('telefone', clienteTelefone);

// 3. Chamar webhook de forma assíncrona (não bloqueia)
fetch(webhookUrl, { ... })
  .then(() => {
    // Marcar webhook como enviado
    supabase
      .from('fichas_de_servico')
      .update({ webhook_pendente: false })
      .eq('id', nomeFicha);
  })
  .catch(console.error);

// 4. Fechar dialog e recarregar (não espera webhook)
toast.success("Ficha criada!");
onOpenChange(false);
```

### SQL para Corrigir Ficha do Amilton

```sql
INSERT INTO fichas_de_servico (
  id,
  nome_ficha,
  telefone_cliente,
  status,
  webhook_pendente
) VALUES (
  'FGM1@260202260202',
  'FGM1@260202260202',
  'whatsapp:+554199276709',
  'Ficha Criada',
  true
);
```
