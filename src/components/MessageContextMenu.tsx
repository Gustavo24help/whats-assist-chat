import { useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ClipboardCopy, FileText, Calendar, User, DollarSign, Reply, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MessageContextMenuProps {
  children: React.ReactNode;
  messageText: string;
  fichaId: string | null;
  messageData?: any;
  onReply?: () => void;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  canEditDelete?: boolean;
}

const FIELD_GROUPS = {
  "Informações Gerais": [
    { id: "descricao", label: "Descrição", icon: FileText },
    { id: "motivo_perda", label: "Motivo de Perda", icon: FileText },
    { id: "notas", label: "Notas Adicionais", icon: FileText },
  ],
  "Agendamento": [
    { id: "tempo_servico", label: "Tempo de Serviço", icon: Calendar },
  ],
  "Cliente": [
    { id: "cpf", label: "CPF", icon: User },
    { id: "endereco", label: "Endereço", icon: User },
  ],
  "Valores": [
    { id: "valor_total", label: "Valor Total", icon: DollarSign },
    { id: "valor_mao_obra", label: "Valor Mão de Obra", icon: DollarSign },
    { id: "valor_pecas", label: "Valor Peças", icon: DollarSign },
  ],
};

export const MessageContextMenu = ({ children, messageText, fichaId, messageData, onReply, onEdit, onDelete, canEditDelete }: MessageContextMenuProps) => {
  const [selectedText, setSelectedText] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const cleanMultiMessageText = (text: string): string => {
    return text
      .replace(/\b\d{1,2}:\d{2}\b/g, '')
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const handleCopyText = () => {
    const textToClean = selectedText || messageText;
    const cleanedText = cleanMultiMessageText(textToClean);
    navigator.clipboard.writeText(cleanedText);
    toast.success(selectedText ? "Texto copiado!" : "Mensagem copiada!");
  };

  const handleFillField = async (fieldId: string, fieldLabel: string) => {
    if (!fichaId) {
      toast.error("Nenhuma ficha ativa encontrada");
      return;
    }

    const textToFill = cleanMultiMessageText(selectedText || messageText);
    
    try {
      const { error } = await supabase
        .from('fichas_de_servico')
        .update({ [fieldId]: textToFill })
        .eq('id', fichaId);

      if (error) throw error;
      
      toast.success(`Campo "${fieldLabel}" preenchido!`);
      
      window.dispatchEvent(new CustomEvent('field-filled', { 
        detail: { fieldId } 
      }));
    } catch (error) {
      console.error('Erro ao preencher campo:', error);
      toast.error("Erro ao preencher campo");
    }
  };

  const handleSelection = () => {
    const selection = window.getSelection();
    setSelectedText(selection?.toString() || "");
  };

  const isDeletedMessage = messageText === "[Mensagem apagada]";

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger onContextMenu={handleSelection} className="focus:outline-none select-text">
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {!isDeletedMessage && (
            <ContextMenuItem onClick={handleCopyText}>
              <ClipboardCopy className="mr-2 h-4 w-4" />
              {selectedText ? "Copiar seleção" : "Copiar mensagem"}
            </ContextMenuItem>
          )}

          {onReply && !isDeletedMessage && (
            <ContextMenuItem onClick={onReply}>
              <Reply className="mr-2 h-4 w-4" />
              Responder
            </ContextMenuItem>
          )}

          {canEditDelete && !isDeletedMessage && onEdit && messageData && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => onEdit(messageData.id)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar mensagem
              </ContextMenuItem>
            </>
          )}

          {canEditDelete && !isDeletedMessage && onDelete && messageData && (
            <ContextMenuItem 
              onClick={() => setDeleteDialogOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Apagar mensagem
            </ContextMenuItem>
          )}

          {fichaId && !isDeletedMessage && (
            <>
              <ContextMenuSeparator />
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <FileText className="mr-2 h-4 w-4" />
                  Preencher campo da ficha
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-52">
                  {Object.entries(FIELD_GROUPS).map(([groupName, fields]) => (
                    <ContextMenuSub key={groupName}>
                      <ContextMenuSubTrigger className="text-sm">
                        {groupName}
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent>
                        {fields.map((field) => (
                          <ContextMenuItem
                            key={field.id}
                            onClick={() => handleFillField(field.id, field.label)}
                            className="text-sm"
                          >
                            <field.icon className="mr-2 h-4 w-4" />
                            {field.label}
                          </ContextMenuItem>
                        ))}
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar mensagem?</AlertDialogTitle>
            <AlertDialogDescription>
              A mensagem será substituída por "[Mensagem apagada]" no sistema. 
              Essa ação não pode ser desfeita. A mensagem já enviada no WhatsApp do destinatário não será afetada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (onDelete && messageData) {
                  onDelete(messageData.id);
                }
                setDeleteDialogOpen(false);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
