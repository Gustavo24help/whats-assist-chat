import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Code } from "lucide-react";
import { toast } from "sonner";

interface VariaveisMensagemDropdownProps {
  onSelectVariavel: (variavel: string) => void;
}

const variaveis = [
  {
    categoria: "Cliente",
    items: [
      { nome: "Nome do Cliente", variavel: "[nome_cliente]" },
      { nome: "Telefone do Cliente", variavel: "[telefone_cliente]" },
    ],
  },
  {
    categoria: "Ficha de Serviço",
    items: [
      { nome: "Nome da Ficha", variavel: "[nome_ficha]" },
      { nome: "Status da Ficha", variavel: "[status_ficha]" },
      { nome: "Valor Total", variavel: "[valor_total]" },
      { nome: "Valor Mão de Obra", variavel: "[valor_mao_obra]" },
      { nome: "Valor Peças", variavel: "[valor_pecas]" },
      { nome: "Tempo de Serviço", variavel: "[tempo_servico]" },
      { nome: "Endereço", variavel: "[endereco]" },
      { nome: "Descrição", variavel: "[descricao]" },
      { nome: "CPF", variavel: "[cpf]" },
      { nome: "Data de Agendamento", variavel: "[horario_agendamento]" },
      { nome: "Link de Pagamento", variavel: "[pagamento_link]" },
    ],
  },
  {
    categoria: "Prestador",
    items: [
      { nome: "Nome do Prestador", variavel: "[prestador_nome]" },
      { nome: "CPF do Prestador", variavel: "[prestador_cpf]" },
      { nome: "Telefone do Prestador", variavel: "[prestador_telefone]" },
    ],
  },
];

export const VariaveisMensagemDropdown = ({
  onSelectVariavel,
}: VariaveisMensagemDropdownProps) => {
  const handleSelectVariavel = (variavel: string) => {
    onSelectVariavel(variavel);
    toast.success("Variável inserida!");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" type="button">
          <Code className="h-4 w-4 mr-2" />
          Inserir Variável
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 z-50 bg-popover" align="start" onWheel={(e) => e.stopPropagation()}>
        <div className="p-3 border-b">
          <h4 className="font-semibold text-sm">Variáveis Disponíveis</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Clique para inserir no texto
          </p>
        </div>
        <ScrollArea className="h-96">
          <div className="p-2">
            {variaveis.map((grupo) => (
              <div key={grupo.categoria} className="mb-4">
                <h5 className="text-xs font-semibold text-muted-foreground px-2 mb-2">
                  {grupo.categoria}
                </h5>
                <div className="space-y-1">
                  {grupo.items.map((item) => (
                    <button
                      key={item.variavel}
                      onClick={() => handleSelectVariavel(item.variavel)}
                      className="w-full text-left p-2 rounded-md hover:bg-accent transition-colors"
                    >
                      <div className="font-medium text-sm">{item.nome}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {item.variavel}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
