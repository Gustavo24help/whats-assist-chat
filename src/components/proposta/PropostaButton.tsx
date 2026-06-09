import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSignature } from "lucide-react";
import PropostaComercialModal from "./PropostaComercialModal";

interface Props {
  fichaId?: string | null;
  telefoneCliente: string;
  clienteNome?: string;
}

export default function PropostaButton({ fichaId, telefoneCliente, clienteNome }: Props) {
  const [open, setOpen] = useState(false);
  if (!fichaId) return null;
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-9 px-2 hover:bg-accent"
        title="Gerar proposta comercial em PDF"
      >
        <FileSignature className="h-4 w-4" />
      </Button>
      {open && (
        <PropostaComercialModal
          open={open}
          onOpenChange={setOpen}
          fichaId={fichaId}
          telefoneCliente={telefoneCliente}
          clienteNome={clienteNome}
        />
      )}
    </>
  );
}
