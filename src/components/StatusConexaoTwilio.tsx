import { Badge } from "@/components/ui/badge";
import { useConversationTimer } from "@/hooks/useConversationTimer";

interface StatusConexaoTwilioProps {
  telefoneCliente: string;
}

export const StatusConexaoTwilio = ({ telefoneCliente }: StatusConexaoTwilioProps) => {
  const { dentroJanela, horasRestantes, minutosRestantes } = useConversationTimer(telefoneCliente);

  if (dentroJanela) {
    return (
      <Badge variant="default" className="bg-green-600">
        Janela 24h: {horasRestantes}h {minutosRestantes}m restantes
      </Badge>
    );
  }

  return (
    <Badge variant="destructive">
      Fora da janela de 24h
    </Badge>
  );
};
