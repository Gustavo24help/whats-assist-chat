# Esclarecimento + Plano de teste real

## Esclarecimento sobre o JWT

Quando testei a função `processar-pagamento` agora há pouco:
- Chamei com `Authorization: Bearer invalid` → a função **respondeu mesmo assim** (deveria ter sido bloqueada com 401).
- Isso significa que, apesar de termos removido a entrada `verify_jwt = false` do `config.toml`, no Lovable Cloud o **default real continua sendo `verify_jwt = false`** (sistema de signing-keys).
- Para **forçar JWT obrigatório** é preciso declarar **explicitamente** `verify_jwt = true` no `config.toml`.

Resumo: a função **está deployada e funcionando**, mas hoje aceita chamadas sem token válido. Precisamos corrigir.

## Plano

### 1. Corrigir `supabase/config.toml`
Adicionar bloco explícito:
```toml
[functions.processar-pagamento]
verify_jwt = true
```

### 2. Cadastrar prestador de teste
Inserir em `prestadores`:
- **Nome:** Daniel Paciornik
- **CPF:** 00891196900
- **Categoria:** Marido de Aluguel
- **Chave PIX:** 41998751600
- **Telefone:** 41998751600 (mesmo do PIX, padrão para teste)
- **Ativo:** true

### 3. Redeploy da função
`deploy_edge_functions(["processar-pagamento"])`.

### 4. Teste real (3 cenários)

**A. Sem JWT (deve falhar com 401):**
```bash
curl -X POST .../processar-pagamento \
  -d '{"id":"TEST-DANIEL-001","status":"Finalizado","valor_total":5,"prestador_cpf":"00891196900"}'
```
Esperado: **401 Unauthorized** (gateway bloqueia).

**B. Com JWT válido + payload de teste (status != Finalizado):**
```json
{"id":"TEST-DANIEL-001","status":"Agendado","valor_total":5,"prestador_cpf":"00891196900"}
```
Esperado: `200 { skipped: true, reason: "status != Finalizado" }`. Sem efeito colateral.

**C. Com JWT válido + finalizado real:**
```json
{"id":"TEST-DANIEL-001","status":"Finalizado","valor_total":5,"prestador_cpf":"00891196900","telefone_cliente":"5511999999999"}
```
Esperado: `200 { success: true, prestador: { nome: "Daniel Paciornik", cpf, chave_pix: "41998751600" }, valor_total: 5, conta_receber: { status: "acionado agora" } }`.

Efeitos colaterais esperados:
- 1 linha em `automation_audit` (status `processado`).
- Acionamento de `auto-finalizacao` para a ficha `TEST-DANIEL-001`. Como essa ficha **não existe** em `fichas_de_servico`, o auto-finalizacao deve falhar silenciosamente sem criar conta a receber. Vou validar isso nos logs.

### 5. Limpeza após o teste
- Remover a linha de teste de `automation_audit` (filtrando `ficha_id = 'TEST-DANIEL-001'`).
- **Manter** o prestador Daniel Paciornik cadastrado (você pediu para cadastrar de verdade).
- Caso `auto-finalizacao` tenha criado algo em `contas_receber` para `TEST-DANIEL-001`, remover também.

## Salvaguardas
- Uso de `id` prefixado com `TEST-` para deixar claro que é teste e facilitar limpeza.
- Não toco em `fichas_de_servico` (não crio ficha real).
- Valor R$ 5 conforme solicitado.
- Cadastro do prestador é real e fica disponível no sistema.

## Confirmação que peço
- Posso seguir com cadastro do prestador Daniel + teste real R$ 5?
- Algum telefone de cliente fictício preferido (ou mantenho `5511999999999`)?
