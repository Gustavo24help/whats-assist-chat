import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface StatusConexaoTwilioProps {
  telefoneCliente: string;
}

export const StatusConexaoTwilio = ({ telefoneCliente }: StatusConexaoTwilioProps) => {
  const [dentroJanela, setDentroJanela] = useState<boolean>(true);
  const [horasRestantes, setHorasRestantes] = useState<number>(0);

  useEffect(() => {
    const verificarJanela = async () => {
      const { data: cliente } = await supabase
        .from('clientes')
        .select('ultima_interacao')
        .eq('telefone', telefoneCliente)
        .single();

      if (!cliente?.ultima_interacao) {
        setDentroJanela(false);
        return;
      }

      const now = new Date();
      const ultimaInteracao = new Date(cliente.ultima_interacao);
      const diferencaHoras = (now.getTime() - ultimaInteracao.getTime()) / (1000 * 60 * 60);
      const restantes = Math.max(0, 24 - diferencaHoras);

      setDentroJanela(diferencaHoras < 24);
      setHorasRestantes(Math.floor(restantes));
    };

    verificarJanela();
    const interval = setInterval(verificarJanela, 60000); // Atualizar a cada minuto

    return () => clearInterval(interval);
  }, [telefoneCliente]);

  if (dentroJanela) {
    return (
      <Badge variant="default" className="bg-green-600">
        Janela 24h: {horasRestantes}h restantes
      </Badge>
    );
  }

  return (
    <Badge variant="destructive">
      Fora da janela de 24h
    </Badge>
  );
};
