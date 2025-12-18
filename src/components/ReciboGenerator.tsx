import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Send, Eye, RefreshCw, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import { valorPorExtenso } from "@/lib/valorPorExtenso";

interface ReciboGeneratorProps {
  fichaId: string;
  nomeCliente: string;
  cpfCliente: string | null;
  valorTotal: number;
  descricao: string | null;
  pagamentoRealizado: boolean;
  pagamentoTipo: string | null;
  telefoneCliente: string;
  reciboUrl: string | null;
  onReciboGenerated: (url: string) => void;
}

// Cores
const VERDE_24HELP = [0, 100, 60]; // RGB verde escuro
const CINZA_ESCURO = [60, 60, 60];
const CINZA_CLARO = [120, 120, 120];

export const ReciboGenerator = ({
  fichaId,
  nomeCliente,
  cpfCliente,
  valorTotal,
  descricao,
  pagamentoRealizado,
  pagamentoTipo,
  telefoneCliente,
  reciboUrl,
  onReciboGenerated,
}: ReciboGeneratorProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const limparDescricaoComIA = async (desc: string): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('clean-description', {
        body: { descricao: desc }
      });
      
      if (error) {
        console.error('Erro ao limpar descrição:', error);
        return desc;
      }
      
      return data?.descricaoLimpa || desc;
    } catch (err) {
      console.error('Erro na chamada da função:', err);
      return desc;
    }
  };

  const formatarValor = (valor: number): string => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatarTipoPagamento = (tipo: string | null): string => {
    const tipos: Record<string, string> = {
      'pix': 'PIX',
      'cartao_credito': 'Cartão de Crédito',
      'cartao_debito': 'Cartão de Débito',
      'dinheiro': 'Dinheiro',
      'boleto': 'Boleto',
      'transferencia': 'Transferência'
    };
    return tipo ? tipos[tipo] || tipo : 'Não informado';
  };

  const gerarReciboPDF = async (): Promise<Blob> => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 25;

    // ========== HEADER ==========
    
    // Logo 24help (texto estilizado como fallback)
    doc.setTextColor(VERDE_24HELP[0], VERDE_24HELP[1], VERDE_24HELP[2]);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('24help', margin, y);
    
    // Barra verde com "RECIBO"
    const barraY = y - 8;
    const barraHeight = 12;
    const barraWidth = 50;
    doc.setFillColor(VERDE_24HELP[0], VERDE_24HELP[1], VERDE_24HELP[2]);
    doc.rect(pageWidth - margin - barraWidth, barraY, barraWidth, barraHeight, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RECIBO', pageWidth - margin - barraWidth / 2, barraY + 8, { align: 'center' });
    
    y += 15;

    // ========== DADOS DA EMPRESA E VALOR ==========
    
    // Empresa (lado esquerdo)
    doc.setTextColor(CINZA_ESCURO[0], CINZA_ESCURO[1], CINZA_ESCURO[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('24HELP INTERMEDIACAO E GESTAO DE SERVICOS', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('CNPJ: 85.016.434/0001-32', margin, y);
    
    // Valor (lado direito, destacado)
    doc.setTextColor(VERDE_24HELP[0], VERDE_24HELP[1], VERDE_24HELP[2]);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text(formatarValor(valorTotal), pageWidth - margin, y - 3, { align: 'right' });
    
    y += 12;
    
    // Valor por extenso
    doc.setTextColor(CINZA_CLARO[0], CINZA_CLARO[1], CINZA_CLARO[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    const extenso = valorPorExtenso(valorTotal);
    doc.text(extenso, pageWidth - margin, y, { align: 'right' });
    
    y += 20;

    // ========== LINHA DIVISÓRIA ==========
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 15;

    // ========== RECEBEMOS DE ==========
    doc.setTextColor(CINZA_ESCURO[0], CINZA_ESCURO[1], CINZA_ESCURO[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Recebemos de:', margin, y);
    
    // Selo PAGO (se aplicável)
    if (pagamentoRealizado) {
      const seloX = pageWidth - margin - 25;
      const seloY = y - 5;
      
      // Círculo do selo
      doc.setDrawColor(VERDE_24HELP[0], VERDE_24HELP[1], VERDE_24HELP[2]);
      doc.setLineWidth(2);
      doc.circle(seloX, seloY + 5, 12, 'S');
      
      // Texto PAGO
      doc.setTextColor(VERDE_24HELP[0], VERDE_24HELP[1], VERDE_24HELP[2]);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('PAGO', seloX, seloY + 7, { align: 'center' });
    }
    
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(nomeCliente || 'Cliente', margin, y);
    
    y += 8;
    
    // CPF/CNPJ do cliente
    if (cpfCliente) {
      doc.setFontSize(9);
      doc.setTextColor(CINZA_CLARO[0], CINZA_CLARO[1], CINZA_CLARO[2]);
      doc.text(`CPF/CNPJ: ${cpfCliente}`, margin, y);
      y += 10;
    }
    
    y += 5;

    // ========== REFERENTE A ==========
    doc.setTextColor(CINZA_ESCURO[0], CINZA_ESCURO[1], CINZA_ESCURO[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Referente a:', margin, y);
    y += 6;
    
    // Descrição limpa
    const descricaoLimpa = descricao 
      ? await limparDescricaoComIA(descricao)
      : 'Serviço realizado conforme solicitação';
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(descricaoLimpa, pageWidth - 2 * margin);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 10;

    // ========== DATA ==========
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    doc.setFont('helvetica', 'bold');
    doc.text('Data:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(dataAtual, margin + 12, y);
    
    y += 8;

    // ========== FORMA DE PAGAMENTO ==========
    doc.setFont('helvetica', 'bold');
    doc.text('Forma de pagamento:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formatarTipoPagamento(pagamentoTipo), margin + 42, y);
    
    y += 25;

    // ========== RODAPÉ ==========
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    
    doc.setTextColor(CINZA_CLARO[0], CINZA_CLARO[1], CINZA_CLARO[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('24HELP INTERMEDIACAO E GESTAO DE SERVIÇOS LTDA', pageWidth / 2, y, { align: 'center' });
    y += 4;
    doc.text('CNPJ: 85.016.434/0001-32', pageWidth / 2, y, { align: 'center' });

    return doc.output('blob');
  };

  const handleGerarRecibo = async () => {
    setIsGenerating(true);
    
    try {
      toast.info('Gerando recibo...');
      
      // Gerar PDF
      const pdfBlob = await gerarReciboPDF();
      
      // Nome único do arquivo
      const fileName = `recibo_${fichaId}_${Date.now()}.pdf`;
      
      // Upload para storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(`recibos/${fileName}`, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true
        });
      
      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        toast.error('Erro ao salvar recibo');
        return;
      }
      
      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('chat-files')
        .getPublicUrl(`recibos/${fileName}`);
      
      const publicUrl = urlData.publicUrl;
      
      // Salvar URL na ficha
      const { error: updateError } = await supabase
        .from('fichas_de_servico')
        .update({ recibo_url: publicUrl })
        .eq('id', fichaId);
      
      if (updateError) {
        console.error('Erro ao atualizar ficha:', updateError);
        toast.error('Erro ao salvar URL do recibo');
        return;
      }
      
      onReciboGenerated(publicUrl);
      toast.success('Recibo gerado com sucesso!');
      
    } catch (error) {
      console.error('Erro ao gerar recibo:', error);
      toast.error('Erro ao gerar recibo');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEnviarRecibo = async () => {
    if (!reciboUrl) {
      toast.error('Gere o recibo primeiro');
      return;
    }
    
    setIsSending(true);
    
    try {
      const mensagem = 'Olá! Segue o recibo do serviço realizado. 📄';
      
      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          to: telefoneCliente,
          message: mensagem,
          mediaUrl: reciboUrl
        }
      });
      
      if (error) {
        console.error('Erro ao enviar:', error);
        toast.error('Erro ao enviar recibo');
        return;
      }
      
      toast.success('Recibo enviado ao cliente!');
      
    } catch (error) {
      console.error('Erro ao enviar recibo:', error);
      toast.error('Erro ao enviar recibo');
    } finally {
      setIsSending(false);
    }
  };

  const handleDownloadRecibo = () => {
    if (reciboUrl) {
      // Criar link temporário para download
      const link = document.createElement('a');
      link.href = reciboUrl;
      link.download = `recibo_${fichaId}.pdf`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="mt-4 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-5 w-5 text-primary" />
        <span className="font-medium text-sm">Recibo de Serviço</span>
      </div>
      
      {!reciboUrl ? (
        <Button
          onClick={handleGerarRecibo}
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Gerando recibo...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Gerar Recibo
            </>
          )}
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              onClick={handleDownloadRecibo}
              variant="outline"
              className="flex-1"
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar
            </Button>
            
            <Button
              onClick={() => window.open(reciboUrl, '_blank', 'noopener,noreferrer')}
              variant="outline"
              className="flex-1"
            >
              <Eye className="mr-2 h-4 w-4" />
              Ver
            </Button>
          </div>
          
          <Button
            onClick={handleEnviarRecibo}
            disabled={isSending}
            className="w-full"
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Enviar ao Cliente
              </>
            )}
          </Button>
          
          <Button
            onClick={handleGerarRecibo}
            disabled={isGenerating}
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Regenerando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-3 w-3" />
                Regenerar Recibo
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
