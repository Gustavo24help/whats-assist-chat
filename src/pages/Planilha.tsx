import { ArrowRight, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/PageLayout";

const spreadsheetCards = [
  {
    title: "Controle Financeiro",
    description: "Acompanhamento completo de dados operacionais, pagamentos e rentabilidade da OS.",
    path: "/planilha/controle-financeiro",
  },
  {
    title: "Controle Pagamentos",
    description: "Visão de status dos pagamentos de cliente e repasse para prestadores.",
    path: "/planilha/controle-pagamentos",
  },
];

const Planilha = () => {
  const navigate = useNavigate();

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Button variant="outline" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao início
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold">Planilhas simuladas</h1>
        </div>

        <p className="text-muted-foreground">
          Escolha uma planilha para abrir em página própria e visualizar sua estrutura completa.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {spreadsheetCards.map((sheet) => (
            <button key={sheet.title} onClick={() => navigate(sheet.path)} className="text-left">
              <Card className="border-2 border-transparent hover:border-brand-green/30 transition-all hover:shadow-md h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="icon-container brand-green !h-10 !w-10">
                      <FileSpreadsheet className="h-5 w-5" />
                    </span>
                    {sheet.title}
                  </CardTitle>
                  <CardDescription>{sheet.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="inline-flex items-center text-brand-green font-medium text-sm">
                    Abrir planilha
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Planilha;
