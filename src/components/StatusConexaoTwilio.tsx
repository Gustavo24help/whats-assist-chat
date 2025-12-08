import { Badge } from "@/components/ui/badge";
import { useConversationTimer } from "@/hooks/useConversationTimer";

interface StatusConexaoTwilioProps {
  telefoneCliente: string;
}

export const StatusConexaoTwilio = ({ telefoneCliente }: StatusConexaoTwilioProps) => {
  const { dentroJanela, horasRestantes, minutosRestantes } = useConversationTimer(telefoneCliente);

  if (dentroJanela) {
    return (
      <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs px-2 py-0.5">
        {horasRestantes}h {minutosRestantes}m
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-amber-500/50 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 text-xs px-2 py-0.5">
      Fechada
    </Badge>
  );
};
