import { useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ClipboardCopy, FileText, Calendar, User, DollarSign } from "lucide-react";

interface MessageContextMenuProps {
  children: React.ReactNode;
  messageText: string;
  fichaId: string | null;
  messageData?: any;
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

export const MessageContextMenu = ({ children, messageText, fichaId, messageData }: MessageContextMenuProps) => {
  const [selectedText, setSelectedText] = useState("");

  const handleCopyText = () => {
    if (selectedText) {
      navigator.clipboard.writeText(selectedText);
      toast.success("Texto copiado!");
    } else {
      navigator.clipboard.writeText(messageText);
      toast.success("Mensagem copiada!");
    }
  };

  // Remove timestamp patterns from text (e.g., "14:30", "9:05", etc.)
  const removeTimestamp = (text: string): string => {
    // Remove patterns like "14:30" at the start or end of the message
    // Also handles patterns with brackets like "[14:30]" or "(14:30)"
    return text
      .replace(/^\s*\[?\d{1,2}:\d{2}\]?\s*/g, '') // Start of message
      .replace(/\s*\[?\d{1,2}:\d{2}\]?\s*$/g, '') // End of message
      .trim();
  };

  const handleFillField = async (fieldId: string, fieldLabel: string) => {
    if (!fichaId) {
      toast.error("Nenhuma ficha ativa encontrada");
      return;
    }

    // If text is selected, use it as-is. Otherwise, remove timestamp from full message
    const textToFill = selectedText || removeTimestamp(messageText);
    
    try {
      const { error } = await supabase
        .from('fichas_de_servico')
        .update({ [fieldId]: textToFill })
        .eq('id', fichaId);

      if (error) throw error;
      
      toast.success(`Campo "${fieldLabel}" preenchido!`);
      
      // Emitir evento para scroll automático
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

  return (
    <ContextMenu>
      <ContextMenuTrigger onContextMenu={handleSelection} className="focus:outline-none select-text">
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={handleCopyText}>
          <ClipboardCopy className="mr-2 h-4 w-4" />
          {selectedText ? "Copiar seleção" : "Copiar mensagem"}
        </ContextMenuItem>

        {fichaId && (
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
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};
