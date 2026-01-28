
# Correção: Race Condition na Ativação do Bot

## Problema Identificado

Existe uma **race condition** entre o estado exibido no dialog e o estado usado na execução. O canal realtime (linhas 351-370 do ChatWindow) atualiza `botDesabilitado` em tempo real, mas isso pode causar uma dessincronização:

1. Usuario abre dialog com bot LIGADO (mostra "Assumir Atendimento", sem campo LIGAR)
2. Realtime atualiza estado para bot DESLIGADO
3. UI do dialog nao re-renderiza (ainda mostra "Assumir")  
4. Usuario clica no botao habilitado
5. `toggleBot()` ve o estado ATUALIZADO e LIGA o bot sem confirmacao!

## Solucao

### Mudanca 1: Usar estado local independente no dialog

Ao inves de usar `botDesabilitado` diretamente (que pode mudar via realtime), capturar o estado no momento da abertura do dialog e usar esse valor fixo durante toda a interacao.

```typescript
// Novo estado para controlar o dialog de forma isolada
const [botStatusNoDialog, setBotStatusNoDialog] = useState<boolean | null>(null);

// Em handleAssumirClick
const handleAssumirClick = async () => {
  const { data } = await supabase
    .from('clientes')
    .select('bot_habilitado')
    .eq('telefone', clienteTelefone)
    .single();
  
  if (data) {
    const botDesativado = data.bot_habilitado === false;
    setBotDesabilitado(botDesativado);
    setBotStatusNoDialog(botDesativado); // Captura estado fixo para o dialog
  }
  setAssumirDialogOpen(true);
};

// Limpar ao fechar
onOpenChange={(open) => {
  setAssumirDialogOpen(open);
  if (!open) {
    setConfirmacaoTexto("");
    setBotStatusNoDialog(null); // Limpar estado fixo
  }
}}
```

### Mudanca 2: Usar estado capturado no dialog e na funcao toggleBot

```typescript
// No AlertDialog, usar botStatusNoDialog ao inves de botDesabilitado
{botStatusNoDialog ? (
  // UI para reativar bot (com campo LIGAR)
) : (
  // UI para assumir atendimento
)}

// No toggleBot, usar o estado capturado
const toggleBot = async () => {
  if (isTogglingBot) return;
  
  // Usar o estado que foi capturado ao abrir o dialog
  const estadoCapturado = botStatusNoDialog;
  if (estadoCapturado === null) {
    toast.error("Estado do bot nao foi capturado corretamente");
    return;
  }
  
  setIsTogglingBot(true);
  // ... resto da logica usando estadoCapturado ao inves de botDesabilitado
};
```

### Mudanca 3: Re-verificar estado do banco antes de executar acao

Adicionar verificacao final no toggleBot para garantir que o estado nao mudou:

```typescript
const toggleBot = async () => {
  if (isTogglingBot) return;
  setIsTogglingBot(true);

  try {
    // VERIFICACAO DE SEGURANCA: buscar estado atual do banco
    const { data: clienteAtual } = await supabase
      .from('clientes')
      .select('bot_habilitado')
      .eq('telefone', clienteTelefone)
      .single();
    
    const botRealmenteDesabilitado = clienteAtual?.bot_habilitado === false;
    
    // Se o estado mudou desde a abertura do dialog, abortar e notificar
    if (botRealmenteDesabilitado !== botStatusNoDialog) {
      toast.warning(
        "O estado do bot mudou! Por favor, tente novamente.",
        { description: "Outra pessoa ou o sistema alterou o status." }
      );
      setAssumirDialogOpen(false);
      setBotDesabilitado(botRealmenteDesabilitado);
      return;
    }
    
    // Continuar com a acao...
  } finally {
    setIsTogglingBot(false);
  }
};
```

## Arquivo a Modificar

`src/components/ChatWindow.tsx`

## Resumo das Mudancas

1. Adicionar estado `botStatusNoDialog` para isolar o dialog do realtime
2. Capturar estado no momento da abertura do dialog
3. Usar estado capturado tanto na UI quanto na funcao toggleBot
4. Adicionar verificacao de seguranca antes de executar a acao
5. Abortar e notificar se o estado mudou durante a interacao

## Impacto em Dados Existentes

Nenhum. Esta correcao apenas muda a logica de UI/frontend para prevenir race conditions.

## Resultado Esperado

- Impossivel ligar o bot sem digitar "LIGAR", mesmo com mudancas de estado via realtime
- Se o estado mudar durante a interacao, o usuario e notificado e deve tentar novamente
- Auditoria completa permanece funcionando normalmente
