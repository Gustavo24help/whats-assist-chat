

# Plano: Sistema Completo de Registro de Ponto

## Problema principal
A tabela `registro_ponto` **não existe** no banco de dados (a migração original nunca foi aplicada). Isso causa o erro 404 em toda interação com o ponto.

## O que será feito

### 1. Migração SQL - Criar tabelas

**Tabela `registro_ponto`** (recriar):
- `id`, `user_id`, `entrada_em`, `saida_em`, `created_at`
- `entrada_oficial` (TIME) - horário ajustado com tolerância
- `tipo` TEXT DEFAULT `'normal'` - valores: `normal`, `ajuste_manual`
- `observacao` TEXT - para lançamentos avulsos

**Tabela `configuracao_ponto`** (nova):
- `user_id` UUID UNIQUE
- `carga_diaria_minutos` INTEGER DEFAULT 480 (8h)
- `hora_inicio_prevista` TIME DEFAULT '08:00'
- `hora_fim_prevista` TIME DEFAULT '17:00'
- `saldo_inicial_minutos` INTEGER DEFAULT 0

RLS: cada usuário lê/edita apenas seus próprios registros. Admins podem ler todos (para supervisão futura).

### 2. Tela de Ponto (`RegistroPonto.tsx`) - Reescrita completa

**Seção superior - Status e ações:**
- Botão "Registrar Entrada" / "Registrar Saída"
- Badge "Em expediente" / "Fora do expediente"
- Timer negativo em tempo real: conta de `carga_diaria` até zero
- Exibição do horário configurado (ex: "12:00 - 16:00 | Carga: 4h")

**Seção de contadores:**
- Horas trabalhadas hoje
- Saldo do dia (positivo = hora extra, negativo = falta)
- Saldo acumulado da semana
- Horas extras acumuladas
- Horas negativas acumuladas

**Seção de histórico (paginado):**
- Lista de registros com entrada, saída, duração
- Indicador se houve tolerância aplicada

**Seção de lançamento avulso:**
- Formulário para inserir entrada/saída retroativa com observação
- Para ajuste inicial do sistema no meio da semana

### 3. Configuração por usuário

Na tela de Settings (ou na própria tela de ponto):
- Campo "Carga diária" (horas:minutos)
- Campos "Horário previsto de início" e "fim"
- Campo "Saldo inicial (minutos)" - para ajuste retroativo

### 4. Tolerância de 2 minutos na entrada

Ao registrar entrada:
- Se `agora - hora_inicio_prevista <= 2 min`, gravar `entrada_oficial = hora_inicio_prevista`
- Caso contrário, `entrada_oficial = agora`
- Apenas na entrada (conforme escolha do usuário)

### 5. Popup de fim de expediente

Quando o timer chega a zero:
- Modal grande que trava a tela
- "Você completou sua carga horária!"
- Botão "Deslogar" (faz signOut + redistribui chats)
- Botão "Continuar" (fecha modal, a partir daqui conta como hora extra)

### 6. Redirecionamento pós-login

No `Auth.tsx` e `ProtectedRoute`:
- Após login, verificar se o usuário já tem `registro_ponto` aberto hoje
- Se não tem, redirecionar para `/registro-ponto`
- Se já tem entrada registrada, seguir para a rota normal

### 7. Hook `usePontoClock` (novo)

Hook global que roda enquanto logado:
- Calcula tempo restante / hora extra em tempo real
- Dispara o popup de fim de expediente
- Expõe `minutosRestantes`, `emHoraExtra`, `horasTrabalhadas`

---

## Arquivos

| Arquivo | Ação |
|---|---|
| Nova migração SQL | Criar `registro_ponto` + `configuracao_ponto` |
| `src/pages/RegistroPonto.tsx` | Reescrever completamente |
| `src/hooks/usePontoClock.ts` | Novo - timer global |
| `src/components/PontoEndModal.tsx` | Novo - popup fim de expediente |
| `src/pages/Auth.tsx` | Ajustar destino pós-login |
| `src/App.tsx` | Adicionar PontoEndModal global |

## Ordem
1. Migração SQL
2. Hook `usePontoClock`
3. Reescrever `RegistroPonto.tsx`
4. Popup `PontoEndModal`
5. Ajustar redirecionamento pós-login
6. Integrar no App.tsx

