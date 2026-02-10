

## Atualizar a Edge Function `update-pagamento`

### O que muda

O arquivo enviado (`update-pagamento-CORRIGIDO.ts`) traz uma versão melhorada da função com:

1. **Autenticação flexível** - Além do JWT de usuário, aceita um header `x-make-secret` para chamadas do Make.com
2. **Logs mais detalhados** - Inclui timestamps, tempo de execução, e informações detalhadas de erro para facilitar depuração
3. **Melhor tratamento de erros** - Mensagens de erro mais descritivas com detalhes técnicos

### Pré-requisito: Configurar Secret

O novo código usa uma variável `MAKE_SECRET_KEY` que **ainda não existe** no projeto. Será necessário adicioná-la antes de fazer o deploy.

### Passos de implementação

1. **Solicitar a secret `MAKE_SECRET_KEY`** ao usuário para autenticação do Make.com
2. **Substituir o conteúdo** de `supabase/functions/update-pagamento/index.ts` pelo código do arquivo enviado
3. **Deploy automático** da função atualizada

### Detalhes técnicos

- **Arquivo alterado:** `supabase/functions/update-pagamento/index.ts` (substituição completa)
- **Nova secret necessária:** `MAKE_SECRET_KEY`
- **Sem alterações no banco de dados** - a função continua atualizando os mesmos campos (`pagamento_link`, `pagamento_realizado`) na tabela `fichas_de_servico`
- **Sem impacto em dados existentes** - apenas muda a lógica de autenticação e logging da função
- A configuração `verify_jwt = false` no `config.toml` já está correta e permanece inalterada
