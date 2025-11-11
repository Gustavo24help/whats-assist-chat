import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReplyIndicatorProps {
  message: {
    texto: string;
    remetente: string;
    tipo: string;
  };
  onCancel: () => void;
}

export const ReplyIndicator = ({ message, onCancel }: ReplyIndicatorProps) => {
  const getSenderName = (remetente: string) => {
    switch (remetente) {
      case "atendente": return "Você";
      case "bot": return "Bot";
      default: return "Cliente";
    }
  };

  const getMessagePreview = () => {
    if (message.tipo === "texto" && message.texto) {
      return message.texto.length > 50 
        ? message.texto.substring(0, 50) + "..."
        : message.texto;
    }
    
    const mediaIcons: Record<string, string> = {
      audio: "🎵 Áudio",
      imagem: "🖼️ Imagem",
      video: "🎥 Vídeo",
      arquivo: "📄 Arquivo"
    };
    
    return mediaIcons[message.tipo] || "Mensagem";
  };

  return (
    <div className="px-3 py-2 bg-muted/50 border-t border-l-4 border-l-primary flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-primary mb-0.5">
          Respondendo para {getSenderName(message.remetente)}
        </div>
        <div className="text-sm text-muted-foreground truncate">
          {getMessagePreview()}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onCancel}
        className="h-8 w-8 shrink-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
