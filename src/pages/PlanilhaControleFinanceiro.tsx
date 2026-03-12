import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const columns = [
  "Data da contratação",
  "Data da execução",
  "Data do pgto",
  "ID",
  "Nome do prestador",
  "CPF do prestador",
  "CNPJ",
  "Pix do prestador",
  "Cat. do serviço",
  "Nome do cliente",
  "Pagamento? (sim/não)",
  "Fone do cliente",
  "CPF/CNPJ",
  "Origem do lead",
  "Forma de pagto do cliente",
  "Conf. pgto",
  "Adiant. feito pelo cliente",
  "Adiant. para o prestador",
  "Tx de visita",
  "Mão de obra",
  "Peças",
  "Taxa 24help - 23%",
  "Total da OS",
  "Líquido do prestador",
  "Desconto",
  "Lucro bruto",
  "Rentab",
];

const PlanilhaControleFinanceiro = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Button variant="outline" onClick={() => navigate("/planilha")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Planilhas
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold">Controle Financeiro</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Colunas da planilha</CardTitle>
            <CardDescription>Estrutura simulada para controle financeiro da operação.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60">
                    {columns.map((column) => (
                      <th key={column} className="text-left p-3 font-medium whitespace-nowrap border-r last:border-r-0">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {columns.map((column) => (
                      <td key={column} className="p-3 text-muted-foreground whitespace-nowrap border-t border-r last:border-r-0">
                        -
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PlanilhaControleFinanceiro;
