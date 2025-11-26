import { Badge } from "@/components/ui/badge";
import { useConversationTimer } from "@/hooks/useConversationTimer";

interface StatusConexaoTwilioProps {
  telefoneCliente: string;
}

export const StatusConexaoTwilio = ({ telefoneCliente }: StatusConexaoTwilioProps) => {
  const { dentroJanela, horasRestantes, minutosRestantes } = useConversationTimer(telefoneCliente);

  if (dentroJanela) {
    return (
      <Badge variant="default" className="bg-green-600 hover:bg-green-700">
        <span className="flex items-center gap-1">
          ⏰ Janela 24h: {horasRestantes}h {minutosRestantes}m
        </span>
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
      <span className="flex items-center gap-1">
        🔄 Fora da janela • Bot religa automaticamente
      </span>
    </Badge>
  );
};
