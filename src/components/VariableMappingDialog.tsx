import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin } from "lucide-react";

interface VariableMapping {
  index: number;
  field: string;
}

interface VariableMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variables: string[];
  currentMapping: VariableMapping[];
  onSave: (mapping: VariableMapping[]) => void;
}

const AVAILABLE_FIELDS = [
  { value: "cliente.nome", label: "Cliente - Nome" },
  { value: "cliente.telefone", label: "Cliente - Telefone" },
  { value: "ficha.id", label: "Ficha - ID" },
  { value: "ficha.nome_ficha", label: "Ficha - Nome" },
  { value: "ficha.descricao", label: "Ficha - Descrição" },
  { value: "ficha.categoria", label: "Ficha - Categoria" },
  { value: "ficha.status", label: "Ficha - Status" },
  { value: "ficha.endereco", label: "Ficha - Endereço" },
  { value: "ficha.cpf", label: "Ficha - CPF" },
  { value: "ficha.horario_agendamento", label: "Ficha - Horário Agendamento" },
  { value: "ficha.prestador_id", label: "Ficha - Prestador" },
];

export const VariableMappingDialog = ({
  open,
  onOpenChange,
  variables,
  currentMapping,
  onSave,
}: VariableMappingDialogProps) => {
  const [mapping, setMapping] = useState<VariableMapping[]>(currentMapping);

  const handleFieldChange = (index: number, field: string) => {
    setMapping((prev) => {
      const existing = prev.find((m) => m.index === index);
      if (existing) {
        return prev.map((m) => (m.index === index ? { ...m, field } : m));
      }
      return [...prev, { index, field }];
    });
  };

  const handleSave = () => {
    onSave(mapping);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Mapear Variáveis do Template
          </DialogTitle>
          <DialogDescription>
            Associe cada variável do template a um campo do cliente ou ficha de serviço
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {variables.map((_, index) => (
            <div key={index} className="space-y-2">
              <Label htmlFor={`var-${index}`}>
                Variável {`{{${index + 1}}}`}
              </Label>
              <Select
                value={mapping.find((m) => m.index === index)?.field || ""}
                onValueChange={(value) => handleFieldChange(index, value)}
              >
                <SelectTrigger id={`var-${index}`}>
                  <SelectValue placeholder="Selecione um campo" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_FIELDS.map((field) => (
                    <SelectItem key={field.value} value={field.value}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          {variables.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Este template não possui variáveis
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar Mapeamento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
