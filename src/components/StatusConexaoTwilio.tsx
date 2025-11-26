import { Badge } from "@/components/ui/badge";
import { useConversationTimer } from "@/hooks/useConversationTimer";

interface StatusConexaoTwilioProps {
  telefoneCliente: string;
}

export const StatusConexaoTwilio = ({ telefoneCliente }: StatusConexaoTwilioProps) => {
  const { dentroJanela, horasRestantes, minutosRestantes } = useConversationTimer(telefoneCliente);

  if (dentroJanela) {
    return (
      <Badge variant="default" className="bg-green-600 hover:bg-green-700 h-5 text-[10px]">
        {horasRestantes}h {minutosRestantes}m
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 h-5 text-[10px]">
      Expirado
    </Badge>
  );
};
